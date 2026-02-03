-- Enable extensions (uuid + crypto)
create extension if not exists "pgcrypto";

-- 1) PROFILES
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- 2) CONNECTIONS
create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('bank','csv','pdf','manual')),
  provider text,
  label text,
  status text not null default 'active' check (status in ('active','revoked','error')),
  last_synced_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_connections_user_id on public.connections(user_id);

-- 3) SCANS
create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  connection_id uuid references public.connections(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  started_at timestamptz,
  finished_at timestamptz,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_scans_user_id on public.scans(user_id);
create index if not exists idx_scans_connection_id on public.scans(connection_id);

-- 4) FINDINGS
create table if not exists public.findings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  scan_id uuid not null references public.scans(id) on delete cascade,
  category text not null check (category in ('bank_fees','subscriptions','insurance','tax','utilities','other')),
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open','snoozed','resolved')),
  confidence numeric not null default 0.8 check (confidence >= 0 and confidence <= 1),
  gain_estimated_yearly_cents bigint not null default 0 check (gain_estimated_yearly_cents >= 0),
  effort_minutes integer not null default 10 check (effort_minutes >= 0),
  risk_level text not null default 'low' check (risk_level in ('low','medium','high')),
  explain jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_findings_user_id on public.findings(user_id);
create index if not exists idx_findings_scan_id on public.findings(scan_id);
create index if not exists idx_findings_category on public.findings(category);
create index if not exists idx_findings_status on public.findings(status);

-- 5) EVIDENCE
create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  finding_id uuid not null references public.findings(id) on delete cascade,
  source text not null check (source in ('bank_transaction','pdf_line','csv_row','manual')),
  occurred_at date,
  amount_cents bigint,
  currency text not null default 'EUR',
  merchant text,
  raw_label text,
  reference text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_evidence_user_id on public.evidence(user_id);
create index if not exists idx_evidence_finding_id on public.evidence(finding_id);

-- 6) PLANS
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  scan_id uuid not null references public.scans(id) on delete cascade,
  title text not null default 'Ton plan OptiCash',
  total_gain_estimated_yearly_cents bigint not null default 0 check (total_gain_estimated_yearly_cents >= 0),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_plans_unique_scan on public.plans(scan_id);
create index if not exists idx_plans_user_id on public.plans(user_id);

-- 7) PLAN_ITEMS
create table if not exists public.plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete cascade,
  finding_id uuid references public.findings(id) on delete set null,
  position integer not null default 1 check (position >= 1),
  action_title text not null,
  action_steps jsonb not null default '[]'::jsonb,
  gain_estimated_yearly_cents bigint not null default 0 check (gain_estimated_yearly_cents >= 0),
  effort_minutes integer not null default 10 check (effort_minutes >= 0),
  risk_level text not null default 'low' check (risk_level in ('low','medium','high')),
  priority_score numeric not null default 1.0 check (priority_score >= 0),
  status text not null default 'todo' check (status in ('todo','doing','done','skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_plan_items_user_id on public.plan_items(user_id);
create index if not exists idx_plan_items_plan_id on public.plan_items(plan_id);
create index if not exists idx_plan_items_status on public.plan_items(status);

-- =========================
-- RLS (Row Level Security)
-- =========================
alter table public.profiles enable row level security;
alter table public.connections enable row level security;
alter table public.scans enable row level security;
alter table public.findings enable row level security;
alter table public.evidence enable row level security;
alter table public.plans enable row level security;
alter table public.plan_items enable row level security;

-- PROFILES policies
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

-- CONNECTIONS policies
drop policy if exists "connections_crud_own" on public.connections;
create policy "connections_crud_own"
on public.connections for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- SCANS policies
drop policy if exists "scans_crud_own" on public.scans;
create policy "scans_crud_own"
on public.scans for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- FINDINGS policies
drop policy if exists "findings_crud_own" on public.findings;
create policy "findings_crud_own"
on public.findings for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- EVIDENCE policies
drop policy if exists "evidence_crud_own" on public.evidence;
create policy "evidence_crud_own"
on public.evidence for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- PLANS policies
drop policy if exists "plans_crud_own" on public.plans;
create policy "plans_crud_own"
on public.plans for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- PLAN_ITEMS policies
drop policy if exists "plan_items_crud_own" on public.plan_items;
create policy "plan_items_crud_own"
on public.plan_items for all
using (user_id = auth.uid())
with check (user_id = auth.uid());
