-- OptiCash: Impôts Boost V1
-- Run after base schema (supabase-schema.sql)

alter table public.scans
  add column if not exists tax_answers jsonb not null default '{}'::jsonb,
  add column if not exists tax_generated boolean not null default false;

alter table public.plan_items
  add column if not exists category text not null default 'general',
  add column if not exists proof text,
  add column if not exists reasoning jsonb not null default '[]'::jsonb;

create index if not exists idx_plan_items_category
  on public.plan_items (category);
