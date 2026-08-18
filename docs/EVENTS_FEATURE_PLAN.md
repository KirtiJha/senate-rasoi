# Society Functions & Events — design proposal

Covers the full lifecycle you described: meeting announcement → core team →
plan → budget → per-flat contributions → expenses and bills → a transparent
final report with receipts attached.

> **Status: Phase 1 is built and pushed** (migration `0069`). The decisions in
> §9 were settled with the recommended defaults: admins create a function and
> appoint a lead; a suggested per-flat amount the treasurer can override; the
> roster auto-generates from the resident directory; Phase 1 only.
> Phase 2 and 3 remain unbuilt.

---

## 1. The core idea

Everything you listed is one thing — an **Event** — with two money ledgers and
a team hanging off it:

```
        ┌──────────── EVENT (Diwali 2026) ────────────┐
        │  plan · date · venue · budget · status      │
        └───┬───────────────┬───────────────┬─────────┘
            │               │               │
      CORE TEAM       MONEY IN         MONEY OUT
      lead,           contribution     expenses with
      treasurer,      per flat         bills attached
      members
                          └──────┬──────┘
                                 ▼
                        THE REPORT (generated)
```

**The single most important design decision: the final report is *generated*,
never written by hand.**

If someone types up a summary, it can drift from reality — and the whole point
is transparency. Instead the report is just a live view of the two ledgers:
collected minus spent, with every receipt one tap away. It is always correct,
it exists from day one (not just at the end), and nobody has to assemble it.

That also means residents can watch the money in real time rather than waiting
for a PDF at the end, which is what actually builds trust.

---

## 2. A note on "core team"

You told me earlier not to build committee features, since the society has no
committee and NoBrokerHood covers maintenance. This does not contradict that.

A **standing managing committee** is a permanent society body — not being built.
An **event core team** is 4–6 neighbours who volunteer to run *one* function and
disband afterwards. The team lives on the event, not on the society. Next
year's Diwali team can be completely different people.

---

## 3. What we reuse instead of rebuilding

Most of this already exists in Aangan in another form. Reusing it means less new
code, fewer bugs, and behaviour residents already recognise.

| What you need | Already in Aangan | How it's reused |
|---|---|---|
| Collect money from many people, track who paid | **Sports dues** (`court_payments`) — payer initiates, collector confirms, plus manual "mark paid" and undo | Same proven pattern, applied per flat instead of per player |
| UPI payment button | `PayButton` + `upiUri()` | Unchanged |
| Attach bills and receipts | **Documents** (`documents` bucket, per-file RLS from `0032`) | Receipts stored the same way |
| Meeting announcements | **Feed** posts, category `announcement`, pinnable | Meeting notices link to the event |
| Decide venue / approve budget | **Polls** | A poll can be attached to an event |
| Tell everyone | `notifications` broadcast | Auto-pushes to phones via `0066` |
| "Money I owe / am owed" | `/payments` (already merges two payment tables) | Contributions appear here too |
| Team with elevated rights | `sport_group_members.is_captain` + `is_group_captain()` | Same shape for event roles |

**New code is really only:** the event itself, the per-flat contribution roster,
the expense ledger, and the report view.

---

## 4. Data model

Four new tables.

### `society_events`
The function itself.

| Column | Notes |
|---|---|
| `id`, `community_id`, `created_by` | standard |
| `title`, `description` | "Diwali 2026", the plan |
| `event_date`, `venue` | |
| `status` | `draft` → `collecting` → `ongoing` → `completed` → `cancelled` |
| `budget_amount` | what you *plan* to spend |
| `suggested_contribution` | default per-flat amount |
| `cover_photo_url` | |

### `event_team`
Who is running it. `(event_id, user_id)` primary key.

| Column | Notes |
|---|---|
| `role` | `lead` · `treasurer` · `member` |

Only the **treasurer** can confirm money received. Only the **lead** (or a
society admin) can edit the event and change the team.

### `event_contributions` — money in
**One row per flat**, created up front as a roster. This is what makes "who
hasn't paid yet" answerable.

| Column | Notes |
|---|---|
| `flat` | the unit of contribution |
| `contributor_user_id` | nullable — a flat may have no app user yet |
| `amount` | can differ per flat; not everyone gives the same |
| `status` | `pending` → `initiated` → `received`, or `waived` |
| `method` | `upi` · `cash` · `bank` |
| `recorded_by`, `received_at` | who confirmed it, and when |

> `waived` matters in practice — some flats genuinely don't contribute, and the
> roster shouldn't nag them forever or make the totals look wrong.

When someone pays by UPI we **also** write a normal `payments` row with
`context_type = 'event'`, so the contribution shows up on their own `/payments`
screen alongside everything else. No separate money screen to learn.

### `event_expenses` — money out

| Column | Notes |
|---|---|
| `title`, `category` | decor · food · sound · priest · prizes · misc |
| `amount`, `vendor`, `spent_on` | |
| `paid_by_user_id` | who actually spent it (may need reimbursing) |
| `receipt_url` | the bill photo or PDF |
| `status` | `pending` → `approved` (by lead or treasurer) |

---

## 5. Screens

| Route | Who | What |
|---|---|---|
| `/events` | everyone | Upcoming and past functions. New tile on Home. |
| `/events/new` | admin / lead | Create a function |
| `/events/[id]` | everyone | The hub — plan, team, live "₹X of ₹Y collected" bar |
| `/events/[id]/contributions` | everyone reads; treasurer edits | Per-flat list: paid, pending, waived. Nudge unpaid flats. |
| `/events/[id]/expenses` | everyone reads; team adds | Every expense with its bill attached |
| `/events/[id]/report` | everyone | **The transparency report** |

### The report screen

- Total collected · total spent · **balance remaining**
- Spend by category (a simple bar breakdown)
- Every contribution: flat, amount, method, date
- Every expense: what, who paid, vendor, date, **tap to open the bill**
- Contributor count — "48 of 60 flats contributed"

Shareable as a link, and exportable to the existing Documents area at the end so
it's archived for next year.

---

## 6. Who can do what

| Action | Admin | Lead | Treasurer | Team | Resident |
|---|---|---|---|---|---|
| Create / edit event | ✅ | ✅ | — | — | — |
| Manage team | ✅ | ✅ | — | — | — |
| Set contribution roster | ✅ | ✅ | ✅ | — | — |
| Confirm money received | ✅ | — | ✅ | — | — |
| Add expense + bill | ✅ | ✅ | ✅ | ✅ | — |
| Approve expense | ✅ | ✅ | ✅ | — | — |
| **See everything** | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pay own contribution | ✅ | ✅ | ✅ | ✅ | ✅ |

Every resident can see every rupee in and out. That is the entire point — read
access is deliberately wide open within the society.

---

## 7. Build it in three phases

**Phase 1 — the money spine.** Event + team + contributions + expenses + the
generated report. This alone delivers everything you asked for and is the piece
worth getting right.

**Phase 2 — the wrapper.** Link meeting announcements (feed posts) and decisions
(polls) to the event. Reminders to flats that haven't paid. Archive the finished
report into Documents.

**Phase 3 — nice to have.** Carry a leftover balance forward to the next
function. A vendor list so you can reuse last year's sound guy. Year-on-year
comparison.

I'd strongly suggest shipping Phase 1 and using it for one real function before
building Phase 2. You'll learn more from one Ganesh Chaturthi than from any
amount of planning.

---

## 8. Things to be careful about

**Aangan must never look like it holds the money.** UPI payments go directly
from resident to treasurer, phone to phone — the app only *records* that it
happened, exactly like the existing dues feature. The moment residents think the
app is holding funds, you inherit a liability you don't want. The report should
name the treasurer plainly: "collected by Ramesh, A-402".

**Cash is not optional.** Many flats will hand over notes. If the treasurer
can't record cash, the totals go wrong and nobody trusts the report. Manual
entry is a first-class path, not a fallback.

**Not every flat has the app.** The roster is per *flat*, and
`contributor_user_id` is nullable, so a flat with no app user can still be
recorded as paid. Otherwise the report undercounts.

**Deleting must never rewrite history.** Once an event is `completed`, edits to
contributions and expenses should be blocked or at least recorded — otherwise
the transparency report can be quietly altered after the fact, which defeats it.

**One flat, two residents.** Husband and wife may both use the app. The
contribution belongs to the flat; either can pay it; it must not be collectable
twice.

---

## 9. Decisions I need from you

These change what gets built, so they're worth settling before I start.

1. **Who can create a function?** Society admins only (cleaner, avoids clutter),
   or any resident? *My recommendation: admins only, and the admin appoints a
   lead who runs it day to day.*

2. **How is the contribution amount set?** One flat rate for everyone, or a
   per-flat amount the treasurer can adjust? *My recommendation: a suggested
   default that the treasurer can override per flat — real collections are never
   perfectly uniform.*

3. **Where does the roster come from?** Auto-generate a row for every flat in
   the resident directory, or let the treasurer add flats as they collect?
   *My recommendation: auto-generate from the directory, so "who hasn't paid"
   works from day one.*

4. **Scope now:** Phase 1 only, or Phase 1 + 2 together? *My recommendation:
   Phase 1 only.*

---

## 10. Rough size

Phase 1 is comparable to the Lost & Found + moderation work already shipped:
one migration (4 tables + RLS + notification triggers), one library module, and
about six screens. Not a weekend, but not months either.
