-- Kurangi permukaan RPC SECURITY DEFINER tanpa mengganggu trigger, RLS helper,
-- atau RPC aplikasi yang sudah diberi GRANT eksplisit pada migration asalnya.
--
-- PostgreSQL memberi EXECUTE kepada PUBLIC secara default ketika sebuah fungsi
-- dibuat. Mencabut hak PUBLIC di sini juga menutup akses turunan untuk `anon`.
do $$
declare
  secured_function record;
begin
  for secured_function in
    select procedure.oid::regprocedure as signature
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.prosecdef
  loop
    execute format(
      'revoke execute on function %s from public, anon',
      secured_function.signature
    );
  end loop;

  -- Fungsi trigger dijalankan oleh PostgreSQL dan tidak perlu dapat dipanggil
  -- sebagai RPC oleh pengguna aplikasi.
  for secured_function in
    select procedure.oid::regprocedure as signature
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.prosecdef
      and procedure.prorettype = 'trigger'::regtype
  loop
    execute format(
      'revoke execute on function %s from authenticated',
      secured_function.signature
    );
  end loop;
end
$$;

-- Pemeriksaan versi harus tetap bisa dipanggil aplikasi siswa sebelum login.
grant execute on function public.get_minimum_app_version()
  to anon, authenticated;

-- Bucket ini memang publik sehingga URL objek tetap dapat dibaca tanpa policy
-- SELECT. Policy SELECT yang luas hanya membuka operasi listing seluruh objek.
drop policy if exists "public reads school assets" on storage.objects;
