-- Validasi data akademik dan pembatasan konsumsi layanan AI.

alter table public.school_profile_settings
  add column if not exists school_timezone text not null default 'Asia/Jakarta'
    check (
      school_timezone in (
        'Asia/Jakarta',
        'Asia/Makassar',
        'Asia/Jayapura'
      )
    );

alter table public.school_profile_settings
  drop constraint if exists school_profile_settings_npsn_format;

alter table public.school_profile_settings
  add constraint school_profile_settings_npsn_format
  check (npsn is null or npsn ~ '^[0-9]{8}$') not valid;

alter table public.academic_years
  drop constraint if exists academic_years_name_format;

alter table public.academic_years
  add constraint academic_years_name_format
  check (
    case
      when name ~ '^[0-9]{4}/[0-9]{4}$' then
        substring(name from 6 for 4)::integer
          = substring(name from 1 for 4)::integer + 1
      else false
    end
  ) not valid;

create table if not exists public.ai_import_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists ai_import_attempts_user_created_idx
  on public.ai_import_attempts(user_id, created_at desc);

alter table public.ai_import_attempts enable row level security;

-- Hanya Edge Function dengan service role yang dapat memesan kuota.
create or replace function public.reserve_ai_import_attempt(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  delete from public.ai_import_attempts
  where created_at < now() - interval '24 hours';

  perform pg_advisory_xact_lock(hashtextextended(target_user_id::text, 0));

  select count(*)
  into recent_count
  from public.ai_import_attempts
  where user_id = target_user_id
    and created_at >= now() - interval '1 hour';

  if recent_count >= 10 then
    return false;
  end if;

  insert into public.ai_import_attempts(user_id) values (target_user_id);
  return true;
end;
$$;

revoke all on function public.reserve_ai_import_attempt(uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_ai_import_attempt(uuid)
  to service_role;

create table if not exists public.frontend_error_logs (
  id uuid primary key default gen_random_uuid(),
  reference_id uuid not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  error_message text not null check (length(error_message) <= 500),
  component_stack text check (length(component_stack) <= 5000),
  path text not null check (length(path) <= 1000),
  user_agent text check (length(user_agent) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists frontend_error_logs_created_idx
  on public.frontend_error_logs(created_at desc);

alter table public.frontend_error_logs enable row level security;

create policy "authenticated records own frontend errors"
on public.frontend_error_logs for insert to authenticated
with check (user_id = auth.uid());

create policy "admin reads frontend errors"
on public.frontend_error_logs for select to authenticated
using (public.current_role() = 'admin');
