-- Admin mengelola sistem dan data master. Guru mengelola konten akademik
-- miliknya. Admin tetap dapat membaca data operasional lintas sekolah untuk
-- laporan, audit, dan penanganan darurat tanpa dapat mengubah konten/nilai.

create or replace function public.teacher_owns_bank(target_bank_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.question_banks
    where id = target_bank_id and owner_id = auth.uid()
  );
$$;

create or replace function public.teacher_owns_exam(target_exam_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.exams
    where id = target_exam_id and created_by = auth.uid()
  );
$$;

create or replace function public.teacher_owns_attempt(target_attempt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.attempts a
    join public.exams e on e.id = a.exam_id
    where a.id = target_attempt_id and e.created_by = auth.uid()
  );
$$;

-- Pastikan hanya satu tahun ajaran berstatus aktif dan perubahan dilakukan
-- secara atomik melalui RPC Admin.
with active_years as (
  select id, row_number() over(order by name desc, id) as position
  from public.academic_years
  where active
)
update public.academic_years ay
set active = false
from active_years ranked
where ay.id = ranked.id and ranked.position > 1;

create unique index if not exists academic_years_single_active_idx
on public.academic_years ((active))
where active;

create or replace function public.set_active_academic_year(target_year_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role() <> 'admin' then
    raise exception 'Hanya admin yang dapat mengaktifkan tahun ajaran';
  end if;
  if not exists(select 1 from public.academic_years where id = target_year_id) then
    raise exception 'Tahun ajaran tidak ditemukan';
  end if;
  update public.academic_years set active = false where active;
  update public.academic_years set active = true where id = target_year_id;
end;
$$;

grant execute on function public.set_active_academic_year(uuid) to authenticated;

create or replace function public.audit_master_data_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb;
  target_id uuid;
begin
  payload := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  target_id := coalesce(
    nullif(payload->>'id', '')::uuid,
    nullif(payload->>'class_id', '')::uuid,
    nullif(payload->>'subject_id', '')::uuid
  );
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(
    auth.uid(),
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    target_id,
    jsonb_build_object(
      'name', payload->>'name',
      'student_id', payload->>'student_id',
      'operation', lower(tg_op)
    )
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists academic_years_audit_change on public.academic_years;
create trigger academic_years_audit_change
after insert or update or delete on public.academic_years
for each row execute function public.audit_master_data_change();

drop trigger if exists subjects_audit_change on public.subjects;
create trigger subjects_audit_change
after insert or update or delete on public.subjects
for each row execute function public.audit_master_data_change();

drop trigger if exists classes_audit_change on public.classes;
create trigger classes_audit_change
after insert or update or delete on public.classes
for each row execute function public.audit_master_data_change();

drop trigger if exists class_students_audit_change on public.class_students;
create trigger class_students_audit_change
after insert or update or delete on public.class_students
for each row execute function public.audit_master_data_change();

drop policy if exists "staff manages classes" on public.classes;
create policy "admin manages classes"
on public.classes for all
using(public.current_role() = 'admin')
with check(public.current_role() = 'admin');

drop policy if exists "authenticated reads class students" on public.class_students;
drop policy if exists "staff manages class students" on public.class_students;
create policy "scoped reads class students"
on public.class_students for select
using(
  public.current_role() in ('admin', 'guru')
  or student_id = auth.uid()
);
create policy "admin manages class students"
on public.class_students for all
using(public.current_role() = 'admin')
with check(public.current_role() = 'admin');

drop policy if exists "staff manages subjects" on public.subjects;
create policy "admin manages subjects"
on public.subjects for all
using(public.current_role() = 'admin')
with check(public.current_role() = 'admin');

drop policy if exists "staff manages assignments" on public.teacher_subjects;
create policy "teachers read own assignments"
on public.teacher_subjects for select
using(
  public.current_role() = 'admin'
  or (public.current_role() = 'guru' and teacher_id = auth.uid())
);
create policy "admin manages teacher assignments"
on public.teacher_subjects for all
using(public.current_role() = 'admin')
with check(public.current_role() = 'admin');

drop policy if exists "staff manages banks" on public.question_banks;
create policy "teachers manage own banks"
on public.question_banks for all
using(public.current_role() = 'guru' and owner_id = auth.uid())
with check(public.current_role() = 'guru' and owner_id = auth.uid());

drop policy if exists "staff manages questions" on public.questions;
create policy "teachers manage questions in own banks"
on public.questions for all
using(
  public.current_role() = 'guru'
  and public.teacher_owns_bank(questions.bank_id)
)
with check(
  public.current_role() = 'guru'
  and created_by = auth.uid()
  and public.teacher_owns_bank(questions.bank_id)
);

drop policy if exists "staff manages exams" on public.exams;
create policy "teachers manage own exams"
on public.exams for all
using(public.current_role() = 'guru' and created_by = auth.uid())
with check(public.current_role() = 'guru' and created_by = auth.uid());
create policy "admin reads all exams"
on public.exams for select
using(public.current_role() = 'admin');

drop policy if exists "staff manages exam questions" on public.exam_questions;
create policy "teachers manage own exam questions"
on public.exam_questions for all
using(
  public.current_role() = 'guru'
  and public.teacher_owns_exam(exam_questions.exam_id)
)
with check(
  public.current_role() = 'guru'
  and public.teacher_owns_exam(exam_questions.exam_id)
);
create policy "admin reads all exam questions"
on public.exam_questions for select
using(public.current_role() = 'admin');

drop policy if exists "staff manages exam assignments" on public.exam_assignments;
create policy "teachers manage own exam assignments"
on public.exam_assignments for all
using(
  public.current_role() = 'guru'
  and public.teacher_owns_exam(exam_assignments.exam_id)
)
with check(
  public.current_role() = 'guru'
  and public.teacher_owns_exam(exam_assignments.exam_id)
);
create policy "admin reads all exam assignments"
on public.exam_assignments for select
using(public.current_role() = 'admin');

drop policy if exists "staff reads attempts" on public.attempts;
create policy "teachers read attempts for own exams"
on public.attempts for select
using(
  public.current_role() = 'guru'
  and public.teacher_owns_exam(attempts.exam_id)
);
create policy "admin reads all attempts"
on public.attempts for select
using(public.current_role() = 'admin');

drop policy if exists "staff grades answers" on public.answers;
create policy "teachers grade answers for own exams"
on public.answers for all
using(
  public.current_role() = 'guru'
  and public.teacher_owns_attempt(answers.attempt_id)
)
with check(
  public.current_role() = 'guru'
  and public.teacher_owns_attempt(answers.attempt_id)
);
create policy "admin reads all answers"
on public.answers for select
using(public.current_role() = 'admin');

drop policy if exists "staff reads integrity" on public.integrity_events;
create policy "teachers read integrity for own exams"
on public.integrity_events for select
using(
  public.current_role() = 'guru'
  and public.teacher_owns_attempt(integrity_events.attempt_id)
);
create policy "admin reads all integrity events"
on public.integrity_events for select
using(public.current_role() = 'admin');

drop policy if exists "staff reads audit logs" on public.audit_logs;
create policy "admin reads audit logs"
on public.audit_logs for select
using(public.current_role() = 'admin');
