-- Gerbang versi minimum untuk aplikasi siswa (AWExam).
--
-- Klien lama dapat memakai kontrak RPC yang sudah berubah, dan kegagalan di
-- tengah ujian jauh lebih merugikan daripada menahan siswa di layar pembaruan.

alter table public.school_profile_settings
  add column if not exists minimum_app_version text
    check (
      minimum_app_version is null
      or minimum_app_version ~ '^[0-9]+\.[0-9]+(\.[0-9]+)?$'
    );

comment on column public.school_profile_settings.minimum_app_version is
  'Versi semantik terendah aplikasi siswa yang masih dilayani; null menonaktifkan gerbang.';

-- Pemeriksaan versi berjalan sebelum siswa login, sementara kebijakan RLS tabel
-- ini hanya melayani peran `authenticated`. Fungsi security definer memaparkan
-- satu nilai saja, tanpa membuka kolom lain seperti NPSN atau alamat sekolah.
create or replace function public.get_minimum_app_version()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select minimum_app_version from public.school_profile_settings where id = 1
$$;

revoke all on function public.get_minimum_app_version() from public;
grant execute on function public.get_minimum_app_version() to anon, authenticated;
