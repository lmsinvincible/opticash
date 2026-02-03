-- Stripe fields for premium tracking
alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists is_premium boolean not null default false,
  add column if not exists premium_until timestamptz;
