-- Detailed step-by-step pipeline logs
alter table run_logs add column if not exists steps jsonb;
alter table run_logs add column if not exists run_type text not null default 'generate';
