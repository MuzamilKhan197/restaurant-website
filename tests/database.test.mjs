import test, { before, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTestDatabase, asUser } from './helpers/database.mjs';

const id = (prefix, number) =>
  `${prefix}0000000-0000-0000-0000-${String(number).padStart(12, '0')}`;
const R1 = id('1', 1),
  R2 = id('1', 2),
  OWNER = id('2', 1),
  OWNER2 = id('2', 2),
  SUPPORT = id('2', 3),
  MANAGER = id('2', 4),
  CUSTOMER = id('2', 5),
  OTHER = id('2', 6),
  OUTSIDER = id('2', 7),
  DEVELOPER = id('2', 8);
const C1 = id('3', 1),
  C2 = id('3', 2),
  P1 = id('5', 1),
  P2 = id('5', 2),
  O1 = id('7', 1),
  O2 = id('7', 2),
  O3 = id('7', 3),
  GUEST_ORDER = id('7', 4),
  T1 = id('a', 1),
  T2 = id('a', 2),
  M1 = id('b', 1),
  INTERNAL = id('b', 2);
let db;
const query = (sql, params = []) => db.query(sql, params);
const rows = async (table, where = '', params = []) =>
  (await query(`select * from ${table} ${where}`, params)).rows;
const user = (uid, fn) => asUser(db, uid, fn);
const anon = (fn) => asUser(db, null, fn, 'anon');
const service = (fn) => asUser(db, null, fn, 'service_role');
const scalar = async (sql, params = []) => Object.values((await query(sql, params)).rows[0])[0];

before(async () => {
  db = await createTestDatabase();
  await db.exec(await readFile(new URL('./helpers/fixtures.sql', import.meta.url), 'utf8'));
});
beforeEach(async () => {
  await db.exec('begin;');
});
afterEach(async () => {
  await db.exec('reset role; rollback;');
  await query("select set_config('request.jwt.claim.sub','',false)");
});
after(async () => {
  await db?.close();
});

test('all public application tables and private capability tables have RLS enabled', async () => {
  const unprotected = await query(
    "select tablename from pg_tables where schemaname in ('public','private') and not rowsecurity",
  );
  assert.deepEqual(unprotected.rows, []);
});
test('published catalog is readable but inactive products and inactive categories are hidden', async () => {
  const products = await anon(() => rows('public.products'));
  assert.deepEqual(products.map((row) => row.id).sort(), [P1, P2].sort());
  assert.equal((await anon(() => rows('public.product_variants'))).length, 2);
});
test('draft restaurants and their menus remain invisible to anonymous clients', async () => {
  await query('update public.restaurants set is_published=false where id=$1', [R2]);
  assert.equal((await anon(() => rows('public.restaurants'))).length, 1);
  assert.deepEqual(
    (await anon(() => rows('public.products'))).map((row) => row.id),
    [P1],
  );
  assert.equal(
    (await user(OWNER2, () => rows('public.restaurants', 'where id=$1', [R2]))).length,
    1,
  );
});
test('maintenance hides catalog while staff and existing customer orders remain accessible', async () => {
  await query(
    "update public.restaurant_settings set website_mode='maintenance' where restaurant_id=$1",
    [R1],
  );
  assert.equal(
    (await anon(() => rows('public.products', 'where restaurant_id=$1', [R1]))).length,
    0,
  );
  assert.equal(
    (await user(OWNER, () => rows('public.products', 'where restaurant_id=$1', [R1]))).length,
    3,
  );
  assert.equal((await user(CUSTOMER, () => rows('public.orders'))).length, 1);
});
test('orders-paused mode keeps browsing available', async () => {
  await query(
    "update public.restaurant_settings set website_mode='orders_paused' where restaurant_id=$1",
    [R1],
  );
  assert.equal(
    (await anon(() => rows('public.products', 'where restaurant_id=$1', [R1]))).length,
    1,
  );
});
test('anonymous clients cannot read order records, private contacts or guest keys', async () => {
  await assert.rejects(
    anon(() => rows('public.orders')),
    /permission denied/,
  );
  await assert.rejects(
    anon(() => rows('private.guest_access')),
    /permission denied/,
  );
  await assert.rejects(
    anon(() => rows('public.restaurant_customers')),
    /permission denied/,
  );
});
test('a customer can read only their own order, items, payment and address', async () => {
  assert.deepEqual(
    (await user(CUSTOMER, () => rows('public.orders'))).map((row) => row.id),
    [O1],
  );
  assert.equal((await user(CUSTOMER, () => rows('public.order_items'))).length, 1);
  assert.equal((await user(CUSTOMER, () => rows('public.payments'))).length, 1);
  assert.equal((await user(CUSTOMER, () => rows('public.customer_addresses'))).length, 1);
  assert.equal((await user(CUSTOMER, () => rows('public.restaurant_customers'))).length, 1);
});
test('owners and managers cannot read another restaurant orders', async () => {
  assert.equal((await user(OWNER, () => rows('public.orders', 'where id=$1', [O3]))).length, 0);
  assert.equal((await user(MANAGER, () => rows('public.orders'))).length, 3);
  assert.equal((await user(OWNER2, () => rows('public.orders'))).length, 1);
});
test('support can read tickets but cannot read orders or update menu prices', async () => {
  assert.equal((await user(SUPPORT, () => rows('public.support_tickets'))).length, 3);
  assert.equal((await user(SUPPORT, () => rows('public.orders'))).length, 0);
  const changed = await user(SUPPORT, () =>
    query('update public.products set base_price_minor=1 where id=$1 returning id', [P1]),
  );
  assert.equal(changed.rows.length, 0);
});
test('developer role does not automatically gain customer or financial access', async () => {
  assert.equal((await user(DEVELOPER, () => rows('public.orders'))).length, 0);
  assert.equal((await user(DEVELOPER, () => rows('public.restaurant_customers'))).length, 0);
  assert.equal((await user(DEVELOPER, () => rows('public.support_tickets'))).length, 0);
});
test('user-editable metadata cannot self-promote a customer', async () => {
  assert.equal(
    await user(CUSTOMER, () => scalar("select private.has_permission($1,'staff.manage')", [R1])),
    false,
  );
  await assert.rejects(
    user(CUSTOMER, () =>
      query(
        "insert into public.roles(restaurant_id,name,slug) values($1,'Admin imposter','imposter')",
        [R1],
      ),
    ),
    /row-level security/,
  );
});
test('only an owner can create custom roles and assign staff memberships', async () => {
  const created = await user(OWNER, () =>
    query(
      "insert into public.roles(restaurant_id,name,slug) values($1,'Custom role','custom-role') returning id",
      [R1],
    ),
  );
  assert.equal(created.rows.length, 1);
  await assert.rejects(
    user(MANAGER, () =>
      query("insert into public.roles(restaurant_id,name,slug) values($1,'Bad role','bad-role')", [
        R1,
      ]),
    ),
    /row-level security/,
  );
  await assert.rejects(
    user(SUPPORT, () =>
      query(
        "insert into public.staff_memberships(restaurant_id,user_id,role_id,status) select $1,$2,id,'active' from public.roles where restaurant_id=$1 and slug='manager'",
        [R1, OUTSIDER],
      ),
    ),
    /row-level security/,
  );
});
test('system roles cannot be deleted or renamed', async () => {
  await assert.rejects(
    user(OWNER, () =>
      query("update public.roles set name='Changed' where restaurant_id=$1 and slug='owner'", [R1]),
    ),
    /System role identity/,
  );
  const deleted = await user(OWNER, () =>
    query("delete from public.roles where restaurant_id=$1 and slug='owner' returning id", [R1]),
  );
  assert.equal(deleted.rows.length, 0);
});
test('assigning the Owner label to another user cannot transfer ownership', async () => {
  await assert.rejects(
    user(OWNER, () =>
      query(
        "insert into public.staff_memberships(restaurant_id,user_id,role_id,status) select $1,$2,id,'active' from public.roles where restaurant_id=$1 and slug='owner'",
        [R1, OUTSIDER],
      ),
    ),
    /Owner identity/,
  );
});
test('revoked or suspended staff lose permission immediately, without JWT changes', async () => {
  assert.equal(
    await user(SUPPORT, () => scalar("select private.has_permission($1,'support.read')", [R1])),
    true,
  );
  await query(
    "update public.staff_memberships set status='suspended' where restaurant_id=$1 and user_id=$2",
    [R1, SUPPORT],
  );
  assert.equal(
    await user(SUPPORT, () => scalar("select private.has_permission($1,'support.read')", [R1])),
    false,
  );
  assert.equal((await user(SUPPORT, () => rows('public.support_tickets'))).length, 0);
});
test('composite foreign keys reject cross-restaurant category references', async () => {
  await assert.rejects(
    service(() =>
      query(
        "insert into public.products(restaurant_id,category_id,name,slug,base_price_minor) values($1,$2,'Cross tenant','cross-tenant',100)",
        [R1, id('4', 2)],
      ),
    ),
    /foreign key/,
  );
});
test('composite foreign keys reject cross-restaurant staff role references', async () => {
  const foreignRole = await scalar(
    "select id from public.roles where restaurant_id=$1 and slug='manager'",
    [R2],
  );
  await assert.rejects(
    user(OWNER, () =>
      query(
        "insert into public.staff_memberships(restaurant_id,user_id,role_id,status) values($1,$2,$3,'active')",
        [R1, OUTSIDER, foreignRole],
      ),
    ),
    /row-level security|foreign key/,
  );
});
test('customer addresses cannot be moved to another customer or tenant', async () => {
  await assert.rejects(
    user(CUSTOMER, () =>
      query('update public.customer_addresses set customer_id=$1 where customer_id=$2', [C2, C1]),
    ),
    /permission denied/,
  );
  await assert.rejects(
    service(() =>
      query('update public.customer_addresses set restaurant_id=$1 where customer_id=$2', [R2, C1]),
    ),
    /Immutable identity/,
  );
});
test('clients cannot submit fabricated order prices or modify historical item snapshots', async () => {
  await assert.rejects(
    user(OWNER, () => query('update public.orders set total_minor=1 where id=$1', [O1])),
    /permission denied/,
  );
  await assert.rejects(
    user(CUSTOMER, () =>
      query(
        "insert into public.order_items(restaurant_id,order_id,product_id,product_name,quantity,unit_price_minor,line_total_minor) values($1,$2,$3,'Fake',1,0,0)",
        [R1, O1, P1],
      ),
    ),
    /permission denied/,
  );
  await assert.rejects(
    service(() =>
      query('update public.order_items set unit_price_minor=1 where order_id=$1', [O1]),
    ),
    /Historical records are immutable/,
  );
});
test('menu price changes preserve original order names and prices', async () => {
  await user(MANAGER, () =>
    query("update public.products set name='New name',base_price_minor=200000 where id=$1", [P1]),
  );
  const item = (
    await user(CUSTOMER, () => rows('public.order_items', 'where order_id=$1', [O1]))
  )[0];
  assert.equal(item.product_name, 'Dish one original');
  assert.equal(item.unit_price_minor, 100000);
});
test('customers cannot advance order states; staff workflow rejects skipping steps', async () => {
  assert.equal(
    (
      await user(CUSTOMER, () =>
        query("update public.orders set status='accepted' where id=$1 returning id", [O1]),
      )
    ).rows.length,
    0,
  );
  await assert.rejects(
    user(MANAGER, () => query("update public.orders set status='completed' where id=$1", [O1])),
    /Invalid order status/,
  );
  assert.equal(
    (
      await user(MANAGER, () =>
        query("update public.orders set status='accepted' where id=$1 returning status", [O1]),
      )
    ).rows[0].status,
    'accepted',
  );
});
test('cash payment cannot change amounts, cancellation records a refund due', async () => {
  await assert.rejects(
    user(MANAGER, () => query('update public.payments set amount_minor=1 where order_id=$1', [O1])),
    /permission denied/,
  );
  await user(MANAGER, () =>
    query("update public.payments set status='paid',recorded_by=$1 where order_id=$2", [
      MANAGER,
      O1,
    ]),
  );
  await user(MANAGER, () =>
    query(
      "update public.orders set status='cancelled',cancellation_reason='Test cancellation' where id=$1",
      [O1],
    ),
  );
  assert.equal(
    await scalar('select status from public.payments where order_id=$1', [O1]),
    'refund_due',
  );
  await user(MANAGER, () =>
    query("update public.payments set status='refunded' where order_id=$1", [O1]),
  );
  assert.equal(
    await scalar('select status from public.payments where order_id=$1', [O1]),
    'refunded',
  );
});
test('internal support notes are hidden from customers, including attachment metadata', async () => {
  assert.deepEqual(
    (await user(CUSTOMER, () => rows('public.support_messages'))).map((row) => row.id),
    [M1],
  );
  const attachments = await user(CUSTOMER, () => rows('public.support_attachments'));
  assert.equal(attachments.length, 2);
  assert.ok(
    attachments.every((row) => row.filename !== 'internal.pdf' && row.filename !== 'other.pdf'),
  );
  assert.equal((await user(SUPPORT, () => rows('public.support_messages'))).length, 3);
});
test('customers can reply only to their own open ticket and cannot impersonate staff', async () => {
  const insert = (ticket, authorType = 'customer', internal = false) =>
    query(
      'insert into public.support_messages(restaurant_id,ticket_id,author_user_id,author_type,body,is_internal) values($1,$2,$3,$4,$5,$6)',
      [R1, ticket, CUSTOMER, authorType, 'A follow-up question', internal],
    );
  await user(CUSTOMER, () => insert(T1));
  await assert.rejects(
    user(CUSTOMER, () => insert(T2)),
    /row-level security/,
  );
  await assert.rejects(
    user(CUSTOMER, () => insert(T1, 'staff', true)),
    /row-level security/,
  );
  await query("update public.support_tickets set status='closed' where id=$1", [T1]);
  await assert.rejects(
    user(CUSTOMER, () => insert(T1)),
    /row-level security/,
  );
});
test('private buckets expose only visible menu objects to anonymous clients', async () => {
  assert.ok((await rows('storage.buckets')).every((bucket) => bucket.public === false));
  const files = await anon(() => rows('storage.objects'));
  assert.equal(files.length, 1);
  assert.match(files[0].name, /plate\.jpg$/);
});
test('private attachments require ticket access and cannot expose internal or other files', async () => {
  const files = await user(CUSTOMER, () =>
    rows('storage.objects', "where bucket_id='ticket-attachments'"),
  );
  assert.equal(files.length, 1);
  assert.match(files[0].name, /public\.pdf$/);
  assert.equal(
    (await user(OUTSIDER, () => rows('storage.objects', "where bucket_id='ticket-attachments'")))
      .length,
    0,
  );
});
test('attachment uploads need a matching pending reservation and owner', async () => {
  const path = `${R1}/tickets/${T1}/pending.pdf`;
  await user(CUSTOMER, () =>
    query(
      "insert into storage.objects(bucket_id,name,owner_id) values('ticket-attachments',$1,$2)",
      [path, CUSTOMER],
    ),
  );
  assert.equal(
    (await user(CUSTOMER, () => rows('storage.objects', 'where name=$1', [path]))).length,
    0,
  );
  await assert.rejects(
    user(OTHER, () =>
      query(
        "insert into storage.objects(bucket_id,name,owner_id) values('ticket-attachments',$1,$2)",
        [`${R1}/tickets/${T1}/unreserved.pdf`, OTHER],
      ),
    ),
    /row-level security/,
  );
});
test('malformed and cross-tenant Storage paths fail closed without UUID-cast errors', async () => {
  await assert.rejects(
    user(MANAGER, () =>
      query("insert into storage.objects(bucket_id,name,owner_id) values('menu-images',$1,$2)", [
        'not-a-uuid/products/not-a-product/file.jpg',
        MANAGER,
      ]),
    ),
    /row-level security/,
  );
  await assert.rejects(
    user(MANAGER, () =>
      query("insert into storage.objects(bucket_id,name,owner_id) values('menu-images',$1,$2)", [
        `${R2}/products/${P2}/fake.jpg`,
        MANAGER,
      ]),
    ),
    /row-level security/,
  );
  await assert.rejects(
    user(MANAGER, () =>
      query(
        'insert into public.product_images(restaurant_id,product_id,object_path,alt_text) values($1,$2,$3,$4)',
        [R1, P1, `${R1}/products/${P2}/wrong.jpg`, 'Wrong product'],
      ),
    ),
    /Product image path/,
  );
});
test('guest lookup RPC is server-only and validates hash, resource kind and reference', async () => {
  const resolve = (kind, reference, token) =>
    query('select * from public.resolve_guest_access($1,$2,$3)', [kind, reference, token]);
  await assert.rejects(
    anon(() => resolve('order', 'ORD-GUEST', 'a'.repeat(64))),
    /permission denied/,
  );
  await assert.rejects(
    user(OWNER, () => resolve('order', 'ORD-GUEST', 'a'.repeat(64))),
    /permission denied/,
  );
  assert.equal(
    (await service(() => resolve('order', 'ORD-GUEST', 'a'.repeat(64)))).rows[0].resource_id,
    GUEST_ORDER,
  );
  assert.equal(
    (await service(() => resolve('ticket', 'ORD-GUEST', 'a'.repeat(64)))).rows.length,
    0,
  );
  assert.equal((await service(() => resolve('order', 'ORD-ONE', 'a'.repeat(64)))).rows.length, 0);
  assert.equal((await service(() => resolve('order', 'ORD-GUEST', 'c'.repeat(64)))).rows.length, 0);
});
test('revoked and expired guest capabilities cannot be used', async () => {
  await query("update private.guest_access set revoked_at=now() where resource_type='order'");
  assert.equal(
    (
      await service(() =>
        query("select * from public.resolve_guest_access('order','ORD-GUEST',$1)", [
          'a'.repeat(64),
        ]),
      )
    ).rows.length,
    0,
  );
  await query(
    "update private.guest_access set created_at=now()-interval '2 days',expires_at=now()-interval '1 day' where resource_type='ticket'",
  );
  assert.equal(
    (
      await service(() =>
        query("select * from public.resolve_guest_access('ticket','TKT-GUEST',$1)", [
          'b'.repeat(64),
        ]),
      )
    ).rows.length,
    0,
  );
});
test('guest key relationships cannot target registered orders or cross-tenant resources', async () => {
  await assert.rejects(
    service(() =>
      query(
        "insert into private.guest_access(restaurant_id,resource_type,resource_id,token_hash,expires_at) values($1,'order',$2,repeat('d',64),now()+interval '1 day')",
        [R1, O1],
      ),
    ),
    /guest order/,
  );
  await assert.rejects(
    service(() =>
      query(
        "insert into private.guest_access(restaurant_id,resource_type,resource_id,token_hash,expires_at) values($1,'order',$2,repeat('e',64),now()+interval '1 day')",
        [R2, GUEST_ORDER],
      ),
    ),
    /guest order/,
  );
});
test('audit entries are tenant-scoped, non-editable and omit contact snapshots', async () => {
  const audit = await user(OWNER, () => rows('public.audit_logs'));
  assert.ok(audit.length > 0 && audit.every((row) => row.restaurant_id === R1));
  assert.ok(audit.every((row) => !JSON.stringify(row.metadata).includes('@example.com')));
  await assert.rejects(
    user(OWNER, () =>
      query(
        "insert into public.audit_logs(restaurant_id,action,entity_type) values($1,'forged','orders')",
        [R1],
      ),
    ),
    /permission denied/,
  );
  await assert.rejects(
    service(() =>
      query("update public.audit_logs set action='forged' where restaurant_id=$1", [R1]),
    ),
    /Historical records/,
  );
  assert.equal((await user(SUPPORT, () => rows('public.audit_logs'))).length, 0);
});
test('Realtime publication contains only minimal status events, and RLS still scopes reads', async () => {
  const tables = (
    await query("select tablename from pg_publication_tables where pubname='supabase_realtime'")
  ).rows.map((row) => row.tablename);
  assert.deepEqual(tables, ['order_status_events']);
  assert.equal((await user(CUSTOMER, () => rows('public.order_status_events'))).length, 1);
  assert.equal((await user(OUTSIDER, () => rows('public.order_status_events'))).length, 0);
});
test('schema version endpoint exposes a constant, not private configuration', async () => {
  assert.equal(await anon(() => scalar('select public.platform_schema_version()')), 9);
});

test('website mode requires verified scoped access and rejects stale writes', async () => {
  await query("update auth.users set email='developer@example.invalid',email_confirmed_at=now() where id=$1",[DEVELOPER]);
  const current=await scalar('select updated_at::text from public.restaurant_settings where restaurant_id=$1',[R1]);
  const save=(tenant,expected)=>query("select public.save_website_mode($1,'maintenance','Back soon',null,$2)",[tenant,expected]);
  await assert.rejects(anon(()=>save(R1,current)),/permission denied/);
  await assert.rejects(user(CUSTOMER,()=>save(R1,current)));
  await assert.rejects(user(DEVELOPER,()=>save(R2,current)),/Website access required/);
  await user(DEVELOPER,()=>save(R1,current));
  assert.equal(await scalar('select website_mode from public.restaurant_settings where restaurant_id=$1',[R1]),'maintenance');
  await assert.rejects(user(DEVELOPER,()=>save(R1,'2025-01-01T00:00:00Z')),/Settings changed/);
  assert.equal((await anon(()=>rows('public.products'))).some(p=>p.restaurant_id===R1),false);
  assert.ok((await user(MANAGER,()=>rows('public.orders'))).length>0);
});

test('cash collection records the authenticated actor instead of a forged user id', async () => {
  await user(OWNER, () =>
    query("update public.payments set status='paid',recorded_by=$1 where order_id=$2", [
      OUTSIDER,
      O1,
    ]),
  );
  assert.equal(
    await scalar('select recorded_by from public.payments where order_id=$1', [O1]),
    OWNER,
  );
});

test('support tickets cannot link a different customer order or an unqualified assignee', async () => {
  await assert.rejects(
    service(() =>
      query(
        "insert into public.support_tickets(restaurant_id,customer_id,order_id,subject,contact_name,contact_email) values($1,$2,$3,'Wrong order','Customer','customer@example.com')",
        [R1, C1, O2],
      ),
    ),
    /customer must match/,
  );
  await assert.rejects(
    service(() =>
      query('update public.support_tickets set assigned_to=$1 where id=$2', [id('d', 3), T1]),
    ),
    /active support staff/,
  );
  await user(OWNER, () =>
    query('update public.support_tickets set assigned_to=$1 where id=$2', [id('d', 1), T1]),
  );
});

test('deferred checks reject empty orders and inconsistent line-item totals', async () => {
  await assert.rejects(
    service(async () => {
      await query(
        "insert into public.orders(restaurant_id,reference,method,payment_method,currency,contact_name,contact_email,contact_phone,subtotal_minor,total_minor) values($1,'ORD-EMPTY','pickup','pay_at_pickup','PKR','Guest','guest@example.com','03001234567',100,100)",
        [R1],
      );
      await db.exec('set constraints all immediate;');
    }),
    /subtotal must match/,
  );
  await assert.rejects(
    service(async () => {
      const order = await scalar(
        "insert into public.orders(restaurant_id,reference,method,payment_method,currency,contact_name,contact_email,contact_phone,subtotal_minor,total_minor) values($1,'ORD-MISMATCH','pickup','pay_at_pickup','PKR','Guest','guest@example.com','03001234567',100,100) returning id",
        [R1],
      );
      await query(
        "insert into public.order_items(restaurant_id,order_id,product_id,product_name,quantity,unit_price_minor,line_total_minor) values($1,$2,$3,'Dish',1,50,50)",
        [R1, order, P1],
      );
      await db.exec('set constraints all immediate;');
    }),
    /subtotal must match/,
  );
});

test('menu managers can create categories and dishes while support cannot change prices',async()=>{
  const category=await user(OWNER,()=>scalar("insert into public.categories(restaurant_id,name,slug,sort_order) values($1,'Seasonal','seasonal',3) returning id",[R1]));
  const dish=await user(MANAGER,()=>scalar("insert into public.products(restaurant_id,category_id,name,slug,base_price_minor,is_available) values($1,$2,'Seasonal dish','seasonal-dish',125050,false) returning id",[R1,category]));
  assert.equal(await scalar('select base_price_minor from public.products where id=$1',[dish]),125050);
  const result=await user(SUPPORT,()=>query('update public.products set base_price_minor=1 where id=$1 returning id',[dish]));assert.equal(result.rows.length,0);
  await user(OWNER,()=>query('delete from public.products where id=$1',[dish]));
  await user(OWNER,()=>query('delete from public.categories where id=$1',[category]));
});

test('default variant replacement is atomic and failed edits preserve the existing default',async()=>{
  const created=await user(OWNER,()=>scalar("select public.save_menu_variant($1,$2,null,'Family',250000,true,true,2)",[R1,P1]));
  assert.equal(await scalar('select count(*)::int from public.product_variants where product_id=$1 and is_default',[P1]),1);
  assert.equal(await scalar('select id from public.product_variants where product_id=$1 and is_default',[P1]),created);
  await assert.rejects(user(OWNER,()=>scalar("select public.save_menu_variant($1,$2,null,'',10,true,true,0)",[R1,P1])),/check constraint/);
  assert.equal(await scalar('select id from public.product_variants where product_id=$1 and is_default',[P1]),created);
  await assert.rejects(user(OWNER,()=>scalar("select public.save_menu_variant($1,$2,$3,'Wrong',10,true,true,0)",[R1,P1,id('6',2)])),/Variant unavailable/);
  await assert.rejects(user(OWNER,()=>scalar("select public.save_menu_variant($1,$2,null,'Wrong tenant',10,true,true,0)",[R1,P2])),/Dish unavailable/);
});

test('read-only menu roles can inspect private dishes but cannot mutate variants',async()=>{
  const role=await scalar("insert into public.roles(restaurant_id,name,slug) values($1,'Menu viewer','menu-viewer') returning id",[R1]);
  await query("insert into public.role_permissions(restaurant_id,role_id,permission_key) values($1,$2,'menu.read')",[R1,role]);
  await query("insert into public.staff_memberships(restaurant_id,user_id,role_id,status) values($1,$2,$3,'active')",[R1,OUTSIDER,role]);
  assert.equal((await user(OUTSIDER,()=>rows('public.products','where restaurant_id=$1',[R1]))).length,3);
  await assert.rejects(user(OUTSIDER,()=>scalar("select public.save_menu_variant($1,$2,null,'Forged',1,true,true,0)",[R1,P1])),/Menu management required/);
  await assert.rejects(anon(()=>scalar("select public.save_menu_variant($1,$2,null,'Forged',1,true,true,0)",[R1,P1])),/permission denied/);
});

test('add-on groups link only within the restaurant and enforce choice limits',async()=>{
  const group=await user(OWNER,()=>scalar("insert into public.addon_groups(restaurant_id,name,min_selections,max_selections) values($1,'Sides',0,2) returning id",[R1]));
  const addon=await user(OWNER,()=>scalar("insert into public.addons(restaurant_id,addon_group_id,name,price_minor) values($1,$2,'Fries',25000) returning id",[R1,group]));
  assert.equal((await anon(()=>rows('public.addons','where id=$1',[addon]))).length,0);
  await user(OWNER,()=>query('insert into public.product_addon_groups(restaurant_id,product_id,addon_group_id) values($1,$2,$3)',[R1,P1,group]));
  assert.equal((await anon(()=>rows('public.addons','where id=$1',[addon]))).length,1);
  await assert.rejects(service(()=>query('insert into public.product_addon_groups(restaurant_id,product_id,addon_group_id) values($1,$2,$3)',[R2,P2,group])),/foreign key/);
  await assert.rejects(user(OWNER,()=>query('update public.addon_groups set min_selections=3,max_selections=1 where id=$1',[group])),/check constraint/);
});
