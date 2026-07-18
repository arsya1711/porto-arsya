-- Kontrak data siswa yang aman. Siswa tidak lagi membaca tabel exams secara
-- langsung karena RLS bekerja per baris dan tidak dapat menyembunyikan kolom
-- access_code. Semua metadata siswa diberikan melalui RPC terkontrol.

alter table public.school_profile_settings
  add column if not exists passing_score numeric(5,2) not null default 75
    check (passing_score between 0 and 100);

-- Login aplikasi memakai NIS sebagai identitas. Normalisasi lebih dulu dan
-- hentikan migrasi bila ada duplikat agar akun yang salah tidak terpilih.
do $$
begin
  if exists(
    select 1
    from public.profiles
    where nullif(trim(student_number), '') is not null
    group by lower(trim(student_number))
    having count(*) > 1
  ) then
    raise exception 'Terdapat NIS duplikat. Perbaiki profiles.student_number sebelum menjalankan migrasi 014';
  end if;
end;
$$;

update public.profiles
set student_number = nullif(trim(student_number), '')
where student_number is distinct from nullif(trim(student_number), '');

create unique index if not exists profiles_student_number_unique_idx
on public.profiles (lower(student_number))
where student_number is not null;

create table if not exists public.student_login_attempts (
  id bigint generated always as identity primary key,
  nis_hash text not null,
  ip_hash text,
  attempted_at timestamptz not null default now()
);

create index if not exists student_login_attempts_nis_time_idx
on public.student_login_attempts(nis_hash, attempted_at desc);

create index if not exists student_login_attempts_ip_time_idx
on public.student_login_attempts(ip_hash, attempted_at desc)
where ip_hash is not null;

create index if not exists student_login_attempts_time_idx
on public.student_login_attempts(attempted_at);

alter table public.student_login_attempts enable row level security;
-- Tidak ada policy client. Tabel ini hanya diakses service-role Edge Function.

-- Metadata signup publik tidak boleh menentukan role. Edge Function admin-users
-- tetap dapat menaikkan role setelah memverifikasi admin pemanggil.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, email, role)
  values(
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'Pengguna'),
    new.email,
    'siswa'
  )
  on conflict(id) do update
  set email = excluded.email,
      full_name = excluded.full_name;
  return new;
end;
$$;

drop policy if exists "student reads assigned exams" on public.exams;
drop policy if exists "student reads live questions" on public.exam_questions;

drop policy if exists "profiles self or staff read" on public.profiles;
drop policy if exists "scoped profile reads" on public.profiles;
create policy "scoped profile reads"
on public.profiles for select
using(
  id = auth.uid()
  or public.current_role() = 'admin'
  or (
    public.current_role() = 'guru'
    and exists(
      select 1
      from public.teacher_subjects assignment
      join public.class_students membership
        on membership.class_id = assignment.class_id
      where assignment.teacher_id = auth.uid()
        and membership.student_id = profiles.id
    )
  )
);

drop policy if exists "authenticated reads classes" on public.classes;
drop policy if exists "scoped reads classes" on public.classes;
create policy "scoped reads classes"
on public.classes for select
using(
  public.current_role() = 'admin'
  or exists(
    select 1 from public.class_students membership
    where membership.class_id = classes.id
      and membership.student_id = auth.uid()
  )
  or (
    public.current_role() = 'guru'
    and (
      homeroom_teacher_id = auth.uid()
      or exists(
        select 1 from public.teacher_subjects assignment
        where assignment.class_id = classes.id
          and assignment.teacher_id = auth.uid()
      )
    )
  )
);

drop policy if exists "scoped reads class students" on public.class_students;
create policy "scoped reads class students"
on public.class_students for select
using(
  student_id = auth.uid()
  or public.current_role() = 'admin'
  or (
    public.current_role() = 'guru'
    and exists(
      select 1 from public.teacher_subjects assignment
      where assignment.class_id = class_students.class_id
        and assignment.teacher_id = auth.uid()
    )
  )
);

-- Pembuatan, pembaruan, dan penghapusan ujian guru dilakukan melalui RPC
-- atomik di bawah. Policy SELECT tetap mempertahankan seluruh tampilan guru.
drop policy if exists "teachers manage own exams" on public.exams;
drop policy if exists "teachers read own exams" on public.exams;
create policy "teachers read own exams"
on public.exams for select
using(
  public.current_role() = 'guru'
  and created_by = auth.uid()
);

drop policy if exists "teachers manage own exam questions" on public.exam_questions;
drop policy if exists "teachers read own exam questions" on public.exam_questions;
create policy "teachers read own exam questions"
on public.exam_questions for select
using(
  public.current_role() = 'guru'
  and public.teacher_owns_exam(exam_questions.exam_id)
);

drop policy if exists "teachers manage own exam assignments" on public.exam_assignments;
drop policy if exists "teachers read own exam assignments" on public.exam_assignments;
create policy "teachers read own exam assignments"
on public.exam_assignments for select
using(
  public.current_role() = 'guru'
  and public.teacher_owns_exam(exam_assignments.exam_id)
);

create or replace function public.get_student_exam_catalog()
returns table(
  exam_id uuid,
  title text,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  duration_minutes integer,
  status public.exam_status,
  requires_access_code boolean,
  fullscreen_mode boolean,
  record_tab_switches boolean,
  subject_name text,
  subject_code text,
  class_name text,
  teacher_name text,
  question_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    exam.id,
    exam.title,
    exam.description,
    exam.starts_at,
    exam.ends_at,
    exam.duration_minutes,
    exam.status,
    nullif(trim(exam.access_code), '') is not null,
    exam.fullscreen_mode,
    exam.record_tab_switches,
    subject.name,
    subject.code,
    class.name,
    teacher.full_name,
    count(exam_question.question_id)
  from public.exam_assignments assignment
  join public.exams exam on exam.id = assignment.exam_id
  join public.profiles student
    on student.id = assignment.student_id
    and student.role = 'siswa'
    and student.active
  left join public.subjects subject on subject.id = exam.subject_id
  left join public.classes class on class.id = exam.class_id
  left join public.profiles teacher on teacher.id = exam.created_by
  left join public.exam_questions exam_question on exam_question.exam_id = exam.id
  where assignment.student_id = auth.uid()
    and public.current_role() = 'siswa'
    and exam.status <> 'draft'
  group by
    exam.id,
    subject.name,
    subject.code,
    class.name,
    teacher.full_name
  order by exam.starts_at;
$$;

revoke all on function public.get_student_exam_catalog() from public, anon;
grant execute on function public.get_student_exam_catalog() to authenticated;

create or replace function public.student_attempt_is_active(target_attempt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.attempts attempt
    join public.exams exam on exam.id = attempt.exam_id
    join public.profiles student on student.id = attempt.student_id
    where attempt.id = target_attempt_id
      and attempt.student_id = auth.uid()
      and student.role = 'siswa'
      and student.active
      and attempt.status = 'in_progress'
      and attempt.started_at is not null
      and now() >= exam.starts_at
      and now() <= least(
        attempt.started_at + make_interval(mins => exam.duration_minutes),
        coalesce(exam.ends_at, 'infinity'::timestamptz)
      )
  );
$$;

revoke all on function public.student_attempt_is_active(uuid) from public, anon;
grant execute on function public.student_attempt_is_active(uuid) to authenticated;

drop policy if exists "students insert active answers" on public.answers;
drop policy if exists "students update active answers" on public.answers;
drop policy if exists "teachers grade answers for own exams" on public.answers;
drop policy if exists "teachers read answers for own exams" on public.answers;
create policy "teachers read answers for own exams"
on public.answers for select
using(
  public.current_role() = 'guru'
  and public.teacher_owns_attempt(answers.attempt_id)
);

-- Nilai dan status attempt hanya boleh berubah lewat RPC penilaian yang
-- memvalidasi bobot, kepemilikan ujian, dan menulis audit log.
drop policy if exists "teachers update attempts for own exams" on public.attempts;

create or replace function public.save_exam_answer(
  target_attempt_id uuid,
  target_question_id uuid,
  target_selected_option integer default null,
  target_essay_text text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  question_kind public.question_type;
  question_options jsonb;
  option_count integer;
  should_shuffle_options boolean;
begin
  perform 1
  from public.attempts attempt
  where attempt.id = target_attempt_id
    and attempt.student_id = auth.uid()
  for update;

  if not public.student_attempt_is_active(target_attempt_id) then
    raise exception 'Attempt tidak aktif atau waktu pengerjaan sudah berakhir';
  end if;

  select
    question.type,
    question.options,
    case
      when jsonb_typeof(question.options) = 'array'
        then jsonb_array_length(question.options)
      else 0
    end,
    exam.shuffle_options
  into question_kind, question_options, option_count, should_shuffle_options
  from public.questions question
  join public.exam_questions exam_question
    on exam_question.question_id = question.id
  join public.attempts attempt on attempt.exam_id = exam_question.exam_id
  join public.exams exam on exam.id = attempt.exam_id
  where attempt.id = target_attempt_id
    and question.id = target_question_id;

  if question_kind is null then
    raise exception 'Soal tidak ditemukan pada ujian ini';
  end if;

  if question_kind = 'multiple_choice' then
    if target_selected_option is null
       or target_selected_option < 0
       or target_selected_option >= option_count then
      raise exception 'Pilihan jawaban tidak valid';
    end if;
    if should_shuffle_options then
      select ordered_option.original_index
      into target_selected_option
      from (
        select
          (option_item.ordinality - 1)::integer as original_index,
          (row_number() over (
            order by
              hashtextextended(
                option_item.ordinality::text,
                hashtextextended(
                  target_attempt_id::text || ':' || target_question_id::text,
                  0
                )
              ),
              option_item.ordinality
          ) - 1)::integer as displayed_index
        from jsonb_array_elements(question_options)
          with ordinality as option_item(value, ordinality)
      ) ordered_option
      where ordered_option.displayed_index = target_selected_option;

      if target_selected_option is null then
        raise exception 'Pilihan jawaban tidak valid';
      end if;
    end if;
    target_essay_text := null;
  else
    if length(coalesce(target_essay_text, '')) > 50000 then
      raise exception 'Jawaban essay terlalu panjang';
    end if;
    target_selected_option := null;
  end if;

  insert into public.answers(
    attempt_id,
    question_id,
    selected_option,
    essay_text,
    score,
    teacher_comment,
    answered_at
  )
  values(
    target_attempt_id,
    target_question_id,
    target_selected_option,
    target_essay_text,
    null,
    null,
    now()
  )
  on conflict (attempt_id, question_id) do update
  set selected_option = excluded.selected_option,
      essay_text = excluded.essay_text,
      score = null,
      teacher_comment = null,
      answered_at = excluded.answered_at;
end;
$$;

revoke all on function public.save_exam_answer(uuid, uuid, integer, text)
  from public, anon;
grant execute on function public.save_exam_answer(uuid, uuid, integer, text)
  to authenticated;

create or replace function public.grade_essay_answer(
  target_answer_id uuid,
  awarded_score numeric,
  feedback text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_attempt_id uuid;
  target_status public.attempt_status;
  max_weight numeric;
  total_points numeric;
  earned_points numeric;
  pending_essays integer;
begin
  select answer.attempt_id, question.weight, attempt.status
  into target_attempt_id, max_weight, target_status
  from public.answers answer
  join public.questions question on question.id = answer.question_id
  join public.attempts attempt on attempt.id = answer.attempt_id
  where answer.id = target_answer_id and question.type = 'essay'
  for update of attempt;

  if target_attempt_id is null
     or public.current_role() <> 'guru'
     or not public.teacher_owns_attempt(target_attempt_id) then
    raise exception 'Jawaban tidak ditemukan atau tidak dapat dinilai';
  end if;
  if target_status not in ('grading', 'final') then
    raise exception 'Attempt belum dapat dinilai';
  end if;
  if awarded_score is null
     or awarded_score < 0
     or awarded_score > max_weight then
    raise exception 'Skor harus berada antara 0 dan bobot soal';
  end if;
  if length(coalesce(feedback, '')) > 5000 then
    raise exception 'Catatan penilaian terlalu panjang';
  end if;

  update public.answers
  set score = awarded_score,
      teacher_comment = nullif(trim(feedback), '')
  where id = target_answer_id;

  select count(*) into pending_essays
  from public.exam_questions exam_question
  join public.attempts attempt on attempt.exam_id = exam_question.exam_id
  join public.questions question
    on question.id = exam_question.question_id and question.type = 'essay'
  left join public.answers answer
    on answer.attempt_id = attempt.id
    and answer.question_id = question.id
  where attempt.id = target_attempt_id and answer.score is null;

  select
    coalesce(sum(question.weight), 0),
    coalesce(sum(case
      when question.type = 'multiple_choice'
        and answer.selected_option = question.correct_option then question.weight
      when question.type = 'essay' then coalesce(answer.score, 0)
      else 0
    end), 0)
  into total_points, earned_points
  from public.attempts attempt
  join public.exam_questions exam_question
    on exam_question.exam_id = attempt.exam_id
  join public.questions question on question.id = exam_question.question_id
  left join public.answers answer
    on answer.attempt_id = attempt.id
    and answer.question_id = question.id
  where attempt.id = target_attempt_id;

  update public.attempts
  set essay_score = earned_points - coalesce(objective_score, 0),
      status = case when pending_essays = 0 then 'final' else 'grading' end,
      final_score = case
        when pending_essays = 0 and total_points > 0
          then round(earned_points / total_points * 100, 2)
        else null
      end,
      finalized_at = case when pending_essays = 0 then now() else null end
  where id = target_attempt_id;

  insert into public.audit_logs(
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    auth.uid(),
    'answer.graded',
    'answers',
    target_answer_id,
    jsonb_build_object(
      'attempt_id', target_attempt_id,
      'score', awarded_score,
      'finalized', pending_essays = 0
    )
  );
end;
$$;

revoke all on function public.grade_essay_answer(uuid, numeric, text)
  from public, anon;
grant execute on function public.grade_essay_answer(uuid, numeric, text)
  to authenticated;

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
  if target_status = 'terjadwal' and start_time <= now() then
    raise exception 'Jadwal ujian harus berada di masa mendatang';
  end if;
  if duration_in_minutes < 1 or duration_in_minutes > 480 then
    raise exception 'Durasi ujian harus antara 1 dan 480 menit';
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
      'status', target_status
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

create or replace function public.delete_managed_exam(target_exam_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_title text;
begin
  if public.current_role() <> 'guru' then
    raise exception 'Hanya guru yang dapat menghapus ujian';
  end if;

  select title into deleted_title
  from public.exams
  where id = target_exam_id and created_by = auth.uid()
  for update;

  if deleted_title is null then
    raise exception 'Ujian tidak ditemukan atau bukan milik guru';
  end if;
  if exists(select 1 from public.attempts where exam_id = target_exam_id) then
    raise exception 'Ujian yang sudah memiliki attempt tidak dapat dihapus';
  end if;

  delete from public.exams where id = target_exam_id;
  insert into public.audit_logs(
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    auth.uid(),
    'exam.deleted',
    'exams',
    target_exam_id,
    jsonb_build_object('title', deleted_title)
  );
end;
$$;

revoke all on function public.delete_managed_exam(uuid) from public, anon;
grant execute on function public.delete_managed_exam(uuid) to authenticated;

create or replace function public.start_exam_attempt(
  requested_exam_id uuid,
  provided_access_code text default null
)
returns table(attempt_id uuid, started_at timestamptz, deadline timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_exam public.exams%rowtype;
  target_attempt public.attempts%rowtype;
begin
  if public.current_role() <> 'siswa'
     or not exists(
       select 1 from public.profiles
       where id = auth.uid() and role = 'siswa' and active
     ) then
    raise exception 'Sesi siswa tidak valid';
  end if;

  select exam.* into target_exam
  from public.exams exam
  join public.exam_assignments assignment on assignment.exam_id = exam.id
  where exam.id = requested_exam_id
    and assignment.student_id = auth.uid();

  if target_exam.id is null then
    raise exception 'Ujian tidak ditemukan atau tidak ditugaskan kepada siswa';
  end if;
  if target_exam.status = 'draft' or now() < target_exam.starts_at then
    raise exception 'Ujian belum dapat dimulai';
  end if;
  if target_exam.ends_at is not null and now() > target_exam.ends_at then
    raise exception 'Waktu ujian sudah berakhir';
  end if;
  if nullif(trim(target_exam.access_code), '') is not null
     and upper(trim(coalesce(provided_access_code, '')))
       <> upper(trim(target_exam.access_code)) then
    raise exception 'Kode akses ujian tidak sesuai';
  end if;

  -- Menangani dua request start yang datang hampir bersamaan tanpa membuat
  -- attempt ganda atau mengubah waktu mulai yang sudah tercatat.
  insert into public.attempts(exam_id, student_id, status, started_at)
  values(requested_exam_id, auth.uid(), 'in_progress', now())
  on conflict (exam_id, student_id) do nothing;

  select * into target_attempt
  from public.attempts
  where exam_id = requested_exam_id and student_id = auth.uid()
  for update;

  if target_attempt.status in ('submitted', 'grading', 'final') then
    raise exception 'Ujian ini sudah pernah dikumpulkan';
  end if;

  if target_attempt.status = 'not_started' or target_attempt.started_at is null then
    update public.attempts
    set status = 'in_progress', started_at = now()
    where id = target_attempt.id
    returning * into target_attempt;
  end if;

  return query select
    target_attempt.id,
    target_attempt.started_at,
    least(
      target_attempt.started_at + make_interval(mins => target_exam.duration_minutes),
      coalesce(target_exam.ends_at, 'infinity'::timestamptz)
    );
end;
$$;

revoke all on function public.start_exam_attempt(uuid, text) from public, anon;
grant execute on function public.start_exam_attempt(uuid, text) to authenticated;

drop function if exists public.get_exam_questions(uuid);
create function public.get_exam_questions(requested_exam_id uuid)
returns table(
  question_id uuid,
  body text,
  kind public.question_type,
  options jsonb,
  weight numeric,
  selected_option integer,
  essay_text text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    question.id,
    question.body,
    question.type,
    case
      when exam.shuffle_options and question.type = 'multiple_choice' then (
        select coalesce(
          jsonb_agg(
            option_item.value
            order by
              hashtextextended(
                option_item.ordinality::text,
                hashtextextended(
                  attempt.id::text || ':' || question.id::text,
                  0
                )
              ),
              option_item.ordinality
          ),
          '[]'::jsonb
        )
        from jsonb_array_elements(
          case when jsonb_typeof(question.options) = 'array'
            then question.options else '[]'::jsonb end
        )
          with ordinality as option_item(value, ordinality)
      )
      else question.options
    end,
    question.weight,
    case
      when answer.selected_option is null then null
      when exam.shuffle_options then (
        select ordered_option.displayed_index
        from (
          select
            (option_item.ordinality - 1)::integer as original_index,
            (row_number() over (
              order by
                hashtextextended(
                  option_item.ordinality::text,
                  hashtextextended(
                    attempt.id::text || ':' || question.id::text,
                    0
                  )
                ),
                option_item.ordinality
            ) - 1)::integer as displayed_index
          from jsonb_array_elements(
            case when jsonb_typeof(question.options) = 'array'
              then question.options else '[]'::jsonb end
          )
            with ordinality as option_item(value, ordinality)
        ) ordered_option
        where ordered_option.original_index = answer.selected_option
      )
      else answer.selected_option
    end,
    answer.essay_text
  from public.exam_questions exam_question
  join public.questions question on question.id = exam_question.question_id
  join public.exams exam on exam.id = exam_question.exam_id
  join public.attempts attempt on attempt.exam_id = exam.id
  left join public.answers answer
    on answer.attempt_id = attempt.id
    and answer.question_id = question.id
  join public.profiles student
    on student.id = attempt.student_id
    and student.role = 'siswa'
    and student.active
  where exam.id = requested_exam_id
    and attempt.student_id = auth.uid()
    and public.current_role() = 'siswa'
    and attempt.status = 'in_progress'
    and now() >= exam.starts_at
    and now() <= coalesce(exam.ends_at, 'infinity'::timestamptz)
  order by case
    when exam.shuffle_questions then
      hashtextextended(question.id::text, hashtextextended(attempt.id::text, 0))
    else exam_question.position::bigint
  end;
$$;

revoke all on function public.get_exam_questions(uuid) from public, anon;
grant execute on function public.get_exam_questions(uuid) to authenticated;

create or replace function public.prevent_scheduled_question_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_question_id uuid := case when tg_op = 'DELETE' then old.id else new.id end;
begin
  if exists(
    select 1
    from public.exam_questions exam_question
    join public.exams exam on exam.id = exam_question.exam_id
    where exam_question.question_id = target_question_id
      and (
        exam.status <> 'draft'
        or exists(
          select 1 from public.attempts attempt
          where attempt.exam_id = exam.id
        )
      )
  ) then
    if tg_op = 'DELETE' then
      raise exception 'Soal pada ujian terjadwal atau yang sudah dikerjakan tidak dapat dihapus';
    end if;
    if new.bank_id is distinct from old.bank_id
       or new.body is distinct from old.body
       or new.type is distinct from old.type
       or new.options is distinct from old.options
       or new.correct_option is distinct from old.correct_option
       or new.answer_key is distinct from old.answer_key
       or new.difficulty is distinct from old.difficulty
       or new.weight is distinct from old.weight then
      raise exception 'Soal pada ujian terjadwal atau yang sudah dikerjakan tidak dapat diubah';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists questions_prevent_scheduled_mutation on public.questions;
create trigger questions_prevent_scheduled_mutation
before update or delete on public.questions
for each row execute function public.prevent_scheduled_question_mutation();

create or replace function public.audit_assessment_configuration_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  target_id uuid;
  action_name text;
begin
  if tg_table_name = 'questions'
     and tg_op = 'UPDATE'
     and (to_jsonb(new) - 'usage_count' - 'updated_at')
       = (to_jsonb(old) - 'usage_count' - 'updated_at') then
    return new;
  end if;

  if tg_table_name = 'school_profile_settings' then
    target_id := null;
    action_name := 'school_settings.' || lower(tg_op);
  elsif tg_table_name = 'teacher_subjects' then
    target_id := nullif(payload->>'teacher_id', '')::uuid;
    action_name := 'teacher_assignment.' || lower(tg_op);
  else
    target_id := nullif(payload->>'id', '')::uuid;
    action_name := tg_table_name || '.' || lower(tg_op);
  end if;

  insert into public.audit_logs(
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    auth.uid(),
    action_name,
    tg_table_name,
    target_id,
    case
      when tg_table_name = 'school_profile_settings' then
        jsonb_build_object(
          'school_name', payload->>'school_name',
          'passing_score', payload->>'passing_score',
          'fullscreen_default', payload->>'require_fullscreen_default',
          'record_tab_switches', payload->>'record_tab_switches'
        )
      when tg_table_name = 'teacher_subjects' then
        jsonb_build_object(
          'teacher_id', payload->>'teacher_id',
          'subject_id', payload->>'subject_id',
          'class_id', payload->>'class_id'
        )
      else
        jsonb_build_object(
          'bank_id', payload->>'bank_id',
          'type', payload->>'type',
          'difficulty', payload->>'difficulty',
          'weight', payload->>'weight',
          'archived', payload->>'archived'
        )
    end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.audit_assessment_configuration_change()
  from public, anon, authenticated;

drop trigger if exists questions_audit_change on public.questions;
create trigger questions_audit_change
after insert or update or delete on public.questions
for each row execute function public.audit_assessment_configuration_change();

drop trigger if exists teacher_subjects_audit_change on public.teacher_subjects;
create trigger teacher_subjects_audit_change
after insert or update or delete on public.teacher_subjects
for each row execute function public.audit_assessment_configuration_change();

drop trigger if exists school_profile_settings_audit_change
  on public.school_profile_settings;
create trigger school_profile_settings_audit_change
after update on public.school_profile_settings
for each row execute function public.audit_assessment_configuration_change();

drop policy if exists "students log own integrity" on public.integrity_events;
create policy "students log own integrity"
on public.integrity_events for insert
with check (
  student_id = auth.uid()
  and
  exists(
    select 1 from public.attempts attempt
    where attempt.id = integrity_events.attempt_id
      and attempt.student_id = auth.uid()
  )
  and event_type in (
    'tab_hidden',
    'app_backgrounded',
    'fullscreen_exit',
    'copy',
    'paste',
    'reconnect'
  )
  and octet_length(coalesce(metadata, '{}'::jsonb)::text) <= 4096
);
