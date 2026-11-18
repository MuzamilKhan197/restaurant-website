import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTestDatabase } from './helpers/database.mjs';

test('development seed is repeatable, unpublished, paused and free of customer records', async () => {
  const db = await createTestDatabase({ seed: true });
  try {
    await db.exec(await readFile(new URL('../supabase/seed.sql', import.meta.url), 'utf8'));
    const restaurant = (await db.query('select * from public.restaurants')).rows[0];
    assert.equal(restaurant.owner_user_id, null);
    assert.equal(restaurant.is_published, false);
    assert.equal(
      (await db.query('select website_mode from public.restaurant_settings')).rows[0].website_mode,
      'orders_paused',
    );
    assert.equal((await db.query('select count(*)::int as n from public.products')).rows[0].n, 12);
    assert.equal(
      (await db.query("select base_price_minor from public.products where slug='chicken'")).rows[0]
        .base_price_minor,
      195000,
    );
    for (const table of ['orders', 'restaurant_customers', 'staff_memberships', 'support_tickets'])
      assert.equal((await db.query(`select count(*)::int as n from public.${table}`)).rows[0].n, 0);
    await db.exec('set role anon;');
    assert.deepEqual((await db.query('select * from public.products')).rows, []);
  } finally {
    await db.close();
  }
});
