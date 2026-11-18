create table public.staff_additional_roles (
  restaurant_id uuid not null,
  membership_id uuid not null,
  role_id uuid not null,
  primary key (restaurant_id, membership_id, role_id),
  foreign key (restaurant_id, membership_id) references public.staff_memberships(restaurant_id,id) on delete cascade,
  foreign key (restaurant_id, role_id) references public.roles(restaurant_id,id) on delete restrict
);
create index staff_additional_roles_role_idx on public.staff_additional_roles(restaurant_id,role_id);
alter table public.staff_additional_roles enable row level security;
revoke all on public.staff_additional_roles from anon, authenticated;
grant select on public.staff_additional_roles to authenticated;
grant all on public.staff_additional_roles to service_role;
create policy staff_additional_roles_read on public.staff_additional_roles for select to authenticated
using (private.has_permission(restaurant_id,'staff.read'));
create trigger audit_staff_additional_roles after insert or delete on public.staff_additional_roles
for each row execute function private.audit_change();

create function private.active_member_roles(tenant uuid, member uuid, primary_role uuid)
returns setof public.roles language sql stable set search_path='' as $$
  select r.* from public.roles r where r.restaurant_id=tenant and r.is_active
    and (r.id=primary_role or exists (
      select 1 from public.staff_additional_roles a
      where a.restaurant_id=tenant and a.membership_id=member and a.role_id=r.id
    ));
$$;
revoke all on function private.active_member_roles(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function private.is_staff(p_restaurant uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.is_owner(p_restaurant) or exists (
    select 1 from public.staff_memberships m
    cross join lateral private.active_member_roles(m.restaurant_id,m.id,m.role_id) r
    where m.restaurant_id=p_restaurant and m.user_id=auth.uid() and m.status='active'
  );
$$;

create or replace function private.has_permission(p_restaurant uuid,p_permission text) returns boolean
language sql stable security definer set search_path='' as $$
  select private.is_owner(p_restaurant) or (
    p_permission not in ('staff.manage','roles.manage') and exists (
      select 1 from public.staff_memberships m
      cross join lateral private.active_member_roles(m.restaurant_id,m.id,m.role_id) r
      join public.role_permissions rp on rp.restaurant_id=r.restaurant_id and rp.role_id=r.id
      where m.restaurant_id=p_restaurant and m.user_id=auth.uid()
        and m.status='active' and rp.permission_key=p_permission
    )
  );
$$;

create or replace function private.current_staff_access(p_restaurant uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid; role_name text; permission_keys text[];
begin
  actor := private.require_confirmed_user();
  if not private.is_staff(p_restaurant) then return null; end if;
  if private.is_owner(p_restaurant) then role_name := 'Owner';
  else
    select string_agg(r.name, ', ' order by (r.id=m.role_id) desc,r.name,r.id) into role_name
    from public.staff_memberships m cross join lateral private.active_member_roles(m.restaurant_id,m.id,m.role_id) r
    where m.restaurant_id=p_restaurant and m.user_id=actor and m.status='active';
  end if;
  select coalesce(array_agg(p.key order by p.key),'{}') into permission_keys
  from public.permissions p where private.has_permission(p_restaurant,p.key);
  return jsonb_build_object('restaurant_id',p_restaurant,'role_name',role_name,'is_owner',private.is_owner(p_restaurant),'permissions',permission_keys);
end;
$$;

create function private.set_staff_roles(p_restaurant uuid,p_member uuid,p_role uuid,p_extra_roles uuid[],p_status public.membership_status)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.require_restaurant_owner(p_restaurant);
  if p_extra_roles is null or cardinality(p_extra_roles)>20 or exists (
    select 1 from unnest(p_extra_roles) a(id) where a.id is null or not exists (
      select 1 from public.roles r
      where r.restaurant_id=p_restaurant and r.id=a.id and r.is_active and r.slug not in ('owner','customer')
    )
  ) then raise exception 'Invalid additional staff roles' using errcode='22023'; end if;
  perform private.manage_staff_member(p_restaurant,p_member,p_role,p_status);
  delete from public.staff_additional_roles a
  where a.restaurant_id=p_restaurant and a.membership_id=p_member
    and (a.role_id=p_role or not (a.role_id=any(p_extra_roles)));
  insert into public.staff_additional_roles(restaurant_id,membership_id,role_id)
  select distinct p_restaurant,p_member,id from unnest(p_extra_roles) a(id) where id<>p_role
  on conflict do nothing;
end;
$$;
create function public.set_staff_roles(p_restaurant uuid,p_member uuid,p_role uuid,p_extra_roles uuid[],p_status public.membership_status)
returns void language sql security invoker set search_path='' as $$
  select private.set_staff_roles(p_restaurant,p_member,p_role,p_extra_roles,p_status);
$$;
revoke all on function private.set_staff_roles(uuid,uuid,uuid,uuid[],public.membership_status),public.set_staff_roles(uuid,uuid,uuid,uuid[],public.membership_status) from public,anon,authenticated;
grant execute on function private.set_staff_roles(uuid,uuid,uuid,uuid[],public.membership_status),public.set_staff_roles(uuid,uuid,uuid,uuid[],public.membership_status) to authenticated;

create function private.is_support_assignee(tenant uuid, member uuid) returns boolean
language sql stable set search_path='' as $$
  select exists (
    select 1 from public.staff_memberships m
    cross join lateral private.active_member_roles(m.restaurant_id,m.id,m.role_id) r
    where m.restaurant_id=tenant and m.id=member and m.status='active'
      and (r.slug='owner' or exists (
        select 1 from public.role_permissions rp
        where rp.restaurant_id=tenant and rp.role_id=r.id and rp.permission_key='support.read'
      ))
  );
$$;
revoke all on function private.is_support_assignee(uuid,uuid) from public,anon,authenticated;

create or replace function private.support_assignees(p_restaurant uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.require_confirmed_user();
  if not private.has_permission(p_restaurant,'support.read') or not private.has_permission(p_restaurant,'support.manage') then
    raise exception 'Support management access required' using errcode='42501';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',m.display_name) order by m.display_name,m.id),'[]')
    from public.staff_memberships m where m.restaurant_id=p_restaurant and private.is_support_assignee(p_restaurant,m.id));
end;
$$;

create or replace function private.guard_ticket_relationships() returns trigger
language plpgsql security definer set search_path='' as $$
declare order_customer uuid;
begin
  if new.order_id is not null then
    select customer_id into order_customer from public.orders where id=new.order_id and restaurant_id=new.restaurant_id;
    if not found or order_customer is distinct from new.customer_id then
      raise exception 'Ticket customer must match its linked order' using errcode='23514';
    end if;
  end if;
  if new.assigned_to is not null and not private.is_support_assignee(new.restaurant_id,new.assigned_to) then
    raise exception 'Ticket assignee must be active support staff' using errcode='23514';
  end if;
  return new;
end;
$$;
