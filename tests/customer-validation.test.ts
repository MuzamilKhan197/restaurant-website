import test from 'node:test';
import assert from 'node:assert/strict';
import { profileSchema, addressSchema } from '../src/features/customers/validation.ts';
test('profile trims names, limits contact details and strips forged identity fields', () => {
  assert.deepEqual(
    profileSchema.parse({
      name: '  Muzamil  ',
      phone: ' 03001234567 ',
      user_id: 'forged',
      email: 'forged@example.com',
    }),
    { name: 'Muzamil', phone: '03001234567' },
  );
  assert.equal(profileSchema.safeParse({ name: ' ', phone: '' }).success, false);
  assert.equal(profileSchema.safeParse({ name: 'Name', phone: '1'.repeat(31) }).success, false);
});
test('address validates limits and rejects malformed identifiers', () => {
  const address = {
    label: 'Home',
    address_line: '123 Main Street',
    area: 'Central',
    city: 'Karachi',
    instructions: '',
    is_default: true,
  };
  assert.equal(addressSchema.safeParse(address).success, true);
  assert.equal(addressSchema.safeParse({ ...address, id: 'not-a-uuid' }).success, false);
  assert.equal(addressSchema.safeParse({ ...address, address_line: 'x' }).success, false);
  assert.equal(
    addressSchema.safeParse({ ...address, instructions: 'x'.repeat(501) }).success,
    false,
  );
});
