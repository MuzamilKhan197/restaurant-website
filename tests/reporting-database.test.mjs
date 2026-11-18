import test,{before,beforeEach,afterEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createTestDatabase,asUser} from './helpers/database.mjs';
const id=(p,n)=>p+'0000000-0000-0000-0000-'+String(n).padStart(12,'0');
const R=id('1',1),R2=id('1',2),OWNER=id('2',1),SUPPORT=id('2',3),CUSTOMER=id('2',5),NEW=id('2',7);
let db;const q=(sql,p=[])=>db.query(sql,p),scalar=async(sql,p=[])=>Object.values((await q(sql,p)).rows[0])[0];
const user=(uid,fn)=>asUser(db,uid,fn),anon=fn=>asUser(db,null,fn,'anon');
const report=(from='2026-01-01',to='2026-01-04',tenant=R)=>scalar('select public.restaurant_sales_report($1,$2,$3)',[tenant,from,to]);
const activity=(from='2026-01-01',to='2026-01-04',entity=null,action=null,actor=null,page=1,tenant=R)=>scalar('select public.restaurant_activity_log($1,$2,$3,$4,$5,$6,$7)',[tenant,from,to,entity,action,actor,page]);
async function order({n,date,amount=10000,tenant=R,name='Sold dish',completed=false}){
 const orderId=id('9',n),product=id('5',tenant===R?1:2);
 await q("insert into public.orders(id,restaurant_id,method,payment_method,currency,contact_name,contact_email,contact_phone,subtotal_minor,total_minor,created_at) values($1,$2,'pickup','pay_at_pickup','PKR','Private customer','private@example.invalid','03000000000',$3,$3,$4)",[orderId,tenant,amount,date]);
 await q('insert into public.order_items(restaurant_id,order_id,product_id,product_name,quantity,unit_price_minor,line_total_minor) values($1,$2,$3,$4,1,$5::integer,$5::integer::bigint)',[tenant,orderId,product,name,amount]);
 await q("insert into public.payments(restaurant_id,order_id,method,amount_minor,currency) values($1,$2,'pay_at_pickup',$3,'PKR')",[tenant,orderId,amount]);
 if(completed)for(const status of ['accepted','preparing','ready','completed'])await q('update public.orders set status=$1 where id=$2',[status,orderId]);
 return orderId;
}
async function collect(orderId,date){await q("update public.payments set status='paid' where order_id=$1",[orderId]);await q('update public.payments set paid_at=$1 where order_id=$2',[date,orderId]);}
before(async()=>{db=await createTestDatabase();await db.exec(await readFile(new URL('./helpers/fixtures.sql',import.meta.url),'utf8'));await q("update auth.users set email='verified@example.com',email_confirmed_at=now()");});
beforeEach(async()=>db.exec('begin'));
afterEach(async()=>{await db.exec('rollback;reset role');await q("select set_config('request.jwt.claim.sub','',false)");});
after(async()=>db?.close());
test('empty reports have complete zero buckets, string amounts and no sample products',async()=>{
 const result=await user(OWNER,()=>report());assert.equal(result.summary.total_orders,0);assert.equal(result.summary.completed_sales_minor,'0');assert.equal(result.cash.net_minor,'0');assert.equal(result.daily.length,4);assert.deepEqual(result.popular,[]);assert.ok(result.daily.every(d=>d.orders===0&&d.sales_minor==='0'));
});
test('completed sales exclude pending, rejected and cancelled orders and use immutable sold names',async()=>{
 await order({n:1,date:'2026-01-01T20:00:00Z',amount:10050,name:'Original sold label',completed:true});
 await order({n:2,date:'2026-01-02T20:00:00Z',amount:5000,name:'Latest sold label',completed:true});
 await order({n:3,date:'2026-01-02T10:00:00Z',amount:4000});
 const cancelled=await order({n:4,date:'2026-01-02T10:00:00Z',amount:3000});await q("update public.orders set status='cancelled',cancellation_reason='Test cancellation' where id=$1",[cancelled]);
 const rejected=await order({n:5,date:'2026-01-02T10:00:00Z',amount:2000});await q("update public.orders set status='rejected',rejection_reason='Test rejection' where id=$1",[rejected]);
 await q("update public.products set name='Unsold new menu label',base_price_minor=99999 where id=$1",[id('5',1)]);
 const result=await user(OWNER,()=>report());assert.equal(result.summary.total_orders,5);assert.equal(result.summary.completed_orders,2);assert.equal(result.summary.completed_sales_minor,'15050');assert.equal(result.summary.average_completed_minor,'7525');assert.equal(result.popular[0].name,'Latest sold label');assert.equal(result.popular[0].units,2);assert.equal(result.popular[0].sales_minor,'15050');assert.equal(result.summary.unpaid_minor,'15050');
 await db.exec('set constraints all immediate');
});
test('cash uses payment dates even for old orders, counts receipts once after refund, and permits negative net',async()=>{
 const old=await order({n:1,date:'2025-12-20T12:00:00Z',amount:5000,completed:true});await collect(old,'2026-01-02T10:00:00Z');
 const cancelled=await order({n:2,date:'2026-01-01T10:00:00Z',amount:2500});await collect(cancelled,'2026-01-01T10:00:00Z');await q("update public.orders set status='cancelled',cancellation_reason='Refund test' where id=$1",[cancelled]);
 assert.equal((await user(OWNER,()=>report())).summary.refund_due_minor,'2500');
 await q("update public.payments set status='refunded' where order_id=$1",[cancelled]);await q("update public.payments set refunded_at='2026-01-04T10:00:00Z' where order_id=$1",[cancelled]);
 const all=await user(OWNER,()=>report());assert.equal(all.cash.received_minor,'7500');assert.equal(all.cash.refunded_minor,'2500');assert.equal(all.cash.net_minor,'5000');assert.equal(all.summary.completed_sales_minor,'0');
 const last=await user(OWNER,()=>report('2026-01-04','2026-01-04'));assert.equal(last.cash.net_minor,'-2500');assert.equal(last.summary.total_orders,0);assert.equal(last.daily[0].refunded_minor,'2500');
});
test('inclusive restaurant-local dates use midnight bounds and exclude the next midnight',async()=>{
 await order({n:1,date:'2026-01-01T18:59:59Z'});await order({n:2,date:'2026-01-01T19:00:00Z'});await order({n:3,date:'2026-01-02T18:59:59Z'});await order({n:4,date:'2026-01-02T19:00:00Z'});
 const result=await user(OWNER,()=>report('2026-01-02','2026-01-02'));assert.equal(result.summary.total_orders,2);assert.equal(result.daily[0].orders,2);assert.equal(result.timezone,'Asia/Karachi');
});
test('daylight-saving days use actual timezone boundaries rather than a fixed 24 hours',async()=>{
 await q("update public.restaurants set timezone='America/New_York' where id=$1",[R]);
 await order({n:1,date:'2026-03-08T04:59:59Z'});await order({n:2,date:'2026-03-08T05:00:00Z'});await order({n:3,date:'2026-03-09T03:59:59Z'});await order({n:4,date:'2026-03-09T04:00:00Z'});
 assert.equal((await user(OWNER,()=>report('2026-03-08','2026-03-08'))).summary.total_orders,2);
});
test('anonymous, customer, support-only and foreign-tenant report requests are denied',async()=>{
 await assert.rejects(anon(()=>report()),/permission denied/);await assert.rejects(user(CUSTOMER,()=>report()),/Report access/);await assert.rejects(user(SUPPORT,()=>report()),/Report access/);await assert.rejects(user(OWNER,()=>report('2026-01-01','2026-01-04',R2)),/Report access/);
 await q('update auth.users set email_confirmed_at=null where id=$1',[OWNER]);await assert.rejects(user(OWNER,()=>report()));
});
test('reports-only custom role gets tenant aggregates without raw order/contact access and revocation is immediate',async()=>{
 const role=randomUUID();await q("insert into public.roles(id,restaurant_id,name,slug) values($1,$2,'Report viewer','report-viewer')",[role,R]);await q("insert into public.role_permissions(restaurant_id,role_id,permission_key) values($1,$2,'reports.read')",[R,role]);await q("insert into public.staff_memberships(restaurant_id,user_id,role_id,status,display_name) values($1,$2,$3,'active','Report viewer')",[R,NEW,role]);
 await order({n:1,date:'2026-01-02T10:00:00Z',completed:true});const data=await user(NEW,()=>report());assert.equal(data.summary.completed_orders,1);assert.equal((await user(NEW,()=>q('select id from public.orders'))).rows.length,0);assert.ok(!JSON.stringify(data).includes('private@example.invalid'));
 await assert.rejects(user(NEW,()=>activity()),/Activity access/);
 await q("delete from public.role_permissions where role_id=$1 and permission_key='reports.read'",[role]);await assert.rejects(user(NEW,()=>report()),/Report access/);
});
test('invalid ranges are rejected and one full leap-year range is bounded to 366 buckets',async()=>{
 await assert.rejects(user(OWNER,()=>report('2026-02-01','2026-01-01')),/366 days/);await assert.rejects(user(OWNER,()=>report('2025-01-01','2026-01-02')),/366 days/);
 assert.equal((await user(OWNER,()=>report('2024-01-01','2024-12-31'))).daily.length,366);
});
test('activity is separately permissioned, tenant-scoped, filtered and never returns raw metadata',async()=>{
 await q("insert into public.audit_logs(restaurant_id,actor_user_id,action,entity_type,entity_id,metadata,created_at) values($1,$2,'update','products','record-one','{\"secret_note\":\"never expose\"}','2026-01-02T10:00:00Z'),($3,$2,'update','products','foreign-record','{}','2026-01-02T10:00:00Z')",[R,OWNER,R2]);
 const result=await user(OWNER,()=>activity('2026-01-01','2026-01-04','products','update',OWNER));assert.equal(result.count,1);assert.equal(result.entries[0].entity_id,'record-one');assert.ok(result.entries[0].actor_name);assert.equal(result.entries[0].metadata,undefined);assert.ok(!JSON.stringify(result).includes('never expose'));
 await assert.rejects(user(CUSTOMER,()=>activity()),/Activity access/);await assert.rejects(user(SUPPORT,()=>activity()),/Activity access/);await assert.rejects(user(OWNER,()=>activity('2026-01-01','2026-01-04',null,null,null,1,R2)),/Activity access/);
});
test('activity pages have stable tie ordering, preserve totals and cannot modify audit rows',async()=>{
 await q("insert into public.audit_logs(restaurant_id,action,entity_type,entity_id,created_at) select $1,'update','products',n::text,'2026-01-02T10:00:00Z' from generate_series(1,65) n",[R]);
 const first=await user(OWNER,()=>activity()),second=await user(OWNER,()=>activity('2026-01-01','2026-01-04',null,null,null,2));assert.equal(first.count,65);assert.equal(first.entries.length,50);assert.equal(second.entries.length,15);assert.equal(new Set([...first.entries,...second.entries].map(e=>e.id)).size,65);
 await assert.rejects(user(OWNER,()=>q("update public.audit_logs set action='delete'")),/permission denied/);
});
test('audit-only custom roles can trace activity without accessing sales or customer contacts',async()=>{
 const role=randomUUID();await q("insert into public.roles(id,restaurant_id,name,slug) values($1,$2,'Audit viewer','audit-viewer')",[role,R]);await q("insert into public.role_permissions(restaurant_id,role_id,permission_key) values($1,$2,'audit.read')",[R,role]);await q("insert into public.staff_memberships(restaurant_id,user_id,role_id,status,display_name) values($1,$2,$3,'active','Audit viewer')",[R,NEW,role]);
 await q("insert into public.audit_logs(restaurant_id,action,entity_type,created_at) values($1,'update','products','2026-01-02T10:00:00Z')",[R]);
 assert.equal((await user(NEW,()=>activity())).count,1);await assert.rejects(user(NEW,()=>report()),/Report access/);
 assert.equal((await user(NEW,()=>q('select id from public.restaurant_customers'))).rows.length,0);
});
