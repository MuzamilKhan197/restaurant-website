import { sampleDishes } from '../src/features/menu/data.ts';
import { writeFile } from 'node:fs/promises';
const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const restaurant = '01000000-0000-0000-0000-000000000001';
const uuid = (prefix, number) =>
  `${prefix}000000-0000-0000-0000-${String(number).padStart(12, '0')}`;
const categories = [...new Set(sampleDishes.map((d) => d.category))];
let sql = `-- Development-only sample catalog: no accounts, PII, orders or uploaded files.
-- Draft and ordering-paused by default. Never seed a live client restaurant.
begin;
insert into public.restaurants(id,name,slug,is_sample,is_published) values (${quote(restaurant)},'Saffron & Ember','saffron-and-ember',true,false) on conflict (id) do nothing;
`;
for (const [i, name] of categories.entries())
  sql += `insert into public.categories(id,restaurant_id,name,slug,sort_order) values (${quote(uuid('02', i + 1))},${quote(restaurant)},${quote(name)},${quote(name.toLowerCase().replaceAll(' ', '-'))},${i}) on conflict (id) do nothing;\n`;
for (const [i, d] of sampleDishes.entries())
  sql += `insert into public.products(id,restaurant_id,category_id,name,slug,description,base_price_minor,dietary_labels,allergens,is_available,is_featured,sort_order) values (${quote(uuid('03', i + 1))},${quote(restaurant)},${quote(uuid('02', categories.indexOf(d.category) + 1))},${quote(d.name)},${quote(d.id)},${quote(d.description)},${d.price * 100},array[${d.tags.map((t) => quote(t.toLowerCase().replaceAll('-', '_'))).join(',')}]::text[],array[${d.allergens
    .split(',')
    .map((s) => quote(s.trim()))
    .join(
      ',',
    )}]::text[],${d.available},${Boolean(d.featured)},${i}) on conflict (id) do nothing;\n`;
await writeFile(new URL('../supabase/seed.sql', import.meta.url), sql + 'commit;\n');
console.log(`Generated ${categories.length} categories and ${sampleDishes.length} draft products.`);
