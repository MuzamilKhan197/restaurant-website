import test,{before,beforeEach,afterEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTestDatabase,asUser} from './helpers/database.mjs';
const id=(p,n)=>p+'0000000-0000-0000-0000-'+String(n).padStart(12,'0');
const R=id('1',1),R2=id('1',2),P=id('5',1),V=id('6',1),U=id('2',5),OWNER=id('2',1),SUPPORT=id('2',3),TOKEN='c'.repeat(64);
let db;const q=(sql,p=[])=>db.query(sql,p);const scalar=async(sql,p=[])=>Object.values((await q(sql,p)).rows[0])[0];
const anon=fn=>asUser(db,null,fn,'anon'),user=(uid,fn)=>asUser(db,uid,fn);
const cart=[{product_id:P,variant_id:V,quantity:2,addon_ids:[]}];
const checkout={method:'pickup',name:'Guest',email:'guest@example.com',phone:'03001234567',notes:''};
const quote=(items=cart,method='pickup',zone=null)=>scalar('select public.quote_cart($1,$2,$3,$4)',[R,JSON.stringify(items),method,zone]);
const place=(items=cart,contact=checkout,token=TOKEN,total=2000)=>scalar('select public.place_customer_order($1,$2,$3,$4,$5)',[R,JSON.stringify(items),JSON.stringify(contact),token,total]);
before(async()=>{db=await createTestDatabase();await db.exec(await readFile(new URL('./helpers/fixtures.sql',import.meta.url),'utf8'));await q("update auth.users set email='verified@example.com',email_confirmed_at=now()");await q('update public.product_variants set price_minor=1000 where id=$1',[V]);});
beforeEach(async()=>db.exec('begin'));
afterEach(async()=>{await db.exec('reset role;rollback');await q("select set_config('request.jwt.claim.sub','',false)");});
after(async()=>db?.close());
test('quote ignores client prices and computes exact server snapshots and tax',async()=>{
 const result=await anon(()=>quote([{...cart[0],unit_price_minor:1,total_minor:1}]));assert.equal(result.subtotal_minor,2000);assert.equal(result.items[0].unit_price_minor,1000);
 await q('update public.restaurant_settings set tax_rate_bps=1750 where restaurant_id=$1',[R]);const tax=await anon(()=>quote());assert.equal(tax.tax_minor,350);assert.equal(tax.total_minor,2350);
});
test('guest order commits matching items, unpaid cash payment, status and capability atomically',async()=>{
 const result=await anon(()=>place());await db.exec('set constraints all immediate');
 assert.equal(await scalar('select count(*)::int from public.order_items where order_id=$1',[result.id]),1);
 assert.equal(await scalar('select status from public.payments where order_id=$1',[result.id]),'unpaid');
 assert.equal(await scalar('select status from public.orders where id=$1',[result.id]),'pending');
 assert.equal(await scalar('select customer_id from public.orders where id=$1',[result.id]),null);
});
test('same checkout token retries return one order and edited payload fails',async()=>{
 const first=await anon(()=>place()),second=await anon(()=>place());assert.equal(first.id,second.id);
 await assert.rejects(anon(()=>place(cart,{...checkout,name:'Changed'})),/cannot be reused/);
 assert.equal(await scalar('select count(*)::int from private.idempotency_keys where resource_id=$1',[first.id]),1);
});
test('quote rejects inactive, foreign and missing variant choices and invalid quantities',async()=>{
 for(const item of [{...cart[0],product_id:id('5',2)},{...cart[0],product_id:id('5',3)},{...cart[0],variant_id:null},{...cart[0],variant_id:id('6',2)},{...cart[0],quantity:0},{...cart[0],quantity:21}]){
  await assert.rejects(anon(()=>quote([item])));
 }
 await assert.rejects(anon(()=>quote([])));
});
test('pause, maintenance and draft block new quotes/orders and price changes require review',async()=>{
 await assert.rejects(anon(()=>place(cart,checkout,TOKEN,1)),/Prices changed/);
 assert.equal(await scalar('select count(*)::int from private.idempotency_keys'),0);
 for(const mode of ['orders_paused','maintenance']){await q('update public.restaurant_settings set website_mode=$1 where restaurant_id=$2',[mode,R]);await assert.rejects(anon(()=>quote()),/unavailable/);}
 await q("update public.restaurant_settings set website_mode='normal' where restaurant_id=$1",[R]);await q('update public.restaurants set is_published=false where id=$1',[R]);await assert.rejects(anon(()=>place()),/unavailable/);
});
test('capability requires matching tenant, reference and unexpired secret without contact exposure',async()=>{
 const order=await anon(()=>place());
 const read=(tenant,ref,token)=>anon(()=>scalar('select public.read_order_capability($1,$2,$3)',[tenant,ref,token]));
 const view=await read(R,order.reference,TOKEN);assert.equal(view.total_minor,2000);assert.equal(view.contact_email,undefined);assert.equal(view.items[0].quantity,2);
 assert.equal(await read(R2,order.reference,TOKEN),null);assert.equal(await read(R,order.reference,'d'.repeat(64)),null);assert.equal(await read(R,'ORD-OTHER',TOKEN),null);
 await q("update private.guest_access set revoked_at=now() where resource_id=$1",[order.id]);assert.equal(await read(R,order.reference,TOKEN),null);
});
test('confirmed customer association is derived from Auth and persists original menu prices',async()=>{
 const order=await user(U,()=>place());assert.equal(await scalar('select customer_id from public.orders where id=$1',[order.id]),id('3',1));
 await user(OWNER,()=>q('update public.product_variants set price_minor=9000 where id=$1',[V]));
 assert.equal(await scalar('select unit_price_minor from public.order_items where order_id=$1',[order.id]),1000);
});
test('support-only role cannot alter an order while owner follows legal status transitions',async()=>{
 const order=await anon(()=>place());
 assert.equal((await user(SUPPORT,()=>q("update public.orders set status='accepted' where id=$1 returning id",[order.id]))).rows.length,0);
 await user(OWNER,()=>q("update public.orders set status='accepted' where id=$1",[order.id]));
 await assert.rejects(user(OWNER,()=>q("update public.orders set status='completed' where id=$1",[order.id])),/Invalid order/);
});
test('required extras enforce links, availability, uniqueness and min/max selections',async()=>{
 const group=id('e',1),extra=id('f',1);
 await q("insert into public.addon_groups(id,restaurant_id,name,min_selections,max_selections) values($1,$2,'Choose extra',1,1)",[group,R]);
 await q('insert into public.product_addon_groups(restaurant_id,product_id,addon_group_id) values($1,$2,$3)',[R,P,group]);
 await q("insert into public.addons(id,restaurant_id,addon_group_id,name,price_minor) values($1,$2,$3,'Cheese',250)",[extra,R,group]);
 await assert.rejects(anon(()=>quote()),/required extras/);
 const items=[{...cart[0],addon_ids:[extra]}];const result=await anon(()=>quote(items));assert.equal(result.total_minor,2500);
 const order=await anon(()=>place(items,checkout,TOKEN,2500));await db.exec('set constraints all immediate');
 assert.equal(await scalar('select addon_name from public.order_item_addons where order_id=$1',[order.id]),'Cheese');
 await assert.rejects(anon(()=>quote([{...cart[0],addon_ids:[extra,extra]}])),/Invalid extras/);
 await q('update public.addons set is_available=false where id=$1',[extra]);await assert.rejects(anon(()=>quote(items)),/unavailable/);
});
test('delivery checks enabled areas, minimum, address and authoritative fee',async()=>{
 const zone=id('e',2);
 await q("insert into public.delivery_zones(id,restaurant_id,name) values($1,$2,'Central')",[zone,R]);
 await assert.rejects(anon(()=>quote(cart,'delivery',zone)),/unavailable/);
 await q('update public.restaurant_settings set delivery_enabled=true,delivery_fee_minor=300,minimum_delivery_minor=3000 where restaurant_id=$1',[R]);
 await assert.rejects(anon(()=>quote(cart,'delivery',zone)),/minimum/);
 await q('update public.restaurant_settings set minimum_delivery_minor=0 where restaurant_id=$1',[R]);
 assert.equal((await anon(()=>quote(cart,'delivery',zone))).total_minor,2300);
 await assert.rejects(anon(()=>place(cart,{...checkout,method:'delivery',zone_id:zone},TOKEN,2300)),/address/);
 const order=await anon(()=>place(cart,{...checkout,method:'delivery',zone_id:zone,address_line:'123 Main Street',area:'Central',city:'Karachi'},TOKEN,2300));
 assert.equal(await scalar('select payment_method from public.orders where id=$1',[order.id]),'cash_on_delivery');
});
test('unconfirmed account cannot attach orders and registered orders have no guest capability',async()=>{
 await q('update auth.users set email_confirmed_at=null where id=$1',[U]);
 await assert.rejects(user(U,()=>place()));
 await q('update auth.users set email_confirmed_at=now() where id=$1',[U]);
 const order=await user(U,()=>place());assert.equal(await scalar('select count(*)::int from private.guest_access where resource_id=$1',[order.id]),0);
 assert.equal(await anon(()=>scalar('select public.read_order_capability($1,$2,$3)',[R,order.reference,TOKEN])),null);
});
