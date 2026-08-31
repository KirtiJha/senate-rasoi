# Anonymous posting ("Gossip") — assessment

Status: assessment, nothing built. Written because the idea is worth taking
seriously and because the risks are not obvious from the product side.

---

## 1. The need is real

Every society has conversation that can't happen under a real name:

- the committee is spending oddly and nobody wants to be the one to ask
- a neighbour's dog / parking / late-night noise, and you have to share a lift
  with them tomorrow
- the builder cut corners and the people who know are the people with the most
  to lose by saying so
- the security guard sleeps on shift

Right now this happens in splinter WhatsApp groups — unmoderated, unaccountable,
invisible to anyone who could fix the problem. **Wanting a channel for it is a
correct product instinct.** The question is what shape it takes.

---

## 2. Anonymity works differently at 300 people

This is the part that makes a society different from the internet, and it cuts
in both directions.

**Anonymity doesn't actually hold.** A post saying *"the family on the 4th floor
with the loud dog"* identifies its target to everyone instantly. And in a group
this small, writing style, timing and what someone knows narrows the author down
fast. What you ship is the *feeling* of anonymity, not the fact of it — which is
the dangerous combination, because people say things they'd never sign, while
the target still knows exactly who was meant.

**There is no exit.** On the internet you close the tab. Here you own the flat.
A thread about a real, identifiable neighbour follows them to the lift, the
parking, the school run, their children. Indian societies also have live fault
lines — religion, caste, region, vegetarian/non-vegetarian, tenant vs owner —
and an anonymous channel doesn't create those tensions, it concentrates them.

---

## 3. The legal exposure

This is the part most likely to be missed, and it's specific to India.

**Defamation here is criminal, not just civil.** It sits in the Bharatiya Nyaya
Sanhita (previously IPC 499/500), and the Supreme Court upheld criminal
defamation in *Subramanian Swamy v. Union of India* (2016). A resident who
believes an anonymous thread damaged their reputation has a route that ends in a
police complaint, not only a civil claim.

**Safe harbour is conditional.** Section 79 of the IT Act protects an
intermediary from liability for user content — but only where it does due
diligence and acts on takedown. The IT Rules 2021 add a named grievance officer,
acknowledgement within 24 hours, resolution within 15 days, and 36 hours for
court or government takedown orders.

The problem is that safe harbour assumes a *neutral* intermediary. Shipping a
feature explicitly designed and named for gossip is not a neutral posture, and it
is exactly the fact that gets quoted back at you. "We built an anonymous gossip
channel" reads very differently in a complaint than "we host a community feed."

**Retaining identity is not optional.** For any of the above to be workable you
must know who posted, even if no other resident can see it. Which means: **you
cannot honestly promise complete anonymity.** Anonymous *to neighbours*, yes.
Anonymous *to the platform*, no — and the wording has to say so.

*None of this is legal advice. If you proceed, this is the point to spend a
little money on a lawyer who knows intermediary liability.*

---

## 4. The app-store angle

You have just cleared Apple's Guideline 1.2 and Google's Child Safety Standards.
Anonymous user-generated content is precisely the category that draws extra
scrutiny under those same rules — the lineage of Secret, Yik Yak and Sarahah is
well known to reviewers.

It is not an automatic rejection. It does mean your moderation story has to be
demonstrably stronger than "users can flag it", and a reviewer will look for it.

---

## 5. The strategic tension

Aangan's asset is **trust between people who know each other**. Real names, a
verified directory, food bought from a neighbour's kitchen, money handed to a
named treasurer, function accounts published so everyone can audit them. That is
the whole differentiator against MyGate.

An anonymous channel sits in direct opposition to that. And the person most
likely to become its first target — the secretary, the committee member, the one
who collects for Diwali — is exactly the person whose enthusiasm gets Aangan
adopted by society #2.

**The realistic failure mode isn't a lawsuit. It's a society trying Aangan,
watching one nasty anonymous thread about a real person, and uninstalling.**
Nothing else in the app recovers from that.

---

## 6. The reframe

"Anonymous gossip" is one feature covering three different needs, and each has a
safer answer:

| The real need | Safer shape | Risk |
|---|---|---|
| Tell the committee something without being identified | **Anonymous suggestion box** → goes to admins only, never public | Low |
| Know what the society actually thinks | **Anonymous polls** — hidden votes, public result | Low |
| Raise something serious (funds, harassment, a staff member) | **Private disclosure** to admins, or to one named trusted member | Low |
| Vent about a neighbour | *no product answer, and that is the correct answer* | — |

**Most of the value is in row 1, and it carries almost none of the risk.** It's
also the smallest thing to build — you already have `content_reports` as a model
for "goes to admins, reporter's identity retained".

---

## 7. If you still want the public version

It can be built responsibly, but "post anonymously + flag button" is not enough.
The constraints below are what materially change the outcome:

1. **Pseudonymous, not anonymous.** A stable per-thread handle — *Neighbour 3* —
   so a conversation is coherent and a repeat abuser is visible as one person.
   Pure anonymity makes every comment context-free and un-attributable even in
   aggregate.
2. **Identity retained server-side, invisible to residents *and* admins.** Needed
   for safe harbour and for banning. Say this plainly in the UI.
3. **No naming individuals — enforced, not requested.** A hard rule that posts
   must not name a person or a flat. You have OpenAI wired up: screen every post
   before it becomes visible.
4. **AI pre-moderation, not post-hoc flagging.** Check for abuse, hate, caste and
   religious slurs, and identifiable targets *before* publishing. This is the
   single biggest difference between this and Yik Yak, and the reason a store
   reviewer would accept it. It's also a genuine differentiator — nobody in this
   market has it.
5. **Threads auto-expire** after ~7 days. Nothing anonymous should be permanent.
6. **Rate limits** — one thread per person per day. Prevents a firehose and
   makes brigading obvious.
7. **Flag threshold auto-hides**, immediately, pending admin review. Do not leave
   harmful content up waiting for a human.
8. **Off by default; each society's admin opts in.** Protects you, and makes it
   the society's own decision rather than something you imposed.
9. **Don't call it Gossip.** The name sets the norm and invites the content you
   will then have to moderate. *"Anonymous"*, *"Open Floor"*, *"Say it
   anonymously"* — the same feature under a name that asks for candour rather
   than rumour.

---

## 8. Recommendation

**Build row 1 first** — anonymous feedback to admins. A week of work, near-zero
risk, and it answers the question you actually can't answer today: *do residents
here even want anonymity, or do they just want to be heard?*

If it gets heavy use and people start asking for public discussion, build the
constrained version from §7, opt-in per society, with AI pre-moderation from day
one. If it barely gets used, you've learned that cheaply and kept the trust that
the rest of Aangan runs on.

What I'd avoid is shipping a public anonymous thread named "Gossip" into the
first society while you are simultaneously trying to convince society #2 that
Aangan is the trustworthy one.
