-- OptiCash: plan_items usage questions fields
-- Run after base schema (supabase-schema.sql)

alter table public.plan_items
  add column if not exists has_usage_questions boolean not null default false,
  add column if not exists usage_context jsonb not null default '{}'::jsonb,
  add column if not exists usage_answers jsonb not null default '{}'::jsonb,
  add column if not exists usage_alternatives jsonb not null default '[]'::jsonb,
  add column if not exists usage_refined boolean not null default false;

create index if not exists idx_plan_items_usage_questions
  on public.plan_items (has_usage_questions);
