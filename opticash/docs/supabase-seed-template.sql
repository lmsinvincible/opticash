-- Replace __USER_ID__ with your auth.users.id

insert into public.connections (user_id, type, provider, label, meta)
values
('__USER_ID__','bank','tink','BNP - Compte courant','{"country":"FR"}');

insert into public.scans (user_id, status, summary)
values
('__USER_ID__','done','{"total_gain_estimated_yearly_cents":284000,"top_categories":["subscriptions","bank_fees"]}');

-- Get scan id and use it below
-- select id from public.scans where user_id='__USER_ID__' order by created_at desc limit 1;
