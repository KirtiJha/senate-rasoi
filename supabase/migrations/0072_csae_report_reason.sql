-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0072: explicit child-safety (CSAE) report reason
-- Run AFTER 0001–0071.
--
-- Google Play's Child Safety Standards policy requires an in-app mechanism for
-- users to report child sexual abuse and exploitation. 0068 shipped generic
-- reasons ('adult', 'illegal', 'other') which technically allow it, but a
-- reviewer looking for a CSAE reporting path should find one named as such —
-- and our published standards page at /child-safety tells users to pick it.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════

alter table public.content_reports
  drop constraint if exists content_reports_reason_check;

alter table public.content_reports
  add constraint content_reports_reason_check
  check (reason in (
    'csae',        -- child sexual abuse & exploitation — triaged ahead of all else
    'spam', 'harassment', 'hate', 'scam',
    'adult', 'violence', 'illegal', 'other'
  ));

-- Child-safety reports must stand out in the admin queue, so give admins a
-- distinctly-worded notification rather than the generic "Content reported".
create or replace function public.on_content_report_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin  record;
  v_title  text;
  v_body   text;
begin
  if new.reason = 'csae' then
    v_title := '🚨 URGENT: child-safety report';
    v_body  := 'A ' || new.target_type || ' was reported for child safety. Review immediately.';
  else
    v_title := '🚩 Content reported';
    v_body  := 'A ' || new.target_type || ' was reported for ' || new.reason || '.';
  end if;

  for v_admin in
    select id from public.profiles
     where community_id = new.community_id
       and 'admin' = any(coalesce(roles, '{}'))
  loop
    insert into public.notifications (
      community_id, type, entity_id, actor_id,
      target_user_id, title, body, route
    ) values (
      new.community_id, 'report', new.id, new.reporter_id,
      v_admin.id, v_title, v_body, '/admin?tab=reports'
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists content_report_notify on public.content_reports;
create trigger content_report_notify
  after insert on public.content_reports
  for each row execute function public.on_content_report_insert();
