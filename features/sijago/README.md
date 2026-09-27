# SiJago

Careevo's DeepTutor-derived learning system, vendored from the upstream
DeepTutor project and rebranded **SiJago**.

## Provenance

- Upstream: <https://github.com/HKUDS/DeepTutor>
- Copied from: a local checkout's `web/` directory
- Stack: Next.js 16, React 19, TypeScript, Tailwind CSS 3
- Licence: **Apache License 2.0** — see the upstream `LICENSE` and the per-file
  provenance headers. Those notices must stay intact in any redistribution.

## What was changed from upstream

Branding, one deliberate feature removal, and one deliberate restyle. Everything
else is upstream's, untouched.

### Branding

| Change | Files |
| --- | --- |
| Document `title` → `SiJago` | `app/layout.tsx` |
| Logo `alt` → `SiJago` | `components/layout/AppShell.tsx`, `components/chat/home/SessionLoadingView.tsx` |
| `package.json` `name` → `sijago-web` | `package.json` |
| **Logo art → Careevo** | `components/sidebar/SidebarShell.tsx`, `components/layout/AppShell.tsx`, `components/chat/home/SessionLoadingView.tsx`, `features/chat/components/ChatWorkspace.tsx` |

The DeepTutor mark and wordmark are replaced by the Careevo lockup, cut into
three assets in `public/`:

| Asset | Size | Used for |
| --- | --- | --- |
| `careevo-mark.png` | 256×235 | the collapsed sidebar rail (mark only) |
| `careevo-logo.png` | 720×228 | expanded sidebar + mobile top bar (mark + wordmark) |
| `careevo-logo-full.png` | 1400×455 | the full lockup **with** the `Learn • Grow • Evolve` tagline, for anywhere with room |

The tagline sits **beside** the mark, not under it — it shares rows with the
mark's lower half — so the compact variant is produced by **erasing the tagline
region** (right of the mark, below the wordmark) and then trimming to the alpha
bounding box, not by cropping on `y`. A plain height crop slices the mark in
half, which is exactly what the first attempt did. The tagline is also 53px tall
against a 538px mark, so it turns to noise at sidebar size and is dropped there
regardless.

`favicon-16x16.png`, `favicon-32x32.png` and `apple-touch-icon.png` were
regenerated from the mark on an **opaque** rounded square: a transparent
apple-touch-icon is composited on black by iOS, which a blue mark does not
survive. No proxy change was needed — `isAuthExempt` in `lib/proxy-policy.ts`
matches a file-extension regex, so every new path is already exempt (that is
also why the logo still renders on `/login`).

The old `public/logo.png`, `logo_black.png`, `logo-ver2.png` and `banner.png`
are now **unreferenced** (~660 KB of DeepTutor rasters) but were left on disk
rather than deleted. `tests/proxy-policy.test.ts` still names `/logo.png`,
`/banner.png` and `/logo_black.png` as its example static paths; deleting the
files would be safe, but that is a separate call.

### Removed: Co-Writer and Subagents

Both features are gone from the product, so their routes, components, settings
and chat affordances are deleted rather than hidden. `/co-writer` and `/agents`
now 404. **Partners is untouched** and still works.

Deleted rather than kept behind a flag: the `/co-writer` and `/agents` route
groups, `features/co-writer/`, `components/agents/`, the composer's agent
picker and consult-budget stepper, the per-agent settings pages, the Space
"My Agents" entry, the chat Markdown-note tab, and the tests for all of it.

Two things survive on purpose, because **Partners** travels the same code path:

- `SubagentRunTranscript.tsx` — the partner transcript renderer imports it.
- The `agentNameSet` / `retainedKnowledgeBases` splitter — a partner selected via
  `?agent=` still resolves through the `type: subagent` knowledge-base path. The
  split now normally yields an empty set.

The `/space` dashboard's **Personalization** group (Personas, Skills, MCP
Services, Memory) is hidden from the overview only. Those sections are
untouched and still work at their own URLs; `GROUPS` in
`components/space/SpaceDashboard.tsx` simply no longer lists them, so no count is
fetched for them either.

**CLI Apps were removed entirely**, not just hidden. The whole feature is gone
from both sides: the backend `deeptutor/services/cli_apps/` service and its
`/api/space/cli-apps` router, the `grant.cli_apps` RBAC field alongside
`grant.mcp_tools`, the `cli_*` deferred-tool provider, and this app's
`/space/cli-apps` page, `lib/cli-apps-api.ts`, and `CliAppsSection.tsx`. The
install half and the invoke half went together on purpose — leaving the grant
field behind would have made the tool provider permanently inert with no way to
install anything. `CLI_ICON_SLUGS` went with it, so `brandIconFor()` now takes
one argument and `lib/brand-slugs.ts` curates MCP brands only.

### Restyled: floating dock, rounded conversation

Geometry only. The palette section below covers the colour pass that followed.

- The sidebar is a **floating dock**: 12px of canvas on every side, a 26px
  corner, a hairline border and a soft two-layer lift, on both the expanded panel
  and the collapsed icon rail. Mobile keeps the drawer edge-to-edge — a floating
  panel behind a full-bleed scrim looks broken. Two new tokens carry it,
  `--radius-dock` and `--shadow-dock`, declared for every theme in
  `app/globals.css` beside the existing `--shadow-raised`.
- The **settings sidebar** in `components/settings/SettingsMain.tsx` uses the
  same dock treatment (`md:mx-3 md:my-3 md:rounded-[var(--radius-dock)]
  md:border md:bg-[var(--card)] md:[box-shadow:var(--shadow-dock)]`), so the
  white floating panel matches the chat UI instead of the old flush light-blue
  rail.
- Note: the dock shadow must be written as the arbitrary property
  `md:[box-shadow:var(--shadow-dock)]`, **not** `md:shadow-[var(--shadow-dock)]`.
  Tailwind v3 parses the latter as a shadow *colour* (`--tw-shadow-color`), which
  silently renders `box-shadow: none`.
- The conversation reads rounded: the learner's bubble is `rounded-[26px]`, and
  the cards a turn brings with it use `rounded-2xl`. The assistant's prose stays
  flush — it was never a bubble, and boxing it would fight the markdown.
  `tests/chat-bubble-radius.spec.tsx` pins both.

### Repainted: light mode is now ocean blue

SiJago is embedded in the Careevo shell at `/sijago`, and the two used to disagree
on what "light" meant: Careevo's canvas was a blue-tinted `#ecf3f7` under navy
ink, while SiJago's light theme was a warm parchment `#fdfcf9` with a terracotta
primary. The user-facing result was a blue navbar sitting directly above a cream
workspace.

Both light themes are now one ocean family at two depths, in `app/globals.css`:

- **`light`** (`:root`, the tinted step) — background `#ecf3f7`, foreground
  `#0a2a3a`, primary `#1d4ed8`. These are Careevo's own canvas, ink and ramp, so
  the workspace and the shell around it read as one product.
- **`snow`** (`.theme-snow`, the near-white step) — background `#f8fbfd`, primary
  `#2563eb`, same navy ink. Only the canvas gives way to something close to
  white, which is what still separates the two options from each other.

Dark and Glass are untouched — they were not in scope, and Dark stays warm on
purpose as the one non-blue family. `Dark` no longer "keeps Cream's warmth",
because there is no Cream any more; the Appearance copy and the `Cream` theme
label (now `Ocean`) were updated in all four locales, along with the duplicated
preview palettes in `components/settings/ThemePreviewCard.tsx`.

Light-mode shadows are now tinted with the ocean navy `(10,61,98)` instead of
neutral/warm black, so a lift reads as depth on a blue canvas. Every text pair in
both light themes clears WCAG AA (body 13.3–14.4:1, muted 5.4–6.6:1, primary
label 5.2–6.7:1); hairline borders stay decorative at ~1.2:1, as before.

This was done at the **token** layer on purpose. `bg-[var(--primary)]` appears
316 times across the tree, so recolouring the palette recolours all of them at
once — and the recoloured surface is the same one the "Ocean" preview tile
renders, which is hand-copied hexes that have to be kept in sync.

### Primary buttons: Careevo's `Daftar` gradient

Filled primary **buttons** additionally take Careevo's navbar `Daftar` ramp,
verbatim — `#3b82f6 → #60a5fa → #bfdbfe`, border `#93c5fd`, shadow
`0 1px 2px 0 rgba(0,0,0,0.05)` — exposed as `--primary-gradient` /
`--primary-gradient-hover` in the two light themes. The pale tail is the look and
is kept deliberately; it is **not** AA-safe for a white label (~1.5:1 at the pale
end), an accepted tradeoff. Fix the text if contrast ever has to hold, not the
gradient.

The gradient is opt-in through the long-standing `.btn-primary` marker class
rather than applied to every `--primary` fill, because only ~91 of the 316
`bg-[var(--primary)]` sites are actually primary actions. The rest are toggles,
checkboxes, selected rows, active-nav bars, progress fills and circular send
buttons — a gradient on a 16px checkbox or a 3px active bar is wrong. So
`.btn-primary` was added to the 91 labelled CTAs (`px-*`, at least 28px tall,
literal class string) and deliberately **not** to the other 89 sites. A CSS rule
on the class name keeps that a reviewable, one-line-per-button decision.

Scoping is `:root:not(.dark)`, which is what keeps this a light-mode change:
`dark` and `theme-glass` are only ever applied together, so excluding `.dark`
leaves both dark families on their flat `--primary` and leaves the pre-existing
purple `.theme-glass .btn-primary` override untouched.

### Every remaining flat primary fill now takes the ramp too

`.btn-primary` was the right *opt-in* for the repaint, but it only ever covered
the 91 sites someone hand-tagged, so a second flat dark-blue button still read
wrong against the ocean shell. `app/globals.css` now also sweeps the two
full-opacity fill utilities themselves:

```css
:root:not(.dark) .bg-primary:not(:disabled),
:root:not(.dark) .bg-\[var\(--primary\)\]:not(:disabled) {
  background-image: var(--primary-gradient);
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}
```

Three things this deliberately does **not** do:

- **It does not touch tints.** The class selector matches the whole class token,
  so `bg-primary/5` and `bg-[var(--primary)]/10` are different class names and
  stay flat washes. Those are hover states and selected-row backgrounds, not
  primary fills.
- **It does not touch disabled controls.** `:not(:disabled)` is load-bearing,
  not decoration: the transcript panel's small icon buttons swap to
  `disabled:bg-transparent`, and a `background-image` cannot be undone by a
  `background-color`, so without the guard the gradient kept painting straight
  through the disabled state. Disabled primary buttons fall back to the flat
  colour under their own `disabled:opacity-*`, exactly as before.
- **It does not touch Dark or Glass**, per the `:root:not(.dark)` scoping above.

It uses `background-image` over the flat `background-color` base for the same
reason `.btn-primary` does: a gradient is an image, so the same rule repairs
every button while leaving the base colour in place for the two dark families.

### The default theme no longer follows the OS

`components/ThemeScript.tsx` used to pick Dark when `prefers-color-scheme: dark`,
and Snow otherwise. That is wrong for a vendored app that is **framed inside
Careevo** (`src/components/features/sijago/sijago-frame.tsx`, iframe →
`SIJAGO_WEB_URL`): Careevo's own chrome is always light, so a visitor with a dark
OS got a warm-black workspace under a white navbar — the same blue/warm mismatch
the light repaint was meant to remove, just triggered by the OS instead of by a
stale palette.

A fresh visit now always opens the light `snow` canvas, whatever the OS says.
Dark and Glass are untouched and still selectable in Settings → Appearance; they
are opt-in rather than automatic. An explicitly stored preference is still
respected, so this changes only the *default*, never a deliberate choice.

Note for testing: `/sijago` sits in the `(app)` route group, so it redirects to
`/masuk` without a session and cannot be screenshotted anonymously.

### Which backend the proxy talks to (a live footgun on this box)

`lib/backend-runtime-config.ts` resolves the FastAPI address as
`DEEPTUTOR_API_BASE_URL` → `BACKEND_PORT` → `NEXT_PUBLIC_API_BASE` → **`:8001`**.
That last default is a silent trap here, because this machine runs two FastAPI
processes:

| port | cwd | what it is |
|---|---|---|
| `:8011` | `…/DeepTutor-main` | the checkout — current protocol |
| `:8001` | `/home/vyns` | installed `deeptutor 1.6.9` from site-packages |

The installed copy has an **older turn protocol** than
`contracts/generated/turn-protocol.ts` in this tree, so with nothing configured
the proxy falls through to `:8001` and every chat turn is rejected before it
starts:

```
protocol_error / invalid_command / "Command does not match the turn protocol."
```

The failure looks like a frontend bug and is not one: the payload is valid
(43 keys, `type=start_turn`, `protocol_version=2.0`) and passes
`_CLIENT_COMMAND_ADAPTER.validate_python` against *this* checkout. Only the older
server rejects it.

**Start the standalone server with `./start-standalone.sh [port] [backend-base]`**,
which pins `DEEPTUTOR_API_BASE_URL`. Do not rely on `.env` / `.env.local` for
this: `node .next/standalone/server.js` does not read them (Next loads those at
build time and under `next dev`, not for a bare standalone process).
`.env.local` is kept only so `npm run dev` gets the same address.

Diagnosing this class of failure: send the same captured frame to both ports and
compare. `:8001` answers `invalid_command`; `:8011` gets past validation and
fails later on LLM selection — which localises the fault to the transport, not
the payload.

### No LLM model is configured

With the correct backend the turn runs and then fails with
`No active LLM model is configured. Please set it in Settings > Catalog.`
(`/api/settings/llm-options` returns `{"active": null, "options": []}` — there
are zero providers to choose from). This is environment configuration, not a
code defect: add a provider in SiJago's Settings → Catalog before a chat turn
can produce a reply. Styling and layout can still be verified without one.

Internal identifiers were deliberately **left alone**: import paths, cookie
names, env vars and API routes still say `deeptutor` in ~140 files. Renaming
them would break the app and would make the directory impossible to diff
against upstream, which is the main practical cost of vendoring it.

### Hidden settings groups

`HIDDEN_SETTINGS_KEYS` in `features/settings/navigation/settings-pages.ts` drops
the `Features & integrations` (`tools`, `capabilities`, `knowledge`), `System`
(`network`, `status`, `about`), and `Models & services` (`connections`, `llm`,
`task-models`, `embedding`, `search`, `voice`, `multimodal`) groups from the
settings navigator and search. Only `Personal`, `Learning & conversation`, and
`Archived` remain in the sidebar. The pages themselves stay reachable by direct
URL — the onboarding tour (`/settings/status`), the sidebar version badge
(`/settings/about`), and the readiness panel all deep-link to them. The split
lives in `listedSettingsPages()` (nav only) vs `visibleSettingsPages()` (page
resolution), which is why direct links keep working.

The matching setup links on the **General** page — the `Set up chat first`
(`/settings/connections`, `/settings/llm`, `/settings/status`) and `Add more
when you need it` (`/settings/embedding`, `/settings/search`,
`/settings/task-models`) blocks in `components/settings/SettingsOverview.tsx` —
were removed too, since every target they link to is now hidden from the
navigator. What remains on General is language + starting-point presets.

The **Settings → About / update** screen says "Careevo" (not "DeepTutor" — an
earlier rename already took care of that; this note was stale). What it does
still point at is upstream's own release/version machinery, so the *update URL*
remains `HKUDS/DeepTutor` while the *label* is ours. That mismatch is deliberate:
relabelling the machinery would misreport which build is actually running and
where updates come from.

**The `deeptutor` CLI was removed.** Careevo serves a website and never invoked
it — the API has always been started directly with uvicorn (see "Where it runs"
below). So `backend/deeptutor_cli/`, its `deeptutor` console entry point,
`packaging/deeptutor-cli/`, `start_deeptutor.command`, and `scripts/start_tour.py`
are gone. Two consequences inside the backend: `deeptutor/__main__.py` now raises
with the uvicorn command instead of failing as a missing module, and the two
places that used to shell out to the CLI to relaunch themselves
(`runtime/launcher.py::_launch_detached` and
`runtime/update_worker.py::build_restart_command`) now raise a `RuntimeError`
naming the real remedy — a supervisor restart, which is how
`sijago-backend.service` already works. See `backend/AGENTS.md` for the full note.

## Where it runs

Two processes. The backend first — the UI proxies to it.

```bash
# 1. Backend (from this repo's backend/ — see below)
python3 -m uvicorn deeptutor.api.main:app --host 127.0.0.1 --port 8011

# 2. This app
cd features/sijago
npm ci
npm run build
PORT=3790 HOSTNAME=127.0.0.1 DEEPTUTOR_API_BASE_URL=http://127.0.0.1:8011 \
  node .next/standalone/server.js
```

Use `node .next/standalone/server.js`, **not** `next start` — this app sets
`output: "standalone"` and warns that `next start` is unsupported. (Using
`next start` serves HTML that loads but never paints, which looks like a blank
frame and is not one.)

Two more ways the settings page in particular can come up blank:

- **Stale standalone after a rebuild.** `npm run build` writes a new `.next`,
  but a standalone server that was already running keeps serving the old build
  (its `_next/static` asset names are frozen in memory). The page HTML then
  references chunks that 404 — the shell renders and never hydrates, which
  looks exactly like "I clicked Settings and nothing loaded." After any rebuild,
  restart the standalone server, not just `next build`.
- **`HOSTNAME` binding.** `./start-standalone.sh` leaves `HOSTNAME` unset, so
  `node .next/standalone/server.js` binds to the machine's *hostname* (e.g.
  `http://fedora:3790`) rather than all interfaces. If you then open the app
  through `localhost`/`127.0.0.1` the page loads but its `_next/*` requests
  fail — same blank-page symptom. Start it with `HOSTNAME=0.0.0.0` (or always
  browse via the hostname the server prints) when you want localhost to work.

Ports come from upstream's `data/user/settings/system.json` (`backend_port`,
`frontend_port`; defaults 8001 and 3782). The values above are what this setup
uses. `DEEPTUTOR_API_BASE_URL` is still named that way because it is read by
upstream's own `proxy.ts`.

Careevo points at this app with `SIJAGO_WEB_URL` (default
`http://localhost:3790`); see `src/lib/mode/store.ts`.

## Model configuration

The backend boots without a model and says so
(`Failed to initialize LLM client at startup: No active LLM model is configured`).
Upstream configures providers through its own **Settings → Catalog** UI, writing
`data/user/settings/model_catalog.json` in the *backend* checkout. To point it at
a local OpenAI-compatible gateway (9Router, vLLM, Ollama), add the provider there
rather than editing code here.

## Isolation from Careevo's tooling

Listed in the root config so this tree is not judged by Careevo's rules:

- `tsconfig.json` — `"exclude": [..., "features/sijago"]`
- `eslint.config.mjs` — `globalIgnores([..., "features/sijago/**"])`
- `.gitignore` — its `node_modules`, `.next`, and test output

It has its own `tsconfig.json`, `eslint.config.mjs`, `tailwind.config.js`,
`postcss.config.js`, `next.config.js` and `package-lock.json`. The Careevo root
`npm run check` and `npm run build` do **not** build or test it — use its own
scripts.

## Why it is a separate application

Upstream's chat is not request/response. A turn runs a tool-calling agent loop in
a Python process and streams content back over a WebSocket
(`deeptutor/api/routers/unified_ws.py`); the browser reaches that process through
a proxy rewrite (`proxy.ts`).

| Piece | Why it cannot live inside Careevo |
| --- | --- |
| Python backend (FastAPI + uvicorn) | Owns the agent loop, tool registry and session store. Its own process, its own port. |
| This directory (Next.js) | The UI, plus the proxy that forwards `/api/*` and `/ws/*` to that backend over the WebSocket. |

It also serves its workspaces at the root (`/chat`, `/whisper`), which would
collide with Careevo's own routes. So Careevo hosts it at `/sijago` and frames
it, which keeps Careevo's URL, navbar, session and back button while the app's
bundle runs as built. See `src/components/features/sijago/sijago-frame.tsx`.

## Before changing anything here

Functional changes belong upstream, then come back through a re-copy. If a change
is genuinely Careevo-specific, keep it in Careevo (`src/`) rather than here — that
boundary is what makes this directory re-syncable with upstream.
