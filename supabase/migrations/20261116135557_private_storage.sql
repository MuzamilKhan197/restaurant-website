-- Both buckets remain private. Catalog reads require a published, visible
-- product; ticket uploads/downloads additionally require ticket authorization.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
  ('menu-images','menu-images',false,5242880,array['image/jpeg','image/png','image/webp']),
  ('ticket-attachments','ticket-attachments',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf','text/plain']);

create function private.path_uuid(p_path text,p_position integer) returns uuid
language sql immutable set search_path = '' as $$
  select case when split_part(p_path,'/',p_position) ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    then split_part(p_path,'/',p_position)::uuid else null end;
$$;
create function private.valid_object_path(p_path text) returns boolean
language sql immutable set search_path = '' as $$
  select p_path !~ '(^|/)\.\.?(/|$)' and p_path !~ '[\\]' and length(p_path)<=500
    and split_part(p_path,'/',4)<>'' and split_part(p_path,'/',5)='';
$$;
create function private.guard_object_path() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not private.valid_object_path(new.object_path) or private.path_uuid(new.object_path,1) is distinct from new.restaurant_id then
    raise exception 'Invalid tenant-scoped object path' using errcode='23514';
  end if;
  if tg_table_name='product_images' then
    if split_part(new.object_path,'/',2)<>'products' or private.path_uuid(new.object_path,3) is distinct from new.product_id then
      raise exception 'Product image path must match its product' using errcode='23514';
    end if;
  elsif tg_table_name='support_attachments' then
    if split_part(new.object_path,'/',2)<>'tickets' or private.path_uuid(new.object_path,3) is distinct from new.ticket_id then
      raise exception 'Attachment path must match its ticket' using errcode='23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_image_path before insert or update on public.product_images for each row execute function private.guard_object_path();
create trigger guard_attachment_path before insert or update on public.support_attachments for each row execute function private.guard_object_path();

create function private.read_menu_object(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.product_images i where i.object_path=p_path and private.product_visible(i.restaurant_id,i.product_id))
    or (private.valid_object_path(p_path) and split_part(p_path,'/',2)='products' and private.has_permission(private.path_uuid(p_path,1),'menu.read'))
    or (private.valid_object_path(p_path) and split_part(p_path,'/',2)='products' and private.has_permission(private.path_uuid(p_path,1),'menu.manage'));
$$;
create function private.manage_menu_object(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.valid_object_path(p_path) and split_part(p_path,'/',2)='products'
    and private.has_permission(private.path_uuid(p_path,1),'menu.manage')
    and exists(select 1 from public.products p where p.restaurant_id=private.path_uuid(p_path,1) and p.id=private.path_uuid(p_path,3));
$$;
create function private.read_ticket_object(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.support_attachments a where a.object_path=p_path and a.status='ready' and private.can_read_message(a.restaurant_id,a.message_id));
$$;
create function private.upload_ticket_object(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.support_attachments a where a.object_path=p_path and a.status='pending'
    and a.uploaded_by=(select auth.uid()) and private.can_read_message(a.restaurant_id,a.message_id));
$$;

revoke all on function private.path_uuid(text,integer), private.valid_object_path(text), private.guard_object_path(), private.read_menu_object(text), private.manage_menu_object(text), private.read_ticket_object(text), private.upload_ticket_object(text) from public, anon, authenticated;
grant execute on function private.read_menu_object(text) to anon, authenticated;
grant execute on function private.manage_menu_object(text),private.read_ticket_object(text),private.upload_ticket_object(text) to authenticated;
-- The path trigger executes as its caller; permit only its harmless validators.
grant execute on function private.valid_object_path(text),private.path_uuid(text,integer) to authenticated;
grant execute on all functions in schema private to service_role;

create policy restaurant_menu_object_read on storage.objects for select to anon, authenticated using (bucket_id='menu-images' and private.read_menu_object(name));
create policy restaurant_menu_object_insert on storage.objects for insert to authenticated with check (bucket_id='menu-images' and owner_id=(select auth.uid())::text and private.manage_menu_object(name));
create policy restaurant_menu_object_update on storage.objects for update to authenticated using (bucket_id='menu-images' and private.manage_menu_object(name)) with check (bucket_id='menu-images' and private.manage_menu_object(name));
create policy restaurant_menu_object_delete on storage.objects for delete to authenticated using (bucket_id='menu-images' and private.manage_menu_object(name));
create policy restaurant_ticket_object_read on storage.objects for select to authenticated using (bucket_id='ticket-attachments' and private.read_ticket_object(name));
create policy restaurant_ticket_object_insert on storage.objects for insert to authenticated with check (bucket_id='ticket-attachments' and owner_id=(select auth.uid())::text and private.upload_ticket_object(name));
-- No authenticated UPDATE/DELETE policy for ticket evidence. Cleanup and
-- moderation require trusted server code. Pending files cannot be downloaded.

create function public.platform_schema_version() returns integer
language sql stable set search_path = '' as $$ select 2; $$;
revoke all on function public.platform_schema_version() from public;
grant execute on function public.platform_schema_version() to anon, authenticated, service_role;

-- Publish only minimal status rows, never contacts, addresses, guest keys or
-- entire financial records. Actual subscription isolation is verified when
-- the Supabase Realtime service is connected in the ordering phase.
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.order_status_events;
  end if;
end $$;
