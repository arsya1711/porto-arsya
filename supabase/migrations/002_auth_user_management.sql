alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create unique index if not exists profiles_email_lower_unique on public.profiles (lower(email));
create unique index if not exists profiles_student_number_unique on public.profiles (student_number) where student_number is not null;

insert into public.profiles(id,full_name,email,role,active)
select u.id,
  coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'),''),split_part(u.email,'@',1),'Pengguna'),
  u.email,
  case when u.raw_user_meta_data->>'role' in ('admin','guru','siswa') then (u.raw_user_meta_data->>'role')::public.user_role else 'siswa'::public.user_role end,
  true
from auth.users u
where u.email is not null
on conflict(id) do update set email=excluded.email;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare requested_role public.user_role;
begin
  begin
    requested_role := coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'siswa');
  exception when invalid_text_representation then
    requested_role := 'siswa';
  end;
  insert into public.profiles(id,full_name,email,role)
  values(new.id,coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),'Pengguna'),new.email,requested_role)
  on conflict(id) do update set email=excluded.email, full_name=excluded.full_name;
  return new;
end;
$$;

create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if public.current_role() <> 'admin' and (
    new.role is distinct from old.role or new.active is distinct from old.active or
    new.email is distinct from old.email or new.student_number is distinct from old.student_number
  ) then
    raise exception 'Hanya admin yang dapat mengubah role, status, email, atau NIS';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_privileges on public.profiles;
create trigger profiles_protect_privileges before update on public.profiles
for each row execute function public.protect_profile_privileges();

drop policy if exists "users update own basic profile" on public.profiles;
create policy "users update own basic profile" on public.profiles for update
using(id=auth.uid()) with check(id=auth.uid());
