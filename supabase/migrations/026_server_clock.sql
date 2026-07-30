-- Sumber waktu otoritatif untuk web dan aplikasi siswa. Deadline tetap
-- ditegakkan di database; fungsi ini mencegah jam perangkat yang keliru
-- membuat countdown tampil terlalu cepat atau terlalu lambat.
create or replace function public.get_server_time()
returns timestamptz
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select statement_timestamp();
$$;

revoke all on function public.get_server_time() from public;
grant execute on function public.get_server_time() to anon, authenticated;
