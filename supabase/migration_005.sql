create table if not exists pipeline_config (
  key   text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into pipeline_config (key, value) values
  ('collect_enabled',      'true'),
  ('generate_enabled',     'true'),
  ('generate_max_per_run', '1'),
  ('min_score',            '45')
on conflict (key) do nothing;
