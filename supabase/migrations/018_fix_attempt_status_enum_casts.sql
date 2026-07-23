-- CASE dengan literal teks menghasilkan tipe `text`, sedangkan attempts.status
-- memakai enum attempt_status. PostgreSQL tidak melakukan cast implisit pada
-- assignment ini, sehingga submit ujian dan finalisasi koreksi essay gagal
-- dengan SQLSTATE 42804. Cast seluruh hasil CASE secara eksplisit.

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
    coalesce(sum(case
      when question.type = 'multiple_choice'
        and answer.selected_option = question.correct_option
        then question.weight
      else 0
    end), 0),
    coalesce(sum(question.weight), 0),
    bool_or(question.type = 'essay')
  into objective_points, total_points, has_essay
  from public.attempts attempt
  join public.exam_questions exam_question
    on exam_question.exam_id = attempt.exam_id
  join public.questions question on question.id = exam_question.question_id
  left join public.answers answer
    on answer.attempt_id = attempt.id
    and answer.question_id = question.id
  where attempt.id = target_attempt_id;

  update public.attempts
  set objective_score = objective_points,
      status = (
        case when coalesce(has_essay, false)
          then 'submitted'
          else 'final'
        end
      )::public.attempt_status,
      submitted_at = now(),
      final_score = case
        when not coalesce(has_essay, false) and total_points > 0
          then round(objective_points / total_points * 100, 2)
        else null
      end,
      finalized_at = case
        when not coalesce(has_essay, false) then now()
        else null
      end
  where id = target_attempt_id;
end;
$$;

revoke all on function public.submit_exam_attempt(uuid) from public, anon;
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
        and answer.selected_option = question.correct_option
        then question.weight
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
      status = (
        case when pending_essays = 0
          then 'final'
          else 'grading'
        end
      )::public.attempt_status,
      final_score = case
        when pending_essays = 0 and total_points > 0
          then round(earned_points / total_points * 100, 2)
        else null
      end,
      finalized_at = case
        when pending_essays = 0 then now()
        else null
      end
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
