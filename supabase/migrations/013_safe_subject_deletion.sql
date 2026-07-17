-- Menghapus mata pelajaran hanya bila sudah tidak lagi dipakai. Pemeriksaan dilakukan
-- di database agar Admin mendapat jumlah referensi tanpa membuka isi bank soal
-- milik Guru melalui RLS.

create or replace function public.delete_subject_safely(target_subject_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  bank_count integer;
  exam_count integer;
  assignment_count integer;
begin
  if public.current_role() <> 'admin' then
    raise exception 'Hanya admin yang dapat menghapus mata pelajaran';
  end if;

  if not exists(select 1 from public.subjects where id = target_subject_id) then
    raise exception 'Mata pelajaran tidak ditemukan';
  end if;

  select count(*)::integer into bank_count
  from public.question_banks where subject_id = target_subject_id;

  select count(*)::integer into exam_count
  from public.exams where subject_id = target_subject_id;

  select count(*)::integer into assignment_count
  from public.teacher_subjects where subject_id = target_subject_id;

  if bank_count + exam_count + assignment_count > 0 then
    return jsonb_build_object(
      'deleted', false,
      'question_banks', bank_count,
      'exams', exam_count,
      'teacher_assignments', assignment_count
    );
  end if;

  delete from public.subjects where id = target_subject_id;
  return jsonb_build_object(
    'deleted', true,
    'question_banks', 0,
    'exams', 0,
    'teacher_assignments', 0
  );
end;
$$;

revoke all on function public.delete_subject_safely(uuid) from public;
grant execute on function public.delete_subject_safely(uuid) to authenticated;
