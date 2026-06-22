# Shipping Aangan as an Android app

The Android app is a **native build of this exact Expo codebase** — same screens, same
Supabase backend. Nothing is rewritten. EAS (Expo Application Services) compiles it in
the cloud, so you don't need Android Studio.

Two goals:
1. **Free distribution now** — a signed `.apk` you share by link / QR. $0.
2. **(Later, optional)** Google Play — flips on with one `eas submit`. Costs Google's
   **one-time $25** developer fee. The app stays free for users either way.

What's already wired in this repo:
- `app.json` — package `com.aangan.app`, adaptive icon, splash, permissions, FCM hook.
- `eas.json` — `apk` profile (direct-distribution APK) + `production` profile (Play AAB),
  with the public Supabase keys baked into `env` so the installed app can connect.
- `src/lib/push.ts` + migration `0005_push.sql` — Expo push end-to-end.
- Privacy policy already lives at `/legal?tab=privacy` → public URL:
  `https://<your-vercel-domain>/legal?tab=privacy`.

---

## Prerequisites (one time)
- A free **Expo account** → https://expo.dev/signup
- Node installed (you have it).

```powershell
npm install -g eas-cli
eas login          # interactive — your expo.dev email + password
```

---

## Step 1 — Link the project to EAS

```powershell
eas init
```

This creates the project on expo.dev and writes `extra.eas.projectId` into `app.json`
(push.ts reads it). Commit the change. If it asks to configure EAS Update, say yes
(enables free over-the-air JS updates later).

---

## Step 2 — Firebase / FCM (real push on Android)

Expo's push service delivers to Android through **Firebase Cloud Messaging**. Two files
come out of this: `google-services.json` (goes in the app) and a **service-account key**
(uploaded to Expo so it can send on your behalf).

1. Go to https://console.firebase.google.com → **Add project** → name it `Aangan`
   (you can disable Google Analytics).
2. Inside the project → **Add app → Android**.
   - **Android package name:** `com.aangan.app`  ← must match exactly.
   - Register, then **Download `google-services.json`**.
3. Put `google-services.json` in the **repo root** (next to `app.json`) and **commit it**.
   (It only contains a client config + sender ID — safe to commit. EAS cloud builds use
   your committed git state, so it must be committed or the build won't find it.)
4. Generate the sender key Expo needs:
   - Firebase → ⚙ **Project settings → Service accounts → Generate new private key**.
   - Save the downloaded JSON **outside the repo** (it's a secret — do NOT commit).
5. Upload it to Expo:
   ```powershell
   eas credentials
   ```
   Choose **Android → production → Push Notifications: Manage your FCM V1 service account
   key → Upload a new key** and point it at the file from step 4.

> Skipping Step 2 still produces a working app — it just won't deliver OS-level push on
> Android. In-app notifications keep working. But you asked for FCM, so do it.

---

## Step 3 — Build the APK

```powershell
eas build -p android --profile apk
```

Runs on Expo's servers (free tier — may queue a few minutes). EAS will offer to generate
a **release keystore** the first time → say **yes** and let EAS manage it (back it up via
`eas credentials` later). When done it prints a **download URL** for the `.apk`.

---

## Step 4 — Distribute (free)

- Share the APK download link or a **QR code** (the EAS build page shows one) in your
  residents' WhatsApp group.
- First install asks users to allow **"Install from unknown sources"** — one-time, normal
  for non-Play apps. Tell them: tap the file → Settings prompt → Allow → Install.
- **Future updates:**
  - JS/UI-only change → `eas update --channel production` (instant OTA, no reinstall).
  - Native change (new permission, SDK bump) → new `eas build` + reshare APK.

---

## Step 5 — Google Play later (optional, $25)

When you want it searchable on the Play Store:

1. Pay the one-time $25 at https://play.google.com/console → create the app.
2. Build the Play bundle: `eas build -p android --profile production` (produces an `.aab`).
3. First upload manually in the Play Console; fill the listing:
   - Short + full description (draft below), 2–8 phone screenshots, a 512×512 icon,
     a 1024×500 feature graphic, and the privacy URL `…/legal?tab=privacy`.
   - Complete the **Data safety** form (you collect: name, photos, approximate location,
     contacts — all for app functionality, not sold).
4. After the first manual upload, future releases: `eas submit -p android --profile production`
   (first set up a **Google Play service account** key and point
   `eas.json → submit.production.android.serviceAccountKeyPath` at it — that path currently
   has a placeholder; it is the Play key, NOT `google-services.json`).

### Store listing draft
- **Short:** Your apartment community in one app — notices, marketplace, food, sports & more.
- **Full:** Aangan is the private community app for DS Max Senate. Residents share notices
  and a neighbourhood feed, buy/sell/lend in a local marketplace, order home-cooked tiffins,
  organise sports, manage documents and dues, run polls, raise emergencies, and discover
  nearby places — all in one place, just for verified residents of your society.

---

## Quick reference

| Action | Command |
|---|---|
| Login | `eas login` |
| Link project | `eas init` |
| Manage push/keystore | `eas credentials` |
| Build shareable APK | `eas build -p android --profile apk` |
| Build Play AAB | `eas build -p android --profile production` |
| OTA JS update | `eas update --channel production` |
| Submit to Play | `eas submit -p android --profile production` |
