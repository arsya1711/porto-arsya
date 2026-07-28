-- Index ini identik dengan questions_bank_active_idx dari migration 003.
-- Mempertahankan keduanya hanya menambah biaya tulis dan ruang penyimpanan.
drop index if exists public.questions_bank_archived_created_idx;
