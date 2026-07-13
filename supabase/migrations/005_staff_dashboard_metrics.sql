create or replace function public.get_staff_dashboard_metrics()
returns table(
  active_students bigint,
  classes bigint,
  teachers bigint,
  questions bigint,
  banks bigint,
  pending_grading bigint,
  incidents bigint,
  participants bigint
)
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  requested_by uuid := auth.uid();
  requested_role public.user_role := public.current_role();
begin
  if requested_role not in ('admin', 'guru') then
    raise exception 'Dashboard staf hanya dapat diakses admin atau guru';
  end if;

  return query
  select
    (select count(*) from public.profiles p where p.role='siswa' and p.active),
    (select count(*) from public.classes),
    (select count(*) from public.profiles p where p.role='guru' and p.active),
    (select count(*) from public.questions q
      where not q.archived and (requested_role='admin' or q.created_by=requested_by)),
    (select count(*) from public.question_banks qb
      where requested_role='admin' or qb.owner_id=requested_by),
    (select count(*) from public.attempts a
      join public.exams e on e.id=a.exam_id
      where a.status in ('submitted','grading')
        and (requested_role='admin' or e.created_by=requested_by)),
    (select count(*) from public.integrity_events ie
      left join public.attempts a on a.id=ie.attempt_id
      left join public.exams e on e.id=a.exam_id
      where ie.occurred_at >= now() - interval '7 days'
        and (requested_role='admin' or e.created_by=requested_by)),
    (select count(*) from public.exam_assignments ea
      join public.exams e on e.id=ea.exam_id
      where requested_role='admin' or e.created_by=requested_by);
end;
$$;

revoke all on function public.get_staff_dashboard_metrics() from public;
grant execute on function public.get_staff_dashboard_metrics() to authenticated;
