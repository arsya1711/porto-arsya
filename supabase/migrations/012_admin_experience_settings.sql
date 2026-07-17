-- Melengkapi pengalaman Admin: logo sekolah, default keamanan,
-- dan preferensi notifikasi pengguna.

alter table public.school_profile_settings
  add column if not exists require_fullscreen_default boolean not null default true,
  add column if not exists record_tab_switches boolean not null default true,
  add column if not exists session_timeout_minutes integer not null default 120
    check (session_timeout_minutes between 15 and 1440);

alter table public.exams
  add column if not exists record_tab_switches boolean not null default true;

create table if not exists public.user_notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade default auth.uid(),
  exam_updates boolean not null default true,
  grading_reminders boolean not null default true,
  security_alerts boolean not null default true,
  email_notifications boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_notification_preferences enable row level security;

drop policy if exists "users read own notification preferences"
  on public.user_notification_preferences;
create policy "users read own notification preferences"
on public.user_notification_preferences for select
using (user_id = auth.uid());

drop policy if exists "users create own notification preferences"
  on public.user_notification_preferences;
create policy "users create own notification preferences"
on public.user_notification_preferences for insert
with check (user_id = auth.uid());

drop policy if exists "users update own notification preferences"
  on public.user_notification_preferences;
create policy "users update own notification preferences"
on public.user_notification_preferences for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop trigger if exists user_notification_preferences_touch_updated_at
  on public.user_notification_preferences;
create trigger user_notification_preferences_touch_updated_at
before update on public.user_notification_preferences
for each row execute function public.touch_updated_at();

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'school-assets',
  'school-assets',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public reads school assets" on storage.objects;
create policy "public reads school assets"
on storage.objects for select
using (bucket_id = 'school-assets');

drop policy if exists "admin uploads school assets" on storage.objects;
create policy "admin uploads school assets"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'school-assets'
  and public.current_role() = 'admin'
);

drop policy if exists "admin updates school assets" on storage.objects;
create policy "admin updates school assets"
on storage.objects for update to authenticated
using (
  bucket_id = 'school-assets'
  and public.current_role() = 'admin'
)
with check (
  bucket_id = 'school-assets'
  and public.current_role() = 'admin'
);

drop policy if exists "admin deletes school assets" on storage.objects;
create policy "admin deletes school assets"
on storage.objects for delete to authenticated
using (
  bucket_id = 'school-assets'
  and public.current_role() = 'admin'
);
