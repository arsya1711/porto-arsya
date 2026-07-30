-- Mencegah sekolah kehilangan seluruh akses administrator, termasuk ketika
-- penghapusan berasal dari cascade auth.users atau operasi service role.
create or replace function public.prevent_last_active_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  removes_active_admin boolean := false;
begin
  if old.role = 'admin' and old.active then
    if tg_op = 'DELETE' then
      removes_active_admin := true;
    elsif tg_op = 'UPDATE' then
      removes_active_admin := new.role <> 'admin' or not new.active;
    end if;
  end if;

  if removes_active_admin then
    perform pg_advisory_xact_lock(hashtextextended('awexam:last-active-admin', 0));
    if not exists (
      select 1
      from public.profiles profile
      where profile.id <> old.id
        and profile.role = 'admin'
        and profile.active
    ) then
      raise exception 'Minimal satu administrator aktif harus dipertahankan';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_last_active_admin() from public;

drop trigger if exists profiles_protect_last_active_admin on public.profiles;
create trigger profiles_protect_last_active_admin
before update of role, active or delete on public.profiles
for each row execute function public.prevent_last_active_admin();
