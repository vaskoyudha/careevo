---
name: careevo-sijago
description: >-
  How to run, configure, verify, and brand AI Mastery — the vendored
  DeepTutor-derived Next.js app in features/sijago that Careevo frames at
  /ai-mastery — Careevo's only study chat. Use when a chat turn says "No active
  LLM model is configured", when adding or switching its model, when a
  screenshot of the real AI Mastery UI is wanted, when renaming the visible
  brand, or before restarting any of its processes. Covers the
  :8001/:8011/:3782/:3790 topology, the model-catalog API, why space-bunny
  cannot drive it, and the rename split between the user-facing "AI Mastery"
  name and the internal "sijago" path and "deeptutor" identifiers.
license: MIT
metadata:
  owner: careevo
  area: sijago
---

# AI Mastery — the framed DeepTutor app

`features/sijago/` is a **separate Next.js app** (v16.2.3), vendored from
DeepTutor (Apache-2.0). Careevo does not import it; it frames it in an iframe at
`/ai-mastery`, owning only the URL, navbar, and session.
It has its own scripts and gates — see `features/sijago/README.md`. Never lint,
typecheck, or edit it as if it were Careevo source.

**The brand is AI Mastery; the path is still `features/sijago/`.** That split is
deliberate (see the rename section below).

`/ai-mastery` is the **only** study chat in Careevo. There used to be a
hand-rolled re-implementation at `/belajar/tutor` (and a smaller inline chat card
on `/belajar/jalur`); both were deleted in favour of this one, and their route,
components, session store, actions and DeepTutor attribution rows went with
them. AI Mastery is the real DeepTutor-derived UI (3-pane shell, AI-titled
sessions, ask-hint with Tab-to-complete, Copy/Play-aloud/Regenerate/Delete,
per-turn "Done · Ns" and token counts). If someone asks for a screenshot of "the
AI tutor" or "the AI Mastery UI", they mean `http://localhost:3000/ai-mastery`
(or `:3790/chat` unframed) — there is no second implementation to confuse it
with. Do not rebuild one.

## The `deeptutor` CLI is gone — and so is CLI Apps

Careevo serves a website and never invoked either. Two removals, both done
deliberately, so don't read either as an accident:

- **The `deeptutor` command-line program** (`backend/deeptutor_cli/`, its
  console entry point, `packaging/deeptutor-cli/`, `start_deeptutor.command`,
  `scripts/start_tour.py`). The API was always started directly with uvicorn.
  `deeptutor/__main__.py` now raises with the uvicorn command rather than
  failing as a missing module, and the two sites that shelled out to the CLI to
  relaunch themselves — `runtime/launcher.py::_launch_detached` and
  `runtime/update_worker.py::build_restart_command` — now raise a `RuntimeError`
  naming a supervisor restart. That is the real shape of `:8011`
  (`sijago-backend.service`), so **the in-app updater installs and then reports a
  durable `failed` job**; restarting the unit is the upgrade step. Do not
  "fix" this by reintroducing an entry point.
  Trap: `requirements/cli.txt` and the `.[cli]` extra **stay** despite the name —
  they are the *core* dependency set, and `requirements/server.txt` includes the
  former via `-r cli.txt`. Deleting them breaks the server install.
- **The CLI-Anything installer** (`/space/cli-apps`, `lib/cli-apps-api.ts`,
  `CliAppsSection.tsx`, backend `deeptutor/services/cli_apps/` + its router, the
  `grant.cli_apps` RBAC field, the `cli_*` deferred-tool provider, and
  `CLI_ICON_SLUGS`). The install half and the invoke half went **together**:
  leaving `grant.cli_apps` would have made the tool provider permanently inert
  with no way to install anything. Consequence: `brandIconFor()` takes one
  argument now (the `cli` namespace is gone) and `lib/brand-slugs.ts` curates
  MCP brands only.

Also note what the brand rename did **not** do: it replaced *user-visible*
"DeepTutor" with **AI Personalize** in the backend's own surfaces (FastAPI
title, the Codex-OAuth HTML pages, HTTP error details, the image labels), while
`AI Mastery` remains the product's user-facing name in Careevo and the framed
app. Lowercase `deeptutor` identifiers, pip references, and
`HKUDS/DeepTutor` upstream URLs are untouched, and the Apache attribution
headers in `src/` are not ours to edit.

## Process topology — which port is which

Measured on this repo. Four processes, and the two backends are the trap.

| Port | Process | Role |
|---|---|---|
| `:3000` | `next dev` (Careevo) | frames AI Mastery at `/ai-mastery` |
| `:3790` | AI Mastery `next-server`, serving `.next/standalone` | the framed frontend |
| `:3782` | `deeptutor start` frontend | DeepTutor's own UI (not AI Mastery) |
| `:8001` | `deeptutor start` backend, `deeptutor.service` | installed deeptutor 1.6.9, workspace `/home/vyns` |
| `:8011` | in-repo DeepTutor FastAPI, `sijago-backend.service` | the checkout, "current protocol" — **this is the one AI Mastery uses** |

**AI Mastery (`:3790`) talks to `:8011`, not `:8001`.** The deciding fact is the
framed app *server's* env, not the backend's:

```bash
P=$(ss -ltnp | grep ':3790' | grep -oP 'pid=\K[0-9]+' | head -1)
tr '\0' '\n' < /proc/$P/environ | grep DEEPTUTOR_API_BASE_URL
# → http://127.0.0.1:8011
```

`:8011` **is** supervised, by an enabled systemd *user* unit — this section
previously said it was a detached process with no supervisor, which stopped being
true. There are two units, and they are not interchangeable:

| Unit | Ports |
|---|---|
| `deeptutor.service` | `:8001` / `:3782` (installed `deeptutor start`, workspace `/home/vyns`) |
| `sijago-backend.service` | `:8011` (in-repo `backend/`, `Restart=always`) |

```bash
systemctl --user status sijago-backend.service   # :8011
systemctl --user restart sijago-backend.service  # prefer this over launching uvicorn by hand
journalctl --user -u sijago-backend.service      # its logs; deeptutor.service covers only :8001
```

`ExecStart` runs `backend/venv/bin/python -m uvicorn deeptutor.api.main:app
--host 127.0.0.1 --port 8011` with `WorkingDirectory` and `DEEPTUTOR_HOME` both
set to this repo's `backend/`. Starting a second uvicorn by hand will just hit
`address already in use` — restart the unit instead.

## Model catalog — the "No active LLM model is configured" runbook

AI Mastery's model list is **not** Careevo's `CAREERVO_LLM_*` env. It lives in a
`model_catalog.json` under the backend's runtime home (cwd, or `DEEPTUTOR_HOME`):

- `:8001` → `/home/vyns/data/user/settings/model_catalog.json`
- `:8011` → `backend/data/user/settings/model_catalog.json` in this repo (the
  unit sets `DEEPTUTOR_HOME` to `backend/`; it used to point at a separate
  `DeepTutor-main` checkout that this unit no longer uses)

API (v1.6.3+; the old `/api/v1/settings/...` is 404):

```bash
BASE=http://127.0.0.1:8011/api/settings
curl "$BASE/catalog"        # GET — secrets read back as "***"
# edit, then:
curl -X PUT "$BASE/catalog" -d '{"catalog":{...}}' -H 'content-type: application/json'
curl -X POST "$BASE/apply"  -d '{"catalog":{...}}' -H 'content-type: application/json'
```

Facts that cost time to learn:

- **`GET` redacts `api_key` as `"***"`, but `PUT` restores the real key** from the
  stored catalog before saving — so round-tripping a read catalog is safe. Verify
  the file on disk, not the GET response: if the file holds a literal `"***"`,
  the restore failed and every call 401s.
- `services.llm` shape: `{ active_profile_id, active_model_id, profiles: [] }`.
  A profile is `{ id, name, binding:"openai", base_url, api_key, models:[
  { id, name, model, context_window, context_window_source:"manual" } ] }`.
- `deeptutor start` **resolves the active profile into process env
  (`OPENAI_BASE_URL`, `OPENAI_API_KEY`) at boot**. A long-running process does not
  re-read the file. For `:8001` (systemd) restart the unit; for `:8011` `POST
  /apply` usually suffices, but if the error persists, check the process env:
  `tr '\0' '\n' < /proc/<pid>/environ | grep OPENAI`. A dead `OPENAI_BASE_URL`
  (e.g. `:20129` OmniRoute not listening) outranks a correct catalog.

Debug chain, in order, when a turn says "No active LLM model is configured":

1. Confirm which backend the frontend points at (the `DEEPTUTOR_API_BASE_URL`
   probe above). Configuring the wrong backend's catalog is the classic miss.
2. Read that backend's catalog. `profiles: []` / `active_*_id: null` is the
   root cause — add a profile.
3. Check the backend process env for a stale `OPENAI_BASE_URL` pin.
4. `journalctl --user -u sijago-backend.service` covers `:8011`;
   `journalctl --user -u deeptutor.service` covers only `:8001`.

## Model choice — non-agentic or it fails

9Router is on `127.0.0.1:20128` (key in `~/.9router/db/data.sqlite`, table
`apiKeys`). `o2a/space-bunny-free` is an **agentic** model: on a chat turn it
answers with a tool call instead of prose, the backend logs
`LLM returned empty response`, and the UI reports the misleading
"No active LLM model is configured". Use a non-agentic model —
`ag/gemini-3.7-flash-high` is proven in this profile. This matches Careevo's
`.env.local` ("a non-agentic model matters") and the `loker-evaluasi` skill.

The embedding model is configured separately in the same catalog
(`services.embedding`). Without one, every answer appends "no embedding model is
currently selected… knowledge-base search and indexing are disabled". That is
expected, not a defect.

## Verifying the framed UI in a browser

The framed app is cross-origin (`:3200` parent, `:3790` child), so plain
`page.evaluate` cannot reach it. Use `frameLocator`:

```js
const fl = page.frameLocator('iframe');
await fl.locator('textarea').first().fill("...");
await fl.locator('button:has(svg.lucide-arrow-up)').first().click();
const inner = page.frames().find(f => f.url().includes('3790'));
```

- First send on `/chat` navigates to `/chat/unified_<ts>_<hex>` and creates the
  session. The sidebar entry appears before the transcript does — that is the
  optimistic create, not proof the turn landed.
- **Hydration race:** after `page.goto`, wait ~10–12 s before interacting or the
  turn is silently dropped (the WebSocket is not up yet). A reload-then-immediate
  send produces a new session with an empty transcript and nothing in the backend
  log.
- Turn completion: poll for the stop button to disappear
  (`button:has(svg.lucide-square)`), then for the text to lose
  `Reasoning…` / `Loading the full trace`. Text-stability alone is not enough —
  a streaming pause looks stable.
- The transcript scrolls in the deepest `div` where
  `scrollHeight > clientHeight + 200`; scroll it before screenshotting the newest
  turn.
- The active tab can drift to `/onboarding/demo` or `/loker/inbox` between calls;
  check `browser_tabs({action:"list"})` before concluding a click missed.

## Brand rename — the split that matters

Two renames have happened here, in sequence. Both followed the same rule:
**rename what a user can see, leave the identifiers alone.**

1. `DeepTutor` → `Careevo` across `app/ components/ features/ hooks/ lib/ shared/
   context/ tests/ scripts/ next.config.js` and `locales/{en,zh,fr,uk}/app.json`
   (flat JSON).
2. `Careevo`/`SiJago` → **`AI Mastery`** for the product's own name. In Careevo
   that is the navbar link (`AiMasteryLink`), the route `/ai-mastery`, the page
   title, and `AI_MASTERY_WEB_URL`. In the framed app it is the `<title>` in
   `app/layout.tsx`, the logo `alt`/`aria-label` in `components/layout/AppShell.tsx`
   and `components/sidebar/SidebarShell.tsx`, and the chat status line
   (`const name = agentName?.trim() || "AI Mastery"` in
   `features/chat/trace/TracePresentation.tsx`).

**Do not rename** (renaming breaks the app or upstream diffing):

- the `features/sijago/` **directory**, the `sijago-web` package name, the
  `careevo-sijago` skill id, and `.env` keys already spelled `SIJAGO_*` in
  example files. A path is a checkout location, not a brand. Careevo's own
  `src/components/features/ai-mastery/` *was* renamed, because that tree is
  Careevo source, not vendored.
- lowercase `deeptutor` identifiers: storage keys (`deeptutor-theme`,
  `deeptutor.sidebar.*`), event names (`deeptutor:workspace-switch`), cookie /
  header names (`deeptutor_session`, `x-deeptutor-frontend-host`), Python module
  and pip references (`deeptutor.api.main`, `deeptutor[parse-docling]`), build
  dir `.next-deeptutor/`.
- `https://github.com/HKUDS/DeepTutor` and the `e.g. HKUDS/DeepTutor` placeholder
  — upstream references, kept on purpose.
- `vendor/` and `contracts/` — upstream-vendored and generated; `contracts:check`
  fails if they change.

A bulk rename script must skip lines matching `HKUDS/DeepTutor|github\.com/HKUDS`
and skip `node_modules`, `.next`, `dist`, `vendor`, `contracts`.

**`Careevo` inside `features/sijago/` is ambiguous — do not bulk-replace it.**
Some occurrences are the framed app's own brand (rename them), but others mean
the *host* application and must stay "Careevo" — e.g. the comment in
`components/ThemeScript.tsx` ("framed inside Careevo, whose chrome is always
light") and copy like "Use a folder path on the machine running Careevo" (that
is the Python backend's machine). Read each hit; a blind `Careevo`→`AI Mastery`
produces nonsense like "the machine running AI Mastery".

Known consequence of the first rename: the Settings → About/update **text** says
Careevo while the update machinery still points at HKUDS/DeepTutor releases.
The README's old note ("leave About as DeepTutor") is superseded by the rename
instruction; record this mismatch rather than silently "fixing" the update URL.

### Gates and the serving trap

Validate with the app's own gates, all of which must be green after a rename:

```bash
cd features/sijago
npm run typecheck && npm run test:unit && npm run i18n:check \
  && npm run contracts:check && npm run build
```

`:3790` serves from **`.next/standalone`** — a prebuilt production bundle. Source
edits are **not live** until the standalone bundle is rebuilt and the `:3790`
server restarted. A screenshot that still shows "DeepTutor" after a rename is
usually this, not a failed edit.

## UI language — Indonesian is the default

The framed app ships **five** UI locales: `id` (default), `en`, `zh`, `fr`, `uk`
— bundles in `locales/<code>/app.json`. Adding/removing one means four edits, and
a language that is wired in one place but not the others silently serves English:

| Seam | File |
|---|---|
| Locale registry (drives the picker) | `i18n/languages.ts` (`APP_LANGUAGES`, `DEFAULT_APP_LANGUAGE`) |
| Lazy loader | `i18n/init.ts` (`ensureLanguage`) |
| Stored/SSR default + response language | `context/app-shell-storage.ts`, `context/AppShellContext.tsx` |
| Response-language options | `features/settings/store/SettingsStore.tsx` (`RESPONSE_LANGUAGE_OPTIONS`) |
| Audit gate's required set | `scripts/i18n_audit.mjs` (`REQUIRED_LOCALES`) |

The default is **gated on the backend**, not the frontend: `:8011` normalizes
`language`/`response_language` and rejects anything outside its `UiLanguage`
literal, so an `id` that the frontend knows but the backend does not is silently
served as English. The backend seams are
`deeptutor/services/settings/interface_settings.py` (`UiLanguage`,
`DEFAULT_UI_SETTINGS`, `_normalize_language`),
`services/config/settings_spec.py`, `services/config/launch_settings.py`,
`core/response_languages.py`, `services/prompt/language.py`, and the judge prompt
in `api/routers/quiz_judge.py`.

`backend/data/user/settings/interface.json` is gitignored and usually carries an
explicit `"language"`, which **overrides the default** — to actually see
Indonesian, clear that field or set it to `"id"` and restart `sijago-backend.service`.
