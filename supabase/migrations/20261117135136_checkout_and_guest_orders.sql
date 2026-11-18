-- Anonymous checkout is an intentionally public, tightly scoped capability API.
-- Definer implementations never accept totals, customer IDs or item snapshots.
create index orders_created_lookup on public.orders(restaurant_id,created_at desc);
create function private.price_cart(p_restaurant uuid,p_items jsonb,p_method text,p_zone uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.restaurant_settings; r public.restaurants; line jsonb; p public.products; v public.product_variants;
 a public.addons; g record; choices jsonb; snapshots jsonb:='[]'; extras jsonb; qty integer; price bigint; extra_total bigint; subtotal bigint:=0; fee bigint:=0; tax bigint; selected_count integer;
begin
 select * into r from public.restaurants where id=p_restaurant and is_published;
 select * into s from public.restaurant_settings where restaurant_id=p_restaurant;
 if r.id is null or s.restaurant_id is null or s.website_mode<>'normal' then raise exception 'Online ordering is unavailable' using errcode='22023';end if;
 if p_method is null or p_method not in ('pickup','delivery') then raise exception 'Choose pickup or delivery' using errcode='22023';end if;
 if p_method='delivery' then
  if not s.delivery_enabled or not exists(select 1 from public.delivery_zones where restaurant_id=p_restaurant and id=p_zone and is_active) then raise exception 'Delivery is unavailable for this area' using errcode='22023';end if;
  fee:=s.delivery_fee_minor;
 elsif p_zone is not null then raise exception 'Pickup does not use a delivery zone' using errcode='22023';end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 30 or length(p_items::text)>25000 then raise exception 'Invalid cart' using errcode='22023';end if;
 for line in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(line) is distinct from 'object' or (line->>'quantity') !~ '^[0-9]{1,2}$' then raise exception 'Invalid quantity' using errcode='22023';end if;
  qty:=(line->>'quantity')::integer;if qty is null or qty not between 1 and 20 then raise exception 'Invalid quantity' using errcode='22023';end if;
  select * into p from public.products where restaurant_id=p_restaurant and id=(line->>'product_id')::uuid and is_active and is_available for share;
  if p.id is null or not exists(select 1 from public.categories where restaurant_id=p_restaurant and id=p.category_id and is_active) then raise exception 'A dish is unavailable' using errcode='22023';end if;
  v:=null;
  if nullif(line->>'variant_id','') is not null then
   select * into v from public.product_variants where restaurant_id=p_restaurant and product_id=p.id and id=(line->>'variant_id')::uuid and is_active for share;
   if v.id is null then raise exception 'A selected size is unavailable' using errcode='22023';end if;
  elsif exists(select 1 from public.product_variants where restaurant_id=p_restaurant and product_id=p.id and is_active) then raise exception 'Choose a size' using errcode='22023';end if;
  price:=coalesce(v.price_minor,p.base_price_minor);extra_total:=0;extras:='[]';choices:=coalesce(line->'addon_ids','[]');
  if jsonb_typeof(choices) is distinct from 'array' or jsonb_array_length(choices)>100 or (select count(distinct value) from jsonb_array_elements_text(choices))<>jsonb_array_length(choices) then raise exception 'Invalid extras' using errcode='22023';end if;
  for a in select x.* from public.addons x where x.restaurant_id=p_restaurant and x.id in(select value::uuid from jsonb_array_elements_text(choices)) for share loop
   if not a.is_available or not exists(select 1 from public.product_addon_groups l join public.addon_groups ag on ag.restaurant_id=l.restaurant_id and ag.id=l.addon_group_id where l.restaurant_id=p_restaurant and l.product_id=p.id and l.addon_group_id=a.addon_group_id and ag.is_active) then raise exception 'An extra is unavailable' using errcode='22023';end if;
   extra_total:=extra_total+a.price_minor;extras:=extras||jsonb_build_array(jsonb_build_object('id',a.id,'name',a.name,'price_minor',a.price_minor));
  end loop;
  if jsonb_array_length(extras)<>jsonb_array_length(choices) then raise exception 'An extra is unavailable' using errcode='22023';end if;
  for g in select ag.* from public.addon_groups ag join public.product_addon_groups l on l.restaurant_id=ag.restaurant_id and l.addon_group_id=ag.id where l.restaurant_id=p_restaurant and l.product_id=p.id and ag.is_active loop
   select count(*) into selected_count from public.addons x where x.restaurant_id=p_restaurant and x.addon_group_id=g.id and x.id in(select value::uuid from jsonb_array_elements_text(choices));
   if selected_count<g.min_selections or selected_count>g.max_selections then raise exception 'Check required extras and selection limits' using errcode='22023';end if;
  end loop;
  subtotal:=subtotal+qty*(price+extra_total);
  snapshots:=snapshots||jsonb_build_array(jsonb_build_object('product_id',p.id,'variant_id',v.id,'product_name',p.name,'variant_name',v.name,'quantity',qty,'unit_price_minor',price,'addons_total_minor',extra_total,'line_total_minor',qty*(price+extra_total),'allergens',to_jsonb(p.allergens),'addons',extras));
 end loop;
 if p_method='delivery' and subtotal<s.minimum_delivery_minor then raise exception 'The delivery minimum has not been reached' using errcode='22023';end if;
 tax:=round(subtotal::numeric*s.tax_rate_bps/10000);
 return jsonb_build_object('items',snapshots,'subtotal_minor',subtotal,'delivery_fee_minor',fee,'tax_minor',tax,'tax_rate_bps',s.tax_rate_bps,'total_minor',subtotal+fee+tax,'currency',r.currency);
end;$$;

create function private.place_customer_order(p_restaurant uuid,p_items jsonb,p_checkout jsonb,p_token text,p_expected_total bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare hash text; fingerprint text; previous private.idempotency_keys; actor uuid:=auth.uid(); customer uuid; email_value text;
 quote jsonb; o public.orders; line jsonb; extra jsonb; item_id uuid; address_value jsonb; method_value text:=p_checkout->>'method';zone_value uuid:=nullif(p_checkout->>'zone_id','')::uuid;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Invalid checkout token' using errcode='22023';end if;
 if jsonb_typeof(p_checkout) is distinct from 'object' or length(p_checkout::text)>5000 then raise exception 'Invalid checkout' using errcode='22023';end if;
 hash:=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 fingerprint:=encode(sha256(convert_to(jsonb_build_object('items',p_items,'checkout',p_checkout,'actor',actor,'expected',p_expected_total)::text,'UTF8')),'hex');
 perform 1 from public.restaurants where id=p_restaurant for share;
 perform 1 from public.restaurant_settings where restaurant_id=p_restaurant for update;
 select * into previous from private.idempotency_keys where restaurant_id=p_restaurant and key_hash=hash;
 if found then
  if previous.request_hash<>fingerprint or previous.resource_type<>'order' or previous.expires_at<=now() then raise exception 'This checkout token cannot be reused' using errcode='22023';end if;
  select * into o from public.orders where id=previous.resource_id and restaurant_id=p_restaurant;
  return jsonb_build_object('id',o.id,'reference',o.reference,'total_minor',o.total_minor,'currency',o.currency);
 end if;
 if (select count(*) from public.orders where restaurant_id=p_restaurant and created_at>now()-interval '1 minute')>=60 then raise exception 'Ordering is busy. Please retry shortly' using errcode='22023';end if;
 quote:=private.price_cart(p_restaurant,p_items,method_value,zone_value);
 if p_expected_total is null or p_expected_total<>(quote->>'total_minor')::bigint then raise exception 'Prices changed. Review the updated total' using errcode='22023';end if;
 if actor is not null then
  perform private.require_confirmed_user();select email into email_value from auth.users where id=actor;
  insert into public.restaurant_customers(restaurant_id,user_id,display_name,contact_email,phone) values(p_restaurant,actor,p_checkout->>'name',email_value,p_checkout->>'phone')
  on conflict(restaurant_id,user_id) do nothing;
  select id into customer from public.restaurant_customers where restaurant_id=p_restaurant and user_id=actor;
 else email_value:=p_checkout->>'email';end if;
 if email_value is null or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email address' using errcode='22023';end if;
 if method_value='delivery' then
  address_value:=jsonb_build_object('address_line',p_checkout->>'address_line','area',p_checkout->>'area','city',p_checkout->>'city','instructions',coalesce(p_checkout->>'instructions',''));
  if length(btrim(coalesce(address_value->>'address_line',''))) not between 5 and 300 or length(btrim(coalesce(address_value->>'area',''))) not between 1 and 100 or length(btrim(coalesce(address_value->>'city',''))) not between 1 and 100 or length(address_value->>'instructions')>500 then raise exception 'Enter a valid delivery address' using errcode='22023';end if;
 end if;
 insert into public.orders(restaurant_id,customer_id,method,payment_method,currency,contact_name,contact_email,contact_phone,delivery_address,delivery_zone_id,notes,subtotal_minor,delivery_fee_minor,tax_rate_bps,tax_minor,total_minor)
 values(p_restaurant,customer,method_value::public.fulfilment_method,case when method_value='delivery' then 'cash_on_delivery'::public.cash_payment_method else 'pay_at_pickup'::public.cash_payment_method end,quote->>'currency',btrim(p_checkout->>'name'),email_value,p_checkout->>'phone',address_value,zone_value,coalesce(p_checkout->>'notes',''),(quote->>'subtotal_minor')::bigint,(quote->>'delivery_fee_minor')::integer,(quote->>'tax_rate_bps')::integer,(quote->>'tax_minor')::bigint,(quote->>'total_minor')::bigint) returning * into o;
 for line in select value from jsonb_array_elements(quote->'items') loop
  insert into public.order_items(restaurant_id,order_id,product_id,variant_id,product_name,variant_name,quantity,unit_price_minor,addons_total_minor,line_total_minor,allergens)
  values(p_restaurant,o.id,(line->>'product_id')::uuid,(line->>'variant_id')::uuid,line->>'product_name',line->>'variant_name',(line->>'quantity')::integer,(line->>'unit_price_minor')::integer,(line->>'addons_total_minor')::integer,(line->>'line_total_minor')::bigint,array(select jsonb_array_elements_text(line->'allergens'))) returning id into item_id;
  for extra in select value from jsonb_array_elements(line->'addons') loop
   insert into public.order_item_addons(restaurant_id,order_id,order_item_id,addon_id,addon_name,quantity,unit_price_minor) values(p_restaurant,o.id,item_id,(extra->>'id')::uuid,extra->>'name',1,(extra->>'price_minor')::integer);
  end loop;
 end loop;
 insert into public.payments(restaurant_id,order_id,method,amount_minor,currency) values(p_restaurant,o.id,o.payment_method,o.total_minor,o.currency);
 if customer is null then insert into private.guest_access(restaurant_id,resource_type,resource_id,token_hash,expires_at) values(p_restaurant,'order',o.id,hash,now()+interval '30 days');end if;
 insert into private.idempotency_keys(restaurant_id,key_hash,request_hash,resource_type,resource_id,expires_at) values(p_restaurant,hash,fingerprint,'order',o.id,now()+interval '30 days');
 return jsonb_build_object('id',o.id,'reference',o.reference,'total_minor',o.total_minor,'currency',o.currency);
end;$$;

create function private.read_order_capability(p_restaurant uuid,p_reference text,p_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders; result jsonb;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' or length(p_reference)>50 then return null;end if;
 select ord.* into o from public.orders ord join private.guest_access g on g.restaurant_id=ord.restaurant_id and g.resource_id=ord.id and g.resource_type='order'
 where ord.restaurant_id=p_restaurant and ord.reference=p_reference and g.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and g.revoked_at is null and g.expires_at>now();
 if o.id is null then return null;end if;
 select jsonb_build_object('reference',o.reference,'status',o.status,'method',o.method,'currency',o.currency,'subtotal_minor',o.subtotal_minor,'delivery_fee_minor',o.delivery_fee_minor,'tax_minor',o.tax_minor,'total_minor',o.total_minor,'created_at',o.created_at,'reason',coalesce(o.rejection_reason,o.cancellation_reason),
 'payment_status',(select status from public.payments where restaurant_id=p_restaurant and order_id=o.id),
 'items',(select coalesce(jsonb_agg(jsonb_build_object('name',i.product_name,'variant',i.variant_name,'quantity',i.quantity,'total_minor',i.line_total_minor,'addons',(select coalesce(jsonb_agg(jsonb_build_object('name',a.addon_name,'quantity',a.quantity,'price_minor',a.unit_price_minor)),'[]') from public.order_item_addons a where a.restaurant_id=p_restaurant and a.order_item_id=i.id)) order by i.created_at,i.id),'[]') from public.order_items i where i.restaurant_id=p_restaurant and i.order_id=o.id),
 'events',(select coalesce(jsonb_agg(jsonb_build_object('status',e.status,'created_at',e.created_at) order by e.created_at,e.id),'[]') from public.order_status_events e where e.restaurant_id=p_restaurant and e.order_id=o.id)) into result;
 return result;
end;$$;
revoke all on function private.price_cart(uuid,jsonb,text,uuid),private.place_customer_order(uuid,jsonb,jsonb,text,bigint),private.read_order_capability(uuid,text,text) from public,anon,authenticated;
grant execute on function private.price_cart(uuid,jsonb,text,uuid),private.place_customer_order(uuid,jsonb,jsonb,text,bigint),private.read_order_capability(uuid,text,text) to anon,authenticated;
create function public.quote_cart(p_restaurant uuid,p_items jsonb,p_method text,p_zone uuid) returns jsonb language sql security invoker set search_path='' as $$select private.price_cart(p_restaurant,p_items,p_method,p_zone);$$;
create function public.place_customer_order(p_restaurant uuid,p_items jsonb,p_checkout jsonb,p_token text,p_expected_total bigint) returns jsonb language sql security invoker set search_path='' as $$select private.place_customer_order(p_restaurant,p_items,p_checkout,p_token,p_expected_total);$$;
create function public.read_order_capability(p_restaurant uuid,p_reference text,p_token text) returns jsonb language sql security invoker set search_path='' as $$select private.read_order_capability(p_restaurant,p_reference,p_token);$$;
revoke all on function public.quote_cart(uuid,jsonb,text,uuid),public.place_customer_order(uuid,jsonb,jsonb,text,bigint),public.read_order_capability(uuid,text,text) from public,anon,authenticated;
grant execute on function public.quote_cart(uuid,jsonb,text,uuid),public.place_customer_order(uuid,jsonb,jsonb,text,bigint),public.read_order_capability(uuid,text,text) to anon,authenticated;
create or replace function public.platform_schema_version() returns integer language sql immutable set search_path='' as $$select 6;$$;
