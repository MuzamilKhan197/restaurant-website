import test from 'node:test';
import assert from 'node:assert/strict';
import { restaurant, dishes } from '../data.js';
import { sanitizeCart, cartTotals, bookingSlots, validateReservation, localDateTime, shiftDate } from '../lib/domain.js';

const now = new Date('2026-11-15T10:15:00Z'); // Sunday, 15:15 in Pakistan.
const valid = { name: 'Demo Guest', email: 'guest@example.com', phone: '+92 300 1234567', date: '2026-11-16', time: '18:00', guests: '2', requests: '' };

test('restored carts reject unknown dishes, malformed quantities and injected prices', () => {
  assert.deepEqual(sanitizeCart([{ id: 'chicken', quantity: 2, price: 1 }, { id: 'unknown', quantity: 5 }, { id: 'pasta', quantity: -1 }, { id: 'cake', quantity: 1.5 }, null], dishes), [{ id: 'chicken', quantity: 2 }]);
  assert.deepEqual(sanitizeCart({ id: 'chicken', quantity: 1 }, dishes), []);
});

test('duplicate cart entries merge and quantities are capped', () => {
  assert.deepEqual(sanitizeCart([{ id: 'chicken', quantity: 12 }, { id: 'chicken', quantity: 15 }], dishes), [{ id: 'chicken', quantity: 20 }]);
});

test('mixed dish totals use trusted menu prices and correct quantities', () => {
  const totals = cartTotals([{ id: 'chicken', quantity: 2 }, { id: 'lemonade', quantity: 3 }], dishes, restaurant);
  assert.deepEqual(totals, { subtotal: 5250, delivery: 0, tax: 0, total: 5250, quantity: 5 });
});

test('delivery is charged once, and an empty bag never attracts delivery fees', () => {
  const cart = [{ id: 'pasta', quantity: 2 }];
  assert.equal(cartTotals(cart, dishes, restaurant, 'delivery').total, 3500);
  assert.equal(cartTotals(cart, dishes, restaurant, 'pickup').total, 3300);
  assert.deepEqual(cartTotals([], dishes, restaurant, 'delivery'), { subtotal: 0, delivery: 0, tax: 0, total: 0, quantity: 0 });
});

test('configured tax is rounded once on the subtotal', () => {
  const config = { ...restaurant, taxRate: 0.075 };
  const totals = cartTotals([{ id: 'cake', quantity: 1 }], dishes, config, 'delivery');
  assert.equal(totals.tax, 64);
  assert.equal(totals.total, 1114);
});

test('restaurant timezone advances the date at Pakistan midnight', () => {
  assert.deepEqual(localDateTime(new Date('2026-11-15T19:05:00Z'), restaurant.timeZone), { date: '2026-11-16', time: '00:05' });
});

test('date arithmetic works over year boundaries and leap days', () => {
  assert.equal(shiftDate('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftDate('2028-02-28', 1), '2028-02-29');
});

test('same-day booking excludes past times and the current minute', () => {
  const slots = bookingSlots('2026-11-15', restaurant, now);
  assert.equal(slots[0], '15:30');
  assert.equal(slots.at(-1), '21:00');
  assert.ok(!slots.includes('15:00'));
  assert.equal(bookingSlots('2026-11-15', restaurant, new Date('2026-11-15T10:30:00Z'))[0], '16:00');
});

test('Friday allows the later last booking while Sunday does not', () => {
  assert.equal(bookingSlots('2026-11-20', restaurant, now).at(-1), '22:00');
  assert.equal(bookingSlots('2026-11-22', restaurant, now).at(-1), '21:00');
});

test('booking dates reject impossible dates, past dates, closed days and distant dates', () => {
  for (const date of ['', '2026-11-31', '2026-11-14', '2027-06-01', 'invalid']) assert.deepEqual(bookingSlots(date, restaurant, now), []);
  const closedSunday = { ...restaurant, hours: { ...restaurant.hours, 0: null } };
  assert.deepEqual(bookingSlots('2026-11-15', closedSunday, now), []);
  const lastDate = shiftDate('2026-11-15', restaurant.maxBookingDays);
  assert.ok(bookingSlots(lastDate, restaurant, now).length > 0);
  assert.deepEqual(bookingSlots(shiftDate(lastDate, 1), restaurant, now), []);
});

test('a valid reservation passes without needing a backend', () => {
  assert.deepEqual(validateReservation(valid, restaurant, now), {});
});

test('reservation rejects fabricated time slots and oversized parties', () => {
  assert.ok(validateReservation({ ...valid, time: '18:17' }, restaurant, now).time);
  assert.ok(validateReservation({ ...valid, guests: '13' }, restaurant, now).guests);
  assert.ok(validateReservation({ ...valid, guests: '1.5' }, restaurant, now).guests);
  assert.ok(validateReservation({ ...valid, guests: '' }, restaurant, now).guests);
});

test('reservation validates contact details and prevents stale submissions', () => {
  const errors = validateReservation({ ...valid, name: ' ', email: 'guest@', phone: 'abc' }, restaurant, now);
  assert.ok(errors.name && errors.email && errors.phone);
  assert.ok(validateReservation(valid, restaurant, new Date('2026-11-17T00:00:00Z')).date);
  assert.ok(validateReservation({ ...valid, requests: 'x'.repeat(501) }, restaurant, now).requests);
});
