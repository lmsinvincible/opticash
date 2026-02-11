-- OptiCash: profiles extended fields (V1)
-- Run after supabase-schema.sql

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists birth_date date,
  add column if not exists gender text,
  add column if not exists marital_status text,
  add column if not exists children_count integer not null default 0,
  add column if not exists postal_code text,
  add column if not exists phone text,
  add column if not exists city text,
  add column if not exists has_disability boolean not null default false,
  add column if not exists profession text,
  add column if not exists monthly_income_eur integer,
  add column if not exists commute_km_year integer,
  add column if not exists has_per boolean not null default false,
  add column if not exists has_assurance_vie boolean not null default false,
  add column if not exists has_pea boolean not null default false,
  add column if not exists avatar_url text,
  add column if not exists consent_rgpd boolean not null default false,
  add column if not exists profile_completed boolean not null default false,
  add column if not exists last_login_at timestamptz;

create index if not exists idx_profiles_postal_code on public.profiles (postal_code);
create index if not exists idx_profiles_profile_completed on public.profiles (profile_completed);
