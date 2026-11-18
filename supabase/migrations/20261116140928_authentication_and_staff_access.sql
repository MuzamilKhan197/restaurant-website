-- Phase 3: all identity and permission decisions use trusted Auth/database data.
create function private.require_confirmed_user() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then
    raise exception 'A verified account is required' using errcode='42501';
  end if;
  return actor;
end;
$$;
create function private.require_restaurant_owner(p_restaurant uuid) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare actor uuid;
begin
  actor := private.require_confirmed_user();
  if not private.is_owner(p_restaurant) then raise exception 'Owner access required' using errcode='42501'; end if;
  return actor;
end;
$$;
revoke all on function private.require_confirmed_user(),private.require_restaurant_owner(uuid) from public,anon,authenticated;

-- Caller-specific summary only. No role, user or permission claims are accepted.
create function public.current_staff_access(p_restaurant uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid; role_name text; permission_keys text[];
begin
  actor := private.require_confirmed_user();
  if not private.is_staff(p_restaurant) then return null; end if;
  if private.is_owner(p_restaurant) then role_name := 'Owner';
  else
    select r.name into role_name from public.staff_memberships m
      join public.roles r on r.restaurant_id=m.restaurant_id and r.id=m.role_id
      where m.restaurant_id=p_restaurant and m.user_id=actor and m.status='active' and r.is_active;
  end if;
  select coalesce(array_agg(p.key order by p.key),'{}') into permission_keys
    from public.permissions p where private.has_permission(p_restaurant,p.key);
  return jsonb_build_object('restaurant_id',p_restaurant,'role_name',role_name,'is_owner',private.is_owner(p_restaurant),'permissions',permission_keys);
end;
$$;

create function public.create_staff_invitation(p_restaurant uuid,p_email text,p_role uuid,p_token_hash text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid; result uuid; email_value text:=lower(btrim(p_email));
begin
  actor:=private.require_restaurant_owner(p_restaurant);
  if email_value is null or length(email_value)>254 or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid invitation' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_restaurant::text,0));
  if not exists(select 1 from public.roles where restaurant_id=p_restaurant and id=p_role and is_active and slug not in ('owner','customer')) then raise exception 'Invalid staff role' using errcode='22023'; end if;
  if exists(select 1 from public.staff_memberships m join auth.users u on u.id=m.user_id where m.restaurant_id=p_restaurant and lower(u.email)=email_value) then raise exception 'Account already belongs to this team' using errcode='23505'; end if;
  if (select count(*) from public.staff_invitations where restaurant_id=p_restaurant and created_at>now()-interval '1 hour')>=20 then raise exception 'Invitation limit reached. Try later.' using errcode='54000'; end if;
  update public.staff_invitations set revoked_at=now() where restaurant_id=p_restaurant and lower(email)=email_value and accepted_at is null and revoked_at is null;
  insert into public.staff_invitations(restaurant_id,role_id,email,token_hash,invited_by,expires_at)
    values(p_restaurant,p_role,email_value,p_token_hash,actor,now()+interval '48 hours') returning id into result;
  return result;
end;
$$;

create function public.accept_staff_invitation(p_token text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid; actor_email text; invite public.staff_invitations;
begin
  actor:=private.require_confirmed_user();
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Invitation unavailable' using errcode='42501'; end if;
  select lower(email) into actor_email from auth.users where id=actor;
  select * into invite from public.staff_invitations where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
  if not found or invite.accepted_at is not null or invite.revoked_at is not null or invite.expires_at<=now() or lower(invite.email) is distinct from actor_email then raise exception 'Invitation unavailable' using errcode='42501'; end if;
  if not exists(select 1 from public.roles where id=invite.role_id and restaurant_id=invite.restaurant_id and is_active and slug not in ('owner','customer')) then raise exception 'Invitation unavailable' using errcode='42501'; end if;
  if exists(select 1 from public.staff_memberships where restaurant_id=invite.restaurant_id and user_id=actor) or exists(select 1 from public.restaurants where id=invite.restaurant_id and owner_user_id=actor) then raise exception 'Account already belongs to this team' using errcode='23505'; end if;
  insert into public.staff_memberships(restaurant_id,user_id,role_id,status,display_name,contact_email)
    values(invite.restaurant_id,actor,invite.role_id,'active',coalesce((select display_name from public.profiles where id=actor),''),actor_email);
  update public.staff_invitations set accepted_at=now() where id=invite.id;
  return invite.restaurant_id;
end;
$$;

create function public.revoke_staff_invitation(p_restaurant uuid,p_invitation uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform private.require_restaurant_owner(p_restaurant);
  update public.staff_invitations set revoked_at=now() where id=p_invitation and restaurant_id=p_restaurant and accepted_at is null and revoked_at is null;
  if not found then raise exception 'Invitation unavailable' using errcode='22023'; end if;
end;
$$;

create function public.manage_staff_member(p_restaurant uuid,p_member uuid,p_role uuid,p_status public.membership_status) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
  actor:=private.require_restaurant_owner(p_restaurant);
  if p_status is null or p_status not in ('active','suspended') or not exists(select 1 from public.roles where restaurant_id=p_restaurant and id=p_role and is_active and slug not in ('owner','customer')) then raise exception 'Invalid staff change' using errcode='22023'; end if;
  update public.staff_memberships set role_id=p_role,status=p_status where restaurant_id=p_restaurant and id=p_member and user_id<>actor;
  if not found then raise exception 'Staff member unavailable' using errcode='22023'; end if;
end;
$$;

create function public.save_custom_role(p_restaurant uuid,p_role uuid,p_name text,p_slug text,p_permissions text[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  perform private.require_restaurant_owner(p_restaurant);
  if p_name is null or length(btrim(p_name)) not between 1 and 80 or p_slug is null or length(p_slug)>80 or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or p_slug in ('owner','admin','manager','support-agent','developer','customer') or p_permissions is null or cardinality(p_permissions)>30 then raise exception 'Invalid custom role' using errcode='22023'; end if;
  if exists(select 1 from unnest(p_permissions) selected(key) where selected.key is null or selected.key in ('staff.manage','roles.manage') or not exists(select 1 from public.permissions p where p.key=selected.key)) then raise exception 'Invalid permission selection' using errcode='22023'; end if;
  if p_role is null then
    insert into public.roles(restaurant_id,name,slug) values(p_restaurant,btrim(p_name),p_slug) returning id into result;
  else
    select id into result from public.roles where restaurant_id=p_restaurant and id=p_role and not is_system for update;
    if not found then raise exception 'Custom role unavailable' using errcode='42501'; end if;
    update public.roles set name=btrim(p_name) where restaurant_id=p_restaurant and id=result;
    delete from public.role_permissions where restaurant_id=p_restaurant and role_id=result;
  end if;
  insert into public.role_permissions(restaurant_id,role_id,permission_key) select p_restaurant,result,key from (select distinct unnest(p_permissions) key) selected;
  return result;
end;
$$;

-- Operator-only initial ownership. Never grant this RPC to authenticated users.
create function public.bootstrap_restaurant_owner(p_restaurant uuid,p_owner uuid) returns void
language plpgsql security definer set search_path='' as $$
declare existing_owner uuid; owner_role uuid;
begin
  if not exists(select 1 from auth.users where id=p_owner and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then raise exception 'Verified owner account required' using errcode='22023'; end if;
  select owner_user_id into existing_owner from public.restaurants where id=p_restaurant for update;
  if not found or (existing_owner is not null and existing_owner<>p_owner) then raise exception 'Restaurant unavailable for bootstrap' using errcode='42501'; end if;
  update public.restaurants set owner_user_id=p_owner where id=p_restaurant;
  select id into owner_role from public.roles where restaurant_id=p_restaurant and slug='owner';
  insert into public.staff_memberships(restaurant_id,user_id,role_id,status,display_name,contact_email)
    select p_restaurant,u.id,owner_role,'active',coalesce(p.display_name,''),u.email from auth.users u left join public.profiles p on p.id=u.id where u.id=p_owner
    on conflict(restaurant_id,user_id) do update set role_id=excluded.role_id,status='active';
end;
$$;

revoke all on function public.current_staff_access(uuid),public.create_staff_invitation(uuid,text,uuid,text),public.accept_staff_invitation(text),public.revoke_staff_invitation(uuid,uuid),public.manage_staff_member(uuid,uuid,uuid,public.membership_status),public.save_custom_role(uuid,uuid,text,text,text[]),public.bootstrap_restaurant_owner(uuid,uuid) from public,anon,authenticated;
grant execute on function public.current_staff_access(uuid),public.create_staff_invitation(uuid,text,uuid,text),public.accept_staff_invitation(text),public.revoke_staff_invitation(uuid,uuid),public.manage_staff_member(uuid,uuid,uuid,public.membership_status),public.save_custom_role(uuid,uuid,text,text,text[]) to authenticated;
grant execute on function public.bootstrap_restaurant_owner(uuid,uuid) to service_role;
grant execute on function private.require_confirmed_user(),private.require_restaurant_owner(uuid) to service_role;
create or replace function public.platform_schema_version() returns integer language sql immutable set search_path='' as $$ select 3; $$;
