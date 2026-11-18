export function formatMoney(amount, config) {
  return new Intl.NumberFormat(config.locale, { style: 'currency', currency: config.currency, maximumFractionDigits: 0 }).format(amount);
}

export function sanitizeCart(value, dishes) {
  if (!Array.isArray(value)) return [];
  const known = new Set(dishes.map(dish => dish.id));
  const items = new Map();
  for (const item of value) {
    if (!item || !known.has(item.id) || !Number.isInteger(item.quantity) || item.quantity < 1) continue;
    items.set(item.id, Math.min(20, (items.get(item.id) || 0) + item.quantity));
  }
  return [...items].map(([id, quantity]) => ({ id, quantity }));
}

export function cartTotals(cart, dishes, config, method = 'pickup') {
  const items = sanitizeCart(cart, dishes);
  const subtotal = items.reduce((sum, item) => sum + dishes.find(dish => dish.id === item.id).price * item.quantity, 0);
  const delivery = subtotal > 0 && method === 'delivery' ? config.deliveryFee : 0;
  const tax = Math.round(subtotal * config.taxRate);
  return { subtotal, delivery, tax, total: subtotal + delivery + tax, quantity: items.reduce((sum, item) => sum + item.quantity, 0) };
}

export function localDateTime(now, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export function shiftDate(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const value = new Date(`${date}T12:00:00Z`);
  return !Number.isNaN(value.valueOf()) && value.toISOString().slice(0, 10) === date;
}

export function bookingSlots(date, config, now = new Date()) {
  if (!validDate(date)) return [];
  const local = localDateTime(now, config.timeZone);
  if (config.reservationsEnabled === false || config.closedDates?.includes(date)) return [];
  if (date < local.date || date > shiftDate(local.date, config.maxBookingDays)) return [];
  const hours = config.hours[new Date(`${date}T12:00:00Z`).getUTCDay()];
  if (!hours) return [];
  const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const slots = [];
  for (let minute = minutes(hours.open); minute <= minutes(hours.lastBooking); minute += config.bookingInterval) {
    if (minute + (config.reservationDuration || 60) > minutes(hours.close)) continue;
    const time = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
    if (date !== local.date || time > local.time) slots.push(time);
  }
  return slots;
}

export function validateReservation(values, config, now = new Date()) {
  const errors = {};
  if (!String(values.name || '').trim()) errors.name = 'Please enter your name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(values.email || '').trim())) errors.email = 'Please enter a valid email address.';
  const phone = String(values.phone || '').replace(/[\s()+.\-]/g, '');
  if (!/^\+?\d{7,15}$/.test(phone)) errors.phone = 'Please enter a phone number with 7–15 digits.';
  const local = localDateTime(now, config.timeZone);
  if (!validDate(values.date || '') || values.date < local.date || values.date > shiftDate(local.date, config.maxBookingDays)) errors.date = `Choose a date within the next ${config.maxBookingDays} days.`;
  if (!bookingSlots(values.date || '', config, now).includes(values.time)) errors.time = 'Choose an available future time during opening hours.';
  const guests = Number(values.guests);
  if (!Number.isInteger(guests) || guests < 1 || guests > config.maxPartySize) errors.guests = `Choose between 1 and ${config.maxPartySize} guests.`;
  if (String(values.requests || '').length > 500) errors.requests = 'Please keep requests under 500 characters.';
  return errors;
}
