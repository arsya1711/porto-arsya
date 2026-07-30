-- Reset data akademik tidak boleh menghapus konfigurasi singleton sekolah.
-- Versi 1.0.4 adalah build siswa produksi yang saat ini disiapkan.
insert into public.school_profile_settings(
  id,
  school_name,
  minimum_app_version
)
values (1, 'Mts Alhidayah Wattaqwa', '1.0.4')
on conflict (id) do update
set minimum_app_version = coalesce(
  public.school_profile_settings.minimum_app_version,
  excluded.minimum_app_version
);
