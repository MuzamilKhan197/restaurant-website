alter table public.support_messages add column client_nonce uuid;
create unique index support_message_nonce on public.support_messages(restaurant_id,ticket_id,client_nonce) where client_nonce is not null;
create index tickets_created_lookup on public.support_tickets(restaurant_id,created_at desc);
create function private.guard_support_message() returns trigger language plpgsql security invoker set search_path='' as $$
declare ticket_status public.ticket_status;
begin
 -- Direct Data API inserts must see the ticket through caller RLS before any
 -- state information is returned. Trusted RPC inserts already lock the ticket.
 select status into ticket_status from public.support_tickets where restaurant_id=new.restaurant_id and id=new.ticket_id;
 if not found then raise exception 'new row violates row-level security policy' using errcode='42501';end if;
 if ticket_status in ('resolved','closed') then raise exception 'new row violates row-level security policy: resolved ticket' using errcode='42501';end if;
 if (select count(*) from public.support_messages where restaurant_id=new.restaurant_id and ticket_id=new.ticket_id and created_at>now()-interval '5 minutes')>=20 then raise exception 'Please wait before sending another reply' using errcode='22023';end if;
 return new;
end;$$;
create function private.touch_support_conversation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.support_tickets set status=case when not new.is_internal and new.author_type='staff' and status<>'escalated' then 'waiting_customer'::public.ticket_status when new.author_type='customer' and status='waiting_customer' then 'in_progress'::public.ticket_status else status end,updated_at=now() where restaurant_id=new.restaurant_id and id=new.ticket_id;
 return null;
end;$$;
revoke all on function private.guard_support_message(),private.touch_support_conversation() from public,anon,authenticated;
create trigger guard_support_message before insert on public.support_messages for each row execute function private.guard_support_message();
create trigger touch_support_conversation after insert on public.support_messages for each row execute function private.touch_support_conversation();

-- Guest authorization must remain distinct from staff/customer read access.
create function private.guest_support_access(p_restaurant uuid,p_ticket uuid,p_token text) returns boolean
language sql stable security definer set search_path='' as $$
 select p_token is not null and p_token ~ '^[a-f0-9]{64}$' and exists(
 select 1 from private.guest_access g join public.support_tickets t on t.restaurant_id=g.restaurant_id and t.id=g.resource_id and t.customer_id is null
 where g.restaurant_id=p_restaurant and g.resource_id=p_ticket and g.resource_type='ticket' and g.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and g.expires_at>now() and g.revoked_at is null);
$$;
revoke all on function private.guest_support_access(uuid,uuid,text) from public,anon,authenticated;
create function private.support_access(p_restaurant uuid,p_ticket uuid,p_token text) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is not null then
  perform private.require_confirmed_user();
  if private.has_permission(p_restaurant,'support.read') or exists(select 1 from public.support_tickets t where t.restaurant_id=p_restaurant and t.id=p_ticket and private.is_customer(p_restaurant,t.customer_id)) then return true;end if;
 end if;
 return private.guest_support_access(p_restaurant,p_ticket,p_token);
end;$$;

create function private.create_support_ticket(p_restaurant uuid,p_input jsonb,p_token text,p_order_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); customer uuid; email_value text; linked public.orders; ticket public.support_tickets; first_message uuid;
 hash text; fingerprint text; previous private.idempotency_keys;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_input) is distinct from 'object' or length(p_input::text)>8000 then raise exception 'Invalid support request' using errcode='22023';end if;
 if length(btrim(coalesce(p_input->>'name',''))) not between 1 and 100 or length(btrim(coalesce(p_input->>'subject',''))) not between 1 and 150 or length(btrim(coalesce(p_input->>'body',''))) not between 1 and 5000 or coalesce(p_input->>'category','') not in ('order_problem','cancellation','complaint','delivery','general') then raise exception 'Check your ticket details' using errcode='22023';end if;
 if actor is not null then
  perform private.require_confirmed_user();select email into email_value from auth.users where id=actor;
  select id into customer from public.restaurant_customers where restaurant_id=p_restaurant and user_id=actor;
 else email_value:=p_input->>'email';end if;
 if email_value is null or length(email_value)>254 or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Enter a valid email address' using errcode='22023';end if;
 hash:=encode(sha256(convert_to(p_token,'UTF8')),'hex');fingerprint:=encode(sha256(convert_to(jsonb_build_object('input',p_input,'actor',actor,'order_token',coalesce(p_order_token,''))::text,'UTF8')),'hex');
 perform 1 from public.restaurant_settings where restaurant_id=p_restaurant for update;
 select * into previous from private.idempotency_keys where restaurant_id=p_restaurant and key_hash=hash;
 if found then
  if previous.request_hash<>fingerprint or previous.resource_type<>'ticket' or previous.expires_at<=now() then raise exception 'This request token cannot be reused' using errcode='22023';end if;
  select * into ticket from public.support_tickets where restaurant_id=p_restaurant and id=previous.resource_id;
  select id into first_message from public.support_messages where restaurant_id=p_restaurant and ticket_id=ticket.id and client_nonce='00000000-0000-0000-0000-000000000000';
  return jsonb_build_object('id',ticket.id,'reference',ticket.reference,'message_id',first_message,'guest',ticket.customer_id is null);
 end if;
 if nullif(p_input->>'order_reference','') is not null then
  select * into linked from public.orders where restaurant_id=p_restaurant and reference=p_input->>'order_reference';
  if linked.id is null or not (
   (customer is not null and linked.customer_id=customer) or
   (linked.customer_id is null and p_order_token ~ '^[a-f0-9]{64}$' and exists(select 1 from private.guest_access g where g.restaurant_id=p_restaurant and g.resource_id=linked.id and g.resource_type='order' and g.token_hash=encode(sha256(convert_to(p_order_token,'UTF8')),'hex') and g.expires_at>now() and g.revoked_at is null))
  ) then raise exception 'Order unavailable. Use your account or the private order link' using errcode='22023';end if;
 end if;
 -- Existing orders/customers can contact support during maintenance or a draft.
 if customer is null and linked.id is null and not private.is_published(p_restaurant) then raise exception 'Support is temporarily unavailable' using errcode='22023';end if;
 if linked.id is not null and linked.customer_id is null then customer:=null;end if;
 if actor is not null and customer is null and linked.id is null then
  insert into public.restaurant_customers(restaurant_id,user_id,display_name,contact_email) values(p_restaurant,actor,btrim(p_input->>'name'),email_value) on conflict(restaurant_id,user_id) do nothing;
  select id into customer from public.restaurant_customers where restaurant_id=p_restaurant and user_id=actor;
 end if;
 if (select count(*) from public.support_tickets where restaurant_id=p_restaurant and created_at>now()-interval '1 minute')>=20 then raise exception 'Support is busy. Please retry shortly' using errcode='22023';end if;
 insert into public.support_tickets(restaurant_id,customer_id,order_id,subject,contact_name,contact_email,category)
 values(p_restaurant,customer,linked.id,btrim(p_input->>'subject'),btrim(p_input->>'name'),email_value,(p_input->>'category')::public.ticket_category) returning * into ticket;
 insert into public.support_messages(restaurant_id,ticket_id,author_user_id,author_type,body,client_nonce) values(p_restaurant,ticket.id,actor,'customer',btrim(p_input->>'body'),'00000000-0000-0000-0000-000000000000') returning id into first_message;
 if customer is null then insert into private.guest_access(restaurant_id,resource_type,resource_id,token_hash,expires_at) values(p_restaurant,'ticket',ticket.id,hash,now()+interval '30 days');end if;
 insert into private.idempotency_keys(restaurant_id,key_hash,request_hash,resource_type,resource_id,expires_at) values(p_restaurant,hash,fingerprint,'ticket',ticket.id,now()+interval '30 days');
 return jsonb_build_object('id',ticket.id,'reference',ticket.reference,'message_id',first_message,'guest',customer is null);
end;$$;

create function private.read_support_ticket(p_restaurant uuid,p_reference text,p_token text,p_page integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare ticket public.support_tickets; staff boolean:=false; messages jsonb; total integer;
begin
 if p_reference is null or length(p_reference)>50 or p_page is null or p_page not between 1 and 10000 then return null;end if;
 select * into ticket from public.support_tickets where restaurant_id=p_restaurant and reference=p_reference;
 if ticket.id is null or not coalesce(private.support_access(p_restaurant,ticket.id,p_token),false) then return null;end if;
 if auth.uid() is not null then staff:=private.has_permission(p_restaurant,'support.read');end if;
 select count(*) into total from public.support_messages where restaurant_id=p_restaurant and ticket_id=ticket.id and (staff or not is_internal);
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'body',m.body,'author_type',m.author_type,'is_internal',m.is_internal,'created_at',m.created_at,'can_attach',ticket.status not in ('resolved','closed') and m.author_user_id is not distinct from auth.uid() and (m.author_type='customer' or (staff and private.has_permission(p_restaurant,'support.reply'))),'attachments',
  (select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'filename',a.filename,'content_type',a.content_type,'size_bytes',a.size_bytes) order by a.created_at,a.id),'[]') from public.support_attachments a where a.restaurant_id=p_restaurant and a.message_id=m.id and a.status='ready')
 ) order by m.created_at,m.id),'[]') into messages from (
  select * from public.support_messages where restaurant_id=p_restaurant and ticket_id=ticket.id and (staff or not is_internal) order by created_at desc,id desc limit 50 offset (p_page-1)*50
 ) m;
 return jsonb_build_object('id',ticket.id,'reference',ticket.reference,'subject',ticket.subject,'category',ticket.category,'status',ticket.status,'priority',ticket.priority,'created_at',ticket.created_at,'updated_at',ticket.updated_at,'messages',messages,'message_count',total,'page',p_page);
end;$$;

create function private.reply_support_ticket(p_restaurant uuid,p_reference text,p_token text,p_body text,p_internal boolean,p_nonce uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare ticket public.support_tickets; actor uuid:=auth.uid(); staff boolean:=false; existing public.support_messages; result uuid;
begin
 select * into ticket from public.support_tickets where restaurant_id=p_restaurant and reference=p_reference for update;
 if ticket.id is null or not coalesce(private.support_access(p_restaurant,ticket.id,p_token),false) then raise exception 'Ticket unavailable' using errcode='42501';end if;
 if length(btrim(coalesce(p_body,''))) not between 1 and 5000 or p_nonce is null or p_internal is null then raise exception 'Enter a message up to 5000 characters' using errcode='22023';end if;
 if actor is not null then staff:=private.has_permission(p_restaurant,'support.read') and private.has_permission(p_restaurant,'support.reply');end if;
 if not staff and (p_internal or not (
   (ticket.customer_id is not null and private.is_customer(p_restaurant,ticket.customer_id)) or
   (ticket.customer_id is null and private.guest_support_access(p_restaurant,ticket.id,p_token))
 )) then raise exception 'Reply access required' using errcode='42501';end if;
 select * into existing from public.support_messages where restaurant_id=p_restaurant and ticket_id=ticket.id and client_nonce=p_nonce;
 if found then
  if existing.body<>btrim(p_body) or existing.author_user_id is distinct from actor or existing.is_internal<>p_internal then raise exception 'This reply token cannot be reused' using errcode='22023';end if;
  return existing.id;
 end if;
 if ticket.status in ('resolved','closed') then raise exception 'This ticket is resolved. Staff must reopen it before new replies' using errcode='22023';end if;
 if (select count(*) from public.support_messages where restaurant_id=p_restaurant and ticket_id=ticket.id and created_at>now()-interval '5 minutes')>=20 then raise exception 'Please wait before sending another reply' using errcode='22023';end if;
 insert into public.support_messages(restaurant_id,ticket_id,author_user_id,author_type,body,is_internal,client_nonce) values(p_restaurant,ticket.id,actor,case when staff then 'staff'::public.message_author else 'customer'::public.message_author end,btrim(p_body),p_internal,p_nonce) returning id into result;
 return result;
end;$$;

create function private.support_assignees(p_restaurant uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_confirmed_user();
 if not private.has_permission(p_restaurant,'support.read') or not private.has_permission(p_restaurant,'support.manage') then raise exception 'Support management access required' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',m.display_name) order by m.display_name,m.id),'[]') from public.staff_memberships m join public.roles r on r.restaurant_id=m.restaurant_id and r.id=m.role_id where m.restaurant_id=p_restaurant and m.status='active' and r.is_active and (
  private.is_owner(p_restaurant) and m.user_id=(select owner_user_id from public.restaurants where id=p_restaurant) or exists(select 1 from public.role_permissions rp where rp.restaurant_id=p_restaurant and rp.role_id=m.role_id and rp.permission_key='support.read')));
end;$$;

create function private.support_attachment(p_restaurant uuid,p_ticket uuid,p_message uuid,p_attachment uuid,p_token text,p_file jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ticket public.support_tickets; message public.support_messages; attachment public.support_attachments; staff boolean:=false; extension text;
begin
 select * into ticket from public.support_tickets where restaurant_id=p_restaurant and id=p_ticket for update;
 if ticket.id is null or not coalesce(private.support_access(p_restaurant,ticket.id,p_token),false) then raise exception 'Ticket unavailable' using errcode='42501';end if;
 if auth.uid() is not null then staff:=private.has_permission(p_restaurant,'support.read');end if;
 if p_file is null then
  select * into attachment from public.support_attachments where restaurant_id=p_restaurant and ticket_id=p_ticket and id=p_attachment and status='ready';
  select * into message from public.support_messages where restaurant_id=p_restaurant and ticket_id=p_ticket and id=attachment.message_id;
  if attachment.id is null or message.id is null or (message.is_internal and not staff) then raise exception 'Attachment unavailable' using errcode='42501';end if;
 else
  select * into message from public.support_messages where restaurant_id=p_restaurant and ticket_id=p_ticket and id=p_message;
  if message.id is null or message.author_user_id is distinct from auth.uid() or (message.author_type='staff' and (not staff or not private.has_permission(p_restaurant,'support.reply'))) or (message.is_internal and not staff) or ticket.status in ('resolved','closed') then raise exception 'Attachment upload unavailable' using errcode='42501';end if;
  if jsonb_typeof(p_file) is distinct from 'object' or length(coalesce(p_file->>'filename','')) not between 1 and 150 or (p_file->>'size_bytes') !~ '^[0-9]{1,7}$' or coalesce((p_file->>'size_bytes')::integer,0) not between 1 and 5242880 or coalesce(p_file->>'content_type','') not in ('image/jpeg','image/png','image/webp','application/pdf','text/plain') then raise exception 'Unsupported attachment' using errcode='22023';end if;
  if (select count(*) from public.support_attachments where restaurant_id=p_restaurant and message_id=p_message and status<>'rejected')>=5 then raise exception 'Maximum five attachments per message' using errcode='22023';end if;
  extension:=case p_file->>'content_type' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' when 'application/pdf' then 'pdf' else 'txt' end;
  insert into public.support_attachments(restaurant_id,ticket_id,message_id,uploaded_by,object_path,filename,content_type,size_bytes) values(p_restaurant,p_ticket,p_message,auth.uid(),p_restaurant::text||'/tickets/'||p_ticket::text||'/'||gen_random_uuid()::text||'.'||extension,p_file->>'filename',p_file->>'content_type',(p_file->>'size_bytes')::integer) returning * into attachment;
 end if;
 return jsonb_build_object('id',attachment.id,'path',attachment.object_path,'filename',attachment.filename);
end;$$;

revoke all on function private.support_access(uuid,uuid,text),private.create_support_ticket(uuid,jsonb,text,text),private.read_support_ticket(uuid,text,text,integer),private.reply_support_ticket(uuid,text,text,text,boolean,uuid),private.support_assignees(uuid),private.support_attachment(uuid,uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.support_access(uuid,uuid,text),private.create_support_ticket(uuid,jsonb,text,text),private.read_support_ticket(uuid,text,text,integer),private.reply_support_ticket(uuid,text,text,text,boolean,uuid),private.support_attachment(uuid,uuid,uuid,uuid,text,jsonb) to anon,authenticated;
grant execute on function private.support_assignees(uuid) to authenticated;
create function public.create_support_ticket(p_restaurant uuid,p_input jsonb,p_token text,p_order_token text) returns jsonb language sql security invoker set search_path='' as $$select private.create_support_ticket(p_restaurant,p_input,p_token,p_order_token);$$;
create function public.read_support_ticket(p_restaurant uuid,p_reference text,p_token text,p_page integer) returns jsonb language sql security invoker set search_path='' as $$select private.read_support_ticket(p_restaurant,p_reference,p_token,p_page);$$;
create function public.reply_support_ticket(p_restaurant uuid,p_reference text,p_token text,p_body text,p_internal boolean,p_nonce uuid) returns uuid language sql security invoker set search_path='' as $$select private.reply_support_ticket(p_restaurant,p_reference,p_token,p_body,p_internal,p_nonce);$$;
create function public.support_assignees(p_restaurant uuid) returns jsonb language sql security invoker set search_path='' as $$select private.support_assignees(p_restaurant);$$;
create function public.support_attachment(p_restaurant uuid,p_ticket uuid,p_message uuid,p_attachment uuid,p_token text,p_file jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.support_attachment(p_restaurant,p_ticket,p_message,p_attachment,p_token,p_file);$$;
revoke all on function public.create_support_ticket(uuid,jsonb,text,text),public.read_support_ticket(uuid,text,text,integer),public.reply_support_ticket(uuid,text,text,text,boolean,uuid),public.support_assignees(uuid),public.support_attachment(uuid,uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_support_ticket(uuid,jsonb,text,text),public.read_support_ticket(uuid,text,text,integer),public.reply_support_ticket(uuid,text,text,text,boolean,uuid),public.support_attachment(uuid,uuid,uuid,uuid,text,jsonb) to anon,authenticated;
grant execute on function public.support_assignees(uuid) to authenticated;
-- Attachment rows are minted through the authorized quota-checked RPC.
revoke insert on public.support_attachments from authenticated;
revoke insert(restaurant_id,ticket_id,message_id,uploaded_by,object_path,filename,content_type,size_bytes,status) on public.support_attachments from authenticated;
create or replace function public.platform_schema_version() returns integer language sql immutable set search_path='' as $$select 7;$$;
