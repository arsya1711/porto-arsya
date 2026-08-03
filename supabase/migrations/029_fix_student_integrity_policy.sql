-- Policy lama melakukan subquery langsung ke exams. Karena siswa sengaja tidak
-- memiliki policy SELECT pada exams, subquery tersebut selalu kosong dan event
-- integritas yang sah ditolak oleh RLS.

create or replace function public.can_record_student_integrity_event(
  target_attempt_id uuid,
  target_student_id uuid,
  target_event_type text,
  target_metadata jsonb
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    target_student_id = auth.uid()
    and target_event_type in (
      'tab_hidden',
      'app_backgrounded',
      'fullscreen_exit',
      'copy',
      'paste',
      'reconnect'
    )
    and octet_length(coalesce(target_metadata, '{}'::jsonb)::text) <= 4096
    and exists(
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
        and exam.record_tab_switches
        and now() >= exam.starts_at
        and now() <= least(
          attempt.started_at + make_interval(mins => exam.duration_minutes),
          coalesce(exam.ends_at, 'infinity'::timestamptz)
        )
    );
$$;

revoke all on function public.can_record_student_integrity_event(
  uuid, uuid, text, jsonb
) from public, anon;
grant execute on function public.can_record_student_integrity_event(
  uuid, uuid, text, jsonb
) to authenticated;

drop policy if exists "students log active integrity"
  on public.integrity_events;
create policy "students log active integrity"
on public.integrity_events for insert
to authenticated
with check (
  public.can_record_student_integrity_event(
    attempt_id,
    student_id,
    event_type,
    metadata
  )
);
