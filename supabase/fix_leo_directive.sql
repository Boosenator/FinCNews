-- Fix: Leo Cruz's 2026-06-08 directive was auto-resolved by race condition bug
-- Restore it to pending so it takes effect on his next article

update editorial_directives
set status = 'pending', resolved_at = null
where persona_id = 'leo-cruz'
  and issued_date = '2026-06-08'
  and status = 'resolved'
  and resolved_at::date = '2026-06-08';

-- Verify
select persona_id, status, issued_date, left(directive, 100) as directive, resolved_at
from editorial_directives
where persona_id = 'leo-cruz'
order by issued_date desc;
