-- Keep the account email visible on its profile under the existing profile RLS.
alter table public.profiles add column email text;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is distinct from u.email;

create or replace function private.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, email)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'full_name', ''), 100), new.email);
  return new;
end;
$$;

create function private.sync_profile_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger sync_profile_email after update of email on auth.users
for each row when (old.email is distinct from new.email)
execute function private.sync_profile_email();

-- Reference the stable account ID and keep the directory's existing name column in sync.
alter table public.staff_memberships
  add constraint staff_memberships_user_id_profile_fkey
  foreign key (user_id) references public.profiles(id) on delete restrict;

update public.staff_memberships m
set display_name = p.display_name
from public.profiles p
where m.user_id = p.id and m.display_name is distinct from p.display_name;

create function private.use_staff_profile_name() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    -- Serialize membership creation with profile renames.
    select p.display_name into new.display_name
    from public.profiles p where p.id = new.user_id for share;
  elsif new.display_name is distinct from
    (select p.display_name from public.profiles p where p.id = new.user_id) then
    raise exception 'Update the display name in profiles' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger use_staff_profile_name before insert or update of display_name
on public.staff_memberships for each row execute function private.use_staff_profile_name();

create function private.sync_staff_profile_name() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.staff_memberships
  set display_name = new.display_name
  where user_id = new.id and display_name is distinct from new.display_name;
  return new;
end;
$$;

create trigger sync_staff_profile_name after update of display_name on public.profiles
for each row when (old.display_name is distinct from new.display_name)
execute function private.sync_staff_profile_name();

revoke all on function private.sync_profile_email(), private.use_staff_profile_name(),
  private.sync_staff_profile_name() from public, anon, authenticated;
