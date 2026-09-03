-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0109: report notices name the thing, not the column
-- Run AFTER 0001–0108. Safe to re-run.
--
-- The admin notice concatenated the raw enum values: "A lost_found was
-- reported for other." Now that a resident can flag their own directory
-- listing, that would read "A directory_entry was reported for other", which
-- tells an admin neither what was flagged nor that somebody is asking to be
-- taken out of the roster.
--
-- Same trigger, same rows — the strings are written for a person now.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.on_content_report_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_admin  record;
  v_what   text;
  v_why    text;
  v_title  text;
  v_body   text;
begin
  v_what := case new.target_type
    when 'post'            then 'post'
    when 'comment'         then 'comment'
    when 'listing'         then 'listing'
    when 'dish'            then 'dish'
    when 'borrow'          then 'borrowed item'
    when 'lost_found'      then 'lost & found post'
    when 'recommend'       then 'recommendation'
    when 'property'        then 'property listing'
    when 'place'           then 'nearby place'
    when 'message'         then 'conversation'
    when 'profile'         then 'member profile'
    when 'directory_entry' then 'directory listing'
    else new.target_type
  end;

  v_why := case new.reason
    when 'csae'       then 'child safety'
    when 'spam'       then 'spam'
    when 'harassment' then 'harassment'
    when 'hate'       then 'hate speech'
    when 'scam'       then 'a scam'
    when 'adult'      then 'adult content'
    when 'violence'   then 'violence'
    when 'illegal'    then 'illegal goods'
    else 'review'
  end;

  if new.reason = 'csae' then
    v_title := '🚨 URGENT: child-safety report';
    v_body  := 'A ' || v_what || ' was reported for child safety. Review immediately.';
  elsif new.target_type = 'directory_entry' then
    -- Not abuse: somebody is asking to be corrected or taken off the roster.
    v_title := '🏠 Directory listing flagged';
    v_body  := coalesce(nullif(split_part(new.details, E'\n', 1), ''),
                        'A resident flagged their directory listing.');
  else
    v_title := '🚩 Content reported';
    v_body  := 'A ' || v_what || ' was reported for ' || v_why || '.';
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
