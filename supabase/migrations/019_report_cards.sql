-- Rapor semester berbasis nilai final ujian.
-- Nilai otomatis tetap bersumber dari attempts.final_score; perubahan manual,
-- catatan wali kelas, bobot ujian, dan publikasi disimpan serta diaudit.

create table if not exists public.report_periods (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  name text not null,
  semester smallint not null check (semester in (1, 2)),
  starts_on date not null,
  ends_on date not null,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_year_id, semester),
  check (ends_on >= starts_on)
);

create table if not exists public.report_exam_weights (
  period_id uuid not null references public.report_periods(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  weight numeric(6,2) not null default 1 check (weight > 0 and weight <= 100),
  included boolean not null default true,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (period_id, exam_id)
);

create table if not exists public.report_grade_overrides (
  period_id uuid not null references public.report_periods(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  final_score numeric(5,2) not null check (final_score between 0 and 100),
  description text check (length(description) <= 1000),
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (period_id, class_id, student_id, subject_id)
);

create table if not exists public.report_student_notes (
  period_id uuid not null references public.report_periods(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  homeroom_note text check (length(homeroom_note) <= 2000),
  extracurricular text check (length(extracurricular) <= 1000),
  sick_days integer not null default 0 check (sick_days between 0 and 366),
  permitted_days integer not null default 0 check (permitted_days between 0 and 366),
  absent_days integer not null default 0 check (absent_days between 0 and 366),
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (period_id, class_id, student_id)
);

create table if not exists public.report_publications (
  period_id uuid not null references public.report_periods(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  published boolean not null default false,
  published_at timestamptz,
  published_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (period_id, class_id)
);

create index if not exists report_exam_weights_exam_idx
  on public.report_exam_weights(exam_id);
create index if not exists report_grade_overrides_student_idx
  on public.report_grade_overrides(student_id, period_id);
create index if not exists report_student_notes_student_idx
  on public.report_student_notes(student_id, period_id);

drop trigger if exists report_periods_touch_updated_at on public.report_periods;
create trigger report_periods_touch_updated_at
before update on public.report_periods
for each row execute function public.touch_updated_at();

drop trigger if exists report_exam_weights_touch_updated_at on public.report_exam_weights;
create trigger report_exam_weights_touch_updated_at
before update on public.report_exam_weights
for each row execute function public.touch_updated_at();

drop trigger if exists report_grade_overrides_touch_updated_at on public.report_grade_overrides;
create trigger report_grade_overrides_touch_updated_at
before update on public.report_grade_overrides
for each row execute function public.touch_updated_at();

drop trigger if exists report_student_notes_touch_updated_at on public.report_student_notes;
create trigger report_student_notes_touch_updated_at
before update on public.report_student_notes
for each row execute function public.touch_updated_at();

drop trigger if exists report_publications_touch_updated_at on public.report_publications;
create trigger report_publications_touch_updated_at
before update on public.report_publications
for each row execute function public.touch_updated_at();

-- Siapkan semester standar untuk tahun ajaran yang sudah ada.
insert into public.report_periods (
  academic_year_id,
  name,
  semester,
  starts_on,
  ends_on
)
select
  academic_year.id,
  'Semester Ganjil',
  1,
  make_date(substring(academic_year.name from 1 for 4)::integer, 7, 1),
  make_date(substring(academic_year.name from 1 for 4)::integer, 12, 31)
from public.academic_years academic_year
where academic_year.name ~ '^[0-9]{4}/[0-9]{4}$'
on conflict (academic_year_id, semester) do nothing;

insert into public.report_periods (
  academic_year_id,
  name,
  semester,
  starts_on,
  ends_on
)
select
  academic_year.id,
  'Semester Genap',
  2,
  make_date(substring(academic_year.name from 6 for 4)::integer, 1, 1),
  make_date(substring(academic_year.name from 6 for 4)::integer, 6, 30)
from public.academic_years academic_year
where academic_year.name ~ '^[0-9]{4}/[0-9]{4}$'
on conflict (academic_year_id, semester) do nothing;

create or replace function public.ensure_report_periods_for_academic_year()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.name !~ '^[0-9]{4}/[0-9]{4}$' then
    return new;
  end if;

  insert into public.report_periods(
    academic_year_id,
    name,
    semester,
    starts_on,
    ends_on
  )
  values
    (
      new.id,
      'Semester Ganjil',
      1,
      make_date(substring(new.name from 1 for 4)::integer, 7, 1),
      make_date(substring(new.name from 1 for 4)::integer, 12, 31)
    ),
    (
      new.id,
      'Semester Genap',
      2,
      make_date(substring(new.name from 6 for 4)::integer, 1, 1),
      make_date(substring(new.name from 6 for 4)::integer, 6, 30)
    )
  on conflict (academic_year_id, semester) do update set
    starts_on = excluded.starts_on,
    ends_on = excluded.ends_on;

  return new;
end;
$$;

drop trigger if exists academic_years_ensure_report_periods
  on public.academic_years;
create trigger academic_years_ensure_report_periods
after insert or update of name on public.academic_years
for each row execute function public.ensure_report_periods_for_academic_year();

create or replace function public.can_manage_report_class(target_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_role() = 'admin'
    or (
      public.current_role() = 'guru'
      and (
        exists(
          select 1
          from public.classes class
          where class.id = target_class_id
            and class.homeroom_teacher_id = auth.uid()
        )
        or exists(
          select 1
          from public.teacher_subjects assignment
          where assignment.class_id = target_class_id
            and assignment.teacher_id = auth.uid()
        )
        or exists(
          select 1
          from public.exams exam
          where exam.class_id = target_class_id
            and exam.created_by = auth.uid()
        )
      )
    );
$$;

revoke all on function public.can_manage_report_class(uuid) from public, anon;
grant execute on function public.can_manage_report_class(uuid) to authenticated;

alter table public.report_periods enable row level security;
alter table public.report_exam_weights enable row level security;
alter table public.report_grade_overrides enable row level security;
alter table public.report_student_notes enable row level security;
alter table public.report_publications enable row level security;

create policy "authenticated reads report periods"
on public.report_periods for select to authenticated
using (true);

create policy "admin manages report periods"
on public.report_periods for all
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

create policy "staff reads scoped report weights"
on public.report_exam_weights for select
using (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'guru'
    and exists(
      select 1
      from public.exams exam
      where exam.id = report_exam_weights.exam_id
        and exam.created_by = auth.uid()
    )
  )
);

create policy "staff manages scoped report weights"
on public.report_exam_weights for all
using (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'guru'
    and public.teacher_owns_exam(report_exam_weights.exam_id)
  )
)
with check (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'guru'
    and public.teacher_owns_exam(report_exam_weights.exam_id)
  )
);

create policy "staff and published student read report overrides"
on public.report_grade_overrides for select
using (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'guru'
    and public.can_manage_report_class(report_grade_overrides.class_id)
  )
  or (
    student_id = auth.uid()
    and exists(
      select 1
      from public.report_publications publication
      where publication.period_id = report_grade_overrides.period_id
        and publication.class_id = report_grade_overrides.class_id
        and publication.published
    )
  )
);

create policy "staff manages scoped report overrides"
on public.report_grade_overrides for all
using (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'guru'
    and (
      exists(
        select 1
        from public.teacher_subjects assignment
        where assignment.teacher_id = auth.uid()
          and assignment.class_id = report_grade_overrides.class_id
          and assignment.subject_id = report_grade_overrides.subject_id
      )
      or exists(
        select 1
        from public.exams exam
        where exam.created_by = auth.uid()
          and exam.class_id = report_grade_overrides.class_id
          and exam.subject_id = report_grade_overrides.subject_id
      )
    )
  )
)
with check (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'guru'
    and (
      exists(
        select 1
        from public.teacher_subjects assignment
        where assignment.teacher_id = auth.uid()
          and assignment.class_id = report_grade_overrides.class_id
          and assignment.subject_id = report_grade_overrides.subject_id
      )
      or exists(
        select 1
        from public.exams exam
        where exam.created_by = auth.uid()
          and exam.class_id = report_grade_overrides.class_id
          and exam.subject_id = report_grade_overrides.subject_id
      )
    )
  )
);

create policy "staff and published student read report notes"
on public.report_student_notes for select
using (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'guru'
    and public.can_manage_report_class(report_student_notes.class_id)
  )
  or (
    student_id = auth.uid()
    and exists(
      select 1
      from public.report_publications publication
      where publication.period_id = report_student_notes.period_id
        and publication.class_id = report_student_notes.class_id
        and publication.published
    )
  )
);

create policy "admin or homeroom manages report notes"
on public.report_student_notes for all
using (
  public.current_role() = 'admin'
  or exists(
    select 1
    from public.classes class
    where class.id = report_student_notes.class_id
      and class.homeroom_teacher_id = auth.uid()
  )
)
with check (
  public.current_role() = 'admin'
  or exists(
    select 1
    from public.classes class
    where class.id = report_student_notes.class_id
      and class.homeroom_teacher_id = auth.uid()
  )
);

create policy "staff reads report publications"
on public.report_publications for select
using (
  public.current_role() in ('admin', 'guru')
  or (
    public.current_role() = 'siswa'
    and exists(
      select 1
      from public.class_students class_student
      where class_student.class_id = report_publications.class_id
        and class_student.student_id = auth.uid()
    )
  )
);

create policy "admin or homeroom manages report publications"
on public.report_publications for all
using (
  public.current_role() = 'admin'
  or exists(
    select 1
    from public.classes class
    where class.id = report_publications.class_id
      and class.homeroom_teacher_id = auth.uid()
  )
)
with check (
  public.current_role() = 'admin'
  or exists(
    select 1
    from public.classes class
    where class.id = report_publications.class_id
      and class.homeroom_teacher_id = auth.uid()
  )
);

create or replace function public.get_report_card_data(
  target_period_id uuid,
  target_class_id uuid
)
returns table (
  student_id uuid,
  student_name text,
  student_number text,
  subject_id uuid,
  subject_name text,
  subject_code text,
  automatic_score numeric,
  final_score numeric,
  predicate text,
  description text,
  exam_count bigint,
  manually_adjusted boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  requested_role public.user_role := public.current_role();
  period_start date;
  period_end date;
  is_published boolean;
begin
  select period.starts_on, period.ends_on
  into period_start, period_end
  from public.report_periods period
  where period.id = target_period_id;

  if period_start is null then
    raise exception 'Periode rapor tidak ditemukan';
  end if;

  select coalesce(publication.published, false)
  into is_published
  from public.report_publications publication
  where publication.period_id = target_period_id
    and publication.class_id = target_class_id;

  if requested_role in ('admin', 'guru') then
    if not public.can_manage_report_class(target_class_id) then
      raise exception 'Anda tidak memiliki akses ke rapor kelas ini';
    end if;
  elsif requested_role = 'siswa' then
    if not coalesce(is_published, false)
       or not exists(
         select 1
         from public.class_students class_student
         where class_student.class_id = target_class_id
           and class_student.student_id = auth.uid()
       ) then
      raise exception 'Rapor belum tersedia';
    end if;
  else
    raise exception 'Akses rapor ditolak';
  end if;

  return query
  with subject_scope as (
    select distinct exam.subject_id
    from public.exams exam
    where exam.class_id = target_class_id
      and exam.subject_id is not null
      and exam.starts_at::date between period_start and period_end
      and (
        requested_role = 'admin'
        or exam.created_by = auth.uid()
        or exists(
          select 1
          from public.teacher_subjects assignment
          where assignment.teacher_id = auth.uid()
            and assignment.class_id = target_class_id
            and assignment.subject_id = exam.subject_id
        )
        or requested_role = 'siswa'
      )
    union
    select assignment.subject_id
    from public.teacher_subjects assignment
    where assignment.class_id = target_class_id
      and (
        requested_role = 'admin'
        or assignment.teacher_id = auth.uid()
        or requested_role = 'siswa'
      )
  ),
  automatic as (
    select
      attempt.student_id,
      exam.subject_id,
      round(
        sum(attempt.final_score * coalesce(weight.weight, 1))
        / nullif(sum(coalesce(weight.weight, 1)), 0),
        2
      ) as score,
      count(*) as exams
    from public.attempts attempt
    join public.exams exam on exam.id = attempt.exam_id
    left join public.report_exam_weights weight
      on weight.period_id = target_period_id
      and weight.exam_id = exam.id
    where exam.class_id = target_class_id
      and exam.starts_at::date between period_start and period_end
      and attempt.status = 'final'
      and attempt.final_score is not null
      and coalesce(weight.included, true)
    group by attempt.student_id, exam.subject_id
  )
  select
    student.id,
    student.full_name,
    coalesce(student.student_number, ''),
    subject.id,
    subject.name,
    coalesce(subject.code, ''),
    automatic.score,
    coalesce(override.final_score, automatic.score),
    case
      when coalesce(override.final_score, automatic.score) is null then '—'
      when coalesce(override.final_score, automatic.score) >= 90 then 'A'
      when coalesce(override.final_score, automatic.score) >= 80 then 'B'
      when coalesce(override.final_score, automatic.score) >= 70 then 'C'
      else 'D'
    end,
    coalesce(
      nullif(override.description, ''),
      case
        when coalesce(override.final_score, automatic.score) is null
          then 'Belum ada nilai final.'
        when coalesce(override.final_score, automatic.score) >= 90
          then 'Sangat baik dalam menguasai kompetensi yang diujikan.'
        when coalesce(override.final_score, automatic.score) >= 80
          then 'Baik dalam menguasai kompetensi yang diujikan.'
        when coalesce(override.final_score, automatic.score) >= 70
          then 'Cukup menguasai kompetensi yang diujikan.'
        else 'Perlu pendampingan untuk meningkatkan penguasaan kompetensi.'
      end
    ),
    coalesce(automatic.exams, 0),
    override.final_score is not null
  from public.class_students class_student
  join public.profiles student
    on student.id = class_student.student_id
    and student.role = 'siswa'
    and student.active
  cross join subject_scope scoped_subject
  join public.subjects subject on subject.id = scoped_subject.subject_id
  left join automatic
    on automatic.student_id = student.id
    and automatic.subject_id = subject.id
  left join public.report_grade_overrides override
    on override.period_id = target_period_id
    and override.class_id = target_class_id
    and override.student_id = student.id
    and override.subject_id = subject.id
  where class_student.class_id = target_class_id
    and (requested_role <> 'siswa' or student.id = auth.uid())
  order by student.full_name, subject.name;
end;
$$;

revoke all on function public.get_report_card_data(uuid, uuid) from public, anon;
grant execute on function public.get_report_card_data(uuid, uuid) to authenticated;

create or replace function public.audit_report_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    lower(tg_op) || '_report_' || tg_table_name,
    tg_table_name,
    nullif(payload->>'student_id', '')::uuid,
    jsonb_build_object('record', payload)
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists report_exam_weights_audit on public.report_exam_weights;
create trigger report_exam_weights_audit
after insert or update or delete on public.report_exam_weights
for each row execute function public.audit_report_change();

drop trigger if exists report_grade_overrides_audit on public.report_grade_overrides;
create trigger report_grade_overrides_audit
after insert or update or delete on public.report_grade_overrides
for each row execute function public.audit_report_change();

drop trigger if exists report_student_notes_audit on public.report_student_notes;
create trigger report_student_notes_audit
after insert or update or delete on public.report_student_notes
for each row execute function public.audit_report_change();

drop trigger if exists report_publications_audit on public.report_publications;
create trigger report_publications_audit
after insert or update or delete on public.report_publications
for each row execute function public.audit_report_change();
