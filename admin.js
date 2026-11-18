import { formatMoney } from './lib/domain.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const label = value => String(value).replaceAll('_', ' ');
let activeTab = 'overview';
let rows = [];
let menu = [];
let settings;
let settingsVersion;
let page = 1;
let query = '';
let status = '';
let selected;
let loadSequence = 0;
const titles = { overview: 'Overview', orders: 'Orders', reservations: 'Reservations', messages: 'Message inbox', menu: 'Menu & availability', settings: 'Business settings', audit: 'Activity log' };
const statuses = { orders: ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled'], reservations: ['pending', 'confirmed', 'seated', 'completed', 'no_show', 'cancelled'], messages: ['new', 'read', 'archived'] };
const transitions = { orders: { pending: ['confirmed', 'cancelled'], confirmed: ['preparing', 'cancelled'], preparing: ['ready', 'cancelled'], ready: ['out_for_delivery', 'completed', 'cancelled'], out_for_delivery: ['completed', 'cancelled'], completed: [], cancelled: [] }, reservations: { pending: ['confirmed', 'cancelled'], confirmed: ['seated', 'no_show', 'cancelled'], seated: ['completed'], completed: [], no_show: [], cancelled: [] }, messages: { new: ['read', 'archived'], read: ['archived', 'new'], archived: ['read'] } };
const date = value => new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Karachi', dateStyle: 'medium', timeStyle: 'short' });
const money = value => formatMoney(value, { locale: 'en-PK', currency: 'PKR' });
function feedback(message = '', error = false) { $('#admin-feedback').textContent = message; $('#admin-feedback').classList.toggle('error', error); }
function loginView() {
  $('#login-view').hidden = false; $('#dashboard-view').hidden = true; $('#logout').hidden = true; $('#admin-email').textContent = '';
  rows = []; menu = []; selected = null; settings = null;
  $('#admin-content').innerHTML = ''; $('#admin-record-detail').innerHTML = '';
  $$('dialog[open]').forEach(dialog => dialog.close());
}
async function request(path, options = {}) {
  const response = await fetch(`/api/admin/${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, signal: AbortSignal.timeout(12000) });
  let data;
  try { data = await response.json(); } catch { throw new Error('The restaurant server is unavailable. Start npm run dev and reload.'); }
  if (!response.ok) {
    if (response.status === 401 && path !== 'login') loginView();
    throw Object.assign(new Error(data.error || 'Please try again.'), { status: response.status });
  }
  return data;
}
function dashboard(email) {
  $('#login-view').hidden = true; $('#dashboard-view').hidden = false; $('#logout').hidden = false; $('#admin-email').textContent = email;
  $('#login-form').reset(); $('#login-error').textContent = '';
  loadTab();
}
function empty(title, copy) { return `<div class="admin-empty"><h2>${title}</h2><p>${copy}</p></div>`; }
function badge(value) { return `<span class="status-badge status-${escape(value)}">${escape(label(value))}</span>`; }

async function loadTab() {
  const sequence = ++loadSequence;
  const tab = activeTab;
  $('#admin-page-title').textContent = titles[tab];
  $$('[data-tab]').forEach(button => { if (button.dataset.tab === tab) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
  $('#admin-content').setAttribute('aria-busy', 'true');
  feedback();
  try {
    let html = '';
    if (tab === 'overview') {
      const data = await request('overview'); if (sequence !== loadSequence) return;
      html = `<div class="stats-grid">${[['Pending orders', data.pendingOrders], ['Active reservations', data.activeReservations], ['Unread messages', data.unreadMessages], ['Total orders', data.totalOrders]].map(([name, value]) => `<div class="stat-card"><span>${name}</span><strong>${value}</strong></div>`).join('')}</div><div class="admin-card"><h2>A clear picture.</h2><div class="totals-row"><span>Payments recorded as collected</span><strong>${money(data.collectedRevenue)}</strong></div><p>These are actual saved records. Unpaid orders, refunds due and refunded payments are excluded from collected revenue.</p></div><div class="admin-card"><h2>Service connections</h2><div class="integration-list"><p><strong>Storage</strong>${escape(data.database)}</p><p><strong>Online payments</strong>${escape(data.onlinePayments)}. Payment on collection/delivery is available.</p><p><strong>Email &amp; SMS</strong>${escape(data.notifications)}. Check this dashboard for new requests.</p><p><strong>Customer tracking</strong>Reference and private key. Customers can refresh status under My requests.</p></div></div><div class="admin-card admin-warning"><h2>Before serving real customers</h2><p>Replace the sample business details, verify menu prices and allergens, set opening hours and capacity, and configure your actual delivery areas. The website currently represents a sample business. No email or payment provider is connected.</p><button class="button button-small" data-tab="settings">Review business settings &rarr;</button></div>`;
    } else if (['orders', 'reservations', 'messages'].includes(tab)) {
      const data = await request(`${tab}?page=${page}&q=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}`); if (sequence !== loadSequence) return;
      rows = data.rows;
      html = `<form id="list-filter" class="admin-toolbar"><label class="sr-only" for="admin-search">Search records</label><input id="admin-search" type="search" name="q" value="${escape(query)}" placeholder="Search reference, name, email or date..."><label class="sr-only" for="admin-status-filter">Filter status</label><select id="admin-status-filter" name="status"><option value="">All statuses</option>${statuses[tab].map(value => `<option value="${value}" ${status === value ? 'selected' : ''}>${label(value)}</option>`).join('')}</select><button class="button button-small" type="submit">Search</button><a class="button button-small button-outline" href="/api/admin/export?kind=${tab}" download>Export CSV</a></form>${rows.length ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Reference &amp; received</th><th>Guest</th><th>${tab === 'orders' ? 'Method & total' : tab === 'reservations' ? 'Visit' : 'Subject'}</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map(row => `<tr><td><strong>${escape(row.id)}</strong><small>${date(row.createdAt)} PKT</small></td><td><strong>${escape(row.name)}</strong><small>${escape(row.email)}</small></td><td>${tab === 'orders' ? `${escape(row.method)}<small>${money(row.totals.total)} &middot; ${escape(label(row.paymentStatus))}</small>` : tab === 'reservations' ? `${escape(row.date)} ${escape(row.time)}<small>${row.guests} guests</small>` : escape(row.subject)}</td><td>${badge(row.status)}</td><td><button class="text-button" data-view-record="${row.id}">View details</button></td></tr>`).join('')}</tbody></table></div>` : empty('Nothing here yet.', query || status ? 'Try a different search or status filter.' : 'New requests will appear here when guests submit them.')}<div class="admin-pagination"><span>${data.total} records &middot; Page ${page} of ${Math.max(1, data.pages)}</span><div><button class="button button-small button-outline" data-page-change="-1" ${page <= 1 ? 'disabled' : ''}>Previous</button><button class="button button-small button-outline" data-page-change="1" ${page >= data.pages ? 'disabled' : ''}>Next</button></div></div>`;
    } else if (tab === 'menu') {
      const data = await request('menu'); if (sequence !== loadSequence) return; menu = data.dishes;
      html = `<div class="admin-toolbar"><p class="small">${menu.length} dishes &middot; prices in PKR</p><button class="button button-small" id="new-dish">Add a dish +</button></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Image</th><th>Dish</th><th>Price</th><th>Availability</th><th>Visibility</th><th>Action</th></tr></thead><tbody>${menu.map(dish => `<tr><td><img src="assets/${dish.image}.jpg" alt="" width="45" height="45"></td><td><strong>${escape(dish.name)}</strong><small>${escape(dish.category)}</small></td><td>${money(dish.price)}</td><td>${badge(dish.available ? 'available' : 'sold_out')}</td><td>${dish.active ? 'Listed' : 'Archived'}${dish.featured ? '<small>Featured</small>' : ''}</td><td><button class="text-button" data-edit-dish="${dish.id}">Edit</button></td></tr>`).join('')}</tbody></table></div>`;
    } else if (tab === 'settings') {
      const data = await request('settings'); if (sequence !== loadSequence) return; settings = data.settings; settingsVersion = data.version;
      html = settingsHTML();
    } else if (tab === 'audit') {
      const data = await request('audit'); if (sequence !== loadSequence) return;
      html = `<p class="small">The latest 100 administrative and request events. Passwords and private keys are never written to this log.</p><div class="admin-card">${data.rows.length ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Time (Pakistan)</th><th>Action</th><th>Reference</th></tr></thead><tbody>${data.rows.map(row => `<tr><td>${date(row.created_at)}</td><td>${escape(row.action)}</td><td>${escape(row.target)}</td></tr>`).join('')}</tbody></table></div>` : empty('No activity yet.', 'Changes and requests will appear here.')}</div>`;
    }
    if (sequence !== loadSequence) return;
    $('#admin-content').innerHTML = html;
    if (tab === 'settings') bindSettings();
  } catch (error) {
    if (sequence !== loadSequence) return;
    feedback(error.message, true);
    if (!$('#dashboard-view').hidden) $('#admin-content').innerHTML = empty('Unable to load this section.', 'Use Refresh to try again.');
  } finally { if (sequence === loadSequence) $('#admin-content').removeAttribute('aria-busy'); }
}

function settingsHTML() {
  const input = (name, title, type = 'text', extra = '') => `<label>${title}<input name="${name}" type="${type}" value="${escape(settings[name])}" ${extra}></label>`;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return `<form id="settings-form" class="settings-form"><section class="admin-card"><h2>Your business</h2><div class="settings-grid">${input('name', 'Restaurant name', 'text', 'required maxlength="80"')}${input('tagline', 'Tagline', 'text', 'maxlength="120"')}${input('location', 'Address / location', 'text', 'required maxlength="200"')}${input('locationNote', 'Location note', 'text', 'maxlength="200"')}${input('email', 'Business email', 'email', 'required maxlength="150"')}${input('phone', 'Business phone', 'tel', 'maxlength="30"')}</div><div class="settings-toggles"><label><input type="checkbox" name="sampleBusiness" ${settings.sampleBusiness ? 'checked' : ''}> Show sample-business notices</label></div><p class="small">Only turn off sample notices after replacing fictional branding, photos, story and location with verified business content.</p></section><section class="admin-card"><h2>Ordering &amp; delivery</h2><div class="settings-toggles">${[['orderingEnabled', 'Accept order requests'], ['deliveryEnabled', 'Offer delivery'], ['reservationsEnabled', 'Accept table requests']].map(([key, title]) => `<label><input type="checkbox" name="${key}" ${settings[key] ? 'checked' : ''}> ${title}</label>`).join('')}</div><div class="settings-grid">${input('deliveryFee', 'Delivery fee (PKR)', 'number', 'required min="0" max="100000" step="1"')}${input('minimumDelivery', 'Minimum delivery subtotal (PKR)', 'number', 'required min="0" max="1000000" step="1"')}<label>Tax rate (%)<input name="taxPercent" type="number" min="0" max="100" step="0.01" required value="${settings.taxRate * 100}"></label><label>Delivery areas (one per line)<textarea name="deliveryAreas" rows="4">${escape(settings.deliveryAreas.join('\n'))}</textarea></label></div><p class="small">Taxes are calculated on the item subtotal. Delivery is added separately. Staff should verify applicable rates before accepting real orders.</p></section><section class="admin-card"><h2>Tables &amp; opening hours</h2><div class="settings-grid">${input('seatCapacity', 'Total seat capacity', 'number', 'required min="1" max="500" step="1"')}${input('maxPartySize', 'Maximum party size', 'number', 'required min="1" max="100" step="1"')}${input('reservationDuration', 'Visit duration (minutes)', 'number', 'required min="30" max="180" step="1"')}${input('maxBookingDays', 'Booking window (days)', 'number', 'required min="1" max="365" step="1"')}<label class="wide">Closed dates (one YYYY-MM-DD per line)<textarea name="closedDates" rows="3" placeholder="2026-12-25">${escape(settings.closedDates.join('\n'))}</textarea></label></div><p class="small">All hours use Asia/Karachi. The final arrival plus visit duration must fit before closing. Capacity checks use overlapping visits, not a physical table layout.</p>${days.map((day, i) => { const hours = settings.hours[i]; return `<div class="hours-editor" data-day="${i}"><strong>${day}</strong><label class="closed-toggle"><input type="checkbox" name="closed-${i}" ${!hours ? 'checked' : ''}> Closed</label><label>Open<input type="time" name="open-${i}" value="${hours?.open || '12:00'}"></label><label>Close<input type="time" name="close-${i}" value="${hours?.close || '22:00'}"></label><label>Last arrival<input type="time" name="last-${i}" value="${hours?.lastBooking || '21:00'}"></label></div>`; }).join('')}</section><p id="settings-error" class="submission-error" role="alert"></p><button class="button" type="submit">Save business settings &rarr;</button></form><section class="admin-card"><h2>Change your password</h2><form id="password-form" class="password-form"><label>Current password<input name="currentPassword" type="password" autocomplete="current-password" required maxlength="200"></label><label>New password<input name="newPassword" type="password" autocomplete="new-password" required minlength="12" maxlength="200"></label><label>Confirm new password<input name="confirmPassword" type="password" autocomplete="new-password" required minlength="12" maxlength="200"></label><p class="small">Changing your password signs out all sessions. The new password is stored as a hash in the database; the original .env password will no longer work.</p><p id="password-error" class="submission-error" role="alert"></p><button class="button button-small" type="submit">Change password</button></form></section><section class="admin-card"><h2>Backups &amp; service setup</h2><p>Use the project command <code>npm run backup</code> to create a consistent database snapshot in the backups folder. Backups and exports contain personal data; keep them private.</p><p>Online payments, email and SMS require a selected provider and its credentials. This installation uses payment on collection/delivery and in-dashboard request management.</p></section>`;
}
function bindSettings() {
  $('#settings-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form));
    for (const name of ['deliveryFee', 'minimumDelivery', 'seatCapacity', 'maxPartySize', 'maxBookingDays', 'reservationDuration']) values[name] = Number(values[name]);
    for (const name of ['orderingEnabled', 'reservationsEnabled', 'deliveryEnabled', 'sampleBusiness']) values[name] = form.elements[name].checked;
    values.deliveryAreas = values.deliveryAreas.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    values.closedDates = values.closedDates.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    values.taxRate = Number(values.taxPercent) / 100; values.version = settingsVersion; values.hours = {};
    for (let day = 0; day < 7; day++) values.hours[day] = form.elements[`closed-${day}`].checked ? null : { open: values[`open-${day}`], close: values[`close-${day}`], lastBooking: values[`last-${day}`] };
    const button = form.querySelector('[type=submit]'); button.disabled = true;
    try { const result = await request('settings', { method: 'PUT', body: JSON.stringify(values) }); settings = result.settings; settingsVersion = result.version; feedback('Business settings saved. Refresh the public website to see changes.'); $('#settings-error').textContent = ''; }
    catch (error) { $('#settings-error').textContent = error.message; }
    finally { button.disabled = false; }
  });
  $('#password-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form));
    if (values.newPassword !== values.confirmPassword) { $('#password-error').textContent = 'New passwords must match.'; return; }
    const button = form.querySelector('[type=submit]'); button.disabled = true;
    try { await request('password', { method: 'POST', body: JSON.stringify(values) }); form.reset(); loginView(); $('#login-error').textContent = 'Password changed. Sign in using your new password.'; }
    catch (error) { $('#password-error').textContent = error.message; }
    finally { button.disabled = false; }
  });
}
function editDish(dish) {
  const form = $('#dish-form'); form.reset(); $('#dish-error').textContent = '';
  form.elements.id.value = ''; form.elements.version.value = '';
  for (const name of ['id', 'version', 'name', 'description', 'category', 'price', 'allergens', 'image']) if (dish?.[name] !== undefined) form.elements[name].value = dish[name];
  for (const name of ['available', 'active', 'featured']) form.elements[name].checked = dish ? dish[name] : name !== 'featured';
  form.querySelectorAll('[name=tags]').forEach(input => { input.checked = dish?.tags.includes(input.value) || false; });
  $('#dish-dialog-title').textContent = dish ? 'Edit dish' : 'Add a dish';
  $('#dish-dialog').showModal();
}
function viewRecord(record) {
  selected = record; const kind = activeTab;
  const options = (transitions[kind][record.status] || []).filter(value => !(kind === 'orders' && record.method === 'pickup' && value === 'out_for_delivery'));
  $('#record-dialog-title').textContent = record.id;
  $('#admin-record-detail').innerHTML = `${badge(record.status)}<dl class="admin-record-meta">${[['Guest', record.name], ['Email', record.email], ['Phone', record.phone || '-'], ['Received (Pakistan)', date(record.createdAt)], ...(kind === 'orders' ? [['Method', record.method], ['Payment', label(record.paymentStatus)], ['Address', record.address || 'Pickup'], ['Area', record.area || '-']] : kind === 'reservations' ? [['Visit (Pakistan)', `${record.date} ${record.time}`], ['Guests', record.guests], ['Visit duration', `${record.duration} minutes`]] : [['Subject', record.subject]])].map(([title, value]) => `<div><dt>${title}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>${kind === 'orders' ? `<div class="receipt-lines">${record.items.map(item => `<div><span>${item.quantity} &times; ${escape(item.name)}</span><strong>${money(item.price * item.quantity)}</strong></div>`).join('')}<div><span>Delivery</span><span>${money(record.totals.delivery)}</span></div><div><span>Tax</span><span>${money(record.totals.tax)}</span></div><div class="receipt-total"><span>Total</span><strong>${money(record.totals.total)}</strong></div></div>` : ''}${record.notes || record.requests || record.message ? `<div class="record-note">${escape(record.notes || record.requests || record.message)}</div>` : ''}<form id="record-update-form" class="record-admin-actions">${options.length ? `<label class="sr-only" for="next-status">Change status</label><select id="next-status" name="status"><option value="">Choose next status</option>${options.map(value => `<option value="${value}">${label(value)}</option>`).join('')}</select><button class="button button-small" type="submit">Update status</button>` : '<p class="small">No further status changes are available.</p>'}${kind === 'orders' && record.paymentStatus === 'unpaid' && record.status !== 'cancelled' ? '<button class="button button-small button-outline" type="button" id="mark-paid">Record payment collected</button>' : ''}${kind === 'orders' && record.paymentStatus === 'refund_due' ? '<button class="button button-small button-outline" type="button" id="mark-refunded">Record refund completed</button>' : ''}</form><p class="small">Payment and refund actions record staff handling only; they do not move money. Cancellation is applied immediately.</p><p class="submission-error" id="record-update-error" role="alert"></p>`;
  if (!$('#record-dialog').open) $('#record-dialog').showModal();
  else $('#record-dialog [data-close-admin]').focus();
}
async function updateSelected(values) {
  const kind = activeTab;
  $$('#record-update-form button').forEach(button => { button.disabled = true; });
  try {
    const response = await request(`${kind}/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ ...values, version: selected.version }) });
    const index = rows.findIndex(row => row.id === selected.id); if (index >= 0) rows[index] = response.record;
    viewRecord(response.record); feedback('Record updated.');
  } catch (error) { $('#record-update-error').textContent = error.message; $$('#record-update-form button').forEach(button => { button.disabled = false; }); }
}

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('[type=submit]'); button.disabled = true; $('#login-error').textContent = '';
  try { const result = await request('login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); dashboard(result.email); }
  catch (error) { $('#login-error').textContent = error.message; form.elements.password.value = ''; }
  finally { button.disabled = false; }
});
$('#logout').addEventListener('click', async () => { try { await request('logout', { method: 'POST', body: '{}' }); loginView(); } catch (error) { feedback(error.message, true); } });
$('#admin-refresh').addEventListener('click', loadTab);
$('#dish-form').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form));
  values.price = Number(values.price); values.version = Number(values.version); values.tags = [...form.querySelectorAll('[name=tags]:checked')].map(input => input.value);
  for (const name of ['available', 'active', 'featured']) values[name] = form.elements[name].checked;
  const button = form.querySelector('[type=submit]'); button.disabled = true;
  try { await request(values.id ? `menu/${values.id}` : 'menu', { method: values.id ? 'PATCH' : 'POST', body: JSON.stringify(values) }); $('#dish-dialog').close(); await loadTab(); feedback('Dish saved.'); }
  catch (error) { $('#dish-error').textContent = error.message; }
  finally { button.disabled = false; }
});
document.addEventListener('submit', event => {
  if (event.target.id === 'list-filter') { event.preventDefault(); const form = event.target; query = form.elements.q.value; status = form.elements.status.value; page = 1; loadTab(); }
  if (event.target.id === 'record-update-form') { event.preventDefault(); const next = event.target.elements.status?.value; if (next) updateSelected({ status: next }); }
});
document.addEventListener('change', event => { if (event.target.id === 'admin-status-filter') { status = event.target.value; query = $('#admin-search').value; page = 1; loadTab(); } });
document.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.hasAttribute('data-tab')) { activeTab = button.dataset.tab; page = 1; query = ''; status = ''; loadTab(); }
  if (button.hasAttribute('data-page-change')) { page += Number(button.dataset.pageChange); loadTab(); }
  if (button.id === 'new-dish') editDish();
  if (button.hasAttribute('data-edit-dish')) editDish(menu.find(dish => dish.id === button.dataset.editDish));
  if (button.hasAttribute('data-view-record')) viewRecord(rows.find(row => row.id === button.dataset.viewRecord));
  if (button.hasAttribute('data-close-admin')) button.closest('dialog').close();
  if (button.id === 'mark-paid') updateSelected({ paymentStatus: 'paid' });
  if (button.id === 'mark-refunded') updateSelected({ paymentStatus: 'refunded' });
});
$$('dialog').forEach(dialog => dialog.addEventListener('close', () => { if (dialog.id === 'record-dialog' && !$('#dashboard-view').hidden) loadTab(); }));
try { const session = await request('session'); dashboard(session.email); } catch (error) { loginView(); if (error.status !== 401) $('#login-error').textContent = error.message; }
