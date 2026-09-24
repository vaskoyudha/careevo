# MotionSites — SaaS Value (Questly Landing Page)

- **Source URL:** `https://motionsites.org/prompts/saas-value?copy=1`
- **Canonical URL:** `https://motionsites.org/prompts/saas-value`
- **ID:** `ab189cea-752b-5edd-969f-c58d0aeff9ae`
- **Category:** SaaS / Health
- **Access Model:** Free (gated by login on website)
- **High-Res UI Preview:** `https://motionsites.org/assets/catalog-previews/saas-value-ecade96f3fa6.png`
- **Poster WebP:** `https://motionsites.org/assets/catalog-posters/saas-value-421bef2c1b.webp`
- **Target Tech Stack:** React, TypeScript, Tailwind CSS, Vite, `lucide-react`

---

## Complete AI Generation Prompt

```markdown
Build a full-viewport hero section for a modern SaaS landing page called "Questly" using React, TypeScript, Tailwind CSS, and Vite. Use `lucide-react` for all icons. Do not use other third-party UI libraries.

### 1. Visual Theme & Style
- **Background:** Panoramic nature photograph featuring rolling lush green hillside with a soft light blue sky and gentle cloud line.
- **Color Palette:**
  - Page foreground text: Deep charcoal / near black (`#0D1117`).
  - High-contrast highlights: Pure white (`#FFFFFF`).
  - Translucent glass pills: `rgba(255, 255, 255, 0.75)` backdrop-blur with subtle borders.
  - Embedded App Mockup: Dark mode canvas (`#161618`), card surfaces (`#222225`), border outlines (`#2E2E32`), warm orange accent (`#F05A28`), green status indicator (`#22C55E`).
- **Typography:** Modern clean sans-serif (Inter, Geist, or Nimbus Sans TW01).

---

### 2. Navigation Bar (Top)
- Fixed or sticky transparent top header.
- **Left Brand:**
  - Square brand mark with an upward-right angled arrow glyph.
  - Label text: "Questly" (semi-bold).
- **Center Nav Links:**
  - `Toolkit` (with a small downward chevron `ChevronDown`).
  - `Plans`
  - `News`
- **Right Action:**
  - Solid black pill button (`rounded-full px-5 py-2 text-sm font-medium bg-black text-white hover:bg-neutral-800`).
  - Label: `Try it free`.

---

### 3. Hero Section
- **Headline (Centered, Bold, 2 Lines):**
  - Line 1: `Get cited.`
  - Line 2: `Effortlessly.`
  - Style: `text-5xl md:text-7xl font-bold tracking-tight text-neutral-900`.
- **Interactive AI Prompt Bar (Centered):**
  - Frosted glass container (`max-w-xl mx-auto rounded-full bg-white/70 backdrop-blur-md border border-black/10 px-5 py-3 shadow-lg flex items-center justify-between`).
  - Input text / placeholder: `What makes content rank in AI search?`
  - Right action button: Small black circular icon button (`w-9 h-9 rounded-full bg-black text-white flex items-center justify-center hover:scale-105 transition`) with an upward arrow icon (`ArrowUp`).
- **Sub-headline (Centered):**
  - Line 1: `Ship articles that answer actual customer questions`
  - Line 2: `— and be seen on ✦ ChatGPT` (with a small 4-point sparkle icon `Sparkles`).
  - Style: `text-base md:text-lg text-neutral-700 font-normal mt-4`.
- **Button Group (Centered):**
  - Primary button: Solid black pill button (`px-6 py-3 rounded-full bg-black text-white font-medium text-sm hover:bg-neutral-800`).
    - Label: `Try It Free`.
  - Secondary button: Translucent light-gray pill button (`px-6 py-3 rounded-full bg-white/60 hover:bg-white/90 border border-neutral-300 text-neutral-900 font-medium text-sm`).
    - Label: `Talk to sales`.

---

### 4. Embedded Product Mockup (questly.ai web app)
Place a floating dark-mode browser mockup centered below the hero copy, with its lower edge seamlessly resting into the grassy terrain.

#### Window Frame & Browser Chrome:
- Rounded container (`rounded-2xl border border-neutral-800 bg-[#161618] shadow-2xl overflow-hidden`).
- Top bar:
  - Three traffic lights on the left: Red (`#EF4444`), Yellow (`#F59E0B`), Green (`#10B981`).
  - Browser navigation icons: Sidebar toggle, left arrow (`<`), right arrow (`>`).
  - Center address bar: Dark pill with monitor icon (`Monitor`) and text `questly.ai`.
  - Right utility buttons: Refresh (`RotateCw`), share (`Share2`), plus (`Plus`), window duplicate icon.

#### Left Sidebar:
- Brand icon (arrow mark) + grid icon.
- Workspace selector card:
  - Orange rounded square avatar with the letter **C**.
  - Title: **CareNest**.
- Navigation items (with right search icon `Search`):
  - Compass icon (`Compass`) → **Uncover**.
  - Layer stack icon (`Layers`) → **Subjects**.
  - Inbox tray icon (`Inbox`) → **Inbox**.
- Section `Latest`:
  - Item 1: `Caring for Aging Parents: What N...` (Green dot + `Ready to Release`).
  - Item 2: `Ways to Handle Caregiver Fatigue...` (Green dot + `Ready to Release`).
  - Item 3: `Juggling a Career and Elder Care...`.

#### Main Viewport:
- **Header:**
  - Workspace title: Orange **C** logo, **CareNest**, subtitle `Smart home-care services for families and elders`.
  - Right button: Dark pill button with sparkles icon `Generate 🪄`.
- **4-Column Metric Summary Cards:**
  1. `RELEASED` | `62` | `Posts indexed`
  2. `BREADTH` | `12` | `Subject groups`
  3. `REMAINING` | `412` | `Ready to draft`
  4. `MAX REACH` | `3,156,200` | `Searches a month`
- **Section: `Subjects ⓘ`:**
  - 3 Cards grid:
    - Card 1: **Elder Care** (`Mild · 11.7K/mo · 38 questions`)
    - Card 2: **Mobility** (`Easy · 10.2K/mo · 24 questions`)
    - Card 3: **Home Safety** (`7.9K/mo · 31 questions`)
- **Section: `Drafting inbox`:**
  - Header with right count badge: `412 ready`.
  - Table preview showing keyword query title, search volume (`13.4K/mo`), difficulty (`Easy`), status badge with orange dot `Drafting`.
```
