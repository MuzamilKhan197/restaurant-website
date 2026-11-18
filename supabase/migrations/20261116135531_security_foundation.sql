insert into public.permissions(key, description) values
('orders.read','Read restaurant orders'), ('orders.update','Update allowed order states'),
('payments.manage','Record cash collection and refunds'), ('menu.read','Read unpublished menu data'),
('menu.manage','Manage categories, products, variants, add-ons and images'),
('customers.read','Read restaurant customer profiles and order history'),
('staff.read','Read restaurant staff'), ('staff.manage','Owner-only staff management'),
('roles.manage','Owner-only role and permission management'),
('support.read','Read support tickets and internal notes'), ('support.reply','Reply to tickets'),
('support.manage','Assign, escalate and resolve tickets'),
('reports.read','Read sales and order reports'), ('audit.read','Read restaurant activity'),
('settings.read','Read business configuration'), ('settings.manage','Manage business configuration'),
('website.manage','Manage storefront availability');

create function private.is_owner(p_restaurant uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.restaurants r where r.id = p_restaurant and r.owner_user_id = (select auth.uid())
  );
$$;
create function private.is_staff(p_restaurant uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_owner(p_restaurant) or exists (
    select 1 from public.staff_memberships m join public.roles r on r.id=m.role_id and r.restaurant_id=m.restaurant_id
    where m.restaurant_id=p_restaurant and m.user_id=(select auth.uid()) and m.status='active' and r.is_active
  );
$$;
create function private.has_permission(p_restaurant uuid, p_permission text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when p_permission in ('staff.manage','roles.manage') then private.is_owner(p_restaurant)
    else private.is_owner(p_restaurant) or exists (
      select 1 from public.staff_memberships m
      join public.roles r on r.restaurant_id=m.restaurant_id and r.id=m.role_id and r.is_active
      join public.role_permissions rp on rp.restaurant_id=r.restaurant_id and rp.role_id=r.id
      where m.restaurant_id=p_restaurant and m.user_id=(select auth.uid())
        and m.status='active' and rp.permission_key=p_permission
    ) end;
$$;
create function private.is_customer(p_restaurant uuid, p_customer uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.restaurant_customers c where c.restaurant_id=p_restaurant and c.id=p_customer and c.user_id=(select auth.uid())
  );
$$;
create function private.is_published(p_restaurant uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.restaurants r where r.id=p_restaurant and r.is_published);
$$;
create function private.storefront_visible(p_restaurant uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.restaurants r join public.restaurant_settings s on s.restaurant_id=r.id
    where r.id=p_restaurant and r.is_published and s.website_mode<>'maintenance');
$$;
create function private.product_visible(p_restaurant uuid, p_product uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.storefront_visible(p_restaurant) and exists (
    select 1 from public.products p join public.categories c on c.restaurant_id=p.restaurant_id and c.id=p.category_id
    where p.restaurant_id=p_restaurant and p.id=p_product and p.is_active and c.is_active
  );
$$;
create function private.addon_group_visible(p_restaurant uuid, p_group uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.addon_groups g join public.product_addon_groups pg on pg.restaurant_id=g.restaurant_id and pg.addon_group_id=g.id
    where g.restaurant_id=p_restaurant and g.id=p_group and g.is_active and private.product_visible(p_restaurant, pg.product_id));
$$;
create function private.can_read_order(p_restaurant uuid, p_order uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_permission(p_restaurant,'orders.read') or exists (
    select 1 from public.orders o where o.restaurant_id=p_restaurant and o.id=p_order and private.is_customer(p_restaurant,o.customer_id)
  );
$$;
create function private.can_read_ticket(p_restaurant uuid, p_ticket uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_permission(p_restaurant,'support.read') or exists (
    select 1 from public.support_tickets t where t.restaurant_id=p_restaurant and t.id=p_ticket and private.is_customer(p_restaurant,t.customer_id)
  );
$$;
create function private.can_read_message(p_restaurant uuid, p_message uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.support_messages m where m.restaurant_id=p_restaurant and m.id=p_message
    and (private.has_permission(p_restaurant,'support.read') or (not m.is_internal and private.can_read_ticket(p_restaurant,m.ticket_id))));
$$;

create function private.initialize_restaurant() returns trigger
language plpgsql security definer set search_path = '' as $$
declare role_row record;
begin
  insert into public.restaurant_settings(restaurant_id) values(new.id);
  insert into public.roles(restaurant_id,name,slug,is_system) values
    (new.id,'Owner','owner',true), (new.id,'Admin','admin',true), (new.id,'Manager','manager',true),
    (new.id,'Support Agent','support-agent',true), (new.id,'Developer','developer',true), (new.id,'Customer','customer',true);
  for role_row in select id,slug from public.roles where restaurant_id=new.id loop
    insert into public.role_permissions(restaurant_id,role_id,permission_key)
    select new.id,role_row.id,p.key from public.permissions p where
      role_row.slug='owner'
      or (role_row.slug='admin' and p.key not in ('staff.manage','roles.manage'))
      or (role_row.slug='manager' and p.key in ('orders.read','orders.update','payments.manage','menu.read','menu.manage','customers.read','support.read','support.reply','support.manage','reports.read','settings.read'))
      or (role_row.slug='support-agent' and p.key in ('support.read','support.reply','support.manage'))
      or (role_row.slug='developer' and p.key in ('settings.read','website.manage','audit.read'));
  end loop;
  return new;
end;
$$;
create trigger initialize_restaurant after insert on public.restaurants for each row execute function private.initialize_restaurant();

create function private.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,display_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'full_name',''),100));
  return new;
end;
$$;
create trigger create_restaurant_profile after insert on auth.users for each row execute function private.create_profile();

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$ begin new.updated_at=now(); return new; end; $$;
create function private.guard_identity() returns trigger
language plpgsql set search_path = '' as $$
declare field text;
begin
  foreach field in array tg_argv loop
    if (to_jsonb(new)->field) is distinct from (to_jsonb(old)->field) then
      raise exception 'Immutable identity field: %',field using errcode='23514';
    end if;
  end loop;
  return new;
end;
$$;
create function private.immutable_record() returns trigger
language plpgsql set search_path = '' as $$ begin raise exception 'Historical records are immutable' using errcode='23514'; end; $$;
create function private.guard_role() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op='DELETE' then
    if old.is_system then raise exception 'System roles cannot be deleted' using errcode='23514'; end if;
    return old;
  end if;
  if old.is_system and (new.is_system is distinct from old.is_system or new.slug is distinct from old.slug or new.name is distinct from old.name or not new.is_active) then
    raise exception 'System role identity cannot be changed' using errcode='23514';
  end if;
  if new.is_system is distinct from old.is_system then raise exception 'Custom roles cannot become system roles' using errcode='23514'; end if;
  return new;
end;
$$;
create trigger guard_system_role before update or delete on public.roles for each row execute function private.guard_role();
create function private.guard_staff_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid; role_slug text;
begin
  if tg_op='DELETE' then
    if old.user_id=(select owner_user_id from public.restaurants where id=old.restaurant_id) then raise exception 'Owner membership cannot be removed' using errcode='23514'; end if;
    return old;
  end if;
  select owner_user_id into owner_id from public.restaurants where id=new.restaurant_id;
  select slug into role_slug from public.roles where restaurant_id=new.restaurant_id and id=new.role_id;
  if (role_slug='owner' and new.user_id is distinct from owner_id)
    or (new.user_id=owner_id and (role_slug<>'owner' or new.status<>'active')) then
    raise exception 'Owner identity is controlled by restaurant ownership, not a role label' using errcode='23514';
  end if;
  return new;
end;
$$;
create trigger guard_staff_owner before insert or update or delete on public.staff_memberships for each row execute function private.guard_staff_owner();

create function private.guard_order() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='INSERT' then
    if new.status<>'pending' then raise exception 'Orders must start pending' using errcode='23514'; end if;
    if new.currency<>(select currency from public.restaurants where id=new.restaurant_id) then raise exception 'Order currency must match restaurant' using errcode='23514'; end if;
    return new;
  end if;
  if tg_op='DELETE' then raise exception 'Orders cannot be deleted' using errcode='23514'; end if;
  if (to_jsonb(new)-array['status','rejection_reason','cancellation_reason','updated_at']) is distinct from (to_jsonb(old)-array['status','rejection_reason','cancellation_reason','updated_at']) then
    raise exception 'Order snapshots and totals are immutable' using errcode='23514';
  end if;
  if new.status<>old.status and not (
    (old.status='pending' and new.status in ('accepted','rejected','cancelled')) or
    (old.status='accepted' and new.status in ('preparing','cancelled')) or
    (old.status='preparing' and new.status in ('ready','cancelled')) or
    (old.status='ready' and new.status in ('completed','cancelled'))
  ) then raise exception 'Invalid order status transition' using errcode='23514'; end if;
  if new.status='rejected' and nullif(btrim(new.rejection_reason),'') is null then raise exception 'A rejection reason is required' using errcode='23514'; end if;
  if new.status='cancelled' and nullif(btrim(new.cancellation_reason),'') is null then raise exception 'A cancellation reason is required' using errcode='23514'; end if;
  return new;
end;
$$;
create trigger guard_order before insert or update or delete on public.orders for each row execute function private.guard_order();
create function private.order_status_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='INSERT' or new.status is distinct from old.status then
    insert into public.order_status_events(restaurant_id,order_id,status) values(new.restaurant_id,new.id,new.status);
  end if;
  if tg_op='UPDATE' and new.status in ('rejected','cancelled') then
    update public.payments set status='refund_due' where restaurant_id=new.restaurant_id and order_id=new.id and status='paid';
  end if;
  return new;
end;
$$;
create trigger order_status_event after insert or update on public.orders for each row execute function private.order_status_event();

create function private.guard_payment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  if tg_op='DELETE' then raise exception 'Payments cannot be deleted' using errcode='23514'; end if;
  select * into o from public.orders where restaurant_id=new.restaurant_id and id=new.order_id;
  if not found or new.amount_minor<>o.total_minor or new.currency<>o.currency or new.method<>o.payment_method then
    raise exception 'Payment must match its order' using errcode='23514';
  end if;
  if tg_op='INSERT' and (new.status<>'unpaid' or new.paid_at is not null or new.refunded_at is not null) then raise exception 'Payments must start unpaid' using errcode='23514'; end if;
  if tg_op='UPDATE' then
    if (to_jsonb(new)-array['status','recorded_by','paid_at','refunded_at','updated_at']) is distinct from (to_jsonb(old)-array['status','recorded_by','paid_at','refunded_at','updated_at']) then
      raise exception 'Payment amount and identity are immutable' using errcode='23514';
    end if;
    if auth.uid() is not null then new.recorded_by=auth.uid(); end if;
    if new.status<>old.status and not ((old.status='unpaid' and new.status='paid' and o.status not in ('rejected','cancelled'))
      or (old.status='paid' and new.status='refund_due' and o.status in ('rejected','cancelled')) or (old.status='refund_due' and new.status='refunded')) then
      raise exception 'Invalid payment status transition' using errcode='23514';
    end if;
    if new.status='paid' and old.status<>'paid' then new.paid_at=now(); end if;
    if new.status='refunded' and old.status<>'refunded' then new.refunded_at=now(); end if;
  end if;
  return new;
end;
$$;
create trigger guard_payment before insert or update or delete on public.payments for each row execute function private.guard_payment();

create function private.guard_ticket_relationships() returns trigger
language plpgsql security definer set search_path = '' as $$
declare order_customer uuid;
begin
  if new.order_id is not null then
    select customer_id into order_customer from public.orders where id=new.order_id and restaurant_id=new.restaurant_id;
    if not found or order_customer is distinct from new.customer_id then
      raise exception 'Ticket customer must match its linked order' using errcode='23514';
    end if;
  end if;
  if new.assigned_to is not null and not exists (
    select 1 from public.staff_memberships m join public.roles r on r.restaurant_id=m.restaurant_id and r.id=m.role_id
    where m.id=new.assigned_to and m.restaurant_id=new.restaurant_id and m.status='active' and r.is_active
      and (exists (select 1 from public.restaurants restaurant where restaurant.id=m.restaurant_id and restaurant.owner_user_id=m.user_id) or exists (
        select 1 from public.role_permissions p where p.restaurant_id=m.restaurant_id and p.role_id=m.role_id and p.permission_key='support.read'))
  ) then raise exception 'Ticket assignee must be active support staff' using errcode='23514'; end if;
  return new;
end;
$$;
create trigger guard_ticket_relationships before insert or update on public.support_tickets for each row execute function private.guard_ticket_relationships();

create function private.check_order_totals() returns trigger
language plpgsql security definer set search_path = '' as $$
declare order_key uuid; tenant uuid; expected bigint; actual bigint; item_count integer;
begin
  if tg_table_name='orders' then order_key=new.id; tenant=new.restaurant_id; else order_key=new.order_id; tenant=new.restaurant_id; end if;
  select subtotal_minor into expected from public.orders where id=order_key and restaurant_id=tenant;
  select coalesce(sum(line_total_minor),0),count(*) into actual,item_count from public.order_items where order_id=order_key and restaurant_id=tenant;
  if item_count=0 or actual<>expected then raise exception 'Order subtotal must match immutable line items' using errcode='23514'; end if;
  if exists(select 1 from public.order_items i where i.order_id=order_key and i.restaurant_id=tenant and i.addons_total_minor <>
    (select coalesce(sum(a.unit_price_minor::bigint*a.quantity),0) from public.order_item_addons a where a.restaurant_id=tenant and a.order_item_id=i.id)) then
    raise exception 'Item add-on total must match add-on snapshots' using errcode='23514';
  end if;
  if not exists(select 1 from public.payments p where p.restaurant_id=tenant and p.order_id=order_key) then
    raise exception 'Order requires a matching cash payment record' using errcode='23514';
  end if;
  return null;
end;
$$;
create constraint trigger check_order_totals after insert on public.orders deferrable initially deferred for each row execute function private.check_order_totals();
create constraint trigger check_order_item_totals after insert on public.order_items deferrable initially deferred for each row execute function private.check_order_totals();
create constraint trigger check_order_addon_totals after insert on public.order_item_addons deferrable initially deferred for each row execute function private.check_order_totals();

create function private.audit_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare row_value jsonb; tenant uuid; row_key text;
begin
  if tg_op='DELETE' then row_value=to_jsonb(old); else row_value=to_jsonb(new); end if;
  if tg_table_name='restaurants' then tenant=(row_value->>'id')::uuid; else tenant=(row_value->>'restaurant_id')::uuid; end if;
  row_key=coalesce(row_value->>'id',row_value->>'role_id',row_value->>'product_id',tenant::text);
  insert into public.audit_logs(restaurant_id,actor_user_id,action,entity_type,entity_id,metadata)
    values(tenant,(select auth.uid()),lower(tg_op),tg_table_name,row_key,jsonb_build_object('source','database'));
  return null;
end;
$$;

create function private.guard_guest_resource() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.resource_type='order' and not exists(select 1 from public.orders where id=new.resource_id and restaurant_id=new.restaurant_id and customer_id is null) then
    raise exception 'Guest order key must reference a guest order in the same restaurant' using errcode='23514';
  elsif new.resource_type='ticket' and not exists(select 1 from public.support_tickets where id=new.resource_id and restaurant_id=new.restaurant_id and customer_id is null) then
    raise exception 'Guest ticket key must reference a guest ticket in the same restaurant' using errcode='23514';
  end if;
  return new;
end;
$$;
create trigger guard_guest_resource before insert or update on private.guest_access for each row execute function private.guard_guest_resource();

create function public.resolve_guest_access(p_kind text,p_reference text,p_token text)
returns table(resource_id uuid,restaurant_id uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_kind not in ('order','ticket') or p_token is null or p_token !~ '^[a-f0-9]{64}$' or length(p_reference)>80 then return; end if;
  return query select g.resource_id,g.restaurant_id from private.guest_access g
    where g.resource_type=p_kind and g.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')
    and g.expires_at>now() and g.revoked_at is null and (
      (p_kind='order' and exists(select 1 from public.orders o where o.id=g.resource_id and o.restaurant_id=g.restaurant_id and o.reference=p_reference))
      or (p_kind='ticket' and exists(select 1 from public.support_tickets t where t.id=g.resource_id and t.restaurant_id=g.restaurant_id and t.reference=p_reference))
    );
end;
$$;
revoke all on function public.resolve_guest_access(text,text,text) from public, anon, authenticated;
grant execute on function public.resolve_guest_access(text,text,text) to service_role;
