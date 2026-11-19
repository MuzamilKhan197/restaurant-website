create function private.can_manage_all_staff_roles(tenant uuid, actor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.restaurants where id=tenant and owner_user_id=actor)
    or exists (
      select 1 from public.staff_memberships m
      cross join lateral private.active_member_roles(m.restaurant_id,m.id,m.role_id) r
      where m.restaurant_id=tenant and m.user_id=actor and m.status='active'
        and r.is_system and r.slug='ceo-co-owner-super-admin'
    );
$$;

revoke all on function private.can_manage_all_staff_roles(uuid,uuid) from public,anon,authenticated;

create or replace function private.can_grant_permissions(tenant uuid,actor uuid,keys text[]) returns boolean
language sql stable security definer set search_path='' as $$
  select private.can_manage_all_staff_roles(tenant,actor)
    or not exists (select 1 from unnest(keys) p(key)
      where p.key in ('staff.manage','roles.manage')
        or not private.staff_permission_for(tenant,actor,p.key));
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
  return jsonb_build_object('restaurant_id',p_restaurant,'role_name',role_name,'is_owner',private.is_owner(p_restaurant),'permissions',permission_keys,'can_manage_all_staff_roles',private.can_manage_all_staff_roles(p_restaurant,actor));
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
    not private.can_manage_all_staff_roles(p_restaurant,actor) and exists (
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
    and (private.can_manage_all_staff_roles(p_restaurant,auth.uid()) or invited_by=auth.uid());
  if not found then raise exception 'Invitation unavailable' using errcode='22023'; end if;
end;
$$;

create function private.can_manage_all_staff_invitations(tenant uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_manage_all_staff_roles(tenant,auth.uid());
$$;

revoke all on function private.can_manage_all_staff_invitations(uuid) from public,anon,authenticated;
grant execute on function private.can_manage_all_staff_invitations(uuid) to authenticated;

create policy invitations_executive_read on public.staff_invitations for select to authenticated
using (private.can_manage_all_staff_invitations(restaurant_id));
