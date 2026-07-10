create extension if not exists pgcrypto;

create type public.user_role as enum ('admin','guru','siswa');
create type public.exam_status as enum ('draft','terjadwal','berlangsung','selesai');
create type public.question_type as enum ('multiple_choice','essay');
create type public.attempt_status as enum ('not_started','in_progress','submitted','grading','final');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role public.user_role not null,
  student_number text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.academic_years (id uuid primary key default gen_random_uuid(), name text not null, active boolean not null default false);
create table public.classes (id uuid primary key default gen_random_uuid(), name text not null, academic_year_id uuid references public.academic_years(id), homeroom_teacher_id uuid references public.profiles(id));
create table public.class_students (class_id uuid references public.classes(id) on delete cascade, student_id uuid references public.profiles(id) on delete cascade, primary key(class_id,student_id));
create table public.subjects (id uuid primary key default gen_random_uuid(), name text not null, code text unique);
create table public.teacher_subjects (teacher_id uuid references public.profiles(id), subject_id uuid references public.subjects(id), class_id uuid references public.classes(id), primary key(teacher_id,subject_id,class_id));
create table public.question_banks (id uuid primary key default gen_random_uuid(), name text not null, subject_id uuid references public.subjects(id), owner_id uuid references public.profiles(id), grade_level text, created_at timestamptz not null default now());
create table public.questions (
  id uuid primary key default gen_random_uuid(), bank_id uuid references public.question_banks(id), body text not null,
  type public.question_type not null, options jsonb, correct_option integer, answer_key text,
  difficulty text not null default 'sedang' check(difficulty in('mudah','sedang','sulit')),
  weight numeric(6,2) not null default 1 check(weight>0), usage_count integer not null default 0,
  archived boolean not null default false, created_by uuid references public.profiles(id), created_at timestamptz not null default now()
);
create table public.exams (
  id uuid primary key default gen_random_uuid(), title text not null, description text, subject_id uuid references public.subjects(id),
  class_id uuid references public.classes(id), created_by uuid references public.profiles(id), starts_at timestamptz not null default now(),
  ends_at timestamptz, duration_minutes integer not null check(duration_minutes>0), status public.exam_status not null default 'draft',
  access_code text, shuffle_questions boolean not null default true, shuffle_options boolean not null default true,
  fullscreen_mode boolean not null default true, created_at timestamptz not null default now()
);
create table public.exam_questions (exam_id uuid references public.exams(id) on delete cascade, question_id uuid references public.questions(id), position integer not null, primary key(exam_id,question_id));
create table public.exam_assignments (exam_id uuid references public.exams(id) on delete cascade, student_id uuid references public.profiles(id), primary key(exam_id,student_id));
create table public.attempts (
  id uuid primary key default gen_random_uuid(), exam_id uuid references public.exams(id), student_id uuid references public.profiles(id),
  status public.attempt_status not null default 'not_started', started_at timestamptz, submitted_at timestamptz,
  objective_score numeric(7,2), essay_score numeric(7,2), final_score numeric(7,2), finalized_at timestamptz,
  unique(exam_id,student_id)
);
create table public.answers (
  id uuid primary key default gen_random_uuid(), attempt_id uuid references public.attempts(id) on delete cascade,
  question_id uuid references public.questions(id), selected_option integer, essay_text text, score numeric(7,2), teacher_comment text,
  answered_at timestamptz not null default now(), unique(attempt_id,question_id)
);
create table public.integrity_events (id uuid primary key default gen_random_uuid(), attempt_id uuid references public.attempts(id), student_id uuid references public.profiles(id), event_type text not null, metadata jsonb default '{}', occurred_at timestamptz not null default now());
create table public.audit_logs (id bigint generated always as identity primary key, actor_id uuid references public.profiles(id), action text not null, entity_type text, entity_id uuid, metadata jsonb default '{}', created_at timestamptz not null default now());

create or replace function public.current_role() returns public.user_role language sql stable security definer set search_path=public as $$ select role from public.profiles where id=auth.uid() $$;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,full_name,email,role) values(new.id,coalesce(new.raw_user_meta_data->>'full_name','Pengguna'),new.email,coalesce((new.raw_user_meta_data->>'role')::public.user_role,'siswa')); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create or replace function public.get_exam_questions(requested_exam_id uuid)
returns table(question_id uuid, body text, kind public.question_type, options jsonb, weight numeric)
language sql security definer set search_path=public as $$
  select q.id, q.body, q.type, q.options, q.weight
  from public.exam_questions eq
  join public.questions q on q.id=eq.question_id
  join public.exams e on e.id=eq.exam_id
  join public.exam_assignments ea on ea.exam_id=e.id
  where e.id=requested_exam_id and ea.student_id=auth.uid()
    and now()>=e.starts_at and (e.ends_at is null or now()<=e.ends_at)
  order by eq.position;
$$;
grant execute on function public.get_exam_questions(uuid) to authenticated;

alter table public.profiles enable row level security; alter table public.academic_years enable row level security; alter table public.classes enable row level security;
alter table public.class_students enable row level security; alter table public.subjects enable row level security; alter table public.teacher_subjects enable row level security;
alter table public.question_banks enable row level security; alter table public.questions enable row level security; alter table public.exams enable row level security;
alter table public.exam_questions enable row level security; alter table public.exam_assignments enable row level security; alter table public.attempts enable row level security;
alter table public.answers enable row level security; alter table public.integrity_events enable row level security; alter table public.audit_logs enable row level security;

create policy "profiles self or staff read" on public.profiles for select using(id=auth.uid() or public.current_role() in('admin','guru'));
create policy "admin manages profiles" on public.profiles for all using(public.current_role()='admin') with check(public.current_role()='admin');
create policy "authenticated reads academic years" on public.academic_years for select to authenticated using(true);
create policy "admin manages academic years" on public.academic_years for all using(public.current_role()='admin') with check(public.current_role()='admin');
create policy "authenticated reads classes" on public.classes for select to authenticated using(true);
create policy "staff manages classes" on public.classes for all using(public.current_role() in('admin','guru')) with check(public.current_role() in('admin','guru'));
create policy "authenticated reads class students" on public.class_students for select to authenticated using(true);
create policy "staff manages class students" on public.class_students for all using(public.current_role() in('admin','guru')) with check(public.current_role() in('admin','guru'));
create policy "authenticated reads subjects" on public.subjects for select to authenticated using(true);
create policy "staff manages subjects" on public.subjects for all using(public.current_role() in('admin','guru')) with check(public.current_role() in('admin','guru'));
create policy "staff manages assignments" on public.teacher_subjects for all using(public.current_role() in('admin','guru')) with check(public.current_role() in('admin','guru'));
create policy "staff manages banks" on public.question_banks for all using(public.current_role() in('admin','guru')) with check(public.current_role() in('admin','guru'));
create policy "staff manages questions" on public.questions for all using(public.current_role() in('admin','guru')) with check(public.current_role() in('admin','guru'));
create policy "staff manages exams" on public.exams for all using(public.current_role() in('admin','guru')) with check(public.current_role() in('admin','guru'));
create policy "student reads assigned exams" on public.exams for select using(public.current_role()='siswa' and exists(select 1 from public.exam_assignments a where a.exam_id=id and a.student_id=auth.uid()));
create policy "staff manages exam questions" on public.exam_questions for all using(public.current_role() in('admin','guru')) with check(public.current_role() in('admin','guru'));
create policy "student reads live questions" on public.exam_questions for select using(public.current_role()='siswa' and exists(select 1 from public.exam_assignments a where a.exam_id=exam_questions.exam_id and a.student_id=auth.uid()));
create policy "staff manages exam assignments" on public.exam_assignments for all using(public.current_role() in('admin','guru')) with check(public.current_role() in('admin','guru'));
create policy "students read own assignments" on public.exam_assignments for select using(student_id=auth.uid());
create policy "students manage own attempts" on public.attempts for all using(student_id=auth.uid()) with check(student_id=auth.uid());
create policy "staff reads attempts" on public.attempts for select using(public.current_role() in('admin','guru'));
create policy "students manage own answers" on public.answers for all using(exists(select 1 from public.attempts a where a.id=attempt_id and a.student_id=auth.uid())) with check(exists(select 1 from public.attempts a where a.id=attempt_id and a.student_id=auth.uid()));
create policy "staff grades answers" on public.answers for all using(public.current_role() in('admin','guru')) with check(public.current_role() in('admin','guru'));
create policy "students log own integrity" on public.integrity_events for insert with check(student_id=auth.uid() or exists(select 1 from public.attempts a where a.id=attempt_id and a.student_id=auth.uid()));
create policy "staff reads integrity" on public.integrity_events for select using(public.current_role() in('admin','guru'));
create policy "staff reads audit logs" on public.audit_logs for select using(public.current_role() in('admin','guru'));

insert into public.academic_years(name,active) values('2026/2027',true);
insert into public.subjects(name,code) values('Matematika','MTK'),('IPA','IPA'),('Bahasa Indonesia','BIN'),('IPS','IPS');
