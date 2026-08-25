# Publishing Aangan to the Play Store and the App Store

A step-by-step guide, written to be followed in order. No prior app-store
experience assumed.

**Related docs:** [`ANDROID_RELEASE.md`](./ANDROID_RELEASE.md) has extra detail on
Firebase and on sharing a free APK outside the stores.
[`AANGAN_ISSUE_TRACKER.md`](./AANGAN_ISSUE_TRACKER.md) tracks known issues.

---

## First, three things worth knowing

**You do not need a Mac.** Expo (EAS) builds the iPhone app on their computers in
the cloud. You can do this entire guide from Windows.

**You do not rewrite anything.** The Android app, the iPhone app and the website
are all built from this same codebase.

**Budget:** Apple charges **$99 per year**. Google charges **$25 once, ever**.
The app stays free for your residents either way.

**Timeline:** roughly a day of your effort, then **1–3 days waiting** for Apple's
review and **1–7 days** for Google's first review. Google is slower on a brand-new
developer account than people expect. Plan for about two weeks start to finish.

---

# PART 0 — Do these before anything else

These are quick, and everything later depends on them.

### 0.1 Run the database migrations ⚠️ important

**The easy way:** open `supabase/run/RUN_IN_SUPABASE.sql`, copy the whole
file, paste it into your Supabase **SQL Editor**, and press Run. It contains
all of the below in the right order and is safe to run even if you've already
applied some of them.

Not sure what you've already run? Run `supabase/run/CHECK_WHAT_I_NEED.sql`
first — it tells you, and changes nothing.

The individual files, if you'd rather do them one at a time from
`supabase/migrations/`, **in this exact order**:

| Order | File | What it does |
|---|---|---|
| 1 | `0065_lost_found.sql` | Creates Lost & Found |
| 2 | `0066_push_all.sql` | Sends phone notifications for every event |
| 3 | `0067_fix_lost_found_schema.sql` | Repairs a bug in Lost & Found |
| 4 | `0068_reports_and_blocks.sql` | Report + block (**required by Apple**) |
| 5 | `0069_society_events.sql` | Society functions, contributions & accounts |

To run one: open the file, copy **all** of its text, paste into the SQL Editor,
press **Run**. You should see "Success".

> If you already ran `0065` before today, still run `0067` — that's exactly what
> it's for. If you never ran `0065`, run it anyway, then `0067`; it will do
> nothing and that's fine. Running `0067` twice is harmless.

**Then test it:** open the app, post something in Lost & Found. If it saves
without an error, the migrations worked.

### 0.2 Set a real support email ⚠️ Apple will check this

Right now the app shows a fake address. Apple requires a working contact for
apps where people post content.

1. Set up an email you will actually read — `support@yourdomain.com`, or even a
   dedicated Gmail like `aangan.support@gmail.com`. Either is fine.
2. Open `src/lib/support.ts` and replace this line:
   ```ts
   export const SUPPORT_EMAIL = 'support@aangan.app';
   ```
   with your real address.
3. Save, then commit:
   ```bash
   git add src/lib/support.ts
   git commit -m "chore: real support email"
   git push
   ```

> Use this **same address** later when App Store Connect and Play ask for a
> support contact.

### 0.3 Put the privacy policy on the public web

Both stores demand a privacy-policy link that **anyone can open without logging
in**. Yours lives in the app at `/legal?tab=privacy`, so the website has to be
live. If you haven't deployed to Vercel yet, follow "Deploy to Vercel" in
[`README.md`](../README.md).

Your link will be:

```
https://YOUR-SITE.vercel.app/legal?tab=privacy
```

Open it in a private/incognito window. If it loads without a login, you're done.
**Write this URL down — both stores ask for it.**

### 0.4 Install the build tool

```bash
npm install -g eas-cli
eas login
```

Use your Expo account (free — sign up at https://expo.dev/signup if needed).

---

# PART 1 — Android (Google Play)

Start with Android. It's cheaper, more forgiving, and gets you familiar with the
process before you spend $99 on Apple.

> ### ⚠️ Read this first — Google's rule for new personal accounts
> If your developer account is a **personal** account (created after late 2023),
> Google now requires, *before you can even apply for Production*:
> - a **closed test** with **at least 12 testers opted-in**, running for
>   **at least 14 consecutive days**.
>
> This is separate from, and on top of, identity verification. The **14-day
> clock is the long pole** in your whole launch — start the closed test as early
> as you can (steps 1.6–1.7). Your realistic Android timeline is now closer to
> **3–4 weeks**, not a few days. (This requirement did not exist when the rest of
> this guide was first written.)
>
> Your dashboard shows three stages: **Internal testing** (instant, your own
> device, no 12-tester rule) → **Closed testing** (the 12×14 gate) →
> **Production** (apply after the closed test qualifies).

### 1.1 Set up Firebase (makes notifications work)

Follow **Step 2** in [`ANDROID_RELEASE.md`](./ANDROID_RELEASE.md). Briefly:
create a Firebase project, add an Android app with package name **exactly**
`com.aangan.app`, download `google-services.json` into the repo root, and upload
the *service-account key* to Expo via `eas credentials`.

> `google-services.json` is safe to commit and already is.
> The **service-account key is a secret** — keep it outside the repo.

### 1.2 Do a test build first

Before paying Google anything, make sure the app actually builds and works:

```bash
eas build -p android --profile apk
```

Wait ~15 minutes. You'll get a download link. Install it on your Android phone
and check the important things:

- [ ] You can sign in
- [ ] Photos upload (post a dish or a listing)
- [ ] Notifications arrive when someone else posts
- [ ] Lost & Found works
- [ ] The **⋯** menu on a feed post offers **Report** and **Block**
- [ ] Profile → **Blocked members** opens

If something's broken, fix it now — it's much cheaper than fixing it after a
store rejection.

### 1.3 Create the Play account ($25, once)

Go to https://play.google.com/console → sign up → pay $25.

Google will ask you to **verify your identity** with an ID document. This can
take **1–3 days**, so start it early. You cannot publish until it clears.

### 1.4 Build the file Play wants

Play needs an `.aab`, not the `.apk` you tested with:

```bash
eas build -p android --profile production
```

Download the `.aab` when it finishes.

### 1.5 Create the app and finish setup

In the Play Console: **Create app** → name **Aangan**, English, App, Free.

Then work through **"Finish setting up your app"**. Every field you need — App
access (demo login), Ads, Content rating, Target audience, Data safety, and the
store listing — has **paste-ready answers** in
[`PLAY_DATA_SAFETY.md`](./PLAY_DATA_SAFETY.md). Fill each until it shows a green
check. Highlights:

**Store listing**
- Short description (max 80 chars):
  `Your apartment community in one app — notices, marketplace, food & more.`
- Full description: use the **generalized** draft (so the app doesn't look
  restricted to one building) — in
  [`PLAY_DATA_SAFETY.md`](./PLAY_DATA_SAFETY.md#6-store-listing--grow--store-presence--main-store-listing)
- App icon 512×512 PNG · Feature graphic 1024×500 PNG · 2–8 phone screenshots
- Privacy policy: the URL from step 0.3

**App access** — Aangan needs a login, so give the reviewer a **demo phone
number + PIN** (details in `PLAY_DATA_SAFETY.md` §1). Skipping this = rejection.

**Content rating** / **Data safety** — full answers in `PLAY_DATA_SAFETY.md`
§3 and §5.

### 1.6 Test on your own phone (Internal testing)

You do **not** need Production — or even a cleared identity check — to install
the real store build on your phone. Use the **Internal testing** track:

1. **Release → Testing → Internal testing → Create new release**
2. Upload the `.aab` from step 1.4 (build 7+, the one **without** the CAMERA
   permission)
3. **Testers** tab → create an email list → add your own Google account → save
4. Copy the **join link**, open it on your phone, install, and run the step-1.2
   checklist against the real store build

Two harmless warnings you'll see and can ignore: "no testers specified" (until
you add yourself in step 3) and "no deobfuscation file" (not applicable to this
app — it shows on every upload).

### 1.7 Run the closed test (the gate to Production)

This is the **14-day, 12-tester** requirement from the callout at the top of
Part 1. Start it as early as possible — the clock is what gates your launch.

1. **Release → Testing → Closed testing → Create a new track** (or use the
   default "Alpha") → **Create new release** → upload the same `.aab`
2. **Testers** → add an email list of **at least 12 people** who each have a
   Google account (family, friends, neighbours). Each must **open the join link
   and opt in** — 12 *opted-in* testers, not just 12 invited.
3. Keep the test live for **at least 14 continuous days**. Ask testers to
   actually open the app a few times; genuine usage is what Google looks for.
4. After 14 days with 12+ opted-in testers, the **Production → Apply for access**
   button unlocks. You'll answer a few questions about how the closed test went.

> Tip: recruit your 12 testers **now**, while identity verification is still
> pending — both clocks then run in parallel.

### 1.8 Production

Once identity verification has cleared **and** the closed test qualifies:
**Production → Create new release** → upload the `.aab` → submit for review.
First review on a new account often takes **several days**; later updates are
usually hours.

### 1.9 Future Android updates

- **Design/text change only:** `eas update --channel production` — reaches
  everyone in minutes, no store review.
- **New permission or SDK bump:** `eas build -p android --profile production`,
  then upload again.

---

# PART 2 — iPhone (App Store)

Apple is stricter. Everything in Part 0 must genuinely be done.

### 2.1 Create the Apple Developer account ($99/year)

Go to https://developer.apple.com/programs/enroll/.

- Enrolling as an **individual** is simplest and needs only your Apple ID.
- Enrolling as a **company** requires a D-U-N-S number and takes far longer.

Apple's verification takes **1–3 days**. Start it now and continue below while
you wait.

### 2.2 Register the app in App Store Connect

Once enrolled, go to https://appstoreconnect.apple.com → **My Apps** → **+** →
**New App**:

- Platform: **iOS**
- Name: **Aangan** (must be unique across the whole App Store — if taken, try
  `Aangan — Society App`)
- Primary language: **English (India)**
- Bundle ID: pick **com.aangan.app** from the dropdown
- SKU: `aangan-001` (internal only, any text)

After it's created, note the **Apple ID** number shown on the App Information
page — a long number like `6738291045`. You need it next.

### 2.3 Fill in the three iOS values

Open `eas.json` and replace the three placeholders under `submit.production.ios`:

```json
"ios": {
  "appleId": "you@example.com",        // the email you enrolled with
  "ascAppId": "6738291045",            // the Apple ID number from step 2.2
  "appleTeamId": "ABCDE12345"          // see below
}
```

Find your **Team ID** at https://developer.apple.com/account → scroll to
**Membership details**. It's a 10-character code.

Commit the change:

```bash
git add eas.json && git commit -m "chore: iOS submit config" && git push
```

### 2.4 Turn on push notifications for iPhone

```bash
eas credentials
```

Choose **iOS → production → Push Notifications → Set up your Push Notifications
Key**. Let EAS create and manage the key. This is what makes notifications
work on iPhone — skip it and they silently never arrive.

### 2.5 Build the iPhone app

```bash
eas build -p ios --profile production
```

EAS will ask to log into your Apple account and will create the signing
certificates for you. Say yes to letting EAS manage them. Takes ~20–30 minutes.

### 2.6 Send it to Apple

```bash
eas submit -p ios --profile production
```

This uploads the build to App Store Connect. It then sits in "Processing" for
15–60 minutes.

### 2.7 Test it on your own phone first

In App Store Connect → **TestFlight**, add yourself as a tester. Install the
TestFlight app on your iPhone and try the real build. Run through the same
checklist as step 1.2.

**Do not skip this.** It's the cheapest place to find problems.

### 2.8 Fill in the store listing

In App Store Connect, on your app's page:

- **Screenshots** — required for 6.7" iPhone. You can take these in TestFlight
  on your own phone.
- **Description** — reuse the Play text.
- **Keywords** — `society,apartment,community,neighbours,residents,tiffin`
- **Support URL** — your website, e.g. `https://YOUR-SITE.vercel.app`
- **Privacy Policy URL** — the link from step 0.3
- **Age rating** — answer the questionnaire. Because the app has a feed and
  messaging, expect a **12+** rating.
- **App Privacy** — same disclosures as Play's Data safety (step 1.5).
- **Sign-in information** — ⚠️ **critical.** Aangan is private to a society, so
  Apple's reviewer cannot get in without help. Give them a **real working phone
  number and 6-digit PIN** for a test account in your society, in the "Sign-in
  required" box. **If you skip this, you will be rejected.** Add a note:

  > Aangan is a private app for a single housing society. Please use the demo
  > account above. Report and Block are available from the ⋯ menu on any feed
  > post, and blocked members can be managed at Profile → Blocked members.

### 2.9 Submit

Click **Add for Review** → **Submit**. Apple usually replies within **24–48
hours**.

---

# PART 3 — If Apple rejects you

Rejection is normal, especially the first time. They tell you the guideline
number. The likely ones for this app:

| Guideline | What they mean | Your fix |
|---|---|---|
| **2.1** | "We couldn't log in" | You forgot the demo account in step 2.8. Add it and resubmit. |
| **1.2** | "Apps with user content need report/block" | Already built — reply and point them at the ⋯ menu on any feed post, and Profile → Blocked members. |
| **5.1.1(v)** | "Users must be able to delete their account" | Already built — point them at Profile → Delete account. |
| **4.2** | "Too simple / feels like a website" | Explain it's a private community platform with food ordering, marketplace, sports and payments. |

You reply in **App Store Connect → Resolution Center**. A clear reply often
resolves it without a new build.

---

# Quick command reference

| What | Command |
|---|---|
| Log in | `eas login` |
| Test APK (Android) | `eas build -p android --profile apk` |
| Play build | `eas build -p android --profile production` |
| iPhone build | `eas build -p ios --profile production` |
| Send to Apple | `eas submit -p ios --profile production` |
| Send to Play | `eas submit -p android --profile production` |
| Push/signing keys | `eas credentials` |
| Instant update (no review) | `eas update --channel production` |

---

# Master checklist

**Before you start**
- [ ] Migrations `0065` → `0071` run in Supabase
- [ ] Lost & Found tested and saving
- [ ] Real support email set in `src/lib/support.ts`
- [ ] Website live, privacy policy opens without login
- [ ] `eas-cli` installed, `eas login` works

**Android**
- [ ] Firebase set up, `google-services.json` committed
- [ ] Test APK installed and checked on a real phone
- [ ] $25 paid, identity verification cleared
- [ ] `.aab` built (build 7+, **no CAMERA permission**)
- [ ] App setup complete — App access/demo login, Ads, Content rating, Target
      audience, Data safety, Store listing (see `PLAY_DATA_SAFETY.md`)
- [ ] Build tested on your phone via **Internal testing**
- [ ] **Closed test: 12+ testers opted-in, running ≥14 days** ⏳ (the long pole)
- [ ] Applied for Production access after the closed test qualified
- [ ] Production release submitted

**iPhone**
- [ ] $99 paid, enrolment cleared
- [ ] App registered in App Store Connect
- [ ] `eas.json` iOS values filled in
- [ ] Push key set up via `eas credentials`
- [ ] Build uploaded, tested in TestFlight
- [ ] Listing, age rating, App Privacy complete
- [ ] **Demo phone number + PIN given to the reviewer**
- [ ] Submitted

---

# Two things that are easy to miss

**The app icon.** `assets/images/icon.png` has a transparency layer, and Apple
rejects icons with transparency. Expo usually removes it automatically during
the build — but if Apple rejects the upload complaining about an alpha channel,
open the icon in any image editor, place it on a solid background, and re-export
without transparency.

**Never commit these files:** the Play service-account key and the Apple `.p8`
key are passwords in file form. `.gitignore` now blocks them, but keep them
somewhere safe outside the repo — losing them is a real headache.
(`google-services.json` is different: it's public client config, and it is
committed on purpose.)
