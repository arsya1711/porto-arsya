create extension if not exists pgcrypto;

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.restaurant_tables (
  id integer primary key,
  status text not null default 'available' check (status in ('available', 'occupied', 'reserved')),
  detail text,
  updated_at timestamptz not null default now()
);

create table if not exists public.promos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('persentase', 'nominal')),
  value numeric(12,2) not null check (value > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  table_number integer references public.restaurant_tables(id),
  items jsonb not null default '[]'::jsonb,
  subtotal bigint not null check (subtotal >= 0),
  tax bigint not null default 0 check (tax >= 0),
  service_charge bigint not null default 0 check (service_charge >= 0),
  total bigint not null check (total >= 0),
  payment_method text not null check (payment_method in ('tunai', 'qris', 'debit', 'ewallet', 'transfer')),
  received_amount bigint not null default 0 check (received_amount >= 0),
  status text not null default 'paid' check (status in ('open', 'paid', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  starting_cash bigint not null default 0,
  ending_cash bigint,
  status text not null default 'open' check (status in ('open', 'closed')),
  notes text,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid references public.shifts(id) on delete cascade,
  type text not null check (type in ('in', 'out')),
  amount bigint not null check (amount > 0),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.cashier_security (
  id boolean primary key default true check (id),
  pin_hash text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.promos enable row level security;
alter table public.orders enable row level security;
alter table public.shifts enable row level security;
alter table public.cash_movements enable row level security;
alter table public.cashier_security enable row level security;

-- Policies below make the single-outlet web app usable with the anon key.
-- Before deploying a multi-outlet product, replace these with user/outlet-scoped policies.
create policy "pos read settings" on public.app_settings for select to anon, authenticated using (true);
create policy "pos write settings" on public.app_settings for all to anon, authenticated using (true) with check (true);
create policy "pos read tables" on public.restaurant_tables for select to anon, authenticated using (true);
create policy "pos write tables" on public.restaurant_tables for all to anon, authenticated using (true) with check (true);
create policy "pos manage promos" on public.promos for all to anon, authenticated using (true) with check (true);
create policy "pos manage orders" on public.orders for all to anon, authenticated using (true) with check (true);
create policy "pos manage shifts" on public.shifts for all to anon, authenticated using (true) with check (true);
create policy "pos manage cash" on public.cash_movements for all to anon, authenticated using (true) with check (true);

create or replace function public.update_cashier_pin(new_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN harus 4 digit';
  end if;
  insert into public.cashier_security(id, pin_hash, updated_at)
  values (true, crypt(new_pin, gen_salt('bf')), now())
  on conflict (id) do update set pin_hash = excluded.pin_hash, updated_at = now();
end;
$$;

revoke all on function public.update_cashier_pin(text) from public;
grant execute on function public.update_cashier_pin(text) to anon, authenticated;

insert into public.restaurant_tables (id, status, detail) values
  (1, 'available', null), (2, 'occupied', '3 tamu'), (3, 'available', null),
  (4, 'reserved', '19.00'), (5, 'available', null), (6, 'occupied', '2 tamu'),
  (7, 'available', null), (8, 'occupied', '5 tamu'), (9, 'available', null),
  (10, 'available', null), (11, 'available', null), (12, 'available', null)
on conflict (id) do nothing;

insert into public.promos (name, type, value, active)
select 'Diskon Pembukaan', 'persentase', 10, true
where not exists (select 1 from public.promos);

