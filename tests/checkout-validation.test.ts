import test from 'node:test';
import assert from 'node:assert/strict';
import { cartSchema, checkoutSchema, cashUpdateSchema } from '../src/features/orders/validation.ts';
const uuid = '50000000-0000-4000-8000-000000000001';
test('cash receipts and refunds validate the database-required previous payment state', () => {
  assert.equal(
    cashUpdateSchema.safeParse({ id: uuid, previous: 'unpaid', status: 'paid' }).success,
    true,
  );
  assert.equal(
    cashUpdateSchema.safeParse({ id: uuid, previous: 'refund_due', status: 'refunded' }).success,
    true,
  );
  assert.equal(
    cashUpdateSchema.safeParse({ id: uuid, previous: 'paid', status: 'refunded' }).success,
    false,
  );
  assert.equal(
    cashUpdateSchema.safeParse({ id: uuid, previous: 'unpaid', status: 'refunded' }).success,
    false,
  );
});
test('cart submits identifiers and quantities, never trusted client prices', () => {
  const item = {
    product_id: uuid,
    variant_id: null,
    addon_ids: [],
    quantity: 1,
    unit_price_minor: 1,
  };
  assert.equal('unit_price_minor' in cartSchema.parse([item])[0], false);
  assert.equal(cartSchema.safeParse([{ ...item, quantity: 21 }]).success, false);
  assert.equal(cartSchema.safeParse([{ ...item, addon_ids: [uuid, uuid] }]).success, false);
  assert.equal(cartSchema.safeParse([]).success, false);
});
test('delivery checkout requires complete address and zone while pickup works without them', () => {
  const contact = {
    name: 'Guest',
    email: 'guest@example.com',
    phone: '03001234567',
    method: 'pickup',
    zone_id: '',
    address_line: '',
    area: '',
    city: '',
    instructions: '',
    notes: '',
  };
  assert.equal(checkoutSchema.safeParse(contact).success, true);
  assert.equal(checkoutSchema.safeParse({ ...contact, method: 'delivery' }).success, false);
  assert.equal(
    checkoutSchema.safeParse({
      ...contact,
      method: 'delivery',
      zone_id: uuid,
      address_line: '123 Main Street',
      area: 'Central',
      city: 'Karachi',
    }).success,
    true,
  );
});
