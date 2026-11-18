import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { resolve, join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { Store } from '../server/store.js';
import { createApplication } from '../server/http.js';
import { createOrder, createReservation, availableSlots, cancelRecord, lookupRecord, updateRecord, saveMenuDish, saveSettings } from '../server/service.js';

const now = new Date('2026-11-15T10:15:00Z');
const contact = { name: 'Test Guest', email: 'test@example.com', phone: '+923001234567' };
const order = { ...contact, method: 'pickup', payment: 'cash', notes: '', cart: [{ id: 'chicken', quantity: 2 }], expectedTotal: 3900 };
const reservation = { ...contact, date: '2026-11-16', time: '18:00', guests: '2', requests: '' };
const key = suffix => `test-request-key-${suffix}`;
function store(t) { const value = new Store(':memory:', { adminPassword: 'long-test-password', adminEmail: 'admin@example.com' }); t.after(() => value.close()); return value; }

test('orders use server prices, persist snapshots and deduplicate retries', t => {
  const db = store(t);
  const first = createOrder(db, order, key('order'), now);
  const retry = createOrder(db, order, key('order'), now);
  assert.deepEqual(first, retry);
  assert.equal(db.all('orders').length, 1);
  assert.equal(first.record.totals.total, 3900);
  assert.equal(first.record.paymentStatus, 'unpaid');
  assert.equal(first.record.status, 'pending');
  assert.ok(!('email' in first.record));
  assert.throws(() => createOrder(db, { ...order, name: 'Different' }, key('order'), now), /already used/);
  assert.throws(() => createOrder(db, { ...order, expectedTotal: 1 }, key('tamper'), now), /Prices have changed/);
  assert.throws(() => createOrder(db, { ...order, cart: [{ id: 'chicken', quantity: 21 }] }, key('quantity'), now), /menu or bag/);
});

test('delivery area, minimum order, supported payment and sold-out items are enforced', t => {
  const db = store(t);
  assert.throws(() => createOrder(db, { ...order, method: 'delivery', area: 'Unknown', address: 'Sample test address' }, key('area'), now), error => Boolean(error.fields.area));
  assert.throws(() => createOrder(db, { ...order, method: 'delivery', area: 'Gulberg', address: 'Sample test address', cart: [{ id: 'coffee', quantity: 1 }], expectedTotal: 750 }, key('minimum'), now), /delivery minimum/);
  assert.throws(() => createOrder(db, { ...order, payment: 'card' }, key('payment'), now), error => Boolean(error.fields.payment));
  const dish = db.getMenu().find(dish => dish.id === 'chicken');
  saveMenuDish(db, { ...dish, available: false }, dish.id);
  assert.throws(() => createOrder(db, order, key('soldout'), now), /menu or bag/);
});

test('guest tracking requires a private key and excludes contact details', t => {
  const db = store(t);
  const created = createOrder(db, order, key('private'), now);
  assert.throws(() => lookupRecord(db, 'orders', created.record.id, 'a'.repeat(64)), /No matching record/);
  assert.throws(() => lookupRecord(db, 'reservations', created.record.id, created.token), /No matching record/);
  assert.equal(lookupRecord(db, 'orders', created.record.id, created.token).email, contact.email);
  assert.ok(!JSON.stringify(created.record).includes(contact.email));
});

test('reservation capacity covers overlapping visits and cancellation releases seats', t => {
  const db = store(t); db.setMeta('settings', { ...db.settings, seatCapacity: 4, maxPartySize: 4 });
  const first = createReservation(db, { ...reservation, guests: '4' }, key('capacity'), now);
  assert.ok(!availableSlots(db, reservation.date, 1, now).includes('18:30'));
  assert.ok(availableSlots(db, reservation.date, 4, now).includes('19:00'));
  assert.throws(() => createReservation(db, { ...reservation, time: '18:30', guests: '1' }, key('overbook'), now), /no longer has enough seats/);
  cancelRecord(db, 'reservations', first.record.id, first.token, now);
  assert.ok(availableSlots(db, reservation.date, 4, now).includes('18:30'));
});

test('capacity uses peak occupancy without adding non-overlapping guests together', t => {
  const db = store(t); db.setMeta('settings', { ...db.settings, seatCapacity: 4, maxPartySize: 4 });
  createReservation(db, { ...reservation, time: '17:30', guests: '2' }, key('peak-a'), now);
  createReservation(db, { ...reservation, time: '18:30', guests: '2' }, key('peak-b'), now);
  assert.ok(availableSlots(db, reservation.date, 2, now).includes('18:00'));
});

test('closed dates, disabled reservations and maximum duration are respected', t => {
  const db = store(t);
  db.setMeta('settings', { ...db.settings, closedDates: [reservation.date] });
  assert.deepEqual(availableSlots(db, reservation.date, 2, now), []);
  assert.throws(() => createReservation(db, reservation, key('closed'), now));
  db.setMeta('settings', { ...db.settings, closedDates: [], reservationDuration: 120 });
  assert.ok(!availableSlots(db, reservation.date, 2, now).includes('21:00'));
});

test('workflow rejects stale edits and invalid transitions, records refunds due', t => {
  const db = store(t);
  const created = createOrder(db, order, key('workflow'), now);
  let record = updateRecord(db, 'orders', created.record.id, { version: 1, status: 'confirmed' });
  assert.throws(() => updateRecord(db, 'orders', record.id, { version: 1, status: 'preparing' }), /changed/);
  assert.throws(() => updateRecord(db, 'orders', record.id, { version: record.version, status: 'completed' }), /not allowed/);
  assert.throws(() => cancelRecord(db, 'orders', record.id, created.token, now), /already being handled/);
  record = updateRecord(db, 'orders', record.id, { version: record.version, paymentStatus: 'paid' });
  record = updateRecord(db, 'orders', record.id, { version: record.version, status: 'cancelled' });
  assert.equal(record.paymentStatus, 'refund_due');
  record = updateRecord(db, 'orders', record.id, { version: record.version, paymentStatus: 'refunded' });
  assert.equal(record.paymentStatus, 'refunded');
});

test('menu updates preserve existing order prices and reject stale changes', t => {
  const db = store(t); const created = createOrder(db, order, key('snapshot'), now);
  const dish = db.getMenu().find(dish => dish.id === 'chicken');
  saveMenuDish(db, { ...dish, price: 2100, active: false }, dish.id);
  assert.equal(lookupRecord(db, 'orders', created.record.id, created.token).items[0].price, 1950);
  assert.ok(!db.getMenu().some(item => item.id === 'chicken'));
  assert.throws(() => saveMenuDish(db, dish, dish.id), /changed/);
});

test('settings validate hours, capacity, dates and versions', t => {
  const db = store(t); const settings = db.settings;
  assert.throws(() => saveSettings(db, { ...settings, version: 1, seatCapacity: 2 }), /Party size/);
  assert.throws(() => saveSettings(db, { ...settings, version: 1, closedDates: ['2026-11-31'] }), /closed dates/);
  assert.throws(() => saveSettings(db, { ...settings, version: 1, reservationDuration: 120 }), /last booking/);
  const saved = saveSettings(db, { ...settings, version: 1, orderingEnabled: false });
  assert.equal(saved.version, 2);
  assert.throws(() => createOrder(db, order, key('paused'), now), /paused/);
  assert.throws(() => saveSettings(db, { ...settings, version: 1 }), /changed/);
});

test('SQLite data survives closing and reopening the application', () => {
  const dir = mkdtempSync(join(tmpdir(), 'restaurant-test-')); const path = join(dir, 'test.sqlite');
  let db = new Store(path); const created = createOrder(db, order, key('restart'), now); db.close();
  db = new Store(path); assert.equal(db.all('orders').length, 1); assert.equal(lookupRecord(db, 'orders', created.record.id, created.token).totals.total, 3900); db.close();
  // Remove only this newly-created, uniquely-named test directory.
  assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + '\\') || resolve(dir).startsWith(resolve(tmpdir()) + '/'));
  rmSync(dir, { recursive: true, force: true });
});

async function call(app, url, { method = 'GET', body, cookie = '', headers = {}, raw } = {}) {
  const req = Readable.from(raw !== undefined ? [Buffer.from(raw)] : body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  req.url = url; req.method = method; req.socket = { remoteAddress: '127.0.0.1' };
  req.headers = { host: 'localhost:3000', 'content-type': 'application/json', origin: 'http://localhost:3000', cookie, ...headers };
  const responseHeaders = {}; let responseStatus = 200; let output;
  const res = { setHeader(key, value) { responseHeaders[key.toLowerCase()] = value; }, writeHead(status, extra = {}) { responseStatus = status; for (const [key, value] of Object.entries(extra)) responseHeaders[key.toLowerCase()] = value; }, end(value) { output = value?.toString() || ''; } };
  await app.handler(req, res);
  let data; try { data = JSON.parse(output); } catch { data = output; }
  return { status: responseStatus, headers: responseHeaders, data };
}

test('HTTP login protects management, uses private sessions, and logout revokes access', async t => {
  const app = createApplication({ root: resolve('.'), store: store(t), now: () => now });
  assert.equal((await call(app, '/api/admin/orders')).status, 401);
  assert.equal((await call(app, '/api/admin/login', { method: 'POST', body: { email: 'admin@example.com', password: 'wrong' } })).status, 401);
  const login = await call(app, '/api/admin/login', { method: 'POST', body: { email: 'admin@example.com', password: 'long-test-password' } });
  assert.equal(login.status, 200);
  assert.match(login.headers['set-cookie'], /HttpOnly; SameSite=Strict/);
  const cookie = login.headers['set-cookie'].split(';')[0];
  assert.equal((await call(app, '/api/admin/orders', { cookie })).status, 200);
  assert.equal((await call(app, '/api/admin/logout', { method: 'POST', body: {}, cookie })).status, 200);
  assert.equal((await call(app, '/api/admin/orders', { cookie })).status, 401);
});

test('HTTP rejects cross-site mutations, malformed JSON, oversized bodies and private files', async t => {
  const app = createApplication({ root: resolve('.'), store: store(t), now: () => now });
  assert.equal((await call(app, '/api/orders', { method: 'POST', body: order, headers: { origin: 'https://attacker.example' } })).status, 403);
  assert.equal((await call(app, '/api/orders', { method: 'POST', raw: '{bad' })).status, 400);
  assert.equal((await call(app, '/api/orders', { method: 'POST', raw: 'x'.repeat(25000) })).status, 413);
  assert.equal((await call(app, '/api/orders', { method: 'POST', body: order, headers: { 'content-type': 'text/plain' } })).status, 415);
  for (const path of ['/.env', '/storage/restaurant.sqlite', '/server/store.js', '/lib/../server/http.js', '/assets/CREDITS.md', '/assets/%2e%2e/server/store.js']) assert.equal((await call(app, path)).status, 404, path);
  assert.equal((await call(app, '/', { headers: { host: 'attacker.example' } })).status, 403);
});

test('HTTP creates and retrieves orders, messages and reservations with protected tracking', async t => {
  const app = createApplication({ root: resolve('.'), store: store(t), now: () => now });
  const created = await call(app, '/api/orders', { method: 'POST', body: order, headers: { 'idempotency-key': key('http-order') } });
  assert.equal(created.status, 201);
  const trackingURL = `/api/orders/${created.data.record.id}`;
  assert.equal((await call(app, trackingURL)).status, 404);
  const tracked = await call(app, trackingURL, { headers: { authorization: `Bearer ${created.data.token}` } });
  assert.equal(tracked.status, 200); assert.ok(!('phone' in tracked.data.record));
  assert.equal((await call(app, '/api/reservations', { method: 'POST', body: reservation, headers: { 'idempotency-key': key('http-reserve') } })).status, 201);
  const message = await call(app, '/api/messages', { method: 'POST', body: { ...contact, subject: 'General enquiry', message: 'This is a sample test enquiry.' }, headers: { 'idempotency-key': key('http-message') } });
  assert.equal(message.status, 201); assert.equal(app.store.all('messages').length, 1);
});

test('HTTP serves real public files and csv export neutralizes spreadsheet formula injection', async t => {
  const db = store(t); const app = createApplication({ root: resolve('.'), store: db, now: () => now });
  assert.equal((await call(app, '/')).status, 200); assert.equal((await call(app, '/admin')).status, 200);
  assert.match((await call(app, '/app.js')).headers['content-type'], /javascript/);
  assert.equal((await call(app, '/assets/hero.jpg')).status, 200);
  createOrder(db, { ...order, name: '=SUM(1,2)' }, key('csv'), now);
  const login = await call(app, '/api/admin/login', { method: 'POST', body: { email: 'admin@example.com', password: 'long-test-password' } });
  const cookie = login.headers['set-cookie'].split(';')[0];
  const exported = await call(app, '/api/admin/export?kind=orders', { cookie });
  assert.equal(exported.status, 200); assert.ok(exported.data.includes("'=SUM(1,2)")); assert.match(exported.headers['content-disposition'], /orders.csv/);
});
