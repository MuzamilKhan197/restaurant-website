create function private.staff_permission_for(tenant uuid, actor uuid, capability text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists (select 1 from public.restaurants where id=tenant and owner_user_id=actor)
    or exists (select 1 from public.staff_memberships m
      cross join lateral private.active_member_roles(m.restaurant_id,m.id,m.role_id) r
      join public.role_permissions rp on rp.restaurant_id=r.restaurant_id and rp.role_id=r.id
      where m.restaurant_id=tenant and m.user_id=actor and m.status='active'
        and (rp.permission_key=capability
          or (capability='roles.read' and rp.permission_key='roles.manage')
          or (capability='staff.read' and rp.permission_key='staff.manage')));
$$;

create or replace function private.has_permission(p_restaurant uuid,p_permission text) returns boolean
language sql stable security definer set search_path='' as $$
  select private.staff_permission_for(p_restaurant,auth.uid(),p_permission);
$$;

create function private.require_staff_management(tenant uuid,capability text) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform private.require_confirmed_user();
  if not private.has_permission(tenant,capability) then
    raise exception 'Management permission required' using errcode='42501';
  end if;
end;
$$;

-- Only the owner can grant management permissions. Delegates can grant their other permissions.
create function private.can_grant_permissions(tenant uuid,actor uuid,keys text[]) returns boolean
language sql stable security definer set search_path='' as $$
  select exists (select 1 from public.restaurants where id=tenant and owner_user_id=actor)
    or not exists (select 1 from unnest(keys) p(key)
      where p.key in ('staff.manage','roles.manage')
        or not private.staff_permission_for(tenant,actor,p.key));
$$;

create function private.can_grant_roles(tenant uuid,actor uuid,role_ids uuid[]) returns boolean
language sql stable security definer set search_path='' as $$
  select not exists (select 1 from public.roles where restaurant_id=tenant
    and id=any(role_ids) and slug='owner')
    and private.can_grant_permissions(tenant,actor,array(
      select permission_key from public.role_permissions
      where restaurant_id=tenant and role_id=any(role_ids)));
$$;

revoke all on function private.staff_permission_for(uuid,uuid,text), private.require_staff_management(uuid,text),
  private.can_grant_permissions(uuid,uuid,text[]), private.can_grant_roles(uuid,uuid,uuid[])
  from public,anon,authenticated;

create or replace function private.save_custom_role(p_restaurant uuid,p_role uuid,p_name text,p_slug text,p_permissions text[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_restaurant::text,0));
  perform private.require_staff_management(p_restaurant,'roles.manage');
  if p_name is null or length(btrim(p_name)) not between 1 and 80 or p_slug is null or length(p_slug)>80 or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or p_slug in ('owner','admin','manager','support-agent','developer','customer') or p_permissions is null or cardinality(p_permissions)>30 then raise exception 'Invalid custom role' using errcode='22023'; end if;
  if exists(select 1 from unnest(p_permissions) selected(key) where selected.key is null or not exists(select 1 from public.permissions p where p.key=selected.key)) then raise exception 'Invalid permission selection' using errcode='22023'; end if;
  if not private.can_grant_permissions(p_restaurant,auth.uid(),p_permissions) then
    raise exception 'Permission selection exceeds your access' using errcode='42501';
  end if;
  if p_role is null then
    insert into public.roles(restaurant_id,name,slug) values(p_restaurant,btrim(p_name),p_slug) returning id into result;
  else
    select id into result from public.roles where restaurant_id=p_restaurant and id=p_role and not is_system for update;
    if not found then raise exception 'Custom role unavailable' using errcode='42501'; end if;
    if not private.can_grant_roles(p_restaurant,auth.uid(),array[result]) then
      raise exception 'Custom role exceeds your access' using errcode='42501';
    end if;
    update public.roles set name=btrim(p_name) where restaurant_id=p_restaurant and id=result;
    delete from public.role_permissions where restaurant_id=p_restaurant and role_id=result;
  end if;
  insert into public.role_permissions(restaurant_id,role_id,permission_key) select p_restaurant,result,key from (select distinct unnest(p_permissions) key) selected;
  return result;
end;
$$;

create or replace function private.set_staff_roles(p_restaurant uuid,p_member uuid,p_role uuid,p_extra_roles uuid[],p_status public.membership_status)
returns void language plpgsql security definer set search_path='' as $$
declare member public.staff_memberships; old_roles uuid[];
begin
  perform pg_advisory_xact_lock(hashtextextended(p_restaurant::text,0));
  perform private.require_staff_management(p_restaurant,'staff.manage');
  if p_extra_roles is null or cardinality(p_extra_roles)>20 or exists (
    select 1 from unnest(p_extra_roles) a(id) where a.id is null or not exists (
      select 1 from public.roles r
      where r.restaurant_id=p_restaurant and r.id=a.id and r.is_active and r.slug not in ('owner','customer')
    )
  ) then raise exception 'Invalid additional staff roles' using errcode='22023'; end if;
  if p_status is null or p_status not in ('active','suspended') or not exists (
    select 1 from public.roles where restaurant_id=p_restaurant and id=p_role
      and is_active and slug not in ('owner','customer')
  ) then raise exception 'Invalid staff change' using errcode='22023'; end if;
  select * into member from public.staff_memberships where restaurant_id=p_restaurant and id=p_member for update;
  if not found or member.user_id=auth.uid() or exists (
    select 1 from public.restaurants where id=p_restaurant and owner_user_id=member.user_id
  ) then raise exception 'Staff member unavailable' using errcode='42501'; end if;
  old_roles := array_append(array(select role_id from public.staff_additional_roles
    where restaurant_id=p_restaurant and membership_id=p_member),member.role_id);
  if not private.can_grant_roles(p_restaurant,auth.uid(),old_roles)
    or not private.can_grant_roles(p_restaurant,auth.uid(),array_append(p_extra_roles,p_role))
  then raise exception 'Staff roles exceed your access' using errcode='42501'; end if;
  update public.staff_memberships set role_id=p_role,status=p_status
  where restaurant_id=p_restaurant and id=p_member;
  delete from public.staff_additional_roles a
  where a.restaurant_id=p_restaurant and a.membership_id=p_member
    and (a.role_id=p_role or not (a.role_id=any(p_extra_roles)));
  insert into public.staff_additional_roles(restaurant_id,membership_id,role_id)
  select distinct p_restaurant,p_member,id from unnest(p_extra_roles) a(id) where id<>p_role
  on conflict do nothing;
end;
$$;

create or replace function private.create_staff_invitation(p_restaurant uuid,p_email text,p_role uuid,p_token_hash text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid; result uuid; email_value text:=lower(btrim(p_email));
begin
  perform pg_advisory_xact_lock(hashtextextended(p_restaurant::text,0));
  perform private.require_staff_management(p_restaurant,'staff.manage');
  actor:=auth.uid();
  if email_value is null or length(email_value)>254 or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid invitation' using errcode='22023'; end if;
  if not exists(select 1 from public.roles where restaurant_id=p_restaurant and id=p_role and is_active and slug not in ('owner','customer')) then raise exception 'Invalid staff role' using errcode='22023'; end if;
  if exists(select 1 from public.staff_memberships m join auth.users u on u.id=m.user_id where m.restaurant_id=p_restaurant and lower(u.email)=email_value) then raise exception 'Account already belongs to this team' using errcode='23505'; end if;
  if (select count(*) from public.staff_invitations where restaurant_id=p_restaurant and created_at>now()-interval '1 hour')>=20 then raise exception 'Invitation limit reached. Try later.' using errcode='54000'; end if;
  if not private.can_grant_roles(p_restaurant,actor,array[p_role]) or (
    not private.is_owner(p_restaurant) and exists (
      select 1 from public.staff_invitations where restaurant_id=p_restaurant
        and lower(email)=email_value and accepted_at is null and revoked_at is null
        and expires_at>now() and invited_by is distinct from actor
    )
  ) then raise exception 'Invitation exceeds your access' using errcode='42501'; end if;
  update public.staff_invitations set revoked_at=now() where restaurant_id=p_restaurant and lower(email)=email_value and accepted_at is null and revoked_at is null;
  insert into public.staff_invitations(restaurant_id,role_id,email,token_hash,invited_by,expires_at)
    values(p_restaurant,p_role,email_value,p_token_hash,actor,now()+interval '48 hours') returning id into result;
  return result;
end;
$$;

create or replace function private.revoke_staff_invitation(p_restaurant uuid,p_invitation uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_restaurant::text,0));
  perform private.require_staff_management(p_restaurant,'staff.manage');
  update public.staff_invitations set revoked_at=now() where id=p_invitation and restaurant_id=p_restaurant and accepted_at is null and revoked_at is null
    and (private.is_owner(p_restaurant) or invited_by=auth.uid());
  if not found then raise exception 'Invitation unavailable' using errcode='22023'; end if;
end;
$$;

create or replace function private.accept_staff_invitation(p_token text) returns uuid
language plpgsql security definer set search_path='' as $$
declare tenant uuid; actor uuid; actor_email text; invite public.staff_invitations;
begin
  actor:=private.require_confirmed_user();
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Invitation unavailable' using errcode='42501'; end if;
  select lower(email) into actor_email from auth.users where id=actor;
  select restaurant_id into tenant from public.staff_invitations
  where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
  if not found then raise exception 'Invitation unavailable' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(tenant::text,0));
  select * into invite from public.staff_invitations where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
  if not found or invite.accepted_at is not null or invite.revoked_at is not null or invite.expires_at<=now() or lower(invite.email) is distinct from actor_email then raise exception 'Invitation unavailable' using errcode='42501'; end if;
  if not exists(select 1 from public.roles where id=invite.role_id and restaurant_id=invite.restaurant_id and is_active and slug not in ('owner','customer')) then raise exception 'Invitation unavailable' using errcode='42501'; end if;
  if not private.staff_permission_for(invite.restaurant_id,invite.invited_by,'staff.manage')
    or not private.can_grant_roles(invite.restaurant_id,invite.invited_by,array[invite.role_id])
  then raise exception 'Invitation unavailable' using errcode='42501'; end if;
  if exists(select 1 from public.staff_memberships where restaurant_id=invite.restaurant_id and user_id=actor) or exists(select 1 from public.restaurants where id=invite.restaurant_id and owner_user_id=actor) then raise exception 'Account already belongs to this team' using errcode='23505'; end if;
  insert into public.staff_memberships(restaurant_id,user_id,role_id,status,display_name,contact_email)
    values(invite.restaurant_id,actor,invite.role_id,'active',coalesce((select display_name from public.profiles where id=actor),''),actor_email);
  update public.staff_invitations set accepted_at=now() where id=invite.id;
  return invite.restaurant_id;
end;
$$;

create function private.delete_custom_role(p_restaurant uuid,p_role uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_restaurant::text,0));
  perform private.require_staff_management(p_restaurant,'roles.manage');
  if not private.can_grant_roles(p_restaurant,auth.uid(),array[p_role]) then
    raise exception 'Custom role exceeds your access' using errcode='42501';
  end if;
  delete from public.roles where restaurant_id=p_restaurant and id=p_role and not is_system;
  if not found then raise exception 'Custom role unavailable' using errcode='42501'; end if;
end;
$$;

create function public.delete_custom_role(p_restaurant uuid,p_role uuid) returns void
language sql security invoker set search_path='' as $$
  select private.delete_custom_role(p_restaurant,p_role);
$$;

revoke all on function private.delete_custom_role(uuid,uuid),public.delete_custom_role(uuid,uuid)
  from public,anon,authenticated;
grant execute on function private.delete_custom_role(uuid,uuid),public.delete_custom_role(uuid,uuid)
  to authenticated;

create policy invitations_delegated_read on public.staff_invitations for select to authenticated
using (invited_by=(select auth.uid()) and private.has_permission(restaurant_id,'staff.manage'));

update public.permissions set description='Assign permitted roles, invite team members and suspend staff access.' where key='staff.manage';
update public.permissions set description='Create, edit and delete custom roles within assigned access.' where key='roles.manage';
