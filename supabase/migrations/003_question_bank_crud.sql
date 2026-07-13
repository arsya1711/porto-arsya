alter table public.question_banks
  add column if not exists updated_at timestamptz not null default now();

alter table public.questions
  add column if not exists updated_at timestamptz not null default now();

alter table public.question_banks
  alter column owner_id set default auth.uid();

alter table public.questions
  alter column created_by set default auth.uid();

create index if not exists question_banks_subject_id_idx
  on public.question_banks(subject_id);
create index if not exists question_banks_owner_id_idx
  on public.question_banks(owner_id);
create index if not exists questions_bank_active_idx
  on public.questions(bank_id, archived, created_at desc);
create index if not exists questions_created_by_idx
  on public.questions(created_by);

drop trigger if exists question_banks_touch_updated_at on public.question_banks;
create trigger question_banks_touch_updated_at
before update on public.question_banks
for each row execute function public.touch_updated_at();

drop trigger if exists questions_touch_updated_at on public.questions;
create trigger questions_touch_updated_at
before update on public.questions
for each row execute function public.touch_updated_at();

create or replace function public.sync_question_usage_count()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op = 'INSERT' then
    update public.questions
      set usage_count = usage_count + 1
      where id = new.question_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.questions
      set usage_count = greatest(usage_count - 1, 0)
      where id = old.question_id;
    return old;
  elsif new.question_id is distinct from old.question_id then
    update public.questions
      set usage_count = greatest(usage_count - 1, 0)
      where id = old.question_id;
    update public.questions
      set usage_count = usage_count + 1
      where id = new.question_id;
  end if;
  return new;
end;
$$;

update public.questions q
set usage_count = (
  select count(*)::integer
  from public.exam_questions eq
  where eq.question_id = q.id
);

drop trigger if exists exam_questions_sync_usage_count
  on public.exam_questions;
create trigger exam_questions_sync_usage_count
after insert or update of question_id or delete on public.exam_questions
for each row execute function public.sync_question_usage_count();
