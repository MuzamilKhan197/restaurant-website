import { createServer } from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { Store, passwordMatches, hashPassword, digest } from './store.js';
import { ServiceError, availableSlots, createOrder, createReservation, createMessage, lookupRecord, publicRecord, cancelRecord, updateRecord, saveMenuDish, saveSettings } from './service.js';

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.webmanifest': 'application/manifest+json' };
const safeFiles = new Set(['index.html', '404.html', 'styles.css', 'app.js', 'data.js', 'admin.html', 'admin.js', 'admin.css', 'extras.js', 'robots.txt', 'manifest.webmanifest', 'lib/domain.js']);
const noBody = new Set(['GET', 'HEAD']);
const cookieName = 'se_admin';
const csvCell = value => { let cell = String(value ?? ''); if (/^[\s]*[=+@-]/.test(cell) || /^[\t\r\n]/.test(cell)) cell = `'${cell}`; return `"${cell.replaceAll('"', '""')}"`; };

async function readBody(req) {
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw new ServiceError(415, 'Send JSON with Content-Type application/json.');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 24 * 1024) throw new ServiceError(413, 'Request is too large.');
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new ServiceError(400, 'Invalid JSON request.'); }
}
function cookieToken(req) {
  const cookie = String(req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${cookieName}=`));
  return cookie?.slice(cookieName.length + 1) || '';
}
function authToken(req) { return String(req.headers.authorization || '').replace(/^Bearer /, ''); }

export function createApplication({ root, dbPath, adminPassword, adminEmail, publicOrigin = '', now = () => new Date(), store: existingStore } = {}) {
  if (!root || (!dbPath && !existingStore)) throw new Error('A project root and database path are required.');
  const store = existingStore || new Store(dbPath, { adminPassword, adminEmail });
  const staticRoot = resolve(root);
  const configuredURL = publicOrigin ? new URL(publicOrigin) : null;
  const json = (res, status, data, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers }); res.end(JSON.stringify(data)); };
  const cookie = (token, clear = false) => `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${clear ? 0 : 28800}${configuredURL?.protocol === 'https:' ? '; Secure' : ''}`;

  const handler = async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const hostAllowed = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || (configuredURL && url.host === configuredURL.host);
      if (!hostAllowed) throw new ServiceError(403, 'Unrecognized host.');
      const path = decodeURIComponent(url.pathname);
      if (!noBody.has(req.method)) {
        const origin = req.headers.origin;
        const allowedOrigins = new Set([`http://${url.host}`, ...(configuredURL ? [configuredURL.origin] : [])]);
        if ((origin && !allowedOrigins.has(origin)) || req.headers['sec-fetch-site'] === 'cross-site') throw new ServiceError(403, 'Cross-site requests are not allowed.');
      }
      const ipKey = digest(req.socket?.remoteAddress || 'local');
      if (path.startsWith('/api/')) {
        if (req.method === 'OPTIONS') throw new ServiceError(405, 'Cross-origin access is not supported.');
        const isAdmin = path.startsWith('/api/admin/');
        if (isAdmin && path !== '/api/admin/login' && !store.validSession(cookieToken(req))) throw new ServiceError(401, 'Please sign in to the management dashboard.');
        if (path === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true, storage: 'sqlite', notifications: 'not_configured', onlinePayments: 'not_configured' });
        if (path === '/api/config' && req.method === 'GET') return json(res, 200, { restaurant: store.settings, mode: 'local', paymentMethods: ['cash'], notifications: false });
        if (path === '/api/menu' && req.method === 'GET') return json(res, 200, { dishes: store.getMenu() });
        if (path === '/api/availability' && req.method === 'GET') return json(res, 200, { slots: availableSlots(store, url.searchParams.get('date') || '', Number(url.searchParams.get('guests') || 1), now()) });
        if (['/api/orders', '/api/reservations', '/api/messages'].includes(path) && req.method === 'POST') {
          if (!store.rateLimit(`submit:${ipKey}`, 60, 15 * 60 * 1000)) throw new ServiceError(429, 'Too many requests. Please wait 15 minutes.');
          const body = await readBody(req);
          if (body.website) throw new ServiceError(422, 'Please leave the website field empty.');
          const key = req.headers['idempotency-key'];
          const response = path === '/api/orders' ? createOrder(store, body, key, now()) : path === '/api/reservations' ? createReservation(store, body, key, now()) : createMessage(store, body, key);
          return json(res, 201, response);
        }
        const guestRecord = path.match(/^\/api\/(orders|reservations)\/([A-Z0-9-]+)(\/cancel)?$/);
        if (guestRecord && (req.method === 'GET' || (req.method === 'POST' && guestRecord[3]))) {
          if (!store.rateLimit(`lookup:${ipKey}`, 180, 15 * 60 * 1000)) throw new ServiceError(429, 'Too many lookups. Please try later.');
          if (req.method === 'POST') await readBody(req);
          const [, kind, id] = guestRecord;
          return json(res, 200, { record: req.method === 'POST' ? cancelRecord(store, kind, id, authToken(req), now()) : publicRecord(kind, lookupRecord(store, kind, id, authToken(req))) });
        }
        if (path === '/api/admin/login' && req.method === 'POST') {
          if (!store.rateLimit(`login:${ipKey}`, 12, 15 * 60 * 1000)) throw new ServiceError(429, 'Too many sign-in attempts. Wait 15 minutes.');
          const body = await readBody(req);
          const validPassword = passwordMatches(body.password, store.getMeta('adminPassword'));
          if (!validPassword || typeof body.email !== 'string' || body.email.trim().toLowerCase() !== store.getMeta('adminEmail')) throw new ServiceError(401, 'Email or password is incorrect.');
          const token = store.createSession(); store.audit('admin.signed_in', 'admin');
          return json(res, 200, { email: store.getMeta('adminEmail') }, { 'Set-Cookie': cookie(token) });
        }
        if (path === '/api/admin/session' && req.method === 'GET') return json(res, 200, { email: store.getMeta('adminEmail') });
        if (path === '/api/admin/logout' && req.method === 'POST') { await readBody(req); store.deleteSession(cookieToken(req)); return json(res, 200, { ok: true }, { 'Set-Cookie': cookie('', true) }); }
        if (path === '/api/admin/password' && req.method === 'POST') {
          if (!store.rateLimit(`password:${ipKey}`, 8, 15 * 60 * 1000)) throw new ServiceError(429, 'Too many password attempts. Please wait.');
          const body = await readBody(req);
          if (!passwordMatches(body.currentPassword, store.getMeta('adminPassword'))) throw new ServiceError(422, 'Current password is incorrect.');
          if (typeof body.newPassword !== 'string' || body.newPassword.length < 12 || body.newPassword.length > 200) throw new ServiceError(422, 'Use a new password with 12-200 characters.');
          store.transaction(() => { store.setMeta('adminPassword', hashPassword(body.newPassword)); store.db.exec('DELETE FROM sessions'); store.audit('admin.password_changed', 'admin'); });
          return json(res, 200, { ok: true }, { 'Set-Cookie': cookie('', true) });
        }
        if (path === '/api/admin/overview' && req.method === 'GET') {
          const orders = store.all('orders'); const reservations = store.all('reservations'); const messages = store.all('messages');
          return json(res, 200, { totalOrders: orders.length, pendingOrders: orders.filter(row => row.status === 'pending').length, activeReservations: reservations.filter(row => ['pending', 'confirmed', 'seated'].includes(row.status)).length, unreadMessages: messages.filter(row => row.status === 'new').length, collectedRevenue: orders.filter(row => row.paymentStatus === 'paid').reduce((sum, row) => sum + row.totals.total, 0), notifications: 'Not connected', onlinePayments: 'Not connected', database: 'SQLite - persistent local storage' });
        }
        const adminList = path.match(/^\/api\/admin\/(orders|reservations|messages)(?:\/([A-Z0-9-]+))?$/);
        if (adminList && req.method === 'GET' && !adminList[2]) {
          const query = (url.searchParams.get('q') || '').toLowerCase().slice(0, 200); const status = url.searchParams.get('status') || '';
          const page = Math.max(1, Math.min(1000000, Math.floor(Number(url.searchParams.get('page')) || 1)));
          const rows = store.all(adminList[1]).filter(row => (!status || row.status === status) && (!query || `${row.id} ${row.name} ${row.email} ${row.phone || ''} ${row.date || ''} ${row.subject || ''}`.toLowerCase().includes(query))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          return json(res, 200, { rows: rows.slice((page - 1) * 30, page * 30), total: rows.length, page, pages: Math.ceil(rows.length / 30) });
        }
        if (adminList && req.method === 'PATCH' && adminList[2]) return json(res, 200, { record: updateRecord(store, adminList[1], adminList[2], await readBody(req)) });
        if (path === '/api/admin/menu' && req.method === 'GET') return json(res, 200, { dishes: store.getMenu(true) });
        if (path === '/api/admin/menu' && req.method === 'POST') return json(res, 201, { dish: saveMenuDish(store, await readBody(req)) });
        const menuItem = path.match(/^\/api\/admin\/menu\/([a-z0-9-]+)$/);
        if (menuItem && req.method === 'PATCH') return json(res, 200, { dish: saveMenuDish(store, await readBody(req), menuItem[1]) });
        if (path === '/api/admin/settings' && req.method === 'GET') return json(res, 200, { settings: store.settings, version: store.getMeta('settingsVersion') });
        if (path === '/api/admin/settings' && req.method === 'PUT') return json(res, 200, saveSettings(store, await readBody(req)));
        if (path === '/api/admin/audit' && req.method === 'GET') return json(res, 200, { rows: store.db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 100').all() });
        if (path === '/api/admin/export' && req.method === 'GET') {
          const kind = url.searchParams.get('kind');
          if (!['orders', 'reservations', 'messages'].includes(kind)) throw new ServiceError(422, 'Choose an export type.');
          const rows = store.all(kind);
          const fields = kind === 'orders' ? ['id', 'createdAt', 'status', 'name', 'email', 'phone', 'method', 'address', 'area', 'paymentStatus', 'currency', 'total'] : kind === 'reservations' ? ['id', 'createdAt', 'status', 'name', 'email', 'phone', 'date', 'time', 'guests', 'requests'] : ['id', 'createdAt', 'status', 'name', 'email', 'subject', 'message'];
          const csv = [fields.map(csvCell).join(','), ...rows.map(row => fields.map(field => csvCell(field === 'total' ? row.totals.total : row[field])).join(','))].join('\r\n');
          res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${kind}.csv"` }); res.end('\uFEFF' + csv); return;
        }
        throw new ServiceError(404, 'API route not found.');
      }
      if (!noBody.has(req.method)) throw new ServiceError(405, 'Method not allowed.');
      const relative = path === '/' ? 'index.html' : path === '/admin' || path === '/admin/' ? 'admin.html' : path.slice(1);
      if ((!safeFiles.has(relative) && !/^assets\/[a-zA-Z0-9._-]+\.(jpg|png|svg|webp|woff2|ttf)$/.test(relative)) || relative.includes('..') || relative.includes('\\')) throw new ServiceError(404, 'Not found.');
      const file = resolve(staticRoot, relative);
      if (!file.startsWith(staticRoot + sep) || !(await stat(file)).isFile() || !(await realpath(file)).startsWith((await realpath(staticRoot)) + sep)) throw new ServiceError(404, 'Not found.');
      const content = await readFile(file);
      res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': /\.(jpg|woff2|ttf)$/.test(file) ? 'public, max-age=86400' : 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      const status = error.status || (error.code === 'ENOENT' || error instanceof URIError ? 404 : 500);
      if (status === 404 && !req.url.startsWith('/api/')) {
        try { const page = await readFile(resolve(staticRoot, '404.html')); res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(req.method === 'HEAD' ? undefined : page); return; } catch { /* Fall back to JSON when the page is unavailable. */ }
      }
      json(res, status, { error: status === 500 ? 'Something went wrong. Please try again.' : error.message, fields: error.fields || {} });
    }
  };
  const server = createServer(handler); server.requestTimeout = 15000; server.headersTimeout = 10000;
  return { server, handler, store };
}
