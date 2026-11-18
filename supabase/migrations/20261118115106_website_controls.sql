create function private.save_website_mode(tenant uuid, mode public.website_mode, message text, reopening timestamptz, expected timestamptz)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.require_confirmed_user();
  if not private.has_permission(tenant,'website.manage') then
    raise exception 'Website access required' using errcode='42501';
  end if;
  if mode is null or length(btrim(coalesce(message,''))) not between 1 and 1000 then
    raise exception 'Invalid website settings' using errcode='22023';
  end if;
  update public.restaurant_settings set website_mode=mode, maintenance_message=btrim(message), reopening_at=reopening
  where restaurant_id=tenant and updated_at=expected;
  if not found then raise exception 'Settings changed. Refresh and try again' using errcode='40001';end if;
end;
$$;
revoke all on function private.save_website_mode(uuid,public.website_mode,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function private.save_website_mode(uuid,public.website_mode,text,timestamptz,timestamptz) to authenticated;
create function public.save_website_mode(tenant uuid, mode public.website_mode, message text, reopening timestamptz, expected timestamptz)
returns void language sql security invoker set search_path='' as $$
select private.save_website_mode(tenant,mode,message,reopening,expected);
$$;
revoke all on function public.save_website_mode(uuid,public.website_mode,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.save_website_mode(uuid,public.website_mode,text,timestamptz,timestamptz) to authenticated;
create policy settings_website_read on public.restaurant_settings for select to authenticated using(private.has_permission(restaurant_id,'website.manage') or private.has_permission(restaurant_id,'settings.manage'));
create policy zones_settings_read on public.delivery_zones for select to authenticated using(private.has_permission(restaurant_id,'settings.read') or private.has_permission(restaurant_id,'settings.manage'));
create policy zones_settings_insert on public.delivery_zones for insert to authenticated with check(private.has_permission(restaurant_id,'settings.manage'));
create policy zones_settings_update on public.delivery_zones for update to authenticated using(private.has_permission(restaurant_id,'settings.manage')) with check(private.has_permission(restaurant_id,'settings.manage'));
create or replace function public.platform_schema_version() returns integer language sql immutable set search_path='' as $$select 9;$$;
