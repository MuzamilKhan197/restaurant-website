import test from 'node:test';
import assert from 'node:assert/strict';
import { createTicketSchema, replySchema, capability } from '../src/features/support/validation.ts';
test('support requests validate limits and strip forged staff or priority controls', () => {
  const request = {
    name: 'Guest',
    email: 'guest@example.com',
    subject: 'Question',
    body: 'Please help.',
    category: 'general',
    order_reference: '',
    priority: 'urgent',
    customer_id: 'forged',
  };
  const result = createTicketSchema.parse(request);
  assert.equal('priority' in result, false);
  assert.equal('customer_id' in result, false);
  assert.equal(createTicketSchema.safeParse({ ...request, body: ' ' }).success, false);
  assert.equal(
    createTicketSchema.safeParse({ ...request, subject: 'x'.repeat(151) }).success,
    false,
  );
  assert.equal(
    createTicketSchema.safeParse({ ...request, order_reference: 'bad-id' }).success,
    false,
  );
});
test('support reply requires a bounded message, idempotency UUID and strict secret format', () => {
  const reply = {
    reference: 'TKT-ABC',
    body: 'Please help.',
    internal: false,
    nonce: '10000000-0000-4000-8000-000000000001',
  };
  assert.equal(replySchema.safeParse(reply).success, true);
  assert.equal(replySchema.safeParse({ ...reply, nonce: 'bad' }).success, false);
  assert.equal(replySchema.safeParse({ ...reply, body: 'x'.repeat(5001) }).success, false);
  assert.equal(capability.safeParse('c'.repeat(64)).success, true);
  assert.equal(capability.safeParse('guess').success, false);
});
