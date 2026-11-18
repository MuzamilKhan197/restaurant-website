create function private.customer_verified_email() returns text language plpgsql stable security definer set search_path='' as $$
declare actor uuid; result text;
begin actor:=private.require_confirmed_user();select email into result from auth.users where id=actor;return result;end; $$;
revoke all on function private.customer_verified_email() from public,anon,authenticated;
grant execute on function private.customer_verified_email() to authenticated,service_role;

create function public.save_customer_profile(p_restaurant uuid,p_name text,p_phone text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare actor uuid:=auth.uid(); email_value text; result uuid;
begin
 email_value:=private.customer_verified_email();
 if p_name is null or length(btrim(p_name)) not between 1 and 100 or length(coalesce(p_phone,''))>30 then raise exception 'Invalid profile' using errcode='22023';end if;
 perform 1 from public.profiles where id=actor for update;
 if not found then raise exception 'Profile unavailable' using errcode='42501';end if;
 update public.profiles set display_name=btrim(p_name) where id=actor;
 select id into result from public.restaurant_customers where restaurant_id=p_restaurant and user_id=actor for update;
 if result is null and not private.is_published(p_restaurant) then return null;end if;
 insert into public.restaurant_customers(restaurant_id,user_id,display_name,contact_email,phone) values(p_restaurant,actor,btrim(p_name),email_value,nullif(btrim(p_phone),''))
 on conflict(restaurant_id,user_id) do update set display_name=excluded.display_name,contact_email=excluded.contact_email,phone=excluded.phone returning id into result;
 return result;
end; $$;
create function public.save_customer_address(p_restaurant uuid,p_address uuid,p_label text,p_line text,p_area text,p_city text,p_instructions text,p_default boolean) returns uuid
language plpgsql security invoker set search_path='' as $$
declare customer uuid; result uuid;
begin
 perform private.customer_verified_email();
 select id into customer from public.restaurant_customers where restaurant_id=p_restaurant and user_id=auth.uid() for update;
 if not found then raise exception 'Save your restaurant profile first' using errcode='42501';end if;
 if p_address is not null and not exists(select 1 from public.customer_addresses where restaurant_id=p_restaurant and customer_id=customer and id=p_address) then raise exception 'Address unavailable' using errcode='42501';end if;
 if p_default then update public.customer_addresses set is_default=false where restaurant_id=p_restaurant and customer_id=customer and is_default;end if;
 if p_address is null then
 insert into public.customer_addresses(restaurant_id,customer_id,label,address_line,area,city,instructions,is_default) values(p_restaurant,customer,p_label,p_line,p_area,p_city,nullif(p_instructions,''),p_default) returning id into result;
 else update public.customer_addresses set label=p_label,address_line=p_line,area=p_area,city=p_city,instructions=nullif(p_instructions,''),is_default=p_default where restaurant_id=p_restaurant and customer_id=customer and id=p_address returning id into result;end if;
 return result;
end; $$;
revoke all on function public.save_customer_profile(uuid,text,text),public.save_customer_address(uuid,uuid,text,text,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.save_customer_profile(uuid,text,text),public.save_customer_address(uuid,uuid,text,text,text,text,text,boolean) to authenticated;
create or replace function public.platform_schema_version() returns integer language sql immutable set search_path='' as $$ select 5; $$;
