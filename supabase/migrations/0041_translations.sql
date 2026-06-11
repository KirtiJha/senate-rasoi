-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0041: multilingual everything (translation cache)
-- Run AFTER 0001–0040.
--
--   • profiles.preferred_lang — the reader's chosen language (BCP-47-ish code,
--     e.g. 'hi', 'bn', 'kn'). null = English / no auto-translation.
--   • translations — a cache of machine translations keyed by the content item
--     + field + target language. The ai-proxy `translate` action reads/writes
--     this (service role) so the same post is never translated twice; source_hash
--     invalidates the cache when the original text is edited.
-- ════════════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists preferred_lang text;

create table if not exists public.translations (
  source      text not null,          -- post|announcement|dish|tiffin|listing|property|recommend|borrow|comment
  source_id   uuid not null,
  field       text not null,          -- title|body|description|detail …
  target_lang text not null,
  content     text not null,          -- the translated text
  source_hash text not null,          -- hash of the ORIGINAL text (cache invalidation)
  updated_at  timestamptz not null default now(),
  primary key (source, source_id, field, target_lang)
);

create index if not exists translations_lookup_idx
  on public.translations (target_lang, source, source_id);

alter table public.translations enable row level security;
-- No policies: only the service-role Edge Function reads/writes this cache.
