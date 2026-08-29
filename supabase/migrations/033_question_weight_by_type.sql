-- Pilihan ganda selalu memiliki bobot satu. Bobot yang dapat disesuaikan
-- hanya berlaku untuk soal essay. Nilai difficulty dipertahankan sebagai
-- metadata internal agar data lama dan laporan historis tetap kompatibel.

-- Normalisasi ini memang mengubah konfigurasi bobot soal lama. Attempt yang
-- sudah final menyimpan nilainya sendiri dan tidak dihitung ulang. Trigger
-- proteksi mutation dinonaktifkan hanya selama backfill dalam migration ini.
alter table public.questions
  disable trigger questions_prevent_scheduled_mutation;

update public.questions
set weight = 1
where type = 'multiple_choice'
  and weight <> 1;

alter table public.questions
  enable trigger questions_prevent_scheduled_mutation;

create or replace function public.enforce_question_weight_by_type()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.type = 'multiple_choice' then
    new.weight := 1;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_question_weight_by_type()
from public, anon, authenticated;

drop trigger if exists questions_enforce_weight_by_type
on public.questions;
create trigger questions_enforce_weight_by_type
before insert or update on public.questions
for each row execute function public.enforce_question_weight_by_type();

alter table public.questions
  drop constraint if exists questions_multiple_choice_static_weight;
alter table public.questions
  add constraint questions_multiple_choice_static_weight
  check (type = 'essay' or weight = 1);
