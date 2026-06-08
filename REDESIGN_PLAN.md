# Aangan — UI/UX Complete Redesign Plan
> **Status:** Planning complete. Ready to implement on feature branch `redesign/ui-overhaul`.
> **Goal:** Elevate every screen from functional → polished, premium, modern.
> **Scope:** Design tokens · Brand · Core components · All screens

---

## 1. Design Philosophy

**Current feel:** Warm Indian food app skin stretched onto a community platform. Orange/coral accent, cramped spacing, dated gradient buttons.

**Target feel:** A premium, modern community operating system. Clean whitespace, confident typography, purposeful color. Feels like Linear or Notion but warm and culturally resonant — not cold SaaS.

**Three principles:**
1. **Breathe** — generous padding, clear visual hierarchy, nothing crammed
2. **Ground** — earthy, trustworthy palette; not flashy but unmistakably beautiful
3. **Alive** — micro-interactions, smooth spring animations, purposeful motion

**Tagline (new):** *"Your society, together."*

---

## 2. New Color System — "Jade"

Replaces the coral/orange (`#FF5A3C`) entirely. Rationale: teal/jade reads as trust + community + nature — perfect for a residential society hub. Warm amber is reserved for food-only contexts.

### Light Mode

| Token | Old | New | Role |
|-------|-----|-----|------|
| `bg` | `#FBF7F2` (warm cream) | `#F8FAF9` (cool-warm neutral) | Page background |
| `surface` | `#FFFFFF` | `#FFFFFF` | Cards, sheets |
| `inset` | `#F4F0E9` | `#F0F4F3` (teal-tinted gray) | Chips, tag BGs, fields |
| `ink` | `#16171A` | `#0D1B1A` (near-black, slight teal) | Primary text |
| `muted` | `#696E76` | `#4B6B68` (muted teal-gray) | Secondary text |
| `faint` | `#9CA1A9` | `#93AEAB` | Tertiary, placeholders |
| `line` | `#E9E9E8` | `#E2ECEA` | Hairlines, dividers |
| `accent` | `#FF5A3C` 🔴 | `#0F766E` (Teal-700) | CTAs, active states, brand |
| `accentPress` | `#E8431F` | `#0D6B64` | Pressed CTA |
| `accentSoft` | `#FFE9E3` | `#F0FDFA` (Teal-50) | Chip BG, tag BG |
| `onAccent` | `#FFFFFF` | `#FFFFFF` | Text on CTA buttons |

### Dark Mode

| Token | Old | New |
|-------|-----|-----|
| `bg` | `#0E0F12` | `#0B1614` (deep teal-black) |
| `surface` | `#191B1F` | `#121F1E` |
| `inset` | `#21242A` | `#1A2C2A` |
| `ink` | `#F4F5F7` | `#E8F5F3` |
| `muted` | `#A5ABB5` | `#7AABA6` |
| `faint` | `#6E747E` | `#4D7572` |
| `line` | `#292C33` | `#1E3432` |
| `accent` | `#FF6C50` | `#14B8A6` (Teal-500, lighter for dark) |
| `accentPress` | `#FF5A3C` | `#0D9488` |
| `accentSoft` | `#2B1914` | `#042F2E` (very dark teal) |

### New Gradient System

```
hero:      #0D9488 → #10B981   (teal to emerald — brand/primary)
heroDark:  #0F766E → #0D9488
food:      #D97706 → #F59E0B   (amber — food section only)
warm:      #F97316 → #FB923C   (orange — warmth accents)
cool:      #0EA5E9 → #06B6D4   (sky/info elements)
```

### Semantic Colours (unchanged — already good)
- `veg`: `#14A06A` — Indian veg green
- `nonveg`: `#E0322B` — Indian non-veg red
- `whatsapp`: `#25D366`
- Emergency red: `#EF4444`
- Polls indigo: `#6366F1`

---

## 3. Typography Upgrade

### Font Change

We have **5 unused premium fonts** already installed. Activating two of them:

| Role | Old | New | Why |
|------|-----|-----|-----|
| Display / Hero | BricolageGrotesque | **BricolageGrotesque** *(keep)* | Already beautiful, keep for brand |
| Body / UI | HankenGrotesk | **Plus Jakarta Sans** | Cleaner, more modern, widely used in 2025 premium products |

**Plus Jakarta Sans** replaces HankenGrotesk everywhere in the UI. It's slightly more geometric and has better optical sizing at small text sizes. Bricolage stays for all headlines and the wordmark.

### Font Mapping Update (in tailwind.config.js)

```js
fontFamily: {
  'sans': ['PlusJakartaSans_400Regular', ...],
  'sans-md': ['PlusJakartaSans_500Medium', ...],
  'sans-sb': ['PlusJakartaSans_600SemiBold', ...],
  'sans-bold': ['PlusJakartaSans_700Bold', ...],
  'display': ['BricolageGrotesque_600SemiBold', ...],
  'display-x': ['BricolageGrotesque_700Bold', ...],
  'display-xx': ['BricolageGrotesque_800ExtraBold', ...],
}
```

### Type Scale (key changes)

- Section headers on Home: `36px` BricolageGrotesque (↑ from 28px)
- Card titles: `15px` PlusJakartaSans SemiBold (was Hanken)
- Body text: `14px` PlusJakartaSans Regular (was 13px — more comfortable)
- Labels/chips: `12px` PlusJakartaSans Medium (was 11–12px HankenGrotesk)
- Meta/faint: `11px` PlusJakartaSans Regular

---

## 4. Brand Identity Redesign

### New Logo Mark

**Concept:** A stylized bold "A" on a jade gradient square (like an iOS app icon). Simple, memorable, instantly recognisable at any size. No Ionicons needed — pure Typography + LinearGradient.

```
┌─────────┐
│         │
│    A    │  ← BricolageGrotesque_800ExtraBold, white, letter-spacing -2
│         │
└─────────┘
  ↑ Rounded corners (22% of size), teal→emerald gradient
```

**Sizes:**
- NavRail/TopBar: 30×30px box, 18px "A"
- Auth/Splash: 80×80px box, 50px "A"
- Favicon: 32×32px

**Wordmark:** "Aangan" in BricolageGrotesque_700Bold, `text-ink`, size `1.1× box size`

**Tagline (shown on auth/splash only):** *"Your society, together."* in PlusJakartaSans_400Regular, muted color

### Brand.tsx Changes
- Remove Ionicons `home` icon
- New `LogoMark` component: rounded square + gradient + "A"
- `Wordmark`: LogoMark + "Aangan" text side by side
- `BrandFull`: LogoMark + "Aangan" + tagline, centered, for auth screens
- Export `APP_TAGLINE = 'Your society, together.'`

---

## 5. Core Component Redesigns

### 5a. Button

**Problem now:** Heavy gradient on primary, inconsistent with new cleaner aesthetic.

**New design:**
```
primary: Solid #0F766E bg, white text, subtle inner glow (no gradient)
         On press: scale 0.97 via Reanimated, darken to accentPress
         Shadow: 0 4px 14px rgba(15,118,110,0.35) — teal shadow
outline: 1.5px solid accent border, accent text (was 1px)
ghost:   No border, muted text, inset bg on press (unchanged)
danger:  Solid red, white text (unchanged)
whatsapp: Solid WhatsApp green (unchanged)
```

All sizes get a tiny scale-down press animation via react-native-reanimated.

### 5b. NavRail

Already redesigned (collapsible, sections). Additional tweaks with new color system:
- Active item: jade left-bar + jade text + teal-soft background
- Collapse toggle: slightly more prominent (visible on hover)
- Section labels: in jade-muted tone
- New Post CTA: solid jade (no old gradient)
- Subtle separator between primary nav and community section (1px line)

### 5c. TopBar (mobile)

**Problem now:** Plain thin bar, barely noticeable.

**New design:**
- Slightly taller, cleaner
- Wordmark centred on mobile (not left-aligned)
- Right side: avatar icon button (navigates to /you) instead of just theme toggle
- Theme toggle moves to `/you` profile tab (out of TopBar)
- `expo-glass-effect` for frosted glass on web (when scrolled)

### 5d. Field / Form Inputs

**Problem now:** Fields feel basic.

**New design:**
- Bottom-border-only style (like Google Material 3 but cleaner)
  OR full-border rounded with subtle shadow on focus
- Floating label animation (label lifts when field is focused/filled)
- Focus ring: 2px jade border, soft jade shadow
- Error state: red border + error message below with icon

### 5e. Cards

**ListingCard:**
- Remove heavy border, add subtle shadow instead: `0 1px 3px rgba(0,0,0,0.06), 0 8px 24px -12px rgba(0,0,0,0.12)`
- Category color used as top accent line (3px) — already doing this, keep
- Price badge: pill in jade-soft with jade text
- Avatar: slightly larger (32px → 36px)
- WhatsApp CTA: smaller, right-aligned, jade or green tonal

**DishCard:**
- Photo: taller hero (was fixed height, now 56% aspect ratio)
- Gradient overlay: softer, starts lower
- Price chip: `₹` in white bold on dark overlay
- VegMark: slightly larger
- "Order" button: solid jade at bottom

**PostCard (Feed):**
- Remove border entirely — use shadow + background
- Category color bar at top — thicker (4px)
- Author row: avatar + name/flat inline
- Reply count as a subtle "N replies" badge

### 5f. Avatar

Keep deterministic color approach but update palette to match new system:
- Replace the 6 warm tones with 6 slightly more muted/modern tones: Forest, Teal, Slate, Indigo, Plum, Rose

---

## 6. Screen Redesigns

### 6a. Home Screen (`index.tsx`)

**Current:** Scrolling list of service tiles, bare greeting.

**New layout:**
```
┌─────────────────────────────────────────┐
│  HERO SECTION (no scroll — above fold)  │
│  ─────────────────────────────────────  │
│  "Good morning, Kirti 👋"  [24px, bold] │
│  "Sector 4, Senate Towers"  [14px,muted]│
│  ─────────────────────────────────────  │
│  3 QUICK ACTION CHIPS (horizontal scroll│
│  [🍳 Order food] [📢 Post] [🔍 Search]  │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  SERVICES GRID                          │
│  "What do you need?" [section header]   │
│  ┌──────┐ ┌──────┐ ┌──────┐           │
│  │ Food │ │Tuiti.│ │Tailor│           │
│  └──────┘ └──────┘ └──────┘           │
│  ... (2 or 3 cols responsive)           │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  COMMUNITY SECTION                      │
│  "Community" [section header]           │
│  [Polls]  [Emergency]                   │
└─────────────────────────────────────────┘
```

**Changes:**
- Time-aware greeting: "Good morning / afternoon / evening"
- Quick action chips: horizontal scroll, pill-shaped, jade tint
- Service tiles: icon in colored circle (not square), cleaner label, no blurb text on mobile
- Category tiles use emoji instead of Ionicons for more character
- Subtle shadow on each tile card
- Section headers: `14px` allcaps bold tracking-widest `text-muted`

### 6b. Feed Screen (`feed.tsx`)

**Current:** Plain card list.

**New layout:**
- Filter chips: more pill-like, active = filled jade
- PostCard: no border, subtle shadow, more breathing room
- Empty state: proper illustration area (centered emoji + message)
- FAB: glass-morphism effect behind, jade fill
- Compose modal: full-screen on mobile, sheet on desktop; larger text area

### 6c. Food Screen (`food.tsx`)

**Current:** Functional but dense.

**New:**
- Slot filter: tab-bar style (pill tabs, not just text buttons)
- DishCard: photo aspect ratio improved, gradient overlay softer
- "No food today" empty state with helpful suggestions
- Tiffin card: distinct visual style from one-off dishes

### 6d. You Tab (`you.tsx`)

**Current:** Basic profile with segments.

**New:**
- Hero profile card: large avatar (64px) + name + flat + roles chips
- Segments (Listings / Saved / Kitchen): pill tabs inside a card — cleaner
- Community badge: more prominent, colored by community
- Settings section at bottom (link to profile/me)

### 6e. Search Screen

**Current:** Clean but minimal.

**New:**
- Search bar: prominent, top of screen, auto-focuses on tap
- Recent searches chip row
- Category quick-filter chips (horizontal scroll)
- Results: same card design as category feeds

### 6f. Sign-in Screen

**Current:** Basic phone + PIN form.

**New:**
- BrandFull at top (new logo + tagline)
- Phone input: clean field with country code prefix (`+91`)
- 4-digit PIN dots (visual PIN pad instead of keyboard input)
  OR: Keep keyboard input but style it as OTP-style dot indicators
- "Continue" button: full-width solid jade
- Society picker: clean dropdown/modal
- Background: subtle gradient or noise texture pattern (very faint)

---

## 7. Micro-interactions & Motion

Using `react-native-reanimated` (already installed at v4.3.1):

| Interaction | Animation |
|-------------|-----------|
| Button press | Scale to 0.97, 120ms spring |
| Card press | Scale to 0.985, opacity 0.9, 100ms |
| Filter chip select | Scale 1 → 1.05 → 1, 200ms spring |
| NavRail collapse | Already done — spring animation |
| Screen transitions | Expo Router default (keep) |
| Tab switch | Cross-fade on tab screen change |
| Modal open | Slide up + backdrop fade |
| Loading states | Shimmer skeletons (already done for feed) |
| Pull to refresh | Standard RefreshControl, jade tint |
| FAB entrance | Delay + spring from below on screen focus |

---

## 8. Tailwind Config Updates

New custom utilities to add in `tailwind.config.js`:

```js
// New shadow system
boxShadow: {
  'card': '0 1px 3px rgba(0,0,0,0.05), 0 8px 24px -12px rgba(0,0,0,0.10)',
  'card-hover': '0 2px 8px rgba(0,0,0,0.08), 0 16px 32px -12px rgba(0,0,0,0.14)',
  'fab': '0 8px 24px -6px rgba(15,118,110,0.40)',   // jade shadow
  'button': '0 2px 8px rgba(15,118,110,0.30)',
  'soft': '0 2px 12px -4px rgba(0,0,0,0.12)',
  'sheet': '0 -8px 40px rgba(0,0,0,0.18)',
}
```

---

## 9. Implementation Phases

### Phase A — Foundation (Day 1)
1. `src/theme.ts` — new color tokens + gradients
2. `src/global.css` — updated CSS variables
3. `tailwind.config.js` — new fonts, shadows, extended theme
4. `src/app/_layout.tsx` — load Plus Jakarta Sans fonts
5. `src/components/Brand.tsx` — new "A" logo + BrandFull with tagline

### Phase B — Core Components (Day 1–2)
6. `src/components/ui/Button.tsx` — solid jade, reanimated press
7. `src/components/NavRail.tsx` — apply new jade colors + polish
8. `src/components/TopBar.tsx` — centered wordmark, avatar shortcut
9. `src/components/forms.tsx` — new field style with focus ring
10. `src/components/ui/Avatar.tsx` — updated color palette

### Phase C — Cards & Lists (Day 2)
11. `src/components/listings/ListingCard.tsx` — shadow, spacing
12. `src/components/DishCard.tsx` (if separate file) — photo ratio, price
13. `src/components/PostCard` within feed.tsx — shadow, no border
14. Skeleton loaders — update to match new card designs

### Phase D — Screens (Day 3)
15. `src/app/(tabs)/index.tsx` — Home hero, quick actions, section headers
16. `src/app/(tabs)/feed.tsx` — filter chips, PostCard, FAB
17. `src/app/(tabs)/food.tsx` — slot tabs, dish grid
18. `src/app/(tabs)/you.tsx` — profile hero card
19. `src/app/(auth)/sign-in.tsx` — brand-first layout, PIN style

### Phase E — Polish (Day 3–4)
20. Pull all micro-animations (Button press with Reanimated)
21. Update empty state illustrations (emoji + copy for each screen)
22. Dark mode pass — verify all new tokens look correct in dark
23. Desktop/wide pass — verify NavRail + content layout on wide screens
24. Accessibility pass — text contrast ratios ≥ 4.5:1

---

## 10. Files Changed

| File | Change Type |
|------|------------|
| `src/theme.ts` | Full color + gradient replacement |
| `src/global.css` | CSS variable update |
| `tailwind.config.js` | Fonts, shadows, extended palette |
| `src/app/_layout.tsx` | Load PlusJakartaSans fonts |
| `src/components/Brand.tsx` | New "A" logo, new tagline |
| `src/components/ui/Button.tsx` | Solid jade, Reanimated press |
| `src/components/ui/Avatar.tsx` | Updated tonal palette |
| `src/components/NavRail.tsx` | New jade colors, polish |
| `src/components/TopBar.tsx` | Centered wordmark, cleaner |
| `src/components/forms.tsx` | Focus ring, floating labels |
| `src/components/listings/ListingCard.tsx` | Shadow, spacing |
| `src/app/(tabs)/index.tsx` | Hero, quick actions |
| `src/app/(tabs)/feed.tsx` | Filter chips, PostCard |
| `src/app/(tabs)/food.tsx` | Slot tabs |
| `src/app/(tabs)/you.tsx` | Profile hero |
| `src/app/(auth)/sign-in.tsx` | Brand-first, PIN style |

---

## 11. What Does NOT Change

- All data layer (`lib/`, `supabase/`) — zero changes
- Routing structure — zero changes
- Business logic in screens — zero changes
- Mobile tab bar — minor color update only
- FlashList, pagination, realtime — zero changes
- DishCard functionality (ordering, WhatsApp) — only visual changes

---

## Quick Visual Reference

### Current vs New (key metrics)

| Element | Current | New |
|---------|---------|-----|
| Primary accent | Coral `#FF5A3C` | Jade `#0F766E` |
| BG light | Cream `#FBF7F2` | Cool-neutral `#F8FAF9` |
| Body font | Hanken Grotesk | Plus Jakarta Sans |
| Logo | Ionicons `home` in gradient box | "A" lettermark in jade gradient |
| Button style | Warm gradient | Solid jade + teal shadow |
| Card style | `border border-line` | Shadow only (no border) |
| Tagline | *(none)* | "Your society, together." |
| Card radius | `rounded-3xl` (24px) | `rounded-2xl` (16px) — cleaner |
| Section headers | Varies | `12px` allcaps, tracking-wider, muted |

---

*Once you approve this plan, implementation starts on branch `redesign/ui-overhaul`.*
