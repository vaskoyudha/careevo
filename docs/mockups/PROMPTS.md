# Prompt imagery untuk section yang belum ada

Referensi visual untuk section yang hilang di beranda. File ini berisi **prompt
text** — bukan gambar. Jalankan di generator apa pun, lalu serahkan hasilnya
kembali ke agent sebagai referensi.

## Cara pakai

Satu prompt = satu section. Kalau generatormu butuh aspect ratio, pakai
`--ar` (Midjourney) atau set ukuran ekIVALen di UI generator.

Semua prompt mengasumsikan **design system Careevo yang sekarang** — tidak ada
token warna baru, tidak ada font baru. Kalau sebuah prompt terlihat
menyarankan sesuatu yang tidak ada di `src/app/globals.css`, abaikan saja;
prompt ini menuliskan bentuk dan ritme, bukan token.

---

## 1. Privasi (menggantikan 404 `/privasi`)

```
A clean documentation page for a privacy policy, rendered as a real
product surface rather than a legal PDF. Two-column layout: a narrow
sticky table of contents on the left in small monospace type, and a
comfortable reading measure on the right, roughly 65 characters per line.

Content blocks are structured data, not raw markup: each section is a
heading followed by short paragraphs and occasional bulleted lists. One
callout box near the top summarises the strongest privacy claim in
plain language. A small table lists what is recorded, what is never
recorded, and how long each is kept.

Visual language: white background, generous whitespace, hairline
dividers in a very light neutral. Section headings are medium-weight
Inter at large size with tight negative letter-spacing, roughly -1.9px.
Body copy is regular weight, relaxed line height, in a soft slate grey
rather than pure black. One accent only: a deep oceanic blue used for
the active table-of-contents entry, inline links, and focus rings.

Mood: calm, editorial, trustworthy. Reads like a well-designed developer
tool's documentation, not like a compliance document. No illustrations,
no stock photography, no icons used decoratively.

--ar 16:10
```

## 2. Syarat & Ketentuan

```
A terms of service page as a real product surface. Same two-column
structure as the privacy page: sticky table of contents left, readable
column right, hairline dividers, white background, generous whitespace.

This page leads with a summary card that states the core commitment in
one sentence before the dense legal text begins, because most visitors
arrive wanting the gist, not the clauses. Numbered sections, a
definitions block set apart with a subtle background tint, and a
clearly marked "last updated" line with a date in monospace type.

Visual language identical to the privacy page — the two must read as
siblings. Inter throughout, medium-weight headings with tight tracking
around -1.9px, soft slate body copy, deep oceanic blue as the only
accent for links and the active navigation entry.

Mood: plain-spoken and fair. Reads as though a person wrote it, not
assembled from a template. No icons, no illustrations, no photography.

--ar 16:10
```

## 3. Bukti — ganti testimoni palsu dengan angka bersumber

```
A proof section built entirely from sourced statistics, replacing what
was previously a row of fabricated customer testimonials.

Layout: a centred section label in small uppercase monospace, a large
editorial headline beneath it, a short muted paragraph, then a four-up
grid of stat tiles. Each tile stacks three things: a small muted label,
a very large figure in medium-weight Inter, and beneath it a source
line in tiny monospace with a date. Two of the four figures are tinted
in a restrained warning amber and a muted red to signal severity; the
other two stay in the default ink colour so the tinting reads as
deliberate emphasis rather than decoration.

Below the grid, a single horizontal band containing a verified
credential preview: a small card showing a public verification URL, a
green verified chip, a short list of key-value pairs, and a truncated
cryptographic signature in monospace.

Visual language: white background, hairline borders in a light neutral,
12–16px corner radii on cards, one soft shadow layer. Headings tight
tracked at -1.9px, body soft slate. Accent is deep oceanic blue plus
the small green verification chip. Warm editorial, high information
density, zero decoration.

Mood: evidentiary. Every number on screen looks like it can be traced
to a public source. No faces, no portraits, no stock photography — the
credibility comes from the figures and their citations, not from
imagined customers.

--ar 16:9
```

## 4. Kontak

```
A contact page, generous and calm, with lots of empty space.

Layout: a two-column split. Left column carries a large editorial
headline, a short muted paragraph, and three contact routes stacked
vertically — each a bordered card with a small line icon, a label, a
value, and a muted one-line note. Right column is a single form:
labelled fields with visible labels above each input, generous 44px
touch targets, a select, a textarea, and one filled primary button
using a soft blue gradient. Inputs are white with hairline borders and
a visible blue focus ring.

Above the split, a slim horizontal strip answers the three most common
questions in one line each, so most visitors never need the form.

Visual language: white background, Inter throughout, medium-weight
headings tight tracked at -1.9px, body soft slate. Rounded pill
primary action in a light-to-mid blue gradient; everything else is
outlined and quiet. Cards at 12–16px radius with one soft shadow.

Mood: unhurried and human. Reads as though a small team answers its
own inbox. No chatbot widget, no chat bubble, no illustration.

--ar 16:10
```

## 5. Keamanan & Kepercayaan

```
A trust and security section for an education platform that signs its
credentials cryptographically.

Layout: a centred label, large editorial headline, short muted
paragraph, then three tall cards side by side. Each card is a bordered
white panel with a small line icon in a soft tinted square, a
medium-weight title, a short paragraph, and a small monospace detail
line at the bottom suggesting a technical artifact. To one side sits a
compact verification panel showing a public credential URL, a green
verified badge, a short key-value list, and a truncated signature.

Below the cards, a full-width muted band containing a compact
four-column list of security properties, each a short label and value
pair set in small type.

Visual language: white background, hairline borders in light neutral,
12–16px radii, one soft shadow layer. Inter, headings tight tracked at
-1.9px, body soft slate. Accent is deep oceanic blue with a single
green for the verified state. Everything is quiet and technical.

Mood: sober confidence. The page argues through specifics and
artifacts, not through adjectives. No padlock clip-art, no shield
emoji, no stock photography of people in hoodies.

--ar 16:9
```

## 6. FAQ — render di server

```
An FAQ section, server-rendered, laid out as a two-column split.

Left column: a large editorial headline and beneath it a small support
card with three overlapping circular avatars, a short line of muted
text, and one filled pill button. Right column: six accordion items,
each a full-width row with a question in medium-weight Inter at
roughly 20px and a small plus-shaped icon at the right edge, separated
by hairline dividers. The first item is open, showing its answer as a
muted paragraph directly beneath the question row.

The key detail: every answer's text is present in the served HTML, not
only after hydration. The visual result is that all six questions and
all six answers exist for crawlers and for no-JS visitors.

Visual language: white background, generous vertical rhythm, hairline
dividers, Inter throughout, headings tight tracked at -1.9px, answers
in soft slate. The open row's icon is rotated 45 degrees into a close.
One accent, deep oceanic blue, on the support button.

Mood: plain and answerable. No accordions nested inside accordions, no
categories, no search field. Six questions that a real person would
actually ask.

--ar 16:9
```

## 7. Navigasi antar-section

```
A compact in-page navigation bar for a long scrolling marketing page.

A single horizontal row of small pill-shaped anchor links, evenly
spaced, sitting on a white background with a hairline top and bottom
border. The link matching the currently visible section is filled with
a soft blue gradient and dark text; the rest are outlined and muted. A
small horizontal progress indicator sits flush along the bottom edge of
the bar, filled proportionally to scroll depth in mid blue.

The whole component is restrained and utilitarian — it reads as a table
of contents for a long page, not as a feature. Generous padding, 44px
touch targets, generous letter spacing on the labels.

Visual language: white background, Inter, small medium-weight labels,
pill radii, hairline borders in light neutral, one accent colour. No
icons, no dropdowns, no shadow, no illustration.

--ar 21:9
```

---

## Catatan untuk agent yang menerima gambar

Kalau gambar-gambar ini dikembalikan sebagai referensi, yang paling berguna
untuk ditiru:

- **Proporsi dan kepadatan**, bukan warna persis. Warna diambil dari token,
  bukan dari sampel piksel.
- **Ritme vertikal** — berapa banyak ruang putih antarbagian.
- **Hierarki tipografi** — mana yang besar, mana yang kecil, mana yang redup.

Kalau sebuah mockup memuat fixture, wajah orang sungguhan, atau angka yang
tidak bisa dipertanggungjawabkan, **jangan** ikut masuk ke halaman. Bagian yang
sedang rusak di beranda justru berasal dari konten yang tidak benar — mockup
tidak boleh mengembalikannya.
