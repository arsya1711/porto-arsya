-- Simpan log error website maksimal tujuh hari. Job berjalan setiap hari agar
-- log kedaluwarsa tidak menunggu satu siklus mingguan tambahan untuk dihapus.

create extension if not exists pg_cron with schema extensions;

create or replace function public.purge_expired_frontend_error_logs()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_count integer;
begin
  delete from public.frontend_error_logs
  where created_at < now() - interval '7 days';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.purge_expired_frontend_error_logs()
  from public, anon, authenticated;

-- Bersihkan data lama langsung saat migration diterapkan.
select public.purge_expired_frontend_error_logs();

-- Idempotent terhadap deployment ulang atau perbaikan riwayat migration.
do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid
    from cron.job
    where jobname = 'purge-frontend-error-logs-daily'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;

  perform cron.schedule(
    'purge-frontend-error-logs-daily',
    '20 17 * * *',
    'select public.purge_expired_frontend_error_logs();'
  );
end;
$$;

