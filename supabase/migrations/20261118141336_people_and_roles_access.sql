insert into public.permissions(key, description) values
  ('people.read', 'Open the People directory. Staff and customer records still require their respective read permissions.'),
  ('roles.read', 'Open Roles & Permissions and view assigned actions.')
on conflict (key) do update set description=excluded.description;

update public.permissions set description='Assign staff roles, invite team members, and suspend staff access. Owner only.' where key='staff.manage';
update public.permissions set description='Create, edit, and delete custom roles. Owner only.' where key='roles.manage';

-- Preserve access for roles that could already open these sections.
insert into public.role_permissions(restaurant_id, role_id, permission_key)
select distinct restaurant_id,role_id,'people.read' from public.role_permissions
where permission_key in ('staff.read','customers.read')
on conflict do nothing;
insert into public.role_permissions(restaurant_id, role_id, permission_key)
select restaurant_id,role_id,'roles.read' from public.role_permissions
where permission_key='staff.read'
on conflict do nothing;
