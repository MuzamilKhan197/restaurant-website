import { api, toast, escape, ready } from './app.js';
import { formatMoney } from './lib/domain.js';

const $ = selector => document.querySelector(selector);
let current;
const label = value => String(value).replaceAll('_', ' ');
function references() {
  try {
    const data = JSON.parse(localStorage.getItem('se-references-v1') || '[]');
    return Array.isArray(data) ? data.filter(item => item && ['orders', 'reservations'].includes(item.kind) && /^[A-Z0-9-]{10,60}$/.test(item.id) && /^[a-f0-9]{64}$/.test(item.token)).slice(0, 20) : [];
  } catch { return []; }
}
function renderReferences() {
  const entries = references();
  $('#recent-requests').innerHTML = entries.length ? entries.map((item, index) => `<button class="recent-request" data-reference="${index}"><span class="request-type">${item.kind === 'orders' ? 'ORDER' : 'TABLE REQUEST'}</span><strong>${escape(item.id)}</strong><span>Check status &rarr;</span></button>`).join('') : '<div class="empty-state"><h3>No saved requests yet.</h3><p>After submitting, your requests will appear here on this browser.</p><a class="text-link" href="#menu">Explore the menu &rarr;</a></div>';
  $('#clear-history').disabled = entries.length === 0;
}
async function track(kind, id, token) {
  $('#tracking-error').textContent = '';
  const button = $('#tracking-form [type=submit]');
  button.disabled = true;
  try {
    const result = await api(`/api/${kind}/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } });
    current = { kind, id, token, record: result.record };
    renderRecord();
  } catch (error) {
    $('#tracking-result').hidden = true;
    $('#tracking-error').textContent = error.message;
  } finally { button.disabled = false; }
}
function renderRecord() {
  const { kind, record } = current;
  const isOrder = kind === 'orders';
  const money = amount => formatMoney(amount, record);
  const cancellable = isOrder ? record.status === 'pending' : ['pending', 'confirmed'].includes(record.status);
  const result = $('#tracking-result');
  result.hidden = false;
  result.innerHTML = `<article class="record-card"><div class="section-heading"><div><p class="eyebrow">${isOrder ? 'YOUR ORDER REQUEST' : 'YOUR TABLE REQUEST'}</p><h2>${escape(record.id)}</h2></div><span class="status-badge status-${escape(record.status)}">${escape(label(record.status))}</span></div><p class="small">Saved ${escape(new Date(record.createdAt).toLocaleString())}. Status is updated by restaurant staff; no email or SMS is sent.</p>${record.status === 'pending' ? '<div class="demo-notice">Awaiting restaurant acceptance. This request is not yet confirmed.</div>' : ''}${isOrder ? `<div class="record-meta"><p><strong>Method</strong> ${escape(label(record.method))}</p><p><strong>Payment</strong> ${escape(label(record.paymentStatus))} &middot; pay on collection/delivery</p></div><div class="receipt-lines">${record.items.map(item => `<div><span>${item.quantity} &times; ${escape(item.name)}</span><span>${money(item.price * item.quantity)}</span></div>`).join('')}<div><span>Subtotal</span><span>${money(record.totals.subtotal)}</span></div><div><span>Delivery</span><span>${money(record.totals.delivery)}</span></div><div><span>Tax</span><span>${money(record.totals.tax)}</span></div><div class="receipt-total"><strong>Total</strong><strong>${money(record.totals.total)}</strong></div></div>` : `<dl class="result-details"><div><dt>Date</dt><dd>${escape(record.date)}</dd></div><div><dt>Arrival (Pakistan time)</dt><dd>${escape(record.time)}</dd></div><div><dt>Guests</dt><dd>${record.guests}</dd></div></dl>`}<div class="record-actions"><button class="button button-small" id="refresh-record">Refresh status</button>${isOrder ? '<button class="button button-small button-outline" id="download-receipt">Download summary</button><button class="button button-small button-outline" id="print-receipt">Print</button>' : ''}${cancellable ? '<button class="text-button danger" id="request-cancel">Cancel request</button>' : ''}</div><div id="cancel-confirmation" class="demo-notice" hidden><div><p>Cancel this request? Restaurant staff will see it as cancelled.</p><button class="button button-small" id="confirm-cancel">Confirm cancellation</button> <button class="text-button" id="keep-request">Keep request</button></div></div><p id="record-error" class="submission-error" role="alert"></p></article>`;
  result.focus();
}
function downloadSummary() {
  const { record } = current;
  const money = amount => formatMoney(amount, record);
  const contents = [`Saffron & Ember - Order summary (not a tax invoice)`, record.id, `Status: ${label(record.status)}`, `Payment: ${label(record.paymentStatus)}`, `Method: ${record.method}`, '', ...record.items.map(item => `${item.quantity} x ${item.name}: ${money(item.price * item.quantity)}`), '', `Subtotal: ${money(record.totals.subtotal)}`, `Delivery: ${money(record.totals.delivery)}`, `Tax: ${money(record.totals.tax)}`, `Total: ${money(record.totals.total)}`, '', 'This installation is a sample restaurant. No online payment has been processed.'].join('\n');
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${record.id}-summary.txt`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('#tracking-form').addEventListener('submit', event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  track(values.kind, values.reference.trim().toUpperCase(), values.token.trim());
});
document.addEventListener('click', async event => {
  if (event.target.closest('a[href="#manage"]')) renderReferences();
  const button = event.target.closest('button');
  if (!button) return;
  if (button.hasAttribute('data-reference')) {
    const item = references()[Number(button.dataset.reference)];
    if (item) track(item.kind, item.id, item.token);
  }
  if (button.id === 'refresh-record' && current) track(current.kind, current.id, current.token);
  if (button.id === 'clear-history') {
    try { localStorage.removeItem('se-references-v1'); renderReferences(); current = null; $('#tracking-result').innerHTML = ''; $('#tracking-result').hidden = true; $('#tracking-form').reset(); toast('Saved browser keys cleared. Database requests are unchanged.'); }
    catch { toast('Browser storage is unavailable.'); }
  }
  if (button.id === 'request-cancel') $('#cancel-confirmation').hidden = false;
  if (button.id === 'keep-request') $('#cancel-confirmation').hidden = true;
  if (button.id === 'confirm-cancel' && current) {
    button.disabled = true;
    try {
      const response = await api(`/api/${current.kind}/${encodeURIComponent(current.id)}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${current.token}` }, body: '{}' });
      current.record = response.record; renderRecord(); toast('Your request has been cancelled.');
    } catch (error) { $('#record-error').textContent = error.message; button.disabled = false; }
  }
  if (button.id === 'download-receipt' && current?.kind === 'orders') downloadSummary();
  if (button.id === 'print-receipt') window.print();
  if (button.hasAttribute('data-gallery')) {
    const large = $('#gallery-large'); large.src = `assets/${button.dataset.gallery}.jpg`; large.alt = button.dataset.caption;
    $('#gallery-caption').textContent = button.dataset.caption;
    $('#gallery-dialog').showModal(); document.body.classList.add('dialog-open');
  }
  if (button.hasAttribute('data-gallery-close')) $('#gallery-dialog').close();
});
window.addEventListener('hashchange', () => { if (location.hash === '#manage') renderReferences(); });
window.addEventListener('storage', event => { if (event.key === 'se-references-v1' || event.key === null) renderReferences(); });
await ready;
renderReferences();
