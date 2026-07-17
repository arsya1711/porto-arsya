create table if not exists public.school_settings (
  id boolean primary key default true check (id),
  school_name text not null default 'SMP Harapan Bangsa',
  npsn text not null default '',
  address text not null default '',
  academic_year text not null default '',
  exam_reminder boolean not null default true,
  grading_reminder boolean not null default true,
  security_alert boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.school_settings enable row level security;

drop policy if exists "authenticated reads school settings"
on public.school_settings;
create policy "authenticated reads school settings"
on public.school_settings for select to authenticated using (true);

drop policy if exists "admin manages school settings"
on public.school_settings;
create policy "admin manages school settings"
on public.school_settings for all
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

insert into public.school_settings (id)
values (true)
on conflict (id) do nothing;
