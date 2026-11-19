create function private.list_people_profiles(p_restaurant uuid, p_query text)
returns table (id uuid, display_name text, email text, staff_id uuid, customer_id uuid)
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := private.require_confirmed_user();
begin
  if not private.can_manage_all_staff_roles(p_restaurant, actor)
    or not private.has_permission(p_restaurant, 'people.read')
    or not private.has_permission(p_restaurant, 'staff.read')
    or not private.has_permission(p_restaurant, 'customers.read') then
    raise exception 'Profile directory access required' using errcode = '42501';
  end if;

  return query
  select p.id, p.display_name, p.email, m.id, c.id
  from public.profiles p
  left join public.staff_memberships m on m.user_id = p.id and m.restaurant_id = p_restaurant
  left join public.restaurant_customers c on c.user_id = p.id and c.restaurant_id = p_restaurant
  where (m.id is not null or c.id is not null or
    not exists (select 1 from public.restaurants r where r.id <> p_restaurant))
    and (
      strpos(lower(p.display_name), lower(left(coalesce(p_query, ''), 100))) > 0
      or strpos(lower(coalesce(p.email, '')), lower(left(coalesce(p_query, ''), 100))) > 0
      or coalesce(p_query, '') = ''
    );
end;
$$;

create function public.list_people_profiles(p_restaurant uuid, p_query text)
returns table (id uuid, display_name text, email text, staff_id uuid, customer_id uuid)
language sql stable security invoker set search_path = '' as $$
  select * from private.list_people_profiles(p_restaurant, p_query);
$$;

revoke all on function public.list_people_profiles(uuid, text),
  private.list_people_profiles(uuid, text) from public, anon, authenticated;
grant execute on function public.list_people_profiles(uuid, text),
  private.list_people_profiles(uuid, text) to authenticated;
