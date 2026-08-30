-- Emoji reactions on post comments.
--
-- WHY: a society feed fills up with "+1" and "🙏" replies that carry no
-- information but push real discussion off the screen. A reaction says the
-- same thing without costing everyone else a comment to scroll past.

create table public.comment_reactions (
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now(),

  -- One row per person per emoji per comment. This is the whole integrity
  -- story: reacting twice with the same emoji is a no-op instead of a
  -- duplicate, and un-reacting is a delete on a known key. No counter column
  -- to drift out of sync with reality.
  primary key (comment_id, user_id, emoji)
);

-- Reactions are always read as "all reactions on these comments", never by
-- user, so the primary key's leading column already serves the only query.
-- This index covers the fan-out when a post's whole comment list loads.
create index comment_reactions_comment_idx on public.comment_reactions (comment_id);

-- Keep the emoji column honest: it holds one short grapheme, not a message.
-- Without this it is an unbounded text column that anyone can write to.
alter table public.comment_reactions
  add constraint comment_reactions_emoji_len check (char_length(emoji) between 1 and 16);

alter table public.comment_reactions enable row level security;

-- Readable by anyone who can already read the comment itself: a member of the
-- community that owns the post. Mirrors comments_read in 0013 rather than
-- inventing a second rule.
create policy comment_reactions_read on public.comment_reactions
  for select using (
    auth.role() = 'authenticated'
    and exists (
      select 1
      from public.post_comments pc
      join public.posts po on po.id = pc.post_id
      join public.profiles p on p.id = auth.uid()
      where pc.id = comment_id and po.community_id = p.community_id
    )
  );

-- You may only add your own reaction, and only to a comment you can see.
-- The second half matters: without it any authenticated user could react to
-- comments in a society they do not belong to, which would leak the existence
-- of those comments back through the reaction list.
create policy comment_reactions_insert on public.comment_reactions
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.post_comments pc
      join public.posts po on po.id = pc.post_id
      join public.profiles p on p.id = auth.uid()
      where pc.id = comment_id and po.community_id = p.community_id
    )
  );

-- You may only remove your own. Admins deliberately have no delete here:
-- moderating a reaction is not a thing anyone needs, and the comment itself
-- can already be removed, which cascades.
create policy comment_reactions_delete on public.comment_reactions
  for delete using (auth.uid() = user_id);

alter publication supabase_realtime add table public.comment_reactions;
