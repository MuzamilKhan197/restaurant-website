import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePrice,
  productSchema,
  groupSchema,
  variantSchema,
  validateImage,
  MAX_IMAGE_SIZE,
} from '../src/features/menu/validation.ts';
test('money input converts decimal rupees exactly and rejects unsafe formats', () => {
  assert.equal(parsePrice('1950.10'), 195010);
  assert.equal(parsePrice('0.01'), 1);
  assert.equal(parsePrice('19.9'), 1990);
  for (const bad of ['-1', '1.001', '1e3', 'NaN', 'Infinity', '1,000', '1000000.01', ''])
    assert.throws(() => parsePrice(bad));
});
test('dish validation preserves controlled attributes and rejects unsupported dietary claims', () => {
  const dish = {
    name: 'Pasta',
    slug: 'pasta',
    category_id: '40000000-0000-4000-8000-000000000001',
    price: '1650',
    description: 'Fresh pasta',
    allergens: 'Wheat, Milk',
    sort_order: 0,
    is_active: true,
    is_available: false,
    is_featured: false,
    dietary_labels: ['vegetarian'],
  };
  const result = productSchema.parse(dish);
  assert.equal(result.price, 165000);
  assert.deepEqual(result.allergens, ['Wheat', 'Milk']);
  assert.equal(result.is_available, false);
  assert.ok(!productSchema.safeParse({ ...dish, dietary_labels: ['allergen_free'] }).success);
});
test('add-on limits and default variant availability are validated before database writes', () => {
  assert.ok(
    !groupSchema.safeParse({
      name: 'Extras',
      min_selections: 3,
      max_selections: 2,
      is_active: true,
    }).success,
  );
  assert.ok(
    !variantSchema.safeParse({
      product_id: '50000000-0000-4000-8000-000000000001',
      name: 'Large',
      price: '200',
      sort_order: 0,
      is_active: false,
      is_default: true,
    }).success,
  );
});
test('image boundaries reject SVG, misleading MIME types and oversized content', () => {
  const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(validateImage(png, 'image/png'), 'png');
  assert.throws(() => validateImage(png, 'image/jpeg'));
  assert.throws(() => validateImage(new TextEncoder().encode('<svg></svg>'), 'image/svg+xml'));
  assert.throws(() => validateImage(new Uint8Array(MAX_IMAGE_SIZE + 1), 'image/png'));
  assert.throws(() => validateImage(new Uint8Array(), 'image/png'));
});
