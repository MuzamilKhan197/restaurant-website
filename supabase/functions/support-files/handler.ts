// Type-only npm imports are erased in local Node tests; Deno resolves the pinned SDK.
import type {SupabaseClient} from 'npm:@supabase/supabase-js@2.119.0';
import {MAX_FILE_SIZE,validateEvidence,safeFilename} from './validation.ts';
type Config={url:string;anonKey:string;serviceKey:string};
type Factory=(url:string,key:string,options?:Record<string,unknown>)=>SupabaseClient;
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
async function boundedBody(request:Request){
 if(!request.body)throw new Error('Missing request body.');
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_FILE_SIZE+65536){await reader.cancel();throw new Error('Attachment request is too large.');}chunks.push(value);}
 const all=new Uint8Array(size);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.byteLength;}return all;
}
export async function handleSupportFile(request:Request,config:Config,createClient:Factory):Promise<Response>{
 if(request.method!=='POST')return json({error:'Use POST.'},405);
 if(!config.url||!config.anonKey||!config.serviceKey)return json({error:'Attachment service unavailable.'},503);
 try{
  const bytes=await boundedBody(request);
  const form=await new Response(bytes,{headers:{'Content-Type':request.headers.get('Content-Type')||''}}).formData();
  const tenant=form.get('restaurant_id'),ticket=form.get('ticket_id'),message=form.get('message_id'),attachment=form.get('attachment_id'),token=form.get('token');
  if(!uuid(tenant)||!uuid(ticket)||(token!==null&&(typeof token!=='string'||token.length>64)))return json({error:'Invalid attachment request.'},400);
  const options={auth:{persistSession:false,autoRefreshToken:false}};
  let caller=createClient(config.url,config.anonKey,options);
  const bearer=request.headers.get('Authorization')?.replace(/^Bearer\s+/i,'')||'';
  if(bearer&&bearer!==config.anonKey&&bearer.split('.').length===3){
   const candidate=createClient(config.url,config.anonKey,{...options,global:{headers:{Authorization:'Bearer '+bearer}}});
   const identity=await candidate.auth.getUser(bearer);
   if(identity.error||!identity.data.user?.email_confirmed_at||identity.data.user.is_anonymous)return json({error:'Verified sign-in required.'},401);
   caller=candidate;
  }
  const file=form.get('file'),upload=file instanceof File;
  if(upload&&!uuid(message))return json({error:'Choose the message for this attachment.'},400);
  if(!upload&&!uuid(attachment))return json({error:'Attachment unavailable.'},400);
  let fileBytes:Uint8Array|undefined;
  if(upload){fileBytes=new Uint8Array(await file.arrayBuffer());validateEvidence(fileBytes,file.type);}
  const authorized=await caller.rpc('support_attachment',{p_restaurant:tenant,p_ticket:ticket,p_message:upload?message:null,p_attachment:upload?null:attachment,p_token:typeof token==='string'?token:null,p_file:upload?{filename:safeFilename(file.name),content_type:file.type,size_bytes:fileBytes!.length}:null});
  const context=authorized.data;
  if(authorized.error||!context||!uuid(context.id)||typeof context.path!=='string'||!context.path.startsWith(tenant+'/tickets/'+ticket+'/')||typeof context.filename!=='string')return json({error:'Attachment access unavailable.'},403);
  // A service credential is used only after the caller-scoped RPC authorized
  // this exact tenant, ticket, message/file and guest capability or Auth identity.
  const service=createClient(config.url,config.serviceKey,options),bucket=service.storage.from('ticket-attachments');
  if(upload){
   const uploaded=await bucket.upload(context.path,fileBytes!,{contentType:file.type,upsert:false});
   if(uploaded.error){await service.from('support_attachments').update({status:'rejected'}).eq('restaurant_id',tenant).eq('id',context.id);return json({error:'Upload failed. Please retry.'},502);}
   const ready=await service.from('support_attachments').update({status:'ready'}).eq('restaurant_id',tenant).eq('id',context.id).eq('status','pending').select('id').single();
   if(ready.error){await bucket.remove([context.path]);await service.from('support_attachments').update({status:'rejected'}).eq('restaurant_id',tenant).eq('id',context.id);return json({error:'Unable to finalize attachment.'},502);}
   return json({id:context.id});
  }
  const signed=await bucket.createSignedUrl(context.path,60,{download:safeFilename(context.filename)});
  return signed.error?json({error:'Download unavailable.'},502):json({url:signed.data.signedUrl});
 }catch(error){return json({error:error instanceof Error&&/file|attachment|body|contents/i.test(error.message)?error.message:'Unable to process attachment.'},400);}
}
