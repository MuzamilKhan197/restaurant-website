-- Atomic default-variant replacement. Invoker privileges and RLS remain active.
create function public.save_menu_variant(p_restaurant uuid,p_product uuid,p_variant uuid,p_name text,p_price integer,p_active boolean,p_default boolean,p_sort integer) returns uuid
language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
  if not private.has_permission(p_restaurant,'menu.manage') then raise exception 'Menu management required' using errcode='42501'; end if;
  perform 1 from public.products where restaurant_id=p_restaurant and id=p_product for update;
  if not found then raise exception 'Dish unavailable' using errcode='42501'; end if;
  if p_default and not p_active then raise exception 'Default variant must be active' using errcode='23514'; end if;
  if p_variant is not null and not exists(select 1 from public.product_variants where restaurant_id=p_restaurant and product_id=p_product and id=p_variant) then raise exception 'Variant unavailable' using errcode='42501'; end if;
  if p_default then update public.product_variants set is_default=false where restaurant_id=p_restaurant and product_id=p_product and is_default; end if;
  if p_variant is null then
    insert into public.product_variants(restaurant_id,product_id,name,price_minor,is_active,is_default,sort_order)
      values(p_restaurant,p_product,p_name,p_price,p_active,p_default,p_sort) returning id into result;
  else
    update public.product_variants set name=p_name,price_minor=p_price,is_active=p_active,is_default=p_default,sort_order=p_sort
      where restaurant_id=p_restaurant and product_id=p_product and id=p_variant returning id into result;
  end if;
  return result;
end;
$$;
revoke all on function public.save_menu_variant(uuid,uuid,uuid,text,integer,boolean,boolean,integer) from public,anon,authenticated;
grant execute on function public.save_menu_variant(uuid,uuid,uuid,text,integer,boolean,boolean,integer) to authenticated;
create or replace function public.platform_schema_version() returns integer language sql immutable set search_path='' as $$ select 4; $$;
