import test from 'node:test';
import assert from 'node:assert/strict';
import {handleSupportFile} from '../supabase/functions/support-files/handler.ts';
import {validateEvidence,safeFilename,MAX_FILE_SIZE} from '../supabase/functions/support-files/validation.ts';
const tenant='10000000-0000-4000-8000-000000000001',ticket='a0000000-0000-4000-8000-000000000001',message='b0000000-0000-4000-8000-000000000001',attachment='c0000000-0000-4000-8000-000000000001';
const config={url:'https://example.supabase.co',anonKey:'anon',serviceKey:'secret'};
function request(file=true,auth=''){const form=new FormData();form.set('restaurant_id',tenant);form.set('ticket_id',ticket);form.set('token','c'.repeat(64));if(file){form.set('message_id',message);form.set('file',new File(['evidence'],'proof.txt',{type:'text/plain'}));}else form.set('attachment_id',attachment);return new Request('https://example.invalid/files',{method:'POST',body:form,headers:auth?{Authorization:auth}:undefined});}
function setup({allowed=true,uploadError=false,readyError=false,userError=false}={}){
 const calls=[];const query={update(data){calls.push(['update',data]);return this;},eq(){return this;},select(){return this;},async single(){return {error:readyError?{}:null,data:{id:attachment}};},then(resolve){resolve({error:null});}};
 const bucket={async upload(path,bytes,options){calls.push(['upload',path,bytes.length,options]);return {error:uploadError?{}:null};},async remove(paths){calls.push(['remove',paths]);return {error:null};},async createSignedUrl(path,ttl,options){calls.push(['sign',path,ttl,options]);return {data:{signedUrl:'https://example.invalid/private-download'},error:null};}};
 const factory=(_url,key)=>{calls.push(['client',key]);return key==='secret'?{storage:{from:()=>bucket},from:()=>query}:{auth:{getUser:async()=>({error:userError?{}:null,data:{user:{email_confirmed_at:'now',is_anonymous:false}}})},rpc:async()=>({error:allowed?null:{},data:allowed?{id:attachment,path:tenant+'/tickets/'+ticket+'/proof.txt',filename:'proof.txt'}:null})};};
 return {factory,calls};
}
test('attachment validation rejects spoofed types, empty/oversized files and invalid UTF-8',()=>{
 assert.throws(()=>validateEvidence(new TextEncoder().encode('<svg/>'),'image/png'));
 assert.throws(()=>validateEvidence(new Uint8Array(),'text/plain'));
 assert.throws(()=>validateEvidence(new Uint8Array(MAX_FILE_SIZE+1),'text/plain'));
 assert.throws(()=>validateEvidence(new Uint8Array([255,255]),'text/plain'));
 validateEvidence(new TextEncoder().encode('%PDF-1.7'),'application/pdf');
 assert.equal(safeFilename('../proof\u0000.txt'),'.._proof_.txt');
});
test('denied attachment requests never instantiate a service client or touch Storage',async()=>{
 const {factory,calls}=setup({allowed:false});const response=await handleSupportFile(request(),config,factory);assert.equal(response.status,403);assert.equal(calls.some(c=>c[0]==='client'&&c[1]==='secret'),false);
});
test('validated uploads finalize only the reserved object and disable overwriting',async()=>{
 const {factory,calls}=setup();assert.equal((await handleSupportFile(request(),config,factory)).status,200);
 const upload=calls.find(c=>c[0]==='upload');assert.equal(upload[1],tenant+'/tickets/'+ticket+'/proof.txt');assert.equal(upload[3].upsert,false);assert.ok(calls.some(c=>c[0]==='update'&&c[1].status==='ready'));
});
test('failed uploads become rejected and failed finalization removes uploaded bytes',async()=>{
 let setupValue=setup({uploadError:true});assert.equal((await handleSupportFile(request(),config,setupValue.factory)).status,502);assert.ok(setupValue.calls.some(c=>c[0]==='update'&&c[1].status==='rejected'));
 setupValue=setup({readyError:true});assert.equal((await handleSupportFile(request(),config,setupValue.factory)).status,502);assert.ok(setupValue.calls.some(c=>c[0]==='remove'));
});
test('downloads are short lived, forced attachments and caller authorized',async()=>{
 const {factory,calls}=setup();const response=await handleSupportFile(request(false),config,factory);assert.equal(response.status,200);const signed=calls.find(c=>c[0]==='sign');assert.equal(signed[2],60);assert.equal(signed[3].download,'proof.txt');
});
test('invalid authenticated sessions cannot fall back to guest file access',async()=>{
 const {factory,calls}=setup({userError:true});assert.equal((await handleSupportFile(request(true,'Bearer invalid.jwt.token'),config,factory)).status,401);assert.equal(calls.some(c=>c[0]==='client'&&c[1]==='secret'),false);
});
