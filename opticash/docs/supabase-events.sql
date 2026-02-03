-- Events table for basic analytics tracking
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_events_user_created on public.events(user_id, created_at desc);

alter table public.events enable row level security;

drop policy if exists "events_select_own" on public.events;
create policy "events_select_own"
on public.events for select
using (user_id = auth.uid());

drop policy if exists "events_insert_own" on public.events;
create policy "events_insert_own"
on public.events for insert
with check (user_id = auth.uid());
