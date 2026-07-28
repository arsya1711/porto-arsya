-- Login massal dari jaringan sekolah umumnya berbagi satu IP publik. Percobaan
-- yang berhasil harus segera dikeluarkan dari jendela pembatas, dan batas IP
-- harus cukup besar agar satu ruang ujian tidak saling mengunci.

create or replace function public.reserve_student_login_attempt(
  target_nis_hash text,
  target_ip_hash text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  nis_attempts integer;
  ip_attempts integer := 0;
begin
  if target_nis_hash !~ '^[0-9a-f]{64}$'
     or (
       target_ip_hash is not null
       and target_ip_hash !~ '^[0-9a-f]{64}$'
     ) then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('nis:' || target_nis_hash, 0));
  if target_ip_hash is not null then
    perform pg_advisory_xact_lock(hashtextextended('ip:' || target_ip_hash, 0));
  end if;

  delete from public.student_login_attempts
  where attempted_at < now() - interval '24 hours'
    and (
      nis_hash = target_nis_hash
      or (target_ip_hash is not null and ip_hash = target_ip_hash)
    );
  if random() < 0.01 then
    delete from public.student_login_attempts
    where attempted_at < now() - interval '24 hours';
  end if;

  select count(*) into nis_attempts
  from public.student_login_attempts
  where nis_hash = target_nis_hash
    and attempted_at >= now() - interval '15 minutes';

  if target_ip_hash is not null then
    select count(*) into ip_attempts
    from public.student_login_attempts
    where ip_hash = target_ip_hash
      and attempted_at >= now() - interval '15 minutes';
  end if;

  -- Batas NIS menahan brute-force akun tertentu. Batas IP hanya menjadi rem
  -- serangan besar; 500 tetap mengizinkan login serentak dari NAT sekolah.
  if nis_attempts >= 8 or ip_attempts >= 500 then
    return false;
  end if;

  insert into public.student_login_attempts(nis_hash, ip_hash)
  values(target_nis_hash, target_ip_hash);
  return true;
end;
$$;

revoke all on function public.reserve_student_login_attempt(text, text)
  from public, anon, authenticated;
grant execute on function public.reserve_student_login_attempt(text, text)
  to service_role;

create or replace function public.clear_student_login_attempts(
  target_nis_hash text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_nis_hash !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('nis:' || target_nis_hash, 0));
  delete from public.student_login_attempts
  where nis_hash = target_nis_hash;
end;
$$;

revoke all on function public.clear_student_login_attempts(text)
  from public, anon, authenticated;
grant execute on function public.clear_student_login_attempts(text)
  to service_role;
