-- Izinkan guru mengatur waktu selesai tanpa batas maksimum delapan jam.
-- ends_at tetap dihitung dari start_time + duration_in_minutes, sehingga
-- satu-satunya batas jadwal adalah waktu selesai harus setelah waktu mulai.

create or replace function public.save_managed_exam(
  target_exam_id uuid,
  exam_title text,
  exam_description text,
  target_subject_id uuid,
  target_class_id uuid,
  start_time timestamptz,
  duration_in_minutes integer,
  target_status public.exam_status,
  question_ids uuid[],
  access_code_value text,
  should_shuffle_questions boolean,
  should_shuffle_options boolean,
  should_use_fullscreen boolean,
  should_record_tab_switches boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_exam_id uuid;
  question_count integer;
  action_name text;
begin
  if public.current_role() <> 'guru' then
    raise exception 'Hanya guru yang dapat menyimpan ujian';
  end if;
  if nullif(trim(exam_title), '') is null then
    raise exception 'Judul ujian wajib diisi';
  end if;
  if target_status is null or target_status not in ('draft', 'terjadwal') then
    raise exception 'Status ujian tidak dapat disimpan dari halaman ini';
  end if;
  if start_time is null then
    raise exception 'Waktu mulai ujian wajib diisi';
  end if;
  if target_status = 'terjadwal' and start_time <= now() then
    raise exception 'Jadwal ujian harus berada di masa mendatang';
  end if;
  if duration_in_minutes is null or duration_in_minutes < 1 then
    raise exception 'Waktu selesai harus setelah waktu mulai';
  end if;
  if coalesce(array_length(question_ids, 1), 0) = 0 then
    raise exception 'Pilih minimal satu soal';
  end if;
  if not exists(
    select 1 from public.teacher_subjects
    where teacher_id = auth.uid()
      and subject_id = target_subject_id
      and class_id = target_class_id
  ) then
    raise exception 'Guru tidak ditugaskan pada mata pelajaran dan kelas tersebut';
  end if;

  select count(*) into question_count
  from public.questions question
  join public.question_banks bank on bank.id = question.bank_id
  where question.id = any(question_ids)
    and not question.archived
    and bank.subject_id = target_subject_id
    and bank.owner_id = auth.uid();

  if question_count <> array_length(question_ids, 1) then
    raise exception 'Terdapat soal duplikat, tidak valid, atau bukan milik guru';
  end if;

  if target_exam_id is null then
    insert into public.exams(
      title,
      description,
      subject_id,
      class_id,
      created_by,
      starts_at,
      ends_at,
      duration_minutes,
      status,
      access_code,
      shuffle_questions,
      shuffle_options,
      fullscreen_mode,
      record_tab_switches
    ) values (
      trim(exam_title),
      nullif(trim(exam_description), ''),
      target_subject_id,
      target_class_id,
      auth.uid(),
      start_time,
      start_time + make_interval(mins => duration_in_minutes),
      duration_in_minutes,
      target_status,
      nullif(upper(trim(access_code_value)), ''),
      should_shuffle_questions,
      should_shuffle_options,
      should_use_fullscreen,
      should_record_tab_switches
    ) returning id into saved_exam_id;
    action_name := 'exam.created';
  else
    select exam.id into saved_exam_id
    from public.exams exam
    where exam.id = target_exam_id and exam.created_by = auth.uid()
    for update;

    if saved_exam_id is null then
      raise exception 'Ujian tidak ditemukan atau bukan milik guru';
    end if;
    if exists(
      select 1 from public.attempts where exam_id = saved_exam_id
    ) then
      raise exception 'Ujian yang sudah memiliki attempt tidak dapat diubah';
    end if;

    update public.exams
    set title = trim(exam_title),
        description = nullif(trim(exam_description), ''),
        subject_id = target_subject_id,
        class_id = target_class_id,
        starts_at = start_time,
        ends_at = start_time + make_interval(mins => duration_in_minutes),
        duration_minutes = duration_in_minutes,
        status = target_status,
        access_code = nullif(upper(trim(access_code_value)), ''),
        shuffle_questions = should_shuffle_questions,
        shuffle_options = should_shuffle_options,
        fullscreen_mode = should_use_fullscreen,
        record_tab_switches = should_record_tab_switches
    where id = saved_exam_id;
    action_name := 'exam.updated';

    delete from public.exam_questions where exam_id = saved_exam_id;
    delete from public.exam_assignments where exam_id = saved_exam_id;
  end if;

  insert into public.exam_questions(exam_id, question_id, position)
  select saved_exam_id, item.question_id, item.ordinality::integer
  from unnest(question_ids) with ordinality as item(question_id, ordinality);

  insert into public.exam_assignments(exam_id, student_id)
  select saved_exam_id, class_student.student_id
  from public.class_students class_student
  join public.profiles student
    on student.id = class_student.student_id
    and student.role = 'siswa'
    and student.active
  where class_student.class_id = target_class_id;

  insert into public.audit_logs(
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    auth.uid(),
    action_name,
    'exams',
    saved_exam_id,
    jsonb_build_object(
      'title', trim(exam_title),
      'class_id', target_class_id,
      'subject_id', target_subject_id,
      'questions', question_count,
      'status', target_status,
      'duration_minutes', duration_in_minutes
    )
  );

  return saved_exam_id;
end;
$$;

revoke all on function public.save_managed_exam(
  uuid, text, text, uuid, uuid, timestamptz, integer, public.exam_status,
  uuid[], text, boolean, boolean, boolean, boolean
) from public, anon;
grant execute on function public.save_managed_exam(
  uuid, text, text, uuid, uuid, timestamptz, integer, public.exam_status,
  uuid[], text, boolean, boolean, boolean, boolean
) to authenticated;

comment on function public.save_managed_exam(
  uuid, text, text, uuid, uuid, timestamptz, integer, public.exam_status,
  uuid[], text, boolean, boolean, boolean, boolean
) is 'Menyimpan ujian dengan waktu selesai fleksibel selama berada setelah waktu mulai.';
