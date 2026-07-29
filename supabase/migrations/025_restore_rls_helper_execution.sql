-- Migration 023 mencabut EXECUTE bawaan PUBLIC dari seluruh fungsi
-- SECURITY DEFINER. `current_role()` juga dipakai langsung oleh banyak policy
-- RLS yang berlaku untuk role PUBLIC, sehingga request anon dapat gagal dengan
-- `permission denied` sebelum policy sempat menghasilkan false.
--
-- Fungsi ini hanya mengembalikan role profil milik auth.uid() pemanggil dan
-- memakai search_path tetap, sehingga aman digunakan sebagai helper policy.
grant execute on function public.current_role()
  to anon, authenticated;
