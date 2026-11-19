-- Rename the display label of the existing built-in role.
alter table public.roles disable trigger guard_system_role;
update public.roles set name = 'CEO'
where slug = 'ceo-co-owner-super-admin' and is_system;
alter table public.roles enable trigger guard_system_role;

create or replace function private.initialize_executive_role() returns trigger
language plpgsql security definer set search_path = '' as $$
declare executive_role uuid;
begin
  insert into public.roles (restaurant_id, name, slug, is_system)
  values (new.id, 'CEO', 'ceo-co-owner-super-admin', true)
  returning id into executive_role;

  insert into public.role_permissions (restaurant_id, role_id, permission_key)
  select new.id, executive_role, key from public.permissions;
  return new;
end;
$$;
