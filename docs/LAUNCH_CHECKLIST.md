# Aangan — pre-launch operational checklist

Code-level security/performance fixes are in the app (see migrations `0034`–`0038`
and the audit changelog in `PLATFORM_PLAN.md`). The items below are **operational**
— they live in the Supabase dashboard or in upstream dependencies, not in our code,
so they're documented here as a runbook rather than shipped as a migration.

Status of each is tracked so nothing is silently dropped.

---

## 1. Storage bucket policies  ✅ now in migration `0050`

Our public photo buckets (`listing-photos`, `dish-photos`, `sport-logos`) need
object-level policies on `storage.objects` — without them **every upload is denied**
(`403 / new row violates row-level security policy`), because the bucket's "public"
flag only governs READS.

**These are now applied by `0050_storage_photo_policies.sql`** — run it once the
three buckets exist (it also flips them to public). The policy set is below for
reference (public read; broad authenticated write/update; owner-or-admin delete via
a path → table join):

```sql
-- Public READ (needed for the public image URLs to load)
create policy "photos_public_read" on storage.objects for select
  using (bucket_id in ('listing-photos','dish-photos','sport-logos'));

-- WRITE: any signed-in member. (Must stay broad — dish photos are uploaded
-- BEFORE the dish row exists, so an owner-scoped insert check would break posting.)
create policy "photos_auth_write" on storage.objects for insert to authenticated
  with check (bucket_id in ('listing-photos','dish-photos','sport-logos'));
create policy "photos_auth_update" on storage.objects for update to authenticated
  using (bucket_id in ('listing-photos','dish-photos','sport-logos'));

-- DELETE: owner of the underlying row, or an admin (path → table join).
create policy "photos_owner_delete" on storage.objects for delete to authenticated using (
  public.is_admin(auth.uid())
  or (bucket_id = 'listing-photos' and name like 'property/%'
      and exists (select 1 from public.property_listings p where p.id::text = split_part(name,'/',2) and p.owner_user_id = auth.uid()))
  or (bucket_id = 'listing-photos' and name like 'borrow/%'
      and exists (select 1 from public.lend_items i where i.id::text = split_part(name,'/',2) and i.owner_user_id = auth.uid()))
  or (bucket_id = 'listing-photos' and name not like 'property/%' and name not like 'borrow/%'
      and exists (select 1 from public.listings l where l.id::text = split_part(name,'/',2) and l.owner_user_id = auth.uid()))
  or (bucket_id = 'dish-photos'
      and exists (select 1 from public.dishes d where d.id::text = split_part(split_part(name,'/',2),'.',1) and d.chef_user_id = auth.uid()))
  or (bucket_id = 'sport-logos'
      and exists (select 1 from public.sport_groups g where g.id::text = split_part(name,'.',1) and g.created_by = auth.uid()))
);
```

Then **test an upload** of a dish, a listing, a property and a borrow item to
confirm nothing broke. (`documents` already has correct per-file policies in
migration `0032` — leave it.)

---

## 2. Auth rate-limiting (brute-force on the 6-digit PIN)  ⚠️ set in dashboard

Sign-in is phone + 6-digit PIN. Per phone there are 1,000,000 PINs, so without a
throttle a determined attacker could brute-force one account. Supabase has
default rate limits; tighten them:

**Supabase → Authentication → Rate Limits** (and **Attack Protection**):
- Lower the **token / sign-in** request limit per hour to a sane value.
- Enable **CAPTCHA** (hCaptcha/Turnstile) on the auth endpoints if available on
  your plan — this is the strongest mitigation.
- Confirm **leaked-password protection** is irrelevant here (PINs aren't in HIBP).

Optional app-side hardening (future): move from a 6-digit PIN to a 6-char
alphanumeric, or add a short client cool-down after N failed attempts.

---

## 3. npm audit advisories  ℹ️ upstream, monitor

`npm audit` reports **11 moderate** advisories. All are in Expo's **build-time**
tooling (`@expo/config`, `@expo/config-plugins`, `@expo/prebuild-config`,
`expo-splash-screen`) — they run during `expo export`, **not** in the shipped web
bundle, so they're not exploitable by app users.

- **Do not** run `npm audit fix --force` — it pulls breaking canary versions and
  will break the build.
- Clear them by bumping the **Expo SDK** when a patched release lands; re-check
  with `npm audit --omit=dev` each release.

---

## 4. List virtualisation (FlashList)  ✅ deliberately deferred

The food feed and category listings already use `@shopify/flash-list`. The newer
list screens (directory, properties, borrow, recommend, helpers) render with
`ScrollView` + `.map`, **capped** by `.limit()` in their queries. At pilot scale
(tens of rows) this is faster to ship and has no perceptible cost.

**Trigger to convert:** when any single society's directory or a category list
realistically exceeds **~150 rows**. The conversion is a clean swap — move the
header/filters into `ListHeaderComponent`, the empty state into
`ListEmptyComponent`, and the rows into `renderItem` with an `estimatedItemSize`.

---

## 5. Console output  ✅ clean

Audited: **no `console.log` debug noise** in `src/`. The remaining `console.warn`/
`console.error` calls are legitimate error logging inside `catch` blocks (push
registration, Supabase config). Nothing to remove.

---

## Already done in code (for reference)
- **0038** — profile reads scoped to your own society; `community_id` frozen
  (no self-service society hijack); dish reads scoped to members.
- Realtime subscriptions (`listings`, `properties`, `borrow`, `recommend`)
  filtered by `community_id` (no cross-society re-fetch storms).
- `.limit()` caps on all list fetches; PostgREST `.or()` search filters sanitised.
- `IMAGE_CACHE_PROPS` (memory-disk cache + blur-up) on all remote photos.
