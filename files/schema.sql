-- Sri Balaji Serene - Community Event & Fund Portal (Supabase / PostgreSQL)

create extension if not exists "pgcrypto";

create type event_status as enum ('active', 'settled');
create type pay_mode as enum ('UPI', 'Cash');
create type pay_status as enum ('Pending', 'Verified', 'Rejected');

create table events (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  target_budget numeric(12,2) not null check (target_budget >= 0),
  start_date date not null,
  end_date date not null,
  status event_status not null default 'active',
  total_raised numeric(12,2),
  total_spent numeric(12,2),
  settled_at timestamptz,
  created_at timestamptz default now()
);

create unique index one_active_event on events ((status)) where status = 'active';

create table donations (
  id text primary key default gen_random_uuid()::text,
  event_id text not null references events(id) on delete cascade,
  flat_no text not null,
  resident_name text,
  amount numeric(12,2) not null check (amount > 0),
  mode pay_mode not null,
  status pay_status not null default 'Verified',
  utr text,
  donated_on date not null default current_date,
  created_at timestamptz default now()
);
create index on donations (event_id, flat_no);

create table expenses (
  id text primary key default gen_random_uuid()::text,
  event_id text not null references events(id) on delete cascade,
  category text not null,
  description text not null,
  vendor text,
  amount numeric(12,2) not null check (amount > 0),
  receipt_path text,
  receipt_url text,
  spent_on date not null default current_date,
  created_at timestamptz default now()
);

create table pending_payments (
  id text primary key default gen_random_uuid()::text,
  event_id text references events(id) on delete cascade,
  flat_no text not null,
  resident_name text not null,
  amount numeric(12,2) not null check (amount > 0),
  utr text not null,
  reference_no text,
  screenshot_path text,
  screenshot_url text,
  status pay_status not null default 'Pending',
  is_verified boolean not null default false,
  submitted_at timestamptz default now()
);

create table reserve_fund (
  id text primary key default gen_random_uuid()::text,
  event_id text references events(id),
  delta numeric(12,2) not null,
  note text,
  created_at timestamptz default now()
);
create view reserve_balance as select coalesce(sum(delta),0) as balance from reserve_fund;

create or replace function settle_event(p_event text) returns numeric
language plpgsql security definer as $$
declare r numeric; s numeric; net numeric;
begin
  select coalesce(sum(amount),0) into r from donations where event_id = p_event and status = 'Verified';
  select coalesce(sum(amount),0) into s from expenses where event_id = p_event;
  net := r - s;
  update events set status='settled', total_raised=r, total_spent=s, settled_at=now() where id = p_event and status='active';
  if not found then raise exception 'Event not active'; end if;
  insert into reserve_fund(event_id, delta, note) values (p_event, net, 'Event settlement');
  return net;
end $$;

create or replace function approve_payment(p_id text) returns void
language plpgsql security definer as $$
begin
  insert into donations(event_id, flat_no, resident_name, amount, mode, status, utr)
  select event_id, flat_no, resident_name, amount, 'UPI', 'Verified', utr from pending_payments where id = p_id and status='Pending';
  update pending_payments set status='Verified' where id = p_id;
end $$;

create or replace function is_organizer() returns boolean language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'organizer'
$$;

alter table events enable row level security;
alter table donations enable row level security;
alter table expenses enable row level security;
alter table pending_payments enable row level security;
alter table reserve_fund enable row level security;

create policy "read events" on events for select using (true);
create policy "read verified donations" on donations for select using (status = 'Verified' or is_organizer());
create policy "read expenses" on expenses for select using (true);
create policy "read reserve" on reserve_fund for select using (true);
create policy "submit proof" on pending_payments for insert with check (status = 'Pending');
create policy "organizer queue" on pending_payments for select using (is_organizer());
create policy "organizer update queue" on pending_payments for update using (is_organizer());
create policy "org write events" on events for all using (is_organizer()) with check (is_organizer());
create policy "org write donations" on donations for all using (is_organizer()) with check (is_organizer());
create policy "org write expenses" on expenses for all using (is_organizer()) with check (is_organizer());
create policy "org write reserve" on reserve_fund for all using (is_organizer()) with check (is_organizer());

-- Public demo mode: allow the browser anon key to create ledger entries and review all transparency data.
create policy "anon insert events" on events for insert with check (true);
create policy "anon insert donations" on donations for insert with check (true);
create policy "anon insert expenses" on expenses for insert with check (true);
create policy "anon read pending" on pending_payments for select using (true);
create policy "anon insert pending" on pending_payments for insert with check (true);
create policy "anon update pending" on pending_payments for update using (true) with check (true);
create policy "anon write reserve" on reserve_fund for insert with check (true);

insert into storage.buckets (id, name, public) values ('receipts','receipts',true), ('proofs','proofs',true) on conflict do nothing;

create policy "public read receipts" on storage.objects for select using (bucket_id='receipts');
create policy "public read proofs" on storage.objects for select using (bucket_id='proofs');
create policy "public upload receipts" on storage.objects for insert with check (bucket_id='receipts');
create policy "public upload proofs" on storage.objects for insert with check (bucket_id='proofs');
create policy "public update receipts" on storage.objects for update using (bucket_id='receipts') with check (bucket_id='receipts');
create policy "public update proofs" on storage.objects for update using (bucket_id='proofs') with check (bucket_id='proofs');
create policy "public delete receipts" on storage.objects for delete using (bucket_id='receipts');
create policy "public delete proofs" on storage.objects for delete using (bucket_id='proofs');

insert into reserve_fund(delta, note) values (18500, 'Opening balance');
