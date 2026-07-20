-- Menutup temuan audit pasca migration 014: kode akses tidak lagi disimpan
-- sebagai plaintext, percobaan kode dibatasi, dan deadline attempt digunakan
-- secara konsisten oleh seluruh RPC siswa.

create extension if not exists pgcrypto with schema extensions;
set search_path = public, extensions;

alter table public.exams
  add column if not exists access_code_hash text,
  add column if not exists has_access_code boolean not null default false;

update public.exams
set access_code_hash = crypt(
      upper(trim(access_code)),
      gen_salt('bf', 10)
    ),
    has_access_code = true,
    access_code = null
where nullif(trim(access_code), '') is not null
  and access_code_hash is null;

update public.exams
set has_access_code = access_code_hash is not null,
    access_code = null
where has_access_code is distinct from (access_code_hash is not null)
   or access_code is not null;

create or replace function public.hash_exam_access_code()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.access_code = '__KEEP__' and tg_op = 'UPDATE' then
    new.access_code_hash := old.access_code_hash;
    new.has_access_code := old.has_access_code;
  elsif new.access_code = '__REMOVE__' or nullif(trim(new.access_code), '') is null then
    new.access_code_hash := null;
    new.has_access_code := false;
  else
    if length(trim(new.access_code)) < 4 or length(trim(new.access_code)) > 64 then
      raise exception 'Kode akses harus terdiri dari 4 sampai 64 karakter';
    end if;
    new.access_code_hash := crypt(
      upper(trim(new.access_code)),
      gen_salt('bf', 10)
    );
    new.has_access_code := true;
  end if;
  new.access_code := null;
  return new;
end;
$$;

revoke all on function public.hash_exam_access_code()
  from public, anon, authenticated;

drop trigger if exists exams_hash_access_code on public.exams;
create trigger exams_hash_access_code
before insert or update of access_code on public.exams
for each row execute function public.hash_exam_access_code();

create table if not exists public.exam_access_attempts (
  id bigint generated always as identity primary key,
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index if not exists exam_access_attempts_lookup_idx
on public.exam_access_attempts(exam_id, student_id, attempted_at desc);

create index if not exists exam_access_attempts_time_idx
on public.exam_access_attempts(attempted_at);

alter table public.exam_access_attempts enable row level security;
-- Tidak ada policy client. Hanya start_exam_attempt SECURITY DEFINER yang
-- dapat mengakses tabel pembatas percobaan ini.

create or replace function public.reserve_student_login_attempt(
  target_nis_hash text,
  target_ip_hash text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  nis_attempts integer;
  ip_attempts integer := 0;
begin
  if nullif(trim(target_nis_hash), '') is null then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('nis:' || target_nis_hash, 0));
  if target_ip_hash is not null then
    perform pg_advisory_xact_lock(hashtextextended('ip:' || target_ip_hash, 0));
  end if;

  delete from public.student_login_attempts
  where attempted_at < now() - interval '24 hours'
    and (
      nis_hash = target_nis_hash
      or (target_ip_hash is not null and ip_hash = target_ip_hash)
    );
  if random() < 0.01 then
    delete from public.student_login_attempts
    where attempted_at < now() - interval '24 hours';
  end if;

  select count(*) into nis_attempts
  from public.student_login_attempts
  where nis_hash = target_nis_hash
    and attempted_at >= now() - interval '15 minutes';

  if target_ip_hash is not null then
    select count(*) into ip_attempts
    from public.student_login_attempts
    where ip_hash = target_ip_hash
      and attempted_at >= now() - interval '15 minutes';
  end if;

  if nis_attempts >= 8 or ip_attempts >= 20 then
    return false;
  end if;

  insert into public.student_login_attempts(nis_hash, ip_hash)
  values(target_nis_hash, target_ip_hash);
  return true;
end;
$$;

revoke all on function public.reserve_student_login_attempt(text, text)
  from public, anon, authenticated;
grant execute on function public.reserve_student_login_attempt(text, text)
  to service_role;

create or replace function public.save_managed_user_profile(
  actor_user_id uuid,
  target_user_id uuid,
  target_full_name text,
  target_email text,
  target_role public.user_role,
  target_student_number text,
  target_class_id uuid,
  audit_action text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if audit_action not in ('user.created', 'user.updated') then
    raise exception 'Aksi audit pengguna tidak valid';
  end if;
  if nullif(trim(target_full_name), '') is null
     or nullif(trim(target_email), '') is null then
    raise exception 'Nama dan email wajib diisi';
  end if;
  if target_role = 'siswa' and nullif(trim(target_student_number), '') is null then
    raise exception 'NIS siswa wajib diisi';
  end if;
  update public.profiles
  set full_name = trim(target_full_name),
      email = lower(trim(target_email)),
      role = target_role,
      student_number = case when target_role = 'siswa'
        then trim(target_student_number) else null end,
      active = case when audit_action = 'user.created' then true else active end
  where id = target_user_id;

  if not found then
    raise exception 'Profil pengguna tidak ditemukan';
  end if;

  delete from public.class_students where student_id = target_user_id;
  if target_role = 'siswa' and target_class_id is not null then
    insert into public.class_students(class_id, student_id)
    values(target_class_id, target_user_id);
  end if;

  insert into public.audit_logs(
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor_user_id,
    audit_action,
    'profile',
    target_user_id,
    jsonb_build_object('role', target_role, 'class_id', target_class_id)
  );
end;
$$;

revoke all on function public.save_managed_user_profile(
  uuid, uuid, text, text, public.user_role, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.save_managed_user_profile(
  uuid, uuid, text, text, public.user_role, text, uuid, text
) to service_role;

create or replace function public.set_managed_user_active(
  actor_user_id uuid,
  target_user_id uuid,
  target_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set active = target_active where id = target_user_id;
  if not found then
    raise exception 'Profil pengguna tidak ditemukan';
  end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id)
  values(
    actor_user_id,
    case when target_active then 'user.activated' else 'user.deactivated' end,
    'profile',
    target_user_id
  );
end;
$$;

revoke all on function public.set_managed_user_active(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.set_managed_user_active(uuid, uuid, boolean)
  to service_role;

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
    exam.has_access_code,
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

-- Sepuluh detik terakhir hanya merupakan grace period transport untuk request
-- jawaban yang dikirim browser tepat sebelum timer mencapai nol.
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
      ) + interval '10 seconds'
  );
$$;

revoke all on function public.student_attempt_is_active(uuid) from public, anon;
grant execute on function public.student_attempt_is_active(uuid) to authenticated;

create or replace function public.start_exam_attempt(
  requested_exam_id uuid,
  provided_access_code text default null
)
returns table(attempt_id uuid, started_at timestamptz, deadline timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_exam public.exams%rowtype;
  target_attempt public.attempts%rowtype;
  recent_failures integer;
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

  select * into target_attempt
  from public.attempts
  where exam_id = requested_exam_id and student_id = auth.uid()
  for update;

  if target_attempt.status = 'in_progress' and target_attempt.started_at is not null then
    return query select
      target_attempt.id,
      target_attempt.started_at,
      least(
        target_attempt.started_at + make_interval(mins => target_exam.duration_minutes),
        coalesce(target_exam.ends_at, 'infinity'::timestamptz)
      );
    return;
  end if;
  if target_attempt.status in ('submitted', 'grading', 'final') then
    raise exception 'Ujian ini sudah pernah dikumpulkan';
  end if;

  if target_exam.ends_at is not null and now() > target_exam.ends_at then
    raise exception 'Waktu ujian sudah berakhir';
  end if;

  if target_exam.has_access_code then
    if nullif(trim(provided_access_code), '') is null then
      return;
    end if;
    if length(trim(provided_access_code)) > 64 then
      return;
    end if;

    perform pg_advisory_xact_lock(
      hashtextextended(requested_exam_id::text || ':' || auth.uid()::text, 0)
    );
    delete from public.exam_access_attempts
    where attempted_at < now() - interval '24 hours';

    select count(*) into recent_failures
    from public.exam_access_attempts
    where exam_id = requested_exam_id
      and student_id = auth.uid()
      and attempted_at >= now() - interval '15 minutes';

    if recent_failures >= 8 then
      return;
    end if;

    if target_exam.access_code_hash is null
       or crypt(
         upper(trim(provided_access_code)),
         target_exam.access_code_hash
       ) <> target_exam.access_code_hash then
      insert into public.exam_access_attempts(exam_id, student_id)
      values(requested_exam_id, auth.uid());
      return;
    end if;

    delete from public.exam_access_attempts
    where exam_id = requested_exam_id and student_id = auth.uid();
  end if;

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

create or replace function public.get_exam_questions(requested_exam_id uuid)
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
                hashtextextended(attempt.id::text || ':' || question.id::text, 0)
              ),
              option_item.ordinality
          ),
          '[]'::jsonb
        )
        from jsonb_array_elements(
          case when jsonb_typeof(question.options) = 'array'
            then question.options else '[]'::jsonb end
        ) with ordinality as option_item(value, ordinality)
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
                  hashtextextended(attempt.id::text || ':' || question.id::text, 0)
                ),
                option_item.ordinality
            ) - 1)::integer as displayed_index
          from jsonb_array_elements(
            case when jsonb_typeof(question.options) = 'array'
              then question.options else '[]'::jsonb end
          ) with ordinality as option_item(value, ordinality)
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
    and now() <= least(
      attempt.started_at + make_interval(mins => exam.duration_minutes),
      coalesce(exam.ends_at, 'infinity'::timestamptz)
    )
  order by case
    when exam.shuffle_questions then
      hashtextextended(question.id::text, hashtextextended(attempt.id::text, 0))
    else exam_question.position::bigint
  end;
$$;

revoke all on function public.get_exam_questions(uuid) from public, anon;
grant execute on function public.get_exam_questions(uuid) to authenticated;

drop policy if exists "students log own integrity" on public.integrity_events;
drop policy if exists "students log active integrity" on public.integrity_events;
create policy "students log active integrity"
on public.integrity_events for insert
with check (
  student_id = auth.uid()
  and exists(
    select 1
    from public.attempts attempt
    join public.exams exam on exam.id = attempt.exam_id
    where attempt.id = integrity_events.attempt_id
      and attempt.student_id = auth.uid()
      and attempt.status = 'in_progress'
      and exam.record_tab_switches
      and now() <= least(
        attempt.started_at + make_interval(mins => exam.duration_minutes),
        coalesce(exam.ends_at, 'infinity'::timestamptz)
      )
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

update public.school_profile_settings
set school_name = 'Mts Alhidayah Wattaqwa'
where id = 1 and school_name = 'Ruang Ujian';
