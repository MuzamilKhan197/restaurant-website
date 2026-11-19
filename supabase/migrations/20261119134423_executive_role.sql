-- The executive role receives all restaurant permissions through the existing role checks.
create function private.initialize_executive_role() returns trigger
language plpgsql security definer set search_path = '' as $$
declare executive_role uuid;
begin
  insert into public.roles (restaurant_id, name, slug, is_system)
  values (new.id, 'CEO / Co-owner / Super Admin', 'ceo-co-owner-super-admin', true)
  returning id into executive_role;

  insert into public.role_permissions (restaurant_id, role_id, permission_key)
  select new.id, executive_role, key from public.permissions;
  return new;
end;
$$;

create trigger initialize_executive_role after insert on public.restaurants
for each row execute function private.initialize_executive_role();

insert into public.roles (restaurant_id, name, slug, is_system)
select id, 'CEO / Co-owner / Super Admin', 'ceo-co-owner-super-admin', true
from public.restaurants;

insert into public.role_permissions (restaurant_id, role_id, permission_key)
select r.restaurant_id, r.id, p.key
from public.roles r cross join public.permissions p
where r.slug = 'ceo-co-owner-super-admin' and r.is_system;

create function private.grant_executive_permission() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.role_permissions (restaurant_id, role_id, permission_key)
  select restaurant_id, id, new.key from public.roles
  where slug = 'ceo-co-owner-super-admin' and is_system
  on conflict do nothing;
  return new;
end;
$$;

create trigger grant_executive_permission after insert on public.permissions
for each row execute function private.grant_executive_permission();

revoke all on function private.initialize_executive_role(), private.grant_executive_permission()
from public, anon, authenticated;
