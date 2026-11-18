import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleDishes } from '../src/features/menu/data.ts';
import { filterDishes, formatPrice } from '../src/features/menu/utils.ts';
import { parsePublicEnvironment } from '../src/lib/env.ts';

test('menu searches are case-insensitive and ignore surrounding whitespace', () => {
  assert.deepEqual(
    filterDishes(sampleDishes, { query: '  MUSHROOM  ' }).map((dish) => dish.id),
    ['pasta'],
  );
});
test('category, search and dietary filters work together', () => {
  assert.deepEqual(
    filterDishes(sampleDishes, { category: 'Starters', vegetarianOnly: true, query: 'smoky' }).map(
      (dish) => dish.id,
    ),
    ['hummus'],
  );
  assert.equal(
    filterDishes(sampleDishes, { category: 'From the grill', vegetarianOnly: true }).length,
    0,
  );
});
test('vegetarian filtering includes vegan options and excludes meat and fish', () => {
  const ids = filterDishes(sampleDishes, { vegetarianOnly: true }).map((dish) => dish.id);
  assert.ok(ids.includes('hummus') && ids.includes('bowl') && ids.includes('pasta'));
  assert.ok(!ids.includes('chicken') && !ids.includes('salmon'));
});
test('empty search results are recoverable by resetting filters', () => {
  assert.equal(filterDishes(sampleDishes, { query: 'not-a-dish' }).length, 0);
  assert.equal(filterDishes(sampleDishes, {}).length, sampleDishes.length);
});
test('sample catalogue retains unique routes and original prices', () => {
  assert.equal(new Set(sampleDishes.map((dish) => dish.id)).size, sampleDishes.length);
  assert.equal(sampleDishes.length, 12);
  assert.equal(sampleDishes.find((dish) => dish.id === 'chicken')?.price, 1950);
  assert.ok(sampleDishes.every((dish) => Number.isInteger(dish.price) && dish.price > 0));
});
test('currency formatting does not add fractional rupees', () => {
  assert.match(formatPrice(1950), /1,950/);
  assert.ok(!formatPrice(1950).includes('.00'));
});
test('currency formatting preserves fractional menu prices', () => {
  assert.match(formatPrice(1950.25), /1,950\.25/);
  assert.match(formatPrice(12.5, 'USD'), /12\.50/);
});
test('foundation starts without Supabase credentials', () => {
  assert.deepEqual(parsePublicEnvironment({}), {
    NEXT_PUBLIC_SUPABASE_URL: undefined,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
  });
});
test('partial Supabase configuration fails clearly', () => {
  assert.throws(
    () => parsePublicEnvironment({ NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co' }),
    /Configure both/,
  );
  assert.throws(
    () =>
      parsePublicEnvironment({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example' }),
    /Configure both/,
  );
});
test('Supabase configuration rejects invalid or insecure URLs', () => {
  assert.throws(() =>
    parsePublicEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: 'not a url',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
    }),
  );
  assert.throws(
    () =>
      parsePublicEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: 'http://project.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
      }),
    /HTTPS/,
  );
});
test('public configuration never forwards private environment keys', () => {
  const parsed = parsePublicEnvironment({
    NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
    SUPABASE_SERVICE_ROLE_KEY: 'private-test-key',
    ADMIN_PASSWORD: 'private-test-password',
  });
  assert.equal(Object.keys(parsed).length, 2);
  assert.ok(!JSON.stringify(parsed).includes('private-test'));
});

test('public configuration rejects server secret keys', () => {
  for (const key of ['sb_secret_example', 'eyJhbGciOiJIUzI1NiJ9.service_role']) {
    assert.throws(
      () =>
        parsePublicEnvironment({
          NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
        }),
      /public key/,
    );
  }
});

test('local Supabase HTTP is allowed only for loopback hosts', () => {
  assert.equal(
    parsePublicEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
    }).NEXT_PUBLIC_SUPABASE_URL,
    'http://127.0.0.1:54321',
  );
  assert.throws(
    () =>
      parsePublicEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: 'http://localhost.evil.test',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
      }),
    /HTTPS/,
  );
});
