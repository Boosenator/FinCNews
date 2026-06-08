-- Inbound email log — кожен отриманий лист
create table if not exists inbound_email_logs (
  id           uuid        primary key default gen_random_uuid(),
  from_address text        not null,
  to_address   text        not null,
  subject      text,
  forwarded_to text,
  status       text        not null default 'forwarded' check (status in ('forwarded', 'skipped', 'failed')),
  skip_reason  text,
  received_at  timestamptz not null default now()
);

create index if not exists inbound_email_logs_received_at_idx on inbound_email_logs(received_at desc);
create index if not exists inbound_email_logs_to_address_idx  on inbound_email_logs(to_address);

-- Email routes — куди форвардити кожну адресу
-- recipient: mailbox name ("editorial", "ads") або "*" для catch-all
create table if not exists email_routes (
  id         uuid    primary key default gen_random_uuid(),
  recipient  text    not null unique,
  forward_to text    not null,
  label      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- Default routes (update forward_to via admin UI)
insert into email_routes (recipient, forward_to, label) values
  ('editorial', '',  'Editorial'),
  ('privacy',   '',  'Privacy'),
  ('legal',     '',  'Legal'),
  ('ads',       '',  'Ads'),
  ('tech',      '',  'Tech'),
  ('*',         '',  'Catch-all')
on conflict (recipient) do nothing;
