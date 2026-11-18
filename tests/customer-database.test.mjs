import test,{before,beforeEach,afterEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTestDatabase,asUser} from './helpers/database.mjs';
const id=(p,n)=>p+'0000000-0000-0000-0000-'+String(n).padStart(12,'0');
const R=id('1',1),R2=id('1',2),U=id('2',5),OTHER=id('2',6),NEW=id('2',7),C=id('3',1);
let db;
const q=(sql,params=[])=>db.query(sql,params);
const scalar=async(sql,params=[])=>Object.values((await q(sql,params)).rows[0])[0];
const user=(uid,fn)=>asUser(db,uid,fn);
const save=(address=null,isDefault=false,line='123 Main Street')=>scalar("select public.save_customer_address($1,$2,'Home',$3,'Central','Karachi','', $4)",[R,address,line,isDefault]);
before(async()=>{db=await createTestDatabase();await db.exec(await readFile(new URL('./helpers/fixtures.sql',import.meta.url),'utf8'));await q("update auth.users set email='verified@example.com',email_confirmed_at=now()");});
beforeEach(async()=>db.exec('begin'));
afterEach(async()=>{await db.exec('reset role;rollback');await q("select set_config('request.jwt.claim.sub','',false)");});
after(async()=>db?.close());
test('profile email comes from confirmed auth identity and customer cannot edit another profile',async()=>{
 await user(U,()=>scalar('select public.save_customer_profile($1,$2,$3)',[R,'My name','03001234567']));
 const profile=await scalar('select contact_email from public.restaurant_customers where id=$1',[C]);assert.equal(profile,'verified@example.com');
 const changed=await user(OTHER,()=>q("update public.restaurant_customers set display_name='Attacker' where id=$1 returning id",[C]));assert.equal(changed.rows.length,0);
});
test('unconfirmed and anonymous callers cannot save profile or address',async()=>{
 await q('update auth.users set email_confirmed_at=null where id=$1',[U]);
 await assert.rejects(user(U,()=>scalar("select public.save_customer_profile($1,'Name','')",[R])));
 await assert.rejects(asUser(db,null,()=>save(), 'anon'));
});
test('draft restaurant keeps new profile global without creating restaurant customer',async()=>{
 await q('update public.restaurants set is_published=false where id=$1',[R]);
 assert.equal(await user(NEW,()=>scalar("select public.save_customer_profile($1,'New Name','')",[R])),null);
 assert.equal(await scalar('select display_name from public.profiles where id=$1',[NEW]),'New Name');
 assert.equal(await scalar('select count(*)::int from public.restaurant_customers where user_id=$1',[NEW]),0);
});
test('published restaurant allows joining with verified email and repeat saves reuse customer',async()=>{
 const first=await user(NEW,()=>scalar("select public.save_customer_profile($1,'First','')",[R]));
 const second=await user(NEW,()=>scalar("select public.save_customer_profile($1,'Second','')",[R]));
 assert.equal(first,second);assert.equal(await scalar('select display_name from public.restaurant_customers where id=$1',[first]),'Second');
});
test('address default replacement is atomic and scoped to the caller',async()=>{
 const first=await user(U,()=>save(null,true));const second=await user(U,()=>save(null,true));
 assert.equal(await scalar('select count(*)::int from public.customer_addresses where customer_id=$1 and is_default',[C]),1);
 assert.equal(await scalar('select is_default from public.customer_addresses where id=$1',[first]),false);
 assert.equal(await scalar('select is_default from public.customer_addresses where id=$1',[second]),true);
});
test('foreign address target is rejected before clearing the current default',async()=>{
 const own=await user(U,()=>save(null,true));const other=await user(OTHER,()=>save(null,true));
 await assert.rejects(user(U,()=>save(other,true)));
 assert.equal(await scalar('select is_default from public.customer_addresses where id=$1',[own]),true);
});
test('invalid replacement rolls back previous default and addresses cannot cross tenants',async()=>{
 const own=await user(U,()=>save(null,true));await assert.rejects(user(U,()=>save(null,true,'x')));
 assert.equal(await scalar('select is_default from public.customer_addresses where id=$1',[own]),true);
 await assert.rejects(user(U,()=>scalar("select public.save_customer_address($1,null,'Home','123 Main Street','Central','Karachi','',true)",[R2])));
});
test('address read/delete and order snapshots remain private from another customer',async()=>{
 const own=await user(U,()=>save());
 assert.equal((await user(OTHER,()=>q('select id from public.customer_addresses where id=$1',[own]))).rows.length,0);
 assert.equal((await user(OTHER,()=>q('delete from public.customer_addresses where id=$1 returning id',[own]))).rows.length,0);
 const visible=await user(U,()=>q('select customer_id from public.orders'));assert.ok(visible.rows.length>0);assert.ok(visible.rows.every(row=>row.customer_id===C));
});
