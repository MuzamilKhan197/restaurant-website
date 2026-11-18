-- Exposed RPCs run as invoker; privileged implementations stay in the unexposed private schema.
-- Each implementation checks caller identity/ownership or a verified email-bound capability.
alter function public.current_staff_access(uuid) set schema private;
revoke all on function private.current_staff_access(uuid) from public,anon,authenticated;
grant execute on function private.current_staff_access(uuid) to authenticated;
create function public.current_staff_access(p_restaurant uuid) returns jsonb language sql stable security invoker set search_path='' as $$ select private.current_staff_access(p_restaurant); $$;
revoke all on function public.current_staff_access(uuid) from public,anon,authenticated;
grant execute on function public.current_staff_access(uuid) to authenticated;

alter function public.create_staff_invitation(uuid,text,uuid,text) set schema private;
revoke all on function private.create_staff_invitation(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function private.create_staff_invitation(uuid,text,uuid,text) to authenticated;
create function public.create_staff_invitation(p_restaurant uuid,p_email text,p_role uuid,p_token_hash text) returns uuid language sql  security invoker set search_path='' as $$ select private.create_staff_invitation(p_restaurant,p_email,p_role,p_token_hash); $$;
revoke all on function public.create_staff_invitation(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.create_staff_invitation(uuid,text,uuid,text) to authenticated;

alter function public.accept_staff_invitation(text) set schema private;
revoke all on function private.accept_staff_invitation(text) from public,anon,authenticated;
grant execute on function private.accept_staff_invitation(text) to authenticated;
create function public.accept_staff_invitation(p_token text) returns uuid language sql  security invoker set search_path='' as $$ select private.accept_staff_invitation(p_token); $$;
revoke all on function public.accept_staff_invitation(text) from public,anon,authenticated;
grant execute on function public.accept_staff_invitation(text) to authenticated;

alter function public.revoke_staff_invitation(uuid,uuid) set schema private;
revoke all on function private.revoke_staff_invitation(uuid,uuid) from public,anon,authenticated;
grant execute on function private.revoke_staff_invitation(uuid,uuid) to authenticated;
create function public.revoke_staff_invitation(p_restaurant uuid,p_invitation uuid) returns void language sql  security invoker set search_path='' as $$ select private.revoke_staff_invitation(p_restaurant,p_invitation); $$;
revoke all on function public.revoke_staff_invitation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.revoke_staff_invitation(uuid,uuid) to authenticated;

alter function public.manage_staff_member(uuid,uuid,uuid,public.membership_status) set schema private;
revoke all on function private.manage_staff_member(uuid,uuid,uuid,public.membership_status) from public,anon,authenticated;
grant execute on function private.manage_staff_member(uuid,uuid,uuid,public.membership_status) to authenticated;
create function public.manage_staff_member(p_restaurant uuid,p_member uuid,p_role uuid,p_status public.membership_status) returns void language sql  security invoker set search_path='' as $$ select private.manage_staff_member(p_restaurant,p_member,p_role,p_status); $$;
revoke all on function public.manage_staff_member(uuid,uuid,uuid,public.membership_status) from public,anon,authenticated;
grant execute on function public.manage_staff_member(uuid,uuid,uuid,public.membership_status) to authenticated;

alter function public.save_custom_role(uuid,uuid,text,text,text[]) set schema private;
revoke all on function private.save_custom_role(uuid,uuid,text,text,text[]) from public,anon,authenticated;
grant execute on function private.save_custom_role(uuid,uuid,text,text,text[]) to authenticated;
create function public.save_custom_role(p_restaurant uuid,p_role uuid,p_name text,p_slug text,p_permissions text[]) returns uuid language sql  security invoker set search_path='' as $$ select private.save_custom_role(p_restaurant,p_role,p_name,p_slug,p_permissions); $$;
revoke all on function public.save_custom_role(uuid,uuid,text,text,text[]) from public,anon,authenticated;
grant execute on function public.save_custom_role(uuid,uuid,text,text,text[]) to authenticated;

alter function public.bootstrap_restaurant_owner(uuid,uuid) set schema private;
revoke all on function private.bootstrap_restaurant_owner(uuid,uuid) from public,anon,authenticated;
grant execute on function private.bootstrap_restaurant_owner(uuid,uuid) to service_role;
create function public.bootstrap_restaurant_owner(p_restaurant uuid,p_owner uuid) returns void language sql  security invoker set search_path='' as $$ select private.bootstrap_restaurant_owner(p_restaurant,p_owner); $$;
revoke all on function public.bootstrap_restaurant_owner(uuid,uuid) from public,anon,authenticated;
grant execute on function public.bootstrap_restaurant_owner(uuid,uuid) to service_role;

