create or replace function public.create_scheduled_exam(
  exam_title text,
  target_subject_id uuid,
  target_class_id uuid,
  start_time timestamptz,
  duration_in_minutes integer,
  question_ids uuid[],
  access_code_value text default null,
  should_shuffle_questions boolean default true,
  should_use_fullscreen boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_exam_id uuid;
  question_count integer;
begin
  if public.current_role() <> 'guru' then
    raise exception 'Hanya guru yang dapat membuat ujian';
  end if;
  if nullif(trim(exam_title), '') is null then
    raise exception 'Judul ujian wajib diisi';
  end if;
  if start_time <= now() then
    raise exception 'Jadwal ujian harus berada di masa mendatang';
  end if;
  if duration_in_minutes < 1 or duration_in_minutes > 480 then
    raise exception 'Durasi ujian harus antara 1 dan 480 menit';
  end if;
  if coalesce(array_length(question_ids, 1), 0) = 0 then
    raise exception 'Pilih minimal satu soal';
  end if;
  if not exists (
    select 1 from public.teacher_subjects
    where teacher_id = auth.uid()
      and subject_id = target_subject_id
      and class_id = target_class_id
  ) then
    raise exception 'Guru tidak ditugaskan pada mata pelajaran dan kelas tersebut';
  end if;

  select count(*) into question_count
  from public.questions q
  join public.question_banks qb on qb.id = q.bank_id
  where q.id = any(question_ids)
    and q.archived = false
    and qb.subject_id = target_subject_id
    and qb.owner_id = auth.uid();

  if question_count <> array_length(question_ids, 1) then
    raise exception 'Terdapat soal yang tidak valid atau bukan milik guru';
  end if;

  insert into public.exams(
    title, subject_id, class_id, created_by, starts_at, ends_at,
    duration_minutes, status, access_code, shuffle_questions, fullscreen_mode
  ) values (
    trim(exam_title), target_subject_id, target_class_id, auth.uid(), start_time,
    start_time + make_interval(mins => duration_in_minutes),
    duration_in_minutes, 'terjadwal', nullif(upper(trim(access_code_value)), ''),
    should_shuffle_questions, should_use_fullscreen
  ) returning id into new_exam_id;

  insert into public.exam_questions(exam_id, question_id, position)
  select new_exam_id, item.question_id, item.ordinality::integer - 1
  from unnest(question_ids) with ordinality as item(question_id, ordinality);

  insert into public.exam_assignments(exam_id, student_id)
  select new_exam_id, cs.student_id
  from public.class_students cs
  join public.profiles p on p.id = cs.student_id and p.active
  where cs.class_id = target_class_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(
    auth.uid(), 'exam.created', 'exams', new_exam_id,
    jsonb_build_object('title', trim(exam_title), 'questions', question_count)
  );

  return new_exam_id;
end;
$$;

revoke all on function public.create_scheduled_exam(
  text, uuid, uuid, timestamptz, integer, uuid[], text, boolean, boolean
) from public, anon;
grant execute on function public.create_scheduled_exam(
  text, uuid, uuid, timestamptz, integer, uuid[], text, boolean, boolean
) to authenticated;

