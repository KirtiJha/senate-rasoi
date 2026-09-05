-- One search across the society.
--
-- The Search screen used to download the whole society on open — every
-- resident, three hundred posts, two hundred listings, every dish, tiffin,
-- group and document — and score it in JavaScript. Seven requests and a
-- few hundred kilobytes before the first letter was typed, and four whole
-- tiles (Borrow, Lost & Found, Nearby, Ask & Recommend) it never searched
-- at all.
--
-- This is the search as one question to the database: a ranked list across
-- every tile, trigram-tolerant of a misspelt name ("kalyni" finds Kalyani),
-- honouring row-level security because it runs as the caller.
--
-- Ranking: a word in the title outranks the same word buried in an address
-- or description, so "hospital" lists Blossom Hospital before the biryani
-- place that happens to be opposite one.
--
-- Dishes are materialised one row per serve date, so they are collapsed to
-- one per (name, chef) — soonest serving — or "Butter Chicken" answers
-- three times.

create extension if not exists pg_trgm;

create or replace function public.search_society(p_community uuid, p_q text, p_limit int default 40)
returns table (kind text, id uuid, title text, subtitle text, route text, rank real)
language sql stable security invoker set search_path = public as $fn$
  with q as (select lower(btrim(p_q)) as t),
  hits as (
    select 'resident'::text kind, p.id, p.name title,
           concat_ws(' · ', case when p.flat is not null then 'Flat ' || coalesce(p.block || '-', '') || p.flat end, p.profession, p.resident_type) subtitle,
           '/profile/' || p.id route,
           greatest(similarity(p.name, q.t), word_similarity(q.t, p.name), 0.85 * word_similarity(q.t, concat_ws(' ', p.name, p.flat, p.block, p.profession, p.vehicle_no))) rank
      from public.profiles p, q
     where p.community_id = p_community and coalesce(p.show_in_directory, true)
       and (concat_ws(' ', p.name, p.flat, p.block, p.profession, p.vehicle_no) ilike '%' || q.t || '%' or similarity(p.name, q.t) > 0.3)
    union all
    select 'resident', d.id, d.name,
           concat_ws(' · ', case when d.flat is not null then 'Flat ' || coalesce(d.block || '-', '') || d.flat end, d.profession, 'Not on Aangan yet'),
           '/directory',
           greatest(similarity(d.name, q.t), word_similarity(q.t, d.name), 0.85 * word_similarity(q.t, concat_ws(' ', d.name, d.flat, d.block, d.profession)))
      from public.directory_entries d, q
     where d.community_id = p_community and coalesce(d.shifted, false) = false
       and not exists (select 1 from public.profiles p where p.community_id = d.community_id and p.phone is not null and p.phone = d.phone)
       and (concat_ws(' ', d.name, d.flat, d.block, d.profession) ilike '%' || q.t || '%' or similarity(d.name, q.t) > 0.3)
    union all
    select 'sport', g.id, g.name, initcap(g.sport), '/sports/' || g.id,
           greatest(similarity(g.name, q.t), word_similarity(q.t, g.name), 0.85 * word_similarity(q.t, concat_ws(' ', g.name, g.sport, g.description)))
      from public.sport_groups g, q
     where g.community_id = p_community
       and (concat_ws(' ', g.name, g.sport, g.description) ilike '%' || q.t || '%' or similarity(g.name, q.t) > 0.3)
    union all
    select 'document', d.id, d.name, coalesce(nullif(d.description, ''), 'Document'), '/documents',
           greatest(similarity(d.name, q.t), word_similarity(q.t, d.name), 0.85 * word_similarity(q.t, concat_ws(' ', d.name, d.description)))
      from public.documents d, q
     where d.community_id = p_community
       and (concat_ws(' ', d.name, d.description) ilike '%' || q.t || '%' or similarity(d.name, q.t) > 0.3)
    union all
    select 'dish', x.id, x.dish_name, 'by ' || x.chef_name || ' · ₹' || x.price, '/dish/' || x.id,
           greatest(similarity(x.dish_name, q.t), word_similarity(q.t, x.dish_name), 0.85 * word_similarity(q.t, concat_ws(' ', x.dish_name, x.chef_name, x.description)))
      from (
        select distinct on (lower(dish_name), chef_user_id) *
          from public.dishes
         where community_id = p_community and withdrawn_at is null and serve_date >= current_date
         order by lower(dish_name), chef_user_id, serve_date asc
      ) x, q
     where (concat_ws(' ', x.dish_name, x.chef_name, x.description) ilike '%' || q.t || '%' or similarity(x.dish_name, q.t) > 0.3)
    union all
    select 'tiffin', t.id, t.title, 'Tiffin · ₹' || t.price || '/day', '/food',
           greatest(similarity(t.title, q.t), word_similarity(q.t, t.title), 0.85 * word_similarity(q.t, concat_ws(' ', t.title, t.description)))
      from public.tiffin_plans t, q
     where t.community_id = p_community and coalesce(t.active, true)
       and (concat_ws(' ', t.title, t.description) ilike '%' || q.t || '%' or similarity(t.title, q.t) > 0.3)
    union all
    select 'listing', l.id, coalesce(nullif(l.referral_name, ''), l.title), initcap(replace(l.category, '_', ' ')), '/listing/' || l.id,
           greatest(similarity(coalesce(nullif(l.referral_name, ''), l.title), q.t),
                    word_similarity(q.t, coalesce(nullif(l.referral_name, ''), l.title)),
                    0.85 * word_similarity(q.t, concat_ws(' ', l.title, l.referral_name, l.description, l.location, l.category)))
      from public.listings l, q
     where l.community_id = p_community and l.status = 'active'
       and (concat_ws(' ', l.title, l.referral_name, l.description, l.location, l.category) ilike '%' || q.t || '%' or similarity(coalesce(nullif(l.referral_name, ''), l.title), q.t) > 0.3)
    union all
    select 'post', po.id, coalesce(nullif(po.title, ''), left(po.body, 80)), 'Feed', '/feed/' || po.id,
           greatest(similarity(coalesce(po.title, ''), q.t), word_similarity(q.t, coalesce(po.title, '')), 0.85 * word_similarity(q.t, concat_ws(' ', po.title, po.body)))
      from public.posts po, q
     where po.community_id = p_community
       and (concat_ws(' ', po.title, po.body) ilike '%' || q.t || '%')
    union all
    select 'borrow', b.id, b.title, case when b.kind = 'request' then 'Wants to borrow' else 'Lending' end, '/borrow/' || b.id,
           greatest(similarity(b.title, q.t), word_similarity(q.t, b.title), 0.85 * word_similarity(q.t, concat_ws(' ', b.title, b.description, b.category)))
      from public.lend_items b, q
     where b.community_id = p_community and b.status <> 'unavailable'
       and (concat_ws(' ', b.title, b.description, b.category) ilike '%' || q.t || '%' or similarity(b.title, q.t) > 0.3)
    union all
    select 'lost_found', lf.id, lf.title, case when lf.kind = 'lost' then 'Lost' else 'Found' end, '/lost-found/' || lf.id,
           greatest(similarity(lf.title, q.t), word_similarity(q.t, lf.title), 0.85 * word_similarity(q.t, concat_ws(' ', lf.title, lf.description, lf.category)))
      from public.lost_found_items lf, q
     where lf.community_id = p_community and lf.status = 'open'
       and (concat_ws(' ', lf.title, lf.description, lf.category) ilike '%' || q.t || '%' or similarity(lf.title, q.t) > 0.3)
    union all
    select 'place', pl.id, pl.name, coalesce(nullif(pl.address, ''), initcap(pl.place_type)), '/place/' || pl.id,
           greatest(similarity(pl.name, q.t), word_similarity(q.t, pl.name), 0.85 * word_similarity(q.t, concat_ws(' ', pl.name, pl.address, pl.place_type, pl.description)))
      from public.places pl, q
     where pl.community_id = p_community
       and (concat_ws(' ', pl.name, pl.address, pl.place_type, pl.description) ilike '%' || q.t || '%' or similarity(pl.name, q.t) > 0.3)
    union all
    select 'recommend', r.id, r.title, 'Ask & Recommend', '/recommend/' || r.id,
           greatest(similarity(r.title, q.t), word_similarity(q.t, r.title), 0.85 * word_similarity(q.t, concat_ws(' ', r.title, r.detail, r.category)))
      from public.reco_questions r, q
     where r.community_id = p_community
       and (concat_ws(' ', r.title, r.detail, r.category) ilike '%' || q.t || '%' or similarity(r.title, q.t) > 0.3)
  )
  select kind, id, title, subtitle, route, rank::real
    from hits, q
   where length(q.t) >= 2
   order by rank desc, title
   limit greatest(1, least(p_limit, 100));
$fn$;

grant execute on function public.search_society(uuid, text, int) to authenticated;
