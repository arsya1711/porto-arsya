-- Menyelesaikan alur ujian nyata setelah hardening dan pembuatan ujian atomik:
-- pembaruan hasil oleh guru, dan profil sekolah yang dapat dikelola Admin.

create table if not exists public.school_profile_settings (
  id smallint primary key default 1 check (id = 1),
  school_name text not null default 'Ruang Ujian',
  npsn text,
  address text,
  logo_url text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

insert into public.school_profile_settings(id, school_name)
values (1, 'Ruang Ujian')
on conflict (id) do nothing;

alter table public.school_profile_settings enable row level security;

drop policy if exists "authenticated reads school profile settings" on public.school_profile_settings;
create policy "authenticated reads school profile settings"
on public.school_profile_settings for select to authenticated
using (true);

drop policy if exists "admin manages school profile settings" on public.school_profile_settings;
create policy "admin manages school profile settings"
on public.school_profile_settings for all
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop trigger if exists school_profile_settings_touch_updated_at on public.school_profile_settings;
create trigger school_profile_settings_touch_updated_at
before update on public.school_profile_settings
for each row execute function public.touch_updated_at();

drop policy if exists "teachers update attempts for own exams" on public.attempts;
create policy "teachers update attempts for own exams"
on public.attempts for update
using(
  public.current_role() = 'guru'
  and public.teacher_owns_exam(attempts.exam_id)
)
with check(
  public.current_role() = 'guru'
  and public.teacher_owns_exam(attempts.exam_id)
);

create or replace function public.score_attempt_on_submit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  objective_points numeric(7,2) := 0;
  total_points numeric(7,2) := 0;
  has_essay boolean := false;
begin
  if new.status <> 'submitted' then
    return new;
  end if;

  -- Buat baris kosong untuk soal yang dilewati agar penilaian dan laporan
  -- tetap memperhitungkan seluruh bobot ujian.
  insert into public.answers(attempt_id, question_id)
  select new.id, exam_question.question_id
  from public.exam_questions exam_question
  where exam_question.exam_id = new.exam_id
  on conflict (attempt_id, question_id) do nothing;

  update public.answers answer
  set score = case
      when question.type = 'multiple_choice'
        and answer.selected_option = question.correct_option then question.weight
      when question.type = 'multiple_choice' then 0
      else answer.score
    end
  from public.questions question
  where answer.attempt_id = new.id
    and answer.question_id = question.id;

  select
    coalesce(sum(case when question.type = 'multiple_choice' then answer.score else 0 end), 0),
    coalesce(sum(question.weight), 0),
    coalesce(bool_or(question.type = 'essay'), false)
  into objective_points, total_points, has_essay
  from public.exam_questions exam_question
  join public.questions question on question.id = exam_question.question_id
  left join public.answers answer
    on answer.question_id = question.id and answer.attempt_id = new.id
  where exam_question.exam_id = new.exam_id;

  new.objective_score := objective_points;
  new.essay_score := 0;
  if has_essay then
    new.status := 'grading';
    new.final_score := null;
    new.finalized_at := null;
  else
    new.status := 'final';
    new.final_score := case when total_points > 0
      then round((objective_points / total_points) * 100, 2)
      else 0 end;
    new.finalized_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists attempts_score_on_submit on public.attempts;
create trigger attempts_score_on_submit
before update of status on public.attempts
for each row execute function public.score_attempt_on_submit();

-- Memproses pengumpulan lama yang masih berada pada status submitted.
update public.attempts
set status = 'submitted'
where status = 'submitted';

create index if not exists answers_attempt_question_score_idx
on public.answers(attempt_id, question_id, score);

create index if not exists attempts_exam_final_score_idx
on public.attempts(exam_id, final_score)
where status in ('grading', 'final');
