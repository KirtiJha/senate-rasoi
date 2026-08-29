# Play Console — paste-ready answers

Everything you need to fill **"Finish setting up your app"** in one pass. Values
reflect what Aangan actually does (verified against `src/app/legal.tsx`, the
Supabase schema, and `src/lib/push.ts`). Where a choice is a judgement call, the
reason is given so you can defend it if a reviewer asks.

> Golden rule: **only declare what's true.** Play cross-checks these answers
> against your app's behaviour and rejects mismatches. Everything below is true
> for Aangan today.

---

## 1. App access  (Policy → App content → App access)

Aangan requires a login (phone + 6-digit PIN), so a reviewer **cannot** see the
app without credentials.

- Select **"All or some functionality is restricted"**.
- Add one instruction set:
  - **Name:** `Resident login`
  - **Username / phone:** a real working phone number for a demo account in your
    society
  - **Password / PIN:** that account's 6-digit PIN
  - **Any other instructions:**
    > Aangan is a private app for a single housing society. Sign in with the
    > phone number and 6-digit PIN above. Report and Block are on the ⋯ menu of
    > any feed post; blocked members are managed at Profile → Blocked members;
    > account deletion is at Profile → Delete account.

> ⚠️ If you skip this, Play (and Apple) reject you for "couldn't access the app".

---

## 2. Ads  (App content → Ads)

- **No, my app does not contain ads.** (Aangan shows no advertising.)

---

## 3. Content rating  (App content → Content rating → Start questionnaire)

- **Email:** your support email (`powerju2012@gmail.com`)
- **Category:** **Social / Communication**

Answer the questionnaire truthfully — for Aangan that is:

| Question | Answer |
|---|---|
| Violence (cartoon / realistic) | **No** |
| Sexuality / nudity | **No** |
| Profanity or crude humour | **No** |
| Controlled substances (drugs/alcohol/tobacco) | **No** |
| Gambling / simulated gambling | **No** |
| **Users can interact / communicate** | **Yes** (feed, comments, DMs) |
| **Users can share user-generated content** | **Yes** (posts, listings, photos, documents) |
| Users can share their **personal information** | **Yes** (directory shares name/flat/phone by choice) |
| Shares the user's **current physical location** | **No** (Aangan does not broadcast device location) |
| Digital purchases | **No** (payments are peer-to-peer UPI outside the app) |

This yields a low rating (typically **Teen / PEGI 3–12** with a "users interact"
notice). Accept whatever IARC returns — it's computed from the answers.

---

## 4. Target audience & content  (App content → Target audience)

- **Target age group:** **18 and over.**
  - *Why:* the Terms and Privacy state Aangan is for adults (18+), it carries
    user-generated content and peer payments, and an adults-only audience avoids
    Google's Families/child-safety obligations. Do **not** tick any age band
    under 18.
- **Appeals to children?** **No.**

---

## 5. Data safety  (App content → Data safety)

This is the fiddliest form. Fill the intro questions, then declare each data
type below.

### Intro questions
| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all user data **encrypted in transit**? | **Yes** (HTTPS/TLS to Supabase) |
| Do you provide a way for users to **request deletion**? | **Yes** — in-app: Profile → Delete account (`delete_own_account`) |

> On "sharing": Play defines **sharing** as transferring data to a *separate
> company/third party*. Aangan does **not** do that. Neighbours seeing your
> profile is in-app user-to-user visibility, **not** "sharing" — so mark every
> type **Collected: Yes, Shared: No**.

### Data types to declare
For **every** row below: **Collected = Yes · Shared = No · Processing is not
ephemeral (stored) · Purpose = App functionality** (unless a different purpose is
noted). Mark **Required** unless noted optional.

| Play category → data type | Collected? | Optional? | Notes |
|---|---|---|---|
| **Personal info → Name** | Yes | Required | Display name |
| **Personal info → Phone number** | Yes | Required | It's the login identifier |
| **Personal info → Address** | Yes | Required | Flat / block within the society |
| **Personal info → Other info** | Yes | Optional | Profession, vehicle number, blood group (all user-optional) |
| **Financial info → Other financial info** | Yes | Optional | **UPI ID (VPA) only.** Aangan never sees card/bank/UPI credentials — only the VPA a user chooses to display so neighbours can pay them. Purpose: App functionality |
| **Photos and videos → Photos** | Yes | Optional | Listing/dish/profile/receipt images |
| **Messages → Other in-app messages** | Yes | Optional | Direct messages + listing/property chats |
| **Files and docs → Files and docs** | Yes | Optional | Documents residents upload to the vault |
| **App activity → App interactions** | Yes | Required | Posts, orders, polls, RSVPs, etc. |
| **App activity → Other user-generated content** | Yes | Optional | Feed posts, comments, listings, recommendations |
| **Device or other IDs → Device or other IDs** | Yes | Required | Expo push token (device id) — Purpose: App functionality (notifications) |

### Do NOT declare (Aangan does not collect these)
- **Location** (precise or approximate) — Aangan does not track device location.
  The society's map pin is chosen once by the founding admin at onboarding; it is
  not the user's location.
- **Email address** — sign-in uses a phone-as-alias internally; users never
  provide an email.
- **Financial info → Payment/purchase history, credit score, credit card** — no
  gateway; payments happen in the user's own UPI app.
- **Health, contacts, calendar, SMS, call log, browsing history, installed apps,
  audio, precise location.**

---

## 6. Store listing  (Grow → Store presence → Main store listing)

| Field | Value |
|---|---|
| **App name** | `Aangan` |
| **Short description** (≤80) | `Your apartment community in one app — notices, marketplace, food & more.` |
| **Full description** | *(generalized version — avoids looking restricted to one building)* see below |
| **App icon** | 512×512 PNG |
| **Feature graphic** | 1024×500 PNG |
| **Phone screenshots** | 2–8, taken on your phone |
| **Privacy policy URL** | `https://my-aangan.vercel.app/legal?tab=privacy` |

**Full description (paste):**
```
Aangan is a private community app for apartment societies. Residents share notices and a neighbourhood feed, buy/sell/lend in a local marketplace, order home-cooked tiffins, organise sports, manage documents and dues, run polls, raise emergencies, and discover nearby places — all in one place, just for verified residents of your society.
```

---

## 8. Child safety standards  (App content → Child safety standards)

Required because Aangan is in the **Social** category. Play will not let you
release without it.

| Field | Answer |
|---|---|
| Does your app fall into Social or Dating? | **Social** |
| **Safety standards URL** | `https://YOUR-SITE.vercel.app/child-safety` |
| **Child safety contact email** | `powerju2012@gmail.com` |

Google requires the URL to be live, reachable **worldwide without signing in**,
**not a PDF**, and **not publicly editable**. Ours is a normal page in the web
build, so it meets all four.

⚠️ **Open the URL in an incognito window before you paste it.** If your Vercel
site isn't deployed (PUBLISHING_GUIDE step 0.3) the link won't resolve and Play
will reject the declaration.

The page itself is `src/app/child-safety.tsx` — it states the CSAE prohibition,
how users report it (the "⋯" menu → Report → **Child safety (CSAE)**), how we
respond, the laws we comply with, and the contact address above. If you change
that page, keep every claim on it true: reviewers check it against what the app
actually does.

---

## 9. Quick completion order

1. **App access** (demo login) — unblocks review
2. **Ads** → No
3. **Content rating** questionnaire
4. **Target audience** → 18+
5. **Data safety** (the table above)
6. **Main store listing** (text + graphics + privacy URL)
7. **Child safety standards** (URL + contact email — Social category)

When every item shows a green check, your app is "set up" — you can then push a
build to Internal testing and start the closed test (see PUBLISHING_GUIDE.md).
