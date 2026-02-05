-- OptiCash: admin bypass for paywall
-- Run after base schema (supabase-schema.sql)

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Example: set a user as admin by email
update public.profiles
set is_admin = true
where email = 'lucasmattei84@icloud.com';
