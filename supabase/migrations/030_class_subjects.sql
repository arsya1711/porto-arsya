-- Mata pelajaran tersedia per kelas, bukan lagi sebagai pilihan global.
-- Relasi lama dipertahankan dari penugasan guru dan ujian yang sudah ada.

create table public.class_subjects (
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (class_id, subject_id)
);

create index class_subjects_subject_id_idx
  on public.class_subjects(subject_id);

insert into public.class_subjects(class_id, subject_id)
select assignment.class_id, assignment.subject_id
from public.teacher_subjects assignment
where assignment.class_id is not null
  and assignment.subject_id is not null
union
select exam.class_id, exam.subject_id
from public.exams exam
where exam.class_id is not null
  and exam.subject_id is not null
on conflict (class_id, subject_id) do nothing;

-- Sebelum fitur ini tersedia, seluruh mata pelajaran bersifat global. Bila suatu
-- mata pelajaran belum pernah dipakai, pertahankan perilaku lama terlebih dahulu
-- agar Admin dapat mengatur ulang kelasnya dari halaman Mata Pelajaran.
insert into public.class_subjects(class_id, subject_id)
select classroom.id, subject.id
from public.classes classroom
cross join public.subjects subject
where not exists (
  select 1
  from public.class_subjects configured
  where configured.subject_id = subject.id
)
on conflict (class_id, subject_id) do nothing;

alter table public.class_subjects enable row level security;

create policy "authenticated reads class subjects"
on public.class_subjects for select
to authenticated
using (true);

create policy "admin manages class subjects"
on public.class_subjects for all
to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

alter table public.teacher_subjects
  add constraint teacher_subjects_class_subject_fk
  foreign key (class_id, subject_id)
  references public.class_subjects(class_id, subject_id)
  on delete restrict;

alter table public.exams
  add constraint exams_class_subject_fk
  foreign key (class_id, subject_id)
  references public.class_subjects(class_id, subject_id)
  on delete restrict;

create or replace function public.save_subject_with_classes(
  target_subject_id uuid,
  subject_name text,
  subject_code text,
  class_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_subject_id uuid;
  normalized_class_ids uuid[];
  invalid_class_count integer;
  blocked_classes text;
begin
  if public.current_role() <> 'admin' then
    raise exception 'Hanya admin yang dapat mengatur mata pelajaran';
  end if;

  if nullif(trim(subject_name), '') is null then
    raise exception 'Nama mata pelajaran wajib diisi';
  end if;

  select coalesce(array_agg(distinct selected_id), '{}'::uuid[])
  into normalized_class_ids
  from unnest(coalesce(class_ids, '{}'::uuid[])) selected_id
  where selected_id is not null;

  if cardinality(normalized_class_ids) = 0 then
    raise exception 'Pilih minimal satu kelas untuk mata pelajaran';
  end if;

  select count(*)::integer
  into invalid_class_count
  from unnest(normalized_class_ids) selected_id
  where not exists (
    select 1 from public.classes classroom where classroom.id = selected_id
  );

  if invalid_class_count > 0 then
    raise exception 'Terdapat kelas yang tidak valid';
  end if;

  if target_subject_id is null then
    insert into public.subjects(name, code)
    values (
      trim(subject_name),
      nullif(upper(trim(subject_code)), '')
    )
    returning id into saved_subject_id;
  else
    update public.subjects
    set name = trim(subject_name),
        code = nullif(upper(trim(subject_code)), '')
    where id = target_subject_id
    returning id into saved_subject_id;

    if saved_subject_id is null then
      raise exception 'Mata pelajaran tidak ditemukan';
    end if;
  end if;

  select string_agg(classroom.name, ', ' order by classroom.name)
  into blocked_classes
  from public.class_subjects configured
  join public.classes classroom on classroom.id = configured.class_id
  where configured.subject_id = saved_subject_id
    and not (configured.class_id = any(normalized_class_ids))
    and (
      exists (
        select 1 from public.teacher_subjects assignment
        where assignment.class_id = configured.class_id
          and assignment.subject_id = configured.subject_id
      )
      or exists (
        select 1 from public.exams exam
        where exam.class_id = configured.class_id
          and exam.subject_id = configured.subject_id
      )
    );

  if blocked_classes is not null then
    raise exception 'Mata pelajaran masih dipakai oleh penugasan atau ujian di kelas: %', blocked_classes;
  end if;

  delete from public.class_subjects configured
  where configured.subject_id = saved_subject_id
    and not (configured.class_id = any(normalized_class_ids));

  insert into public.class_subjects(class_id, subject_id)
  select selected_id, saved_subject_id
  from unnest(normalized_class_ids) selected_id
  on conflict (class_id, subject_id) do nothing;

  return saved_subject_id;
end;
$$;

revoke all on function public.save_subject_with_classes(uuid, text, text, uuid[])
  from public, anon;
grant execute on function public.save_subject_with_classes(uuid, text, text, uuid[])
  to authenticated;

drop trigger if exists class_subjects_audit_change on public.class_subjects;
create trigger class_subjects_audit_change
after insert or delete on public.class_subjects
for each row execute function public.audit_master_data_change();
