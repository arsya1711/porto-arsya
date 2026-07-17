create or replace function public.submit_exam_attempt(target_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  objective_points numeric := 0;
  total_points numeric := 0;
  has_essay boolean := false;
  current_status public.attempt_status;
begin
  select status into current_status
  from public.attempts
  where id = target_attempt_id and student_id = auth.uid()
  for update;

  if current_status is null then
    raise exception 'Attempt tidak ditemukan atau bukan milik siswa';
  end if;
  if current_status <> 'in_progress' then
    raise exception 'Attempt sudah dikumpulkan dan tidak dapat diubah';
  end if;

  select
    coalesce(sum(case when q.type = 'multiple_choice' and a.selected_option = q.correct_option then q.weight else 0 end), 0),
    coalesce(sum(q.weight), 0),
    bool_or(q.type = 'essay')
  into objective_points, total_points, has_essay
  from public.attempts at
  join public.exam_questions eq on eq.exam_id = at.exam_id
  join public.questions q on q.id = eq.question_id
  left join public.answers a on a.attempt_id = at.id and a.question_id = q.id
  where at.id = target_attempt_id;

  update public.attempts
  set objective_score = objective_points,
      status = case when coalesce(has_essay, false) then 'submitted' else 'final' end,
      submitted_at = now(),
      final_score = case when not coalesce(has_essay, false) and total_points > 0
        then round(objective_points / total_points * 100, 2) else null end,
      finalized_at = case when not coalesce(has_essay, false) then now() else null end
  where id = target_attempt_id;
end;
$$;

grant execute on function public.submit_exam_attempt(uuid) to authenticated;

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
  max_weight numeric;
  total_points numeric;
  earned_points numeric;
  pending_essays integer;
begin
  select a.attempt_id, q.weight
  into target_attempt_id, max_weight
  from public.answers a
  join public.questions q on q.id = a.question_id
  where a.id = target_answer_id and q.type = 'essay';

  if target_attempt_id is null or not public.teacher_owns_attempt(target_attempt_id) then
    raise exception 'Jawaban tidak ditemukan atau tidak dapat dinilai';
  end if;
  if awarded_score < 0 or awarded_score > max_weight then
    raise exception 'Skor harus berada antara 0 dan bobot soal';
  end if;

  update public.answers
  set score = awarded_score, teacher_comment = nullif(trim(feedback), '')
  where id = target_answer_id;

  select count(*) into pending_essays
  from public.exam_questions eq
  join public.attempts at on at.exam_id = eq.exam_id
  join public.questions q on q.id = eq.question_id and q.type = 'essay'
  left join public.answers a on a.attempt_id = at.id and a.question_id = q.id
  where at.id = target_attempt_id and a.score is null;

  select coalesce(sum(q.weight), 0),
         coalesce(sum(case
           when q.type = 'multiple_choice' and a.selected_option = q.correct_option then q.weight
           when q.type = 'essay' then coalesce(a.score, 0)
           else 0 end), 0)
  into total_points, earned_points
  from public.attempts at
  join public.exam_questions eq on eq.exam_id = at.exam_id
  join public.questions q on q.id = eq.question_id
  left join public.answers a on a.attempt_id = at.id and a.question_id = q.id
  where at.id = target_attempt_id;

  update public.attempts
  set essay_score = earned_points - coalesce(objective_score, 0),
      status = case when pending_essays = 0 then 'final' else 'grading' end,
      final_score = case when pending_essays = 0 and total_points > 0
        then round(earned_points / total_points * 100, 2) else null end,
      finalized_at = case when pending_essays = 0 then now() else null end
  where id = target_attempt_id;
end;
$$;

grant execute on function public.grade_essay_answer(uuid, numeric, text) to authenticated;
