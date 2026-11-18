create index payments_received_lookup on public.payments(restaurant_id,paid_at) where paid_at is not null;
create index payments_refunded_lookup on public.payments(restaurant_id,refunded_at) where refunded_at is not null;

-- Aggregation intentionally supports reports-only roles without granting raw
-- order/contact access. Caller confirmation and fresh tenant permission checks
-- run before reading operational data.
create function private.restaurant_sales_report(p_restaurant uuid,p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare restaurant public.restaurants; start_at timestamptz; end_at timestamptz; summary jsonb; cash jsonb; daily jsonb; popular jsonb; distribution jsonb;
begin
 perform private.require_confirmed_user();
 if not private.has_permission(p_restaurant,'reports.read') then raise exception 'Report access required' using errcode='42501';end if;
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>365 or p_from<date '2000-01-01' or p_to>date '2100-12-31' then raise exception 'Choose an inclusive date range up to 366 days' using errcode='22023';end if;
 select * into restaurant from public.restaurants where id=p_restaurant;
 if not found then raise exception 'Restaurant unavailable' using errcode='42501';end if;
 start_at:=p_from::timestamp at time zone restaurant.timezone;end_at:=(p_to+1)::timestamp at time zone restaurant.timezone;
 select jsonb_build_object(
  'total_orders',count(*),'pending_orders',count(*) filter(where o.status='pending'),
  'active_orders',count(*) filter(where o.status in ('accepted','preparing','ready')),
  'completed_orders',count(*) filter(where o.status='completed'),
  'cancelled_orders',count(*) filter(where o.status='cancelled'),'rejected_orders',count(*) filter(where o.status='rejected'),
  'completed_sales_minor',coalesce(sum(o.total_minor) filter(where o.status='completed'),0)::text,
  'average_completed_minor',coalesce(round(avg(o.total_minor) filter(where o.status='completed')),0)::text,
  'unpaid_minor',coalesce(sum(p.amount_minor) filter(where p.status='unpaid' and o.status in ('accepted','preparing','ready','completed')),0)::text,
  'refund_due_minor',coalesce(sum(p.amount_minor) filter(where p.status='refund_due'),0)::text
 ) into summary from public.orders o left join public.payments p on p.restaurant_id=o.restaurant_id and p.order_id=o.id where o.restaurant_id=p_restaurant and o.created_at>=start_at and o.created_at<end_at;
 select jsonb_build_object(
  'received_minor',coalesce(sum(amount_minor) filter(where paid_at>=start_at and paid_at<end_at),0)::text,
  'refunded_minor',coalesce(sum(amount_minor) filter(where refunded_at>=start_at and refunded_at<end_at),0)::text,
  'net_minor',(coalesce(sum(amount_minor) filter(where paid_at>=start_at and paid_at<end_at),0)-coalesce(sum(amount_minor) filter(where refunded_at>=start_at and refunded_at<end_at),0))::text
 ) into cash from public.payments where restaurant_id=p_restaurant and ((paid_at>=start_at and paid_at<end_at) or (refunded_at>=start_at and refunded_at<end_at));
 with days as (select p_from+value as day from generate_series(0,p_to-p_from) value),
 order_days as (
  select (created_at at time zone restaurant.timezone)::date as day,count(*) as orders,count(*) filter(where status='completed') as completed,
   coalesce(sum(total_minor) filter(where status='completed'),0) as sales
  from public.orders where restaurant_id=p_restaurant and created_at>=start_at and created_at<end_at group by 1
 ),received_days as (
  select (paid_at at time zone restaurant.timezone)::date as day,sum(amount_minor) as received from public.payments where restaurant_id=p_restaurant and paid_at>=start_at and paid_at<end_at group by 1
 ),refunded_days as (
  select (refunded_at at time zone restaurant.timezone)::date as day,sum(amount_minor) as refunded from public.payments where restaurant_id=p_restaurant and refunded_at>=start_at and refunded_at<end_at group by 1
 )
 select jsonb_agg(jsonb_build_object('date',d.day,'orders',coalesce(o.orders,0),'completed',coalesce(o.completed,0),'sales_minor',coalesce(o.sales,0)::text,'received_minor',coalesce(r.received,0)::text,'refunded_minor',coalesce(f.refunded,0)::text) order by d.day) into daily
 from days d left join order_days o using(day) left join received_days r using(day) left join refunded_days f using(day);
 select coalesce(jsonb_agg(to_jsonb(top_items) order by top_items.units desc,top_items.product_id),'[]') into popular from (
  select i.product_id,(array_agg(i.product_name order by o.created_at desc,i.created_at desc,i.id desc))[1] as name,
   sum(i.quantity) as units,count(distinct i.order_id) as orders,sum(i.line_total_minor)::text as sales_minor
  from public.order_items i join public.orders o on o.restaurant_id=i.restaurant_id and o.id=i.order_id
  where i.restaurant_id=p_restaurant and o.status='completed' and o.created_at>=start_at and o.created_at<end_at
  group by i.product_id order by units desc,i.product_id limit 10
 ) top_items;
 select jsonb_agg(jsonb_build_object('status',s.value,'count',(select count(*) from public.orders o where o.restaurant_id=p_restaurant and o.status=s.value and o.created_at>=start_at and o.created_at<end_at)) order by s.value) into distribution from unnest(enum_range(null::public.order_status)) s(value);
 return jsonb_build_object('currency',restaurant.currency,'timezone',restaurant.timezone,'from',p_from,'to',p_to,'summary',summary,'cash',cash,'daily',daily,'popular',popular,'statuses',distribution);
end;$$;

create function private.restaurant_activity_log(p_restaurant uuid,p_from date,p_to date,p_entity text,p_action text,p_actor uuid,p_page integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare zone text; start_at timestamptz; end_at timestamptz; entries jsonb; total bigint;
begin
 perform private.require_confirmed_user();
 if not private.has_permission(p_restaurant,'audit.read') then raise exception 'Activity access required' using errcode='42501';end if;
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>365 or p_from<date '2000-01-01' or p_to>date '2100-12-31' or p_page is null or p_page not between 1 and 10000
  or (p_entity is not null and p_entity !~ '^[a-z_]{1,60}$') or (p_action is not null and p_action !~ '^[a-z_.]{1,64}$') then raise exception 'Invalid activity filters' using errcode='22023';end if;
 select timezone into zone from public.restaurants where id=p_restaurant;if not found then raise exception 'Restaurant unavailable' using errcode='42501';end if;
 start_at:=p_from::timestamp at time zone zone;end_at:=(p_to+1)::timestamp at time zone zone;
 select count(*) into total from public.audit_logs a where a.restaurant_id=p_restaurant and a.created_at>=start_at and a.created_at<end_at
  and (p_entity is null or a.entity_type=p_entity) and (p_action is null or a.action=p_action) and (p_actor is null or a.actor_user_id=p_actor);
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'action',a.action,'entity_type',a.entity_type,'entity_id',a.entity_id,'actor_user_id',a.actor_user_id,
  'actor_name',case when a.actor_user_id is null then 'System / guest' else coalesce(m.display_name,'Account user') end,'created_at',a.created_at) order by a.created_at desc,a.id desc),'[]') into entries
 from (
  select * from public.audit_logs a where a.restaurant_id=p_restaurant and a.created_at>=start_at and a.created_at<end_at
   and (p_entity is null or a.entity_type=p_entity) and (p_action is null or a.action=p_action) and (p_actor is null or a.actor_user_id=p_actor)
  order by a.created_at desc,a.id desc limit 50 offset (p_page-1)*50
 ) a left join public.staff_memberships m on m.restaurant_id=p_restaurant and m.user_id=a.actor_user_id;
 return jsonb_build_object('entries',entries,'count',total,'page',p_page,'timezone',zone);
end;$$;
revoke all on function private.restaurant_sales_report(uuid,date,date),private.restaurant_activity_log(uuid,date,date,text,text,uuid,integer) from public,anon,authenticated;
grant execute on function private.restaurant_sales_report(uuid,date,date),private.restaurant_activity_log(uuid,date,date,text,text,uuid,integer) to authenticated;
create function public.restaurant_sales_report(p_restaurant uuid,p_from date,p_to date) returns jsonb language sql security invoker set search_path='' as $$select private.restaurant_sales_report(p_restaurant,p_from,p_to);$$;
create function public.restaurant_activity_log(p_restaurant uuid,p_from date,p_to date,p_entity text,p_action text,p_actor uuid,p_page integer) returns jsonb language sql security invoker set search_path='' as $$select private.restaurant_activity_log(p_restaurant,p_from,p_to,p_entity,p_action,p_actor,p_page);$$;
revoke all on function public.restaurant_sales_report(uuid,date,date),public.restaurant_activity_log(uuid,date,date,text,text,uuid,integer) from public,anon,authenticated;
grant execute on function public.restaurant_sales_report(uuid,date,date),public.restaurant_activity_log(uuid,date,date,text,text,uuid,integer) to authenticated;
create or replace function public.platform_schema_version() returns integer language sql immutable set search_path='' as $$select 8;$$;
