# FutureLine Fitness — Design System

A stunning dark-navy + teal design language for a mobile-first fitness coaching platform. This design system captures the visual DNA of FutureLine Fitness and gives you everything you need to build new surfaces that feel native to the product.

## Product Context

**FutureLine Fitness** is a multi-role fitness coaching PWA. It is a single codebase that serves three different audiences:

- **Members** — track nutrition, macros, and workouts; follow a plan; message their coach; submit weekly check-ins.
- **Coaches** — browse assigned clients, build training/nutrition plans, view client dashboards, reply to chat messages.
- **Admins** — manage all users, oversee subscriptions, view any client's plan.

The product is **aggressively mobile-first** (`.mobile-container` is `max-w-2xl` centered on desktop with shadow). Core user-facing surfaces include:

- **Dashboard** — "Am I on track?" calorie/macro table, training burn card, weekly calendar, weight timeline
- **Onboarding** — multi-step profile builder (body stats → goal → custom params)
- **Coach Marketplace** — public grid of service cards (the one desktop-shaped screen)
- **Meal Plan / Nutrition** — daily meal logging + shopping list
- **Workout Plan / Training Builder** — exercise library with real photo thumbnails (see `assets/exercises/`)
- **Progress** — weight / measurements / photos timeline
- **Coach Clients / Admin Panel** — client management tables

It is **bilingual EN/AR** with full RTL support (`dir="rtl"` + `ps-*`/`pe-*` Tailwind utilities). Cairo font swaps in for Arabic.

## Sources

- **Codebase:** `FL-Fitness-Coach/` (locally mounted, read-only)
  - Web app: `FL-Fitness-Coach/artifacts/web/`
  - Tokens: `artifacts/web/src/index.css`
  - UI components: `artifacts/web/src/components/ui/` (shadcn-style, Radix-based)
  - Pages: `artifacts/web/src/pages/`
  - Translations: `artifacts/web/src/lib/translations.ts`
- **Real imagery:** `FL-Fitness-Coach/Y Gym Picture/` (40+ exercise photos) and `FL-Fitness-Coach/artifacts/web/public/exercises/`
- **Brand mark:** `FL-Fitness-Coach/artifacts/web/public/logo.png`

---

## CONTENT FUNDAMENTALS

### Tone

Confident, clinical-but-warm, **precision-focused**. It treats you like a serious athlete, not a casual gym-goer. Copy is short, instructional, and quantified — numbers are the point. There's no marketing fluff; body and macro stats *are* the content.

Key tagline language from the product itself:
- *"Sign in to your **precision plan**"*
- *"Start building your **precision plan**"*
- *"Your Body Profile"*
- *"What is your goal?"*
- *"AM I ON TRACK?"* (overline, all-caps)

### Voice

- **Second-person ("you")** everywhere. "Your coach," "your plan," "your weight gap of…"
- **Imperative instructions** for CTAs: "Sign In", "Submit check-in", "Create Account"
- **Questions as section headers** to prompt action: "What is your goal?", "How are you feeling?"
- Coach voice is **personal and direct** in messaging; members address their coach casually.

### Casing

- **Title Case** for page titles and buttons ("Forgot Password", "Create Account")
- **Sentence case** for body, hints, and supporting copy
- **ALL-CAPS OVERLINE** (tracking: 0.1em, 10px, muted) for section dividers on data-dense surfaces — this is a core signature. Examples: "AM I ON TRACK?", "TODAY'S DEFICIT", "CONSUMED / TARGET / VARIANCE"

### Emoji

Used **sparingly** and **only** in very specific places:
- Weekly check-in emoji-sliders: `😫😔😐🙂💪` (energy) and `😩😪😐😌😴` (sleep)
- A single ✅ for completion state ("✅ Submitted this week")
- A single 💬 in toast titles ("💬 New message from your coach")

Emoji are **never** decorative. They carry a functional meaning (rating, status). Do not add emoji to headings, buttons, or nav.

### Numbers & Units

- Numbers are always integer-rounded in data displays (`Math.round()`).
- Units are lowercase and smaller than the value: `2250 kcal`, `185 g`, `82.5 kg`.
- Deltas are prefixed with `+` or `−` (minus sign, not hyphen), color-coded red/green.
- Unit abbreviations: `kcal`, `g`, `kg`, `cm`, `years`.

### Example copy samples

- *"Your coach will continue serving you for 3 more days."*
- *"Your precision plan"* (brand descriptor)
- *"Message your coach…"* (input placeholder, ellipsis included)
- *"How are you feeling? Any struggles?"* (check-in notes placeholder)
- *"No messages yet. Say hi to your coach!"* (empty state)

---

## VISUAL FOUNDATIONS

### Colors

- **Background:** `#0B1630` deep navy — the entire product lives here
- **Surface/card:** `#0F1F3D` slightly lighter navy, set directly on the bg with no shadow needed
- **Primary:** `#2DD4BF` teal (logo gradient resolves to this)
- **Text:** `#F0F6FF` cool white (not pure white — tints cooler for the navy backdrop)
- **Muted text:** `#7B95B8` blue-gray
- **Border:** `#1B3260` navy-toned, low contrast
- **Semantic:** `#EF4444` destructive, `#F59E0B` warning, `#22C55E` success, `#3B82F6` info
- **Macro palette (chart):** protein `#3B82F6`, carbs `#F59E0B`, fat `#EAB308`, burn `#F97316`

Tinted fills are ubiquitous: `bg-primary/10` for soft callouts, `bg-destructive/10` for warning panels, `border-primary/20` for tinted borders.

### Typography

- **Inter** (300–800) for all Latin text
- **Cairo** (300–700) swapped via `:root[lang="ar"] body` for Arabic
- Headings are **tight** (`-0.02em` tracking), **bold** (600–700)
- Overlines are **wide** (`tracking-widest`, `uppercase`, 10px, muted)
- Metric numbers use aggressive negative tracking (`tracking-tighter`) to feel like scoreboard data
- Body is 14px, `leading-relaxed` not used — line-height stays tight (1.5) because surfaces are dense

### Spacing & Layout

- Tailwind spacing scale; most cards pad at `p-5` (20px)
- Mobile container is capped at `max-w-2xl` with `mx-auto`
- Fixed bottom nav (64–72px tall) means content needs `pb-24` to clear it
- Section rhythm is `space-y-6` between card groups, `space-y-3` inside

### Backgrounds

- **Flat deep navy everywhere** — no gradient backgrounds on the product itself
- **One exception:** the `auth-bg.png` wallpaper (dark triangular prismatic pattern) behind login on desktop
- **Soft radial glow** on the login hero: `bg-primary/5 blur-[120px] rounded-full` positioned absolutely — a very subtle "light leak" effect
- Never full-bleed photography on chrome; photos appear only inside bounded image cards (exercise thumbnails)

### Corner Radii

- **Cards:** `rounded-2xl` (24px) — the default
- **Buttons / Inputs:** `rounded-xl` (16px)
- **Chips / Badges:** `rounded-md` (6–8px)
- **Avatars:** `rounded-full`
- **Icon wells:** `rounded-xl` (16px) — small 32×32 square with tinted bg

### Shadows

- **Cards:** `shadow-xl shadow-black/20` — soft dark shadows that work against the navy bg
- **Primary buttons:** `shadow-[0_0_20px_rgba(13,158,117,0.15)]` — a **subtle teal glow** (signature!)
- Elevated modals on mobile use `shadow-2xl shadow-black/50`
- **No inner shadows** anywhere. Depth is communicated through color values, not bevels.

### Borders

- Hairline `rgba(255,255,255,0.05)` used as row separators inside dense cards
- Solid navy borders `#1B3260` for card edges
- Tinted primary borders `border-primary/20` or `border-primary/40` for active/highlighted states
- Borders disappear on primary-filled surfaces (button `default` has no border)

### Animations

- **Framer Motion** drives page entries — `initial: {opacity: 0, y: 20}` → `animate: {opacity: 1, y: 0}` over 0.5s is the hero pattern (see login page)
- **Transitions:** `transition-all duration-300` is everywhere; `duration-200` on inputs; `duration-500` on progress bar fills
- **Easing:** mostly default `ease-in-out`; progress uses `easeInOut`
- **Press state:** `active:scale-[0.98]` on buttons and cards — a tactile squish
- **Hover:** subtle — opacity/`/80` on backgrounds, `/90` on primary bg, border color shift
- **Progress bars:** width-animated fills with `duration-500` — data loads in with a sweep
- **Loaders:** `Loader2` spinner in primary color, `animate-spin`

### Transparency & Blur

- Sticky headers and bottom nav use `bg-background/80 backdrop-blur-xl` — a signature iOS-style frosted bar
- Toast/banner overlays use `bg-[color]/10` fills with `border-[color]/20` — tinted translucent wash
- Disabled/loading states use `opacity-50`
- Blur is reserved for fixed chrome — **not** used mid-page for decorative frosting

### Layout Rules

- **Sticky top header** with backdrop-blur on every app screen
- **Fixed bottom nav** on all member screens (7 icon tabs, truncated labels)
- **Coach-viewing-client banner** slots *above* the main header when a coach is impersonating
- One primary CTA per screen, full-width on mobile
- Cards stack vertically with consistent rhythm; rarely side-by-side on mobile

### Iconography

See the `ICONOGRAPHY` section below.

---

## ICONOGRAPHY

### System: **lucide-react** (exclusive)

The entire app uses **Lucide** icons via `lucide-react`. This is non-negotiable — there is **no** mix of icon systems in the codebase. Every `<Icon>` import traces back to lucide.

Available as a CDN in this design system via `https://unpkg.com/lucide@latest` — recreate components with the `data-lucide` attribute or the inline SVG.

### Common icons (pulled from actual codebase usage)

- **Nav:** `LayoutDashboard`, `TrendingUp`, `CalendarDays`, `Dumbbell`, `UtensilsCrossed`, `ShoppingCart`
- **Actions:** `Settings`, `LogOut`, `ChevronRight`, `ChevronDown`, `ChevronLeft`, `ArrowLeft`, `Edit2`, `Check`, `X`, `Search`, `Plus`
- **Status:** `CheckCircle2`, `AlertTriangle`, `AlertCircle`, `Loader2` (spinner), `Bell`, `RotateCcw`
- **Fitness:** `Dumbbell`, `Flame`, `Zap`, `ClipboardList`
- **Social/coach:** `MessageCircle`, `Send`, `UserCheck`, `User`, `Star`
- **Data:** `Search`, `Calendar`

### Sizing

- Icons inline with text: `w-3.5 h-3.5` (14px) or `w-4 h-4` (16px)
- Nav/chrome icons: `w-5 h-5` (20px)
- Hero/empty-state icons: `w-8 h-8` to `w-12 h-12` with `opacity-30`
- Stroke: Lucide default (`strokeWidth={2}`), bumped to `strokeWidth={3}` on small checkmarks inside radio buttons for extra pop

### Emoji

Emoji are **not** icons here. They appear in 3 very specific places only — see Content Fundamentals.

### Unicode

The only unicode glyph used semantically is the **minus sign** `−` (U+2212), not a hyphen `-`, for negative deltas. Middle dots and em-dashes are used in prose but never as visual dividers.

### Logos

- `assets/logo.png` — the FutureLine "F" mark, deep-navy-to-teal gradient on a circle. Always placed on a **white rounded card** (`bg-white rounded-2xl p-2`) so the dark-on-dark doesn't vanish.

### Exercise Photography

- 40+ real photos live in `assets/exercises/` (flat angle, gym environment, warm cast). Used as square-cropped thumbnails in the exercise library and workout plan. These are the **only photographic assets** in the product.

---

## INDEX — What's in this folder

```
README.md                 ← you are here
SKILL.md                  ← Claude Agent SKILL manifest
colors_and_type.css       ← CSS variables + semantic type classes
fonts/                    ← Google Fonts loaded via URL (no local files)
assets/
  logo.png                ← FutureLine "F" mark
  favicon.svg             ← favicon
  auth-bg.png             ← dark prismatic auth wallpaper
  exercises/              ← 9 representative exercise thumbnails
preview/                  ← HTML preview cards for the Design System tab
  type-*.html
  color-*.html
  spacing-*.html
  components-*.html
  brand-*.html
ui_kits/
  app/                    ← mobile app UI kit (iOS device frame)
    README.md
    index.html            ← click-thru prototype: 6 screens
    FLComponents.jsx      ← atomic components (buttons, inputs, cards, macro bars, coach chat)
    FLScreens.jsx         ← screen compositions (Login, Dashboard, Meals, Workout, Progress, Onboarding)
    ios-frame.jsx         ← iOS device chrome
```

### Key files to read first

1. `colors_and_type.css` — all design tokens as CSS variables
2. `ui_kits/app/index.html` — see components in action
3. `ui_kits/app/README.md` — component inventory

---

## Known substitutions

- **Fonts:** Inter and Cairo are loaded directly from Google Fonts (the production app does the same). No local .ttf files required or included.
- **Icons:** Loaded from `lucide` CDN — identical to the `lucide-react` package the production app uses.
- **Auth background:** Copied as a raster PNG; the real product ships it as-is too.
