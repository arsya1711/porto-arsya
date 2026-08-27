-- RLS policies call this SECURITY DEFINER helper directly. Migration 023
-- revoked PUBLIC execution, so restore access for roles that can reach RLS.
grant execute on function public.teacher_owns_exam(uuid)
  to anon, authenticated;