-- Uploads table for CSV import V1
create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'csv' check (kind in ('csv')),
  storage_path text not null,
  original_name text,
  status text not null default 'uploaded' check (status in ('uploaded','parsed','failed')),
  columns jsonb not null default '[]'::jsonb,
  preview jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_uploads_user_id on public.uploads(user_id);
create index if not exists idx_uploads_status on public.uploads(status);

alter table public.uploads enable row level security;

drop policy if exists "uploads_crud_own" on public.uploads;
create policy "uploads_crud_own"
on public.uploads for all
using (user_id = auth.uid())
with check (user_id = auth.uid());
