import { randomBytes } from 'node:crypto';
import { bookingSlots, cartTotals, validateReservation, localDateTime } from '../lib/domain.js';
import { categories } from '../data.js';
import { digest, makeToken } from './store.js';

export class ServiceError extends Error {
  constructor(status, message, fields = {}) { super(message); this.status = status; this.fields = fields; }
}
const fail = (status, message, fields) => { throw new ServiceError(status, message, fields); };
const ref = prefix => `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
const text = value => typeof value === 'string' ? value.trim() : '';
const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const activeBooking = record => ['pending', 'confirmed', 'seated'].includes(record.status);
const maxString = (value, max) => typeof value === 'string' && value.length <= max;

export function contactErrors(values, phone = false) {
  const errors = {};
  if (!text(values.name) || !maxString(values.name, 100)) errors.name = 'Enter your name (up to 100 characters).';
  if (!maxString(values.email, 150) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(values.email))) errors.email = 'Enter a valid email address.';
  if (phone && (!maxString(values.phone, 30) || !/^\+?\d{7,15}$/.test(text(values.phone).replace(/[\s().-]/g, '')))) errors.phone = 'Enter a valid phone number with 7-15 digits.';
  return errors;
}

export function availableSlots(store, date, guests, now = new Date(), excluding = '') {
  const config = store.settings;
  if (!Number.isInteger(guests) || guests < 1 || guests > config.maxPartySize) return [];
  const existing = store.all('reservations').filter(record => record.date === date && activeBooking(record) && record.id !== excluding);
  return bookingSlots(date, config, now).filter(time => {
    const start = minutes(time);
    const end = start + config.reservationDuration;
    // Capacity is checked throughout the visit, not only at its arrival time.
    const boundaries = new Set([start, ...existing.flatMap(record => [minutes(record.time), minutes(record.time) + record.duration]).filter(value => value >= start && value < end)]);
    return [...boundaries].every(point => guests + existing.reduce((sum, record) => sum + (minutes(record.time) <= point && minutes(record.time) + record.duration > point ? record.guests : 0), 0) <= config.seatCapacity);
  });
}

export function createReservation(store, values, key, now = new Date()) {
  const config = store.settings;
  const errors = { ...validateReservation(values, config, now), ...contactErrors(values, true) };
  if (Object.keys(errors).length) fail(422, 'Please check your reservation details.', errors);
  if (!config.reservationsEnabled) fail(409, 'Reservations are currently paused.');
  return store.idempotent(key, { type: 'reservation', values }, () => {
    if (!availableSlots(store, values.date, Number(values.guests), now).includes(values.time)) fail(409, 'That time no longer has enough seats. Please choose another time.', { time: 'This time is full. Choose another available time.' });
    const token = makeToken();
    const record = { id: ref('RES'), status: 'pending', name: text(values.name), email: text(values.email), phone: text(values.phone), date: values.date, time: values.time, guests: Number(values.guests), requests: text(values.requests), duration: config.reservationDuration, createdAt: now.toISOString(), updatedAt: now.toISOString(), version: 1 };
    store.insertRecord('reservations', record, token);
    store.audit('reservation.created', record.id);
    return { record: publicRecord('reservations', record), token };
  });
}

export function createOrder(store, values, key, now = new Date()) {
  const config = store.settings;
  const errors = contactErrors(values, true);
  if (!['pickup', 'delivery'].includes(values.method)) errors.method = 'Choose pickup or delivery.';
  if (!['cash'].includes(values.payment)) errors.payment = 'Only payment on collection or delivery is configured.';
  if (!maxString(values.notes || '', 500)) errors.notes = 'Keep order notes under 500 characters.';
  if (values.method === 'delivery') {
    if (!config.deliveryEnabled) errors.address = 'Delivery is currently unavailable.';
    if (!maxString(values.address, 300) || text(values.address).length < 10) errors.address = 'Enter your complete delivery address.';
    if (!config.deliveryAreas.includes(values.area)) errors.area = 'Choose a supported delivery area.';
  }
  if (Object.keys(errors).length) fail(422, 'Please check your order details.', errors);
  if (!config.orderingEnabled) fail(409, 'Online ordering is currently paused.');
  return store.idempotent(key, { type: 'order', values }, () => {
    const menu = store.getMenu();
    if (!Array.isArray(values.cart) || !values.cart.length || values.cart.length > 50) fail(422, 'Your bag must contain at least one dish.');
    const ids = new Set();
    const items = values.cart.map(item => {
      const dish = item && menu.find(dish => dish.id === item.id);
      if (!dish || !dish.available || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20 || ids.has(item.id)) fail(409, 'Your menu or bag has changed. Review your bag and try again.');
      ids.add(item.id);
      return { id: dish.id, name: dish.name, price: dish.price, quantity: item.quantity, allergens: dish.allergens };
    });
    const totals = cartTotals(items, menu, config, values.method);
    if (values.method === 'delivery' && totals.subtotal < config.minimumDelivery) fail(422, `The delivery minimum is ${config.currency} ${config.minimumDelivery}. Add a dish or select pickup.`);
    if (!Number.isInteger(values.expectedTotal) || values.expectedTotal !== totals.total) fail(409, 'Prices have changed. Please review the updated total before submitting.');
    const token = makeToken();
    const record = { id: ref('ORD'), status: 'pending', paymentStatus: 'unpaid', payment: 'cash', method: values.method, name: text(values.name), email: text(values.email), phone: text(values.phone), address: values.method === 'delivery' ? text(values.address) : '', area: values.method === 'delivery' ? text(values.area) : '', notes: text(values.notes), items, totals, currency: config.currency, locale: config.locale, createdAt: now.toISOString(), updatedAt: now.toISOString(), version: 1 };
    store.insertRecord('orders', record, token);
    store.audit('order.created', record.id);
    return { record: publicRecord('orders', record), token };
  });
}

export function createMessage(store, values, key) {
  const errors = contactErrors(values);
  if (!['General enquiry', 'Private dining & events', 'Dietary requirements', 'Something else'].includes(values.subject)) errors.subject = 'Choose a topic.';
  if (!maxString(values.message, 2000) || text(values.message).length < 10) errors.message = 'Write a message between 10 and 2000 characters.';
  if (Object.keys(errors).length) fail(422, 'Please check your message.', errors);
  return store.idempotent(key, { type: 'message', values }, () => {
    const record = { id: ref('MSG'), status: 'new', name: text(values.name), email: text(values.email), subject: values.subject, message: text(values.message), createdAt: new Date().toISOString(), version: 1 };
    store.insertRecord('messages', record, makeToken());
    store.audit('message.created', record.id);
    return { id: record.id, status: 'received' };
  });
}

export function publicRecord(kind, record) {
  const base = { id: record.id, status: record.status, createdAt: record.createdAt, updatedAt: record.updatedAt, version: record.version };
  if (kind === 'orders') return { ...base, method: record.method, paymentStatus: record.paymentStatus, payment: record.payment, items: record.items, totals: record.totals, currency: record.currency, locale: record.locale };
  return { ...base, date: record.date, time: record.time, guests: record.guests };
}

export function lookupRecord(store, kind, id, token) {
  const record = store.getRecord(id, kind);
  if (!record || !token || !/^[a-f0-9]{64}$/.test(token) || record.tokenHash !== digest(token)) fail(404, 'No matching record. Check the reference and private access key.');
  return record;
}

export function cancelRecord(store, kind, id, token, now = new Date()) {
  return store.transaction(() => {
    const record = lookupRecord(store, kind, id, token);
    if (record.status === 'cancelled') return publicRecord(kind, record);
    if (kind === 'orders' && record.status !== 'pending') fail(409, 'This order is already being handled. Contact the restaurant to request a change.');
    if (kind === 'reservations') {
      const local = localDateTime(now, store.settings.timeZone);
      if (!['pending', 'confirmed'].includes(record.status) || `${record.date}T${record.time}` <= `${local.date}T${local.time}`) fail(409, 'This reservation can no longer be cancelled online. Contact the restaurant.');
    }
    record.status = 'cancelled'; record.updatedAt = now.toISOString(); record.version++;
    store.saveRecord(kind, record); store.audit(`${kind}.guest_cancelled`, id);
    return publicRecord(kind, record);
  });
}

const orderTransitions = { pending: ['confirmed', 'cancelled'], confirmed: ['preparing', 'cancelled'], preparing: ['ready', 'cancelled'], ready: ['out_for_delivery', 'completed', 'cancelled'], out_for_delivery: ['completed', 'cancelled'], completed: [], cancelled: [] };
const reservationTransitions = { pending: ['confirmed', 'cancelled'], confirmed: ['seated', 'no_show', 'cancelled'], seated: ['completed'], completed: [], cancelled: [], no_show: [] };
export function updateRecord(store, kind, id, values) {
  return store.transaction(() => {
    const record = store.getRecord(id, kind);
    if (!record) fail(404, 'Record not found.');
    if (values.version !== record.version) fail(409, 'This record changed. Refresh before editing.');
    if (values.status && values.status !== record.status) {
      const transitions = kind === 'orders' ? orderTransitions : kind === 'reservations' ? reservationTransitions : { new: ['read', 'archived'], read: ['archived', 'new'], archived: ['read'] };
      if (!transitions[record.status]?.includes(values.status)) fail(422, 'That status change is not allowed.');
      if (kind === 'orders' && record.method === 'pickup' && values.status === 'out_for_delivery') fail(422, 'Pickup orders cannot go out for delivery.');
      record.status = values.status;
      if (kind === 'orders' && record.status === 'cancelled' && record.paymentStatus === 'paid') record.paymentStatus = 'refund_due';
    }
    if (values.paymentStatus && kind === 'orders' && values.paymentStatus !== record.paymentStatus) {
      const permitted = (values.paymentStatus === 'paid' && record.paymentStatus === 'unpaid' && record.status !== 'cancelled') || (values.paymentStatus === 'refunded' && record.paymentStatus === 'refund_due');
      if (!permitted) fail(422, 'That payment change is not allowed.');
      record.paymentStatus = values.paymentStatus;
    }
    record.updatedAt = new Date().toISOString(); record.version++;
    store.saveRecord(kind, record); store.audit(`${kind}.updated`, id);
    const { tokenHash, ...safe } = record;
    return safe;
  });
}

export function saveMenuDish(store, values, id = '') {
  const errors = {};
  for (const [field, max] of [['name', 100], ['description', 600], ['allergens', 200]]) if (!text(values[field]) || !maxString(values[field], max)) errors[field] = `Enter ${field} (up to ${max} characters).`;
  if (!categories.slice(1).includes(values.category)) errors.category = 'Choose a valid category.';
  if (!Number.isInteger(values.price) || values.price < 1 || values.price > 1000000) errors.price = 'Enter a whole price between 1 and 1,000,000.';
  if (!['salad', 'hummus', 'soup', 'chicken', 'steak', 'salmon', 'pasta', 'cake', 'cheesecake', 'lemonade', 'coffee'].includes(values.image)) errors.image = 'Choose an available image.';
  if (!Array.isArray(values.tags) || values.tags.some(tag => !['Vegetarian', 'Vegan', 'Gluten-free', 'Signature'].includes(tag))) errors.tags = 'Choose valid dietary labels.';
  if (Object.keys(errors).length) fail(422, 'Check the dish details.', errors);
  return store.transaction(() => {
    const existing = id ? store.getMenu(true).find(dish => dish.id === id) : null;
    if (id && !existing) fail(404, 'Dish not found.');
    if (existing && values.version !== existing.version) fail(409, 'This dish changed. Refresh before editing.');
    const dish = { id: existing?.id || `dish-${randomBytes(6).toString('hex')}`, name: text(values.name), description: text(values.description), allergens: text(values.allergens), price: values.price, category: values.category, image: values.image, tags: [...new Set(values.tags)], featured: values.featured === true, available: values.available === true, active: values.active !== false, version: (existing?.version || 0) + 1 };
    store.saveDish(dish); store.audit('menu.saved', dish.id);
    return dish;
  });
}

export function saveSettings(store, values) {
  const current = store.settings;
  const settings = { ...current };
  for (const [field, max] of [['name', 80], ['tagline', 120], ['location', 200], ['locationNote', 200], ['email', 150], ['phone', 30]]) {
    if (!maxString(values[field], max) || (!values[field].trim() && ['name', 'location', 'email'].includes(field))) fail(422, `Invalid ${field}.`);
    settings[field] = values[field].trim();
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)) fail(422, 'Enter a valid business email.');
  for (const [field, min, max] of [['deliveryFee', 0, 100000], ['minimumDelivery', 0, 1000000], ['seatCapacity', 1, 500], ['maxPartySize', 1, 100], ['maxBookingDays', 1, 365], ['reservationDuration', 30, 180]]) {
    if (!Number.isInteger(values[field]) || values[field] < min || values[field] > max) fail(422, `Invalid ${field}: use a whole number between ${min} and ${max}.`);
    settings[field] = values[field];
  }
  if (settings.maxPartySize > settings.seatCapacity) fail(422, 'Party size must not exceed seat capacity.');
  if (typeof values.taxRate !== 'number' || values.taxRate < 0 || values.taxRate > 1) fail(422, 'Tax rate must be between 0% and 100%.');
  settings.taxRate = values.taxRate;
  for (const field of ['orderingEnabled', 'reservationsEnabled', 'deliveryEnabled', 'sampleBusiness']) { if (typeof values[field] !== 'boolean') fail(422, `Invalid ${field}.`); settings[field] = values[field]; }
  if (!Array.isArray(values.deliveryAreas) || values.deliveryAreas.length > 50 || values.deliveryAreas.some(area => !text(area) || !maxString(area, 80))) fail(422, 'Enter up to 50 valid delivery areas.');
  settings.deliveryAreas = [...new Set(values.deliveryAreas.map(text))];
  if (!Array.isArray(values.closedDates) || values.closedDates.length > 366 || values.closedDates.some(date => !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date)) fail(422, 'Enter closed dates as YYYY-MM-DD.');
  settings.closedDates = [...new Set(values.closedDates)].sort();
  if (!values.hours || typeof values.hours !== 'object') fail(422, 'Opening hours are required.');
  settings.hours = {};
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  settings.hoursDisplay = [];
  for (let day = 0; day < 7; day++) {
    const hours = values.hours[day];
    if (hours === null) { settings.hours[day] = null; settings.hoursDisplay.push([days[day], 'Closed']); continue; }
    if (!hours || ['open', 'close', 'lastBooking'].some(field => !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hours[field]))) fail(422, `Invalid hours for ${days[day]}.`);
    if (minutes(hours.open) >= minutes(hours.close) || minutes(hours.lastBooking) < minutes(hours.open) || minutes(hours.lastBooking) + settings.reservationDuration > minutes(hours.close)) fail(422, `Check ${days[day]}: the last booking must finish before closing.`);
    settings.hours[day] = { open: hours.open, close: hours.close, lastBooking: hours.lastBooking };
    settings.hoursDisplay.push([days[day], `${hours.open} - ${hours.close}`]);
  }
  return store.transaction(() => {
    if (values.version !== store.getMeta('settingsVersion')) fail(409, 'Settings changed. Refresh before editing.');
    store.setMeta('settings', settings); store.setMeta('settingsVersion', values.version + 1); store.audit('settings.updated', 'restaurant');
    return { settings, version: values.version + 1 };
  });
}
