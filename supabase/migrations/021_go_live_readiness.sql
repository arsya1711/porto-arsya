-- Hardening terakhir menjelang go-live:
-- 1. memastikan perubahan jadwal/attempt/kelas sampai ke dashboard siswa;
-- 2. menambah indeks untuk query yang paling sering dipakai saat ujian;
-- 3. mempertahankan migrasi sebelumnya sebagai immutable history.

create index if not exists profiles_role_active_created_idx
  on public.profiles(role, active, created_at desc);

create index if not exists exams_status_starts_ends_idx
  on public.exams(status, starts_at, ends_at);

create index if not exists questions_bank_archived_created_idx
  on public.questions(bank_id, archived, created_at desc);

create index if not exists integrity_events_student_occurred_idx
  on public.integrity_events(student_id, occurred_at desc);

-- Supabase Realtime hanya mengirim perubahan tabel yang berada di publication
-- supabase_realtime. Blok ini idempotent agar aman pada project yang sebagian
-- tabelnya sudah pernah ditambahkan lewat Dashboard.
do $$
declare
  target_table text;
begin
  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    raise notice 'Publication supabase_realtime tidak tersedia; lewati konfigurasi Realtime';
    return;
  end if;

  foreach target_table in array array['attempts', 'exams', 'class_students']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target_table
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        target_table
      );
    end if;
  end loop;
end
$$;
