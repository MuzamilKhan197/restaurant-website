import { restaurant as defaultRestaurant, dishes as defaultDishes, categories } from './data.js';
import { formatMoney, sanitizeCart, cartTotals, localDateTime, shiftDate, bookingSlots, validateReservation } from './lib/domain.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const money = value => formatMoney(value, restaurant);
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const storageKey = 'saffron-ember-cart-v1';
let restaurant = structuredClone(defaultRestaurant);
let dishes = defaultDishes.map(dish => ({ ...dish, available: true }));
let serverReady = false;
let cart = [];
let storageAvailable = true;
let toastTimer;
let activeCategory = 'All dishes';

try { cart = sanitizeCart(JSON.parse(localStorage.getItem(storageKey) || '[]'), dishes); }
catch { storageAvailable = false; }

function toast(message) {
  clearTimeout(toastTimer);
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('visible');
  toastTimer = setTimeout(() => element.classList.remove('visible'), 3400);
}

function saveCart() {
  try { localStorage.setItem(storageKey, JSON.stringify(cart)); }
  catch {
    if (storageAvailable) toast('Your bag works for this visit. Browser storage is unavailable.');
    storageAvailable = false;
  }
}

function dishCard(dish) {
  const badge = dish.available === false ? 'Sold out' : dish.tags.includes('Signature') ? 'Signature dish' : dish.tags.includes('Vegan') ? 'Plant-powered' : dish.tags.includes('Vegetarian') ? 'Vegetarian' : '';
  return `<article class="dish-card"><div class="dish-photo"><img src="assets/${escape(dish.image)}.jpg" alt="${escape(dish.name)} — illustrative food photograph" width="600" height="450" loading="lazy">${badge ? `<span class="dish-badge ${dish.tags.includes('Signature') ? 'signature' : ''}">${badge}</span>` : ''}</div><div class="dish-body"><p class="dish-category">${escape(dish.category)}</p><h3>${escape(dish.name)}</h3><p class="dish-description">${escape(dish.description)}</p><div class="dish-meta">${dish.tags.filter(tag => tag !== 'Signature').map(tag => `<span class="diet-tag">${escape(tag)}</span>`).join('')}</div><p class="dish-allergens">Allergens: ${escape(dish.allergens)}</p><div class="dish-footer"><span class="dish-price">${money(dish.price)}</span><button class="add-button" data-add="${dish.id}" aria-label="Add ${escape(dish.name)} to bag">+</button></div></div></article>`;
}

function renderMenu() {
  const query = $('#menu-search').value.trim().toLowerCase();
  const vegetarian = $('#vegetarian-only').checked;
  const results = dishes.filter(dish => (activeCategory === 'All dishes' || dish.category === activeCategory) && (!vegetarian || dish.tags.some(tag => ['Vegetarian', 'Vegan'].includes(tag))) && `${dish.name} ${dish.description} ${dish.category} ${dish.tags.join(' ')}`.toLowerCase().includes(query));
  $('#menu-dishes').innerHTML = results.map(dishCard).join('');
  $('#menu-result-count').textContent = `${results.length} ${results.length === 1 ? 'dish' : 'dishes'} to discover`;
  $('#menu-empty').hidden = results.length > 0;
  $$('.category-button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === activeCategory)));
  updateAddButtons();
}

function updateAddButtons() {
  $$('[data-add]').forEach(button => {
    const dish = dishes.find(dish => dish.id === button.dataset.add);
    const full = (cart.find(item => item.id === button.dataset.add)?.quantity || 0) >= 20;
    const unavailable = dish?.available === false;
    button.disabled = full || unavailable || !restaurant.orderingEnabled;
    button.title = unavailable ? 'Currently sold out' : !restaurant.orderingEnabled ? 'Ordering is paused' : full ? 'Maximum 20 of this dish per bag' : 'Add to bag';
    button.textContent = unavailable ? '\u00d7' : '+';
  });
}

function totalsMarkup(totals, includeDelivery = false) {
  return `<div class="totals-row"><span>Subtotal</span><span>${money(totals.subtotal)}</span></div>${includeDelivery ? `<div class="totals-row"><span>Delivery</span><span>${money(totals.delivery)}</span></div>` : ''}${restaurant.taxRate ? `<div class="totals-row"><span>Tax</span><span>${money(totals.tax)}</span></div>` : ''}<div class="totals-row total"><span>Total</span><span>${money(totals.total)}</span></div>`;
}

function renderCart() {
  const totals = cartTotals(cart, dishes, restaurant);
  $$('[data-cart-count]').forEach(element => { element.textContent = totals.quantity; });
  $('[data-open-cart]').setAttribute('aria-label', `Open shopping bag, ${totals.quantity} ${totals.quantity === 1 ? 'item' : 'items'}`);
  $('#cart-title-count').textContent = `(${totals.quantity})`;
  if (!cart.length) {
    $('#cart-content').innerHTML = '<div class="cart-empty"><span aria-hidden="true">♧</span><h3>A little room for delicious.</h3><p>Your bag is empty. Let’s find you something good.</p><button class="button" data-continue>Explore our menu <span aria-hidden="true">↗</span></button></div>';
    $('#cart-footer').innerHTML = '';
  } else {
    $('#cart-content').innerHTML = cart.map(item => {
      const dish = dishes.find(value => value.id === item.id);
      return `<article class="cart-line"><img src="assets/${escape(dish.image)}.jpg" alt="" width="72" height="83"><div><h3>${escape(dish.name)}</h3><p>${money(dish.price)} each</p><div class="quantity-controls" aria-label="Quantity for ${escape(dish.name)}"><button data-quantity="${dish.id}" data-delta="-1" aria-label="Decrease ${escape(dish.name)} quantity">−</button><span aria-label="${item.quantity} items">${item.quantity}</span><button data-quantity="${dish.id}" data-delta="1" aria-label="Increase ${escape(dish.name)} quantity" ${item.quantity >= 20 ? 'disabled' : ''}>+</button></div></div><div class="cart-line-end"><strong>${money(dish.price * item.quantity)}</strong><button class="remove-item" data-remove="${dish.id}" aria-label="Remove ${escape(dish.name)}">Remove</button></div></article>`;
    }).join('');
    $('#cart-footer').innerHTML = `${totalsMarkup(totals)}<p class="cart-demo-note">Prices in ${restaurant.currency}. Delivery is calculated at checkout. Tax and delivery are itemized at checkout.</p><button class="button full-width" id="go-checkout">Continue to checkout <span aria-hidden="true">↗</span></button><p class="form-footnote">Requests are saved locally. Pay on collection or delivery.</p>`;
  }
  updateAddButtons();
}

function commitCart() { cart = sanitizeCart(cart, dishes); saveCart(); renderCart(); }

function changeQuantity(id, delta) {
  const existing = cart.find(item => item.id === id);
  if (!existing || !dishes.some(dish => dish.id === id)) return;
  const quantity = existing.quantity + delta;
  if (quantity > 20) { toast('You can add up to 20 of each dish.'); return; }
  if (quantity < 1) cart = cart.filter(item => item.id !== id);
  else existing.quantity = quantity;
  const focusWas = document.activeElement?.dataset.delta;
  commitCart();
  const focusTarget = $(`[data-quantity="${id}"][data-delta="${focusWas}"]`);
  if (focusTarget && !focusTarget.disabled) focusTarget.focus();
  else $('#cart-dialog [data-close-dialog]').focus();
}

const pageTitles = { home: 'Food made with feeling', menu: 'Our menu', about: 'Our story', reserve: 'Book a table', contact: 'Visit us', manage: 'Manage your visit', gallery: 'Around our table', faq: 'Your questions', privacy: 'Privacy & data', terms: 'Ordering & reservations' };
function route(initial = false) {
  let page = location.hash.slice(1) || 'home';
  if (page === 'main') { $('#main').focus(); return; }
  if (!Object.hasOwn(pageTitles, page)) { page = 'home'; history.replaceState(null, '', '#home'); }
  $$('[data-page]').forEach(element => { element.hidden = element.dataset.page !== page; });
  $$('nav a').forEach(link => {
    if (link.getAttribute('href') === `#${page}`) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.title = `${pageTitles[page]} — ${restaurant.name}`;
  $('#mobile-nav').hidden = true;
  $('.mobile-toggle').setAttribute('aria-expanded', 'false');
  $('.mobile-toggle').setAttribute('aria-label', 'Open navigation');
  if (page === 'reserve') refreshBookingDates();
  if (!initial) { window.scrollTo({ top: 0, behavior: 'instant' }); $('#main').focus({ preventScroll: true }); }
}

function openDialog(dialog) {
  $$('dialog[open]').forEach(other => { if (other !== dialog) other.close(); });
  dialog.showModal();
  document.body.classList.add('dialog-open');
}

function clearErrors(form) {
  form.querySelectorAll('[data-error]').forEach(element => { element.textContent = ''; });
  form.querySelectorAll('[aria-invalid]').forEach(element => element.removeAttribute('aria-invalid'));
}

function displayErrors(form, errors) {
  clearErrors(form);
  let first;
  Object.entries(errors).forEach(([field, message]) => {
    const input = form.elements.namedItem(field);
    const target = form.querySelector(`[data-error="${field}"]`);
    if (!input || !target) return;
    input.setAttribute('aria-invalid', 'true');
    target.textContent = message;
    first ||= input;
  });
  first?.focus();
  return Boolean(first);
}

function basicErrors(form) {
  const errors = {};
  for (const input of form.querySelectorAll('input, select, textarea')) {
    if (!input.name || input.disabled || !input.willValidate) continue;
    if (input.required && !input.value.trim()) errors[input.name] = 'Please fill in this field.';
    else if (input.validity.typeMismatch) errors[input.name] = 'Please enter a valid email address.';
    else if (input.validity.tooShort) errors[input.name] = `Please enter at least ${input.minLength} characters.`;
    else if (input.validity.tooLong) errors[input.name] = `Please use no more than ${input.maxLength} characters.`;
    else if (!input.validity.valid) errors[input.name] = 'Please check this value.';
  }
  return errors;
}

function setupForm(form) {
  form.querySelectorAll('[data-error]').forEach(target => {
    const input = form.elements.namedItem(target.dataset.error);
    target.id = `${form.id}-${target.dataset.error}-error`;
    input?.setAttribute('aria-describedby', target.id);
  });
  form.addEventListener('input', event => {
    if (event.target.getAttribute('aria-invalid') === 'true') {
      event.target.removeAttribute('aria-invalid');
      const error = form.querySelector(`[data-error="${event.target.name}"]`);
      if (error) error.textContent = '';
    }
  });
}

function timeLabel(time) {
  const hour = Number(time.slice(0, 2));
  return `${hour % 12 || 12}:${time.slice(3)} ${hour >= 12 ? 'pm' : 'am'}`;
}

const reservationForm = $('#reservation-form');
function refreshBookingDates() {
  const local = localDateTime(new Date(), restaurant.timeZone);
  reservationForm.elements.date.min = local.date;
  reservationForm.elements.date.max = shiftDate(local.date, restaurant.maxBookingDays);
  if (!reservationForm.elements.date.value || reservationForm.elements.date.value < local.date) reservationForm.elements.date.value = local.date;
  updateBookingTimes();
}

let availabilityRequest = 0;
async function updateBookingTimes() {
  const request = ++availabilityRequest;
  const field = reservationForm.elements.time;
  const previous = field.value;
  const date = reservationForm.elements.date.value;
  let slots = bookingSlots(date, restaurant);
  if (serverReady) {
    field.innerHTML = '<option value="">Checking availability...</option>';
    field.disabled = true;
    try {
      const response = await api(`/api/availability?date=${encodeURIComponent(date)}&guests=${Number(reservationForm.elements.guests.value) || 1}`);
      if (request !== availabilityRequest) return;
      slots = response.slots;
    } catch {
      if (request !== availabilityRequest) return;
      field.innerHTML = '<option value="">Unable to check. Change the date to retry.</option>';
      field.disabled = false;
      return;
    }
    field.disabled = false;
  }
  field.innerHTML = `<option value="">${slots.length ? 'Choose a time' : date ? 'No times available — choose another date' : 'Select a date first'}</option>` + slots.map(time => `<option value="${time}">${timeLabel(time)}</option>`).join('');
  if (slots.includes(previous)) field.value = previous;
}

function showFormResult(form, result, html) {
  form.hidden = true;
  result.innerHTML = html;
  result.hidden = false;
  result.focus();
  form.reset();
  clearErrors(form);
}

function renderCheckout() {
  const method = $('#checkout-form').elements.method.value;
  const totals = cartTotals(cart, dishes, restaurant, method);
  $('#delivery-address-label').hidden = method !== 'delivery';
  $('#checkout-form').elements.address.required = method === 'delivery';
  $('#checkout-form').elements.address.disabled = method !== 'delivery';
  $('#delivery-area-label').hidden = method !== 'delivery';
  $('#checkout-form').elements.area.required = method === 'delivery';
  $('#checkout-form').elements.area.disabled = method !== 'delivery';
  $('#checkout-summary').innerHTML = `<h3>Your delicious little line-up</h3>${cart.map(item => {
    const dish = dishes.find(value => value.id === item.id);
    return `<div class="summary-dish"><span>${item.quantity} × ${escape(dish.name)}</span><span>${money(dish.price * item.quantity)}</span></div>`;
  }).join('')}${totalsMarkup(totals, method === 'delivery')}`;
}

$('#featured-dishes').innerHTML = dishes.filter(dish => dish.featured).map(dishCard).join('');
$('#category-filters').innerHTML = categories.map(category => `<button class="category-button" data-category="${escape(category)}" aria-pressed="${category === activeCategory}">${escape(category)}</button>`).join('');
$('#delivery-fee-label').textContent = `${money(restaurant.deliveryFee)} sample fee`;
$('#year').textContent = new Date().getFullYear();
$$('[data-location]').forEach(element => { element.textContent = restaurant.location; });
$$('[data-location-note]').forEach(element => { element.textContent = restaurant.locationNote; });
$$('[data-email]').forEach(element => { element.textContent = restaurant.email; });
$$('[data-phone]').forEach(element => { element.textContent = restaurant.phone || 'Phone: add your business number before launch.'; });
$$('[data-hours]').forEach(element => { element.innerHTML = restaurant.hoursDisplay.map(([days, hours]) => `<div><span>${escape(days)}</span><span>${escape(hours)}</span></div>`).join(''); });
reservationForm.elements.guests.insertAdjacentHTML('beforeend', Array.from({ length: restaurant.maxPartySize }, (_, index) => `<option value="${index + 1}">${index + 1} ${index === 0 ? 'guest' : 'guests'}</option>`).join(''));
$$('form').forEach(setupForm);

$('#menu-search').addEventListener('input', renderMenu);
$('#vegetarian-only').addEventListener('change', renderMenu);
$('#reset-menu').addEventListener('click', () => { activeCategory = 'All dishes'; $('#menu-search').value = ''; $('#vegetarian-only').checked = false; renderMenu(); $('#menu-search').focus(); });
reservationForm.elements.date.addEventListener('change', updateBookingTimes);
reservationForm.elements.guests.addEventListener('change', updateBookingTimes);
window.addEventListener('hashchange', () => route());
$('.mobile-toggle').addEventListener('click', event => {
  const button = event.currentTarget;
  const open = button.getAttribute('aria-expanded') !== 'true';
  button.setAttribute('aria-expanded', String(open));
  button.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  $('#mobile-nav').hidden = !open;
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !$('#mobile-nav').hidden) {
    $('#mobile-nav').hidden = true;
    $('.mobile-toggle').setAttribute('aria-expanded', 'false');
    $('.mobile-toggle').setAttribute('aria-label', 'Open navigation');
    $('.mobile-toggle').focus();
  }
});

document.addEventListener('click', event => {
  if (event.target.closest('a[href^="#"]')) $$('dialog[open]').forEach(dialog => dialog.close());
  const button = event.target.closest('button');
  if (!button) return;
  if (button.hasAttribute('data-add')) {
    const dish = dishes.find(value => value.id === button.dataset.add);
    if (!dish) return;
    const existing = cart.find(item => item.id === dish.id);
    if (existing?.quantity >= 20) return;
    if (existing) existing.quantity++;
    else cart.push({ id: dish.id, quantity: 1 });
    commitCart();
    toast(`${dish.name} added to your bag.`);
  } else if (button.hasAttribute('data-open-cart')) { renderCart(); openDialog($('#cart-dialog')); }
  else if (button.hasAttribute('data-close-dialog')) button.closest('dialog').close();
  else if (button.hasAttribute('data-category')) { activeCategory = button.dataset.category; renderMenu(); }
  else if (button.hasAttribute('data-quantity')) changeQuantity(button.dataset.quantity, Number(button.dataset.delta));
  else if (button.hasAttribute('data-remove')) {
    const name = dishes.find(dish => dish.id === button.dataset.remove)?.name;
    cart = cart.filter(item => item.id !== button.dataset.remove); commitCart();
    $('#cart-dialog [data-close-dialog]').focus(); toast(`${name} removed from your bag.`);
  } else if (button.hasAttribute('data-continue')) {
    button.closest('dialog')?.close();
    if (location.hash !== '#menu') location.hash = 'menu';
    else $('#menu-search').focus();
  } else if (button.id === 'go-checkout') {
    if (!cart.length) return;
    if (cart.some(item => !dishes.find(dish => dish.id === item.id)?.available)) { toast('Remove sold-out dishes from your bag before checking out.'); return; }
    $('#checkout-form').hidden = false;
    $('#checkout-result').hidden = true;
    $('#checkout-form').reset();
    clearErrors($('#checkout-form'));
    renderCheckout();
    openDialog($('#checkout-dialog'));
  } else if (button.hasAttribute('data-reset-form')) {
    const form = document.getElementById(button.dataset.resetForm);
    form.hidden = false;
    button.closest('.form-result').hidden = true;
    if (form === reservationForm) refreshBookingDates();
    form.querySelector('input')?.focus();
  }
});

$$('dialog').forEach(dialog => {
  dialog.addEventListener('close', () => {
    if (!$('dialog[open]')) document.body.classList.remove('dialog-open');
    if (dialog.id === 'checkout-dialog') {
      $('#checkout-form').reset();
      $('#checkout-result').innerHTML = '';
    }
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
});


async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, signal: AbortSignal.timeout(12000) });
  let data;
  try { data = await response.json(); } catch { throw new Error('The restaurant service is unavailable. Start the Node server and try again.'); }
  if (!response.ok) throw Object.assign(new Error(data.error || 'Please try again.'), { status: response.status, fields: data.fields || {} });
  return data;
}
function formFailure(form, error) {
  displayErrors(form, error.fields || {});
  let notice = form.querySelector('.submission-error');
  if (!notice) { notice = document.createElement('p'); notice.className = 'submission-error'; notice.setAttribute('role', 'alert'); form.append(notice); }
  notice.textContent = error.name === 'TimeoutError' ? 'The request timed out. Your details are still here. Try again to check the same request.' : error.message || 'Unable to reach the server. Your details are still here; please try again.';
}
async function submitRequest(form, endpoint, values, onSuccess) {
  if (form.dataset.busy) return;
  if (!serverReady) { formFailure(form, new Error('The restaurant service is not connected. Run npm run dev and reload this page.')); return; }
  const button = form.querySelector('[type=submit]');
  const oldLabel = button.innerHTML;
  const error = form.querySelector('.submission-error'); if (error) error.remove();
  form.dataset.busy = 'true';
  form.dataset.requestKey ||= crypto.randomUUID();
  button.disabled = true; button.textContent = 'Saving securely...'; form.setAttribute('aria-busy', 'true');
  try {
    const result = await api(endpoint, { method: 'POST', headers: { 'Idempotency-Key': form.dataset.requestKey }, body: JSON.stringify(values) });
    delete form.dataset.requestKey;
    onSuccess(result);
  } catch (error) {
    formFailure(form, error);
    if (error.status === 409 && endpoint === '/api/orders') await refreshMenu().catch(() => {});
    if (error.status === 409 && endpoint === '/api/reservations') updateBookingTimes();
  } finally { delete form.dataset.busy; button.disabled = false; button.innerHTML = oldLabel; form.removeAttribute('aria-busy'); }
}
function rememberRecord(kind, result) {
  try {
    const previous = JSON.parse(localStorage.getItem('se-references-v1') || '[]');
    const entries = Array.isArray(previous) ? previous.filter(item => item.id !== result.record.id) : [];
    localStorage.setItem('se-references-v1', JSON.stringify([{ kind, id: result.record.id, token: result.token }, ...entries].slice(0, 20)));
  } catch { toast('Save your reference and private access key below. Browser storage is unavailable.'); }
}
function referenceMarkup(result) {
  return '<div class="reference-box"><p>Reference <strong>' + escape(result.record.id) + '</strong></p><details><summary>Show your private access key</summary><code>' + escape(result.token) + '</code></details><p class="small">Keep this key private. Your reference and key are saved in this browser so you can check status or cancel eligible requests.</p></div><a class="text-link" href="#manage">Manage your request &rarr;</a>';
}
reservationForm.addEventListener('submit', event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(reservationForm));
  const errors = { ...basicErrors(reservationForm), ...validateReservation(values, restaurant) };
  if (displayErrors(reservationForm, errors)) return;
  submitRequest(reservationForm, '/api/reservations', values, result => {
    rememberRecord('reservations', result);
    showFormResult(reservationForm, $('#reservation-result'), '<h3>Your table request is saved.</h3><p>We have recorded your request for ' + Number(result.record.guests) + ' guests on ' + escape(result.record.date) + ' at ' + timeLabel(result.record.time) + ' (Pakistan time).</p><p><strong>Awaiting restaurant confirmation.</strong> Check your status under Manage your visit. No confirmation email or SMS has been sent.</p>' + referenceMarkup(result) + '<button class="button button-small" data-reset-form="reservation-form">Make another request &rarr;</button>');
  });
});
$('#contact-form').addEventListener('submit', event => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const errors = basicErrors(form);
  if (values.message.trim().length < 10) errors.message = 'Please write at least 10 characters.';
  if (displayErrors(form, errors)) return;
  submitRequest(form, '/api/messages', values, result => {
    showFormResult(form, $('#contact-result'), '<h3>Your note is in the inbox.</h3><p>Your message has been saved for the restaurant administrator.</p><p>Reference: <strong>' + escape(result.id) + '</strong></p><p>No email or SMS notification has been sent. This local project is not connected to a live restaurant.</p><button class="button button-small" data-reset-form="contact-form">Write another message &rarr;</button>');
  });
});
$('#checkout-form').addEventListener('change', event => { if (event.target.name === 'method') renderCheckout(); });
$('#checkout-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!cart.length) { $('#checkout-dialog').close(); toast('Please add a dish to your bag first.'); return; }
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const errors = basicErrors(form);
  if (!/^\+?\d{7,15}$/.test(values.phone.replace(/[\s().-]/g, ''))) errors.phone = 'Please enter a phone number with 7-15 digits.';
  if (values.method === 'delivery' && (values.address || '').trim().length < 10) errors.address = 'Please enter a full delivery address (at least 10 characters).';
  if (displayErrors(form, errors)) return;
  const totals = cartTotals(cart, dishes, restaurant, values.method);
  submitRequest(form, '/api/orders', { ...values, cart, expectedTotal: totals.total }, result => {
    rememberRecord('orders', result);
    showFormResult(form, $('#checkout-result'), '<h3>Your order request is saved.</h3><p>' + result.record.totals.quantity + ' items &middot; ' + money(result.record.totals.total) + ' &middot; ' + escape(result.record.method) + '</p><p><strong>Awaiting acceptance by the restaurant.</strong> Payment is due on collection or delivery. No online payment has been taken and no delivery time is confirmed.</p>' + referenceMarkup(result) + '<button class="button button-small" data-continue>Keep exploring &rarr;</button>');
    cart = []; commitCart();
  });
});

window.addEventListener('storage', event => {
  if (event.key !== storageKey && event.key !== null) return;
  try { cart = sanitizeCart(JSON.parse(event.newValue || '[]'), dishes); }
  catch { cart = []; }
  renderCart();
  if ($('#checkout-dialog').open) {
    if (!cart.length) { $('#checkout-dialog').close(); toast('Your bag was updated in another tab.'); }
    else renderCheckout();
  }
});

// Keep image failure graceful if a local asset is accidentally removed.
document.addEventListener('error', event => {
  const image = event.target;
  if (image.tagName === 'IMG' && !image.src.endsWith('favicon.svg')) { image.src = 'assets/favicon.svg'; image.classList.add('asset-fallback'); }
}, true);

renderMenu();
renderCart();
refreshBookingDates();
route(true);

async function refreshMenu() {
  const [config, menu] = await Promise.all([api('/api/config'), api('/api/menu')]);
  restaurant = config.restaurant;
  dishes = menu.dishes;
  serverReady = true;
  const oldCount = cart.length;
  cart = sanitizeCart(cart, dishes);
  if (oldCount !== cart.length) { saveCart(); toast('Some dishes are no longer listed. Your bag has been updated.'); }
  $('#featured-dishes').innerHTML = dishes.filter(dish => dish.featured).slice(0, 4).map(dishCard).join('');
  renderMenu(); renderCart();
  $$('[data-location]').forEach(el => { el.textContent = restaurant.location; });
  $$('[data-location-note]').forEach(el => { el.textContent = restaurant.locationNote; });
  $$('[data-email]').forEach(el => { el.textContent = restaurant.email; });
  $$('[data-phone]').forEach(el => { el.textContent = restaurant.phone || 'Add your restaurant phone in management settings.'; });
  $$('[data-business-name]').forEach(el => { el.textContent = restaurant.name; });
  $$('.brand[aria-label]').forEach(el => el.setAttribute('aria-label', `${restaurant.name} home`));
  const currentPage = location.hash.slice(1) || 'home';
  document.title = `${pageTitles[currentPage] || pageTitles.home} — ${restaurant.name}`;
  const mapLink = $('a[href*="openstreetmap.org/search"]');
  if (mapLink) { mapLink.href = `https://www.openstreetmap.org/search?query=${encodeURIComponent(restaurant.location)}`; mapLink.textContent = restaurant.sampleBusiness ? 'Explore the sample city ↗' : 'Get directions ↗'; }
  if (restaurant.phone) $$('[data-phone]').forEach(el => { const link = document.createElement('a'); link.href = `tel:${restaurant.phone.replace(/[^+\d]/g, '')}`; link.textContent = restaurant.phone; el.replaceChildren(link); });
  $$('[data-email]').forEach(el => { const link = document.createElement('a'); link.href = `mailto:${restaurant.email}`; link.textContent = restaurant.email; el.replaceChildren(link); });
  $$('[data-hours]').forEach(el => { el.innerHTML = restaurant.hoursDisplay.map(([day, hours]) => '<div><span>' + escape(day) + '</span><span>' + escape(hours) + '</span></div>').join(''); });
  $$('[data-sample-only]').forEach(el => { el.hidden = !restaurant.sampleBusiness; });
  $('#service-status').textContent = restaurant.sampleBusiness ? 'Sample restaurant: requests are saved on this computer. No live restaurant, email or payment provider is connected.' : 'Requests are saved for staff review. Online payments and email notifications are not connected.';
  $('#delivery-fee-label').textContent = money(restaurant.deliveryFee) + ' delivery fee';
  const area = $('#checkout-form').elements.area;
  const oldArea = area.value;
  area.innerHTML = '<option value="">Choose delivery area</option>' + restaurant.deliveryAreas.map(item => '<option>' + escape(item) + '</option>').join('');
  if (restaurant.deliveryAreas.includes(oldArea)) area.value = oldArea;
  $('#checkout-form input[value=delivery]').disabled = !restaurant.deliveryEnabled;
  if (!restaurant.deliveryEnabled) $('#checkout-form input[value=pickup]').checked = true;
  const guests = reservationForm.elements.guests;
  const oldGuests = guests.value;
  guests.innerHTML = '<option value="">Number of guests</option>' + Array.from({length:restaurant.maxPartySize},(_,i)=>'<option value="' +(i+1)+ '">' +(i+1)+ ' guests</option>').join('');
  if (Number(oldGuests) <= restaurant.maxPartySize) guests.value = oldGuests;
  $('#reservation-limit-note').textContent = 'Up to ' + restaurant.maxPartySize + ' guests. Book up to ' + restaurant.maxBookingDays + ' days ahead. Subject to staff confirmation.';
  if ($('#checkout-dialog').open && !$('#checkout-form').hidden) renderCheckout();
  refreshBookingDates();
}
const ready = refreshMenu().catch(() => { $('#service-status').textContent = 'Browsing offline. To submit requests, start the Node server with npm run dev and reload.'; });
$$('form').forEach(form => form.addEventListener('input', () => { if (!form.dataset.busy) delete form.dataset.requestKey; }));
window.addEventListener('hashchange', () => { if (['#menu','#reserve'].includes(location.hash)) refreshMenu().catch(() => {}); });
export { api, toast, escape, restaurant, ready, refreshMenu };
