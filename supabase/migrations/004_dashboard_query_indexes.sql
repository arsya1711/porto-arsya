create index if not exists class_students_student_id_idx
  on public.class_students(student_id);

create index if not exists exam_assignments_student_id_idx
  on public.exam_assignments(student_id);

create index if not exists exams_created_by_starts_at_idx
  on public.exams(created_by, starts_at desc);

create index if not exists attempts_student_id_status_idx
  on public.attempts(student_id, status);

create index if not exists attempts_exam_id_status_idx
  on public.attempts(exam_id, status);

create index if not exists integrity_events_occurred_at_idx
  on public.integrity_events(occurred_at desc);

create index if not exists integrity_events_attempt_id_occurred_at_idx
  on public.integrity_events(attempt_id, occurred_at desc);

create index if not exists audit_logs_created_at_idx
  on public.audit_logs(created_at desc);
