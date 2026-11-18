import test,{before,beforeEach,afterEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createTestDatabase,asUser} from './helpers/database.mjs';
const id=(p,n)=>p+'0000000-0000-0000-0000-'+String(n).padStart(12,'0');
const R=id('1',1),R2=id('1',2),U=id('2',5),OTHER=id('2',6),STAFF=id('2',3),OWNER=id('2',1),TOKEN='c'.repeat(64);
let db;const q=(sql,p=[])=>db.query(sql,p);const scalar=async(sql,p=[])=>Object.values((await q(sql,p)).rows[0])[0];
const anon=fn=>asUser(db,null,fn,'anon'),user=(uid,fn)=>asUser(db,uid,fn);
const input={name:'Guest',email:'guest@example.com',subject:'Order question',body:'Please help with my order.',category:'general',order_reference:''};
const create=(data=input,token=TOKEN,orderToken=null)=>scalar('select public.create_support_ticket($1,$2,$3,$4)',[R,JSON.stringify(data),token,orderToken]);
const read=(reference,token=TOKEN,tenant=R)=>scalar('select public.read_support_ticket($1,$2,$3,1)',[tenant,reference,token]);
const reply=(reference,token=TOKEN,internal=false,body='A new message',nonce=randomUUID())=>scalar('select public.reply_support_ticket($1,$2,$3,$4,$5,$6)',[R,reference,token,body,internal,nonce]);
before(async()=>{db=await createTestDatabase();await db.exec(await readFile(new URL('./helpers/fixtures.sql',import.meta.url),'utf8'));await q("update auth.users set email='verified@example.com',email_confirmed_at=now()");});
beforeEach(async()=>db.exec('begin'));
afterEach(async()=>{await db.exec('reset role;rollback');await q("select set_config('request.jwt.claim.sub','',false)");});
after(async()=>db?.close());
test('guest creation is atomic, idempotent and never accepts client priority or staff identity',async()=>{
 const first=await anon(()=>create({...input,priority:'urgent',author_type:'staff'})),second=await anon(()=>create({...input,priority:'urgent',author_type:'staff'}));
 assert.equal(first.id,second.id);assert.equal(first.guest,true);const view=await anon(()=>read(first.reference));assert.equal(view.priority,'normal');assert.equal(view.messages.length,1);assert.equal(view.messages[0].author_type,'customer');
 await assert.rejects(anon(()=>create({...input,subject:'Changed'})),/cannot be reused/);
});
test('guest read and reply require exact unexpired tenant capability',async()=>{
 const t=await anon(()=>create());assert.equal(await anon(()=>read(t.reference,'d'.repeat(64))),null);assert.equal(await anon(()=>read(t.reference,TOKEN,R2)),null);
 await assert.rejects(anon(()=>reply(t.reference,'d'.repeat(64))),/unavailable/);
 await anon(()=>reply(t.reference));assert.equal((await anon(()=>read(t.reference))).messages.length,2);
 await q("update private.guest_access set revoked_at=now() where resource_id=$1",[t.id]);assert.equal(await anon(()=>read(t.reference)),null);
});
test('registered ticket identity is derived from Auth and other customers are excluded',async()=>{
 const t=await user(U,()=>create());assert.equal(t.guest,false);
 assert.equal(await scalar('select contact_email from public.support_tickets where id=$1',[t.id]),'verified@example.com');
 assert.ok(await user(U,()=>read(t.reference,null)));assert.equal(await user(OTHER,()=>read(t.reference,null)),null);assert.equal(await anon(()=>read(t.reference)),null);
});
test('order links require customer ownership or the matching private guest order token',async()=>{
 await assert.rejects(anon(()=>create({...input,order_reference:'ORD-ONE'})),/Order unavailable/);
 await assert.rejects(user(U,()=>create({...input,order_reference:'ORD-OTHER'})),/Order unavailable/);
 assert.equal((await user(U,()=>create({...input,order_reference:'ORD-ONE'}))).guest,false);
 const guest=await anon(()=>create({...input,order_reference:'ORD-GUEST'},'d'.repeat(64),'a'.repeat(64)));assert.equal(guest.guest,true);
});
test('internal notes and their attachments never appear in customer or guest reads',async()=>{
 const t=await anon(()=>create());await user(STAFF,()=>reply(t.reference,null,true,'Private investigation'));
 const guest=await anon(()=>read(t.reference));assert.equal(guest.messages.length,1);assert.equal(guest.message_count,1);
 const staff=await user(STAFF,()=>read(t.reference,null));assert.equal(staff.messages.length,2);assert.ok(staff.messages.some(m=>m.is_internal));
 await assert.rejects(anon(()=>reply(t.reference,TOKEN,true)),/Reply access/);
});
test('reply retries are idempotent, state changes follow messages, resolved tickets reject new replies',async()=>{
 const t=await anon(()=>create()),nonce=randomUUID();const first=await anon(()=>reply(t.reference,TOKEN,false,'Same reply',nonce)),second=await anon(()=>reply(t.reference,TOKEN,false,'Same reply',nonce));assert.equal(first,second);
 await assert.rejects(anon(()=>reply(t.reference,TOKEN,false,'Edited reply',nonce)),/cannot be reused/);
 await user(STAFF,()=>reply(t.reference,null,false,'Please provide details'));assert.equal((await anon(()=>read(t.reference))).status,'waiting_customer');
 await anon(()=>reply(t.reference));assert.equal((await anon(()=>read(t.reference))).status,'in_progress');
 await user(STAFF,()=>q("update public.support_tickets set status='resolved' where id=$1",[t.id]));await assert.rejects(anon(()=>reply(t.reference)),/resolved/);
});
test('read-only support cannot impersonate a guest reply with a fabricated token',async()=>{
 const t=await anon(()=>create());
 await q("delete from public.role_permissions where role_id=(select role_id from public.staff_memberships where user_id=$1 and restaurant_id=$2) and permission_key='support.reply'",[STAFF,R]);
 assert.ok(await user(STAFF,()=>read(t.reference,null)));
 await assert.rejects(user(STAFF,()=>reply(t.reference,'d'.repeat(64))),/Reply access/);
});
test('guest attachments require own message and download requires ready state',async()=>{
 const t=await anon(()=>create());
 const reserve=(message=t.message_id,file={filename:'evidence.txt',content_type:'text/plain',size_bytes:12})=>anon(()=>scalar('select public.support_attachment($1,$2,$3,null,$4,$5)',[R,t.id,message,TOKEN,JSON.stringify(file)]));
 await assert.rejects(reserve(id('b',1)),/unavailable/);const a=await reserve();assert.ok(a.path.startsWith(R+'/tickets/'+t.id+'/'));
 const download=()=>anon(()=>scalar('select public.support_attachment($1,$2,null,$3,$4,null)',[R,t.id,a.id,TOKEN]));
 await assert.rejects(download(),/unavailable/);await q("update public.support_attachments set status='ready' where id=$1",[a.id]);assert.equal((await download()).id,a.id);
 for(let n=0;n<4;n++)await reserve();await assert.rejects(reserve(),/five attachments/);
});
test('new guest general tickets fail on draft but existing private orders retain support access',async()=>{
 await q('update public.restaurants set is_published=false where id=$1',[R]);await assert.rejects(anon(()=>create()),/unavailable/);
 assert.ok(await anon(()=>create({...input,order_reference:'ORD-GUEST'},TOKEN,'a'.repeat(64))));
});
test('support assignees are permission-checked and customer endpoints expose no staff list',async()=>{
 await assert.rejects(user(U,()=>scalar('select public.support_assignees($1)',[R])));
 const list=await user(STAFF,()=>scalar('select public.support_assignees($1)',[R]));assert.ok(list.some(s=>s.id===id('d',1)));
 await assert.rejects(user(STAFF,()=>q("update public.support_tickets set assigned_to=$1 where id=$2",[id('d',3),id('a',1)])));
});
