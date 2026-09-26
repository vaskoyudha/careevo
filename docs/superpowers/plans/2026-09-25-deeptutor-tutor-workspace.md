# DeepTutor-style 3-pane Tutor Workspace — Implementation Plan

> For agentic workers: implement task-by-task, red → green → verify. Each task is independently reviewable.

**Goal:** Give Careevo a real, usable AI tutor workspace that matches DeepTutor's chat UI: a left rail with a session list, a center 960px chat column with a greeting hero, faded scrollport and rounded composer, and a right-hand Activity drawer.

**Why now:** `/belajar/jalur` currently embeds a single `StudyChat` card below the course card. The user asked for "DeepTutor's full 3-pane UI". The existing card renders but is not a chat product, and the tutor cannot reply at all without `GEMINI_API_KEY`.

## Upstream reference

Explored `/home/vyns/DeepTutor` @ `a5eafa89`:

| Concern | Upstream file |
|---|---|
| Route entry | `web/app/(workspace)/chat/page.tsx` → `ChatWorkspace` |
| App frame (h-dvh, sidebar slot) | `web/components/layout/AppShell.tsx` |
| Left rail (icon-only → expanded) | `web/components/sidebar/WorkspaceSidebar.tsx`, `SidebarShell.tsx`, `nav-entries.ts` |
| Center column (header / hero / scrollport / composer) | `web/features/chat/components/ChatWorkspace.tsx` (L2289–L2510) |
| Composer card (`rounded-[26px]`, send-arrow) | `web/components/chat/home/ChatComposer.tsx` (L705+) |
| Right Activity drawer | `web/components/chat/home/SessionViewerPanel.tsx` |
| Turn navigator (left gutter ticks) | `web/components/chat/home/TurnNavigator.tsx` |
| Nested sessions under a path | `web/app/(utility)/mastery/[pathId]/sessions/` |

**Licence:** DeepTutor is **Apache-2.0** (`LICENSE`). Careevo's existing DeepTutor-derived file
(`src/components/features/learning/study-chat.tsx`) carries an Apache-2.0 adaptation header naming
upstream paths + commit. Every new adapted file gets the same header form. Per
`.agents/skills/careevo-attribution`, add a row to the attribution table.

## Decisions taken

- **Sidebar rail is allowed** on the tutor route. User overrode the AGENTS.md rule
  ("Learner pages use LearnerShell, NEVER AppShell") **for this page only**. The tutor is a
  focus/dashboard-style surface, like `/challenge` which already uses `AppShell`. The
  navbar-contract rule in `AGENTS.md` is updated to carve out this route.
- **No streaming, no WebSockets, no new deps.** Careevo has no WS runtime and the plan forbids new
  dependencies. The tutor keeps the existing server-action flow. Only the *presentation* is ported.
- **Sessions are real and file-backed.** The cookie store caps at 6 messages / 1800 chars
  (`chat-types.ts`) and cannot hold a session list. Sessions go to `.data/tutor/` mirroring the
  proven `.data/resume/` pattern (sha256(email) owner dir, `path.basename` guard,
  `CAREERS_DATA_DIR` override).
- **Route:** `/belajar/tutor` (new) + `/belajar/tutor/[sessionId]`. The new session lives in
  `(focus)` — a focus-mode group already exists for `/challenge` and shares the auth+profile gate.
  `/belajar/jalur` keeps its card but gains a prominent "Buka Tutor" hand-off, mirroring DeepTutor's
  own path→chat hand-off.

## File map

| Action | File | Responsibility |
|---|---|---|
| Create | `src/lib/tutor/types.ts` | Session, message, envelope types + bounds. |
| Create | `src/lib/tutor/session-store.ts` | File-backed session CRUD (create/list/read/append/rename/delete). |
| Create | `src/lib/tutor/session-store.test.ts` | Node tests: bounds, owner isolation, path safety. |
| Create | `src/lib/tutor/ids.ts` | Slug + random session-id helpers. |
| Create | `src/app/(focus)/belajar/tutor/page.tsx` | New-session route. |
| Create | `src/app/(focus)/belajar/tutor/[sessionId]/page.tsx` | Existing-session route. |
| Create | `src/components/features/tutor/tutor-shell.tsx` | `h-dvh` 3-pane frame (rail + column + drawer). |
| Create | `src/components/features/tutor/tutor-rail.tsx` | Left icon-rail + expandable session list. |
| Create | `src/components/features/tutor/tutor-column.tsx` | Header, greeting hero, scrollport, composer. |
| Create | `src/components/features/tutor/tutor-composer.tsx` | `rounded-[26px]` card, send-arrow, Enter-to-send. |
| Create | `src/components/features/tutor/tutor-activity.tsx` | Right drawer; `dt:tutor:panel` localStorage toggle. |
| Create | `src/actions/tutor.ts` | create/rename/delete session, send message. |
| Modify | `src/lib/agents/study-chat/gemini.ts` | Accept an injected session transcript. |
| Modify | `src/components/features/learning/jalur-belajar-view.tsx` | Add "Buka Tutor" hand-off CTA. |
| Modify | `AGENTS.md` | Carve the tutor route out of the navbar contract. |
| Modify | `.agents/skills/careevo-attribution/SKILL.md` | Add DeepTutor rows. |

## Pane structure (ported from DeepTutor)

```
<div class="flex h-dvh overflow-hidden">          // AppShell
  <TutorRail />                                     // w-[60px] collapsed, expands to 220px
  <main class="flex min-w-0 flex-1 flex-col">      // center
    <header class="mx-auto max-w-[960px] px-6 pt-3">   // session title (editable) + actions
    <section class="relative flex-1 min-h-0">         // hero OR scrollport
      scrollport: overflow-y-auto + maskImage fade
      column: mx-auto max-w-[960px] space-y-9 px-6
    </section>
    <TutorComposer />                             // shrink-0, bottom
  </main>
  <TutorActivity />                                 // right drawer, toggled
</div>
```

## Task list

- [ ] **T1** `tutor/types.ts` + `tutor/ids.ts` — pure types and id helpers.
- [ ] **T2** `tutor/session-store.ts` + tests — file-backed CRUD, green.
- [ ] **T3** `actions/tutor.ts` — create/rename/delete/send, reusing `generateStudyReply`.
- [ ] **T4** Routes: `/belajar/tutor` + `/belajar/tutor/[sessionId]` in `(focus)`.
- [ ] **T5** `tutor-shell` + `tutor-rail` — 3-pane frame with expanding rail.
- [ ] **T6** `tutor-column` + `tutor-composer` — hero, scrollport, composer card.
- [ ] **T7** `tutor-activity` — right drawer with persisted toggle.
- [ ] **T8** `jalur-belajar-view` hand-off CTA.
- [ ] **T9** Attribution headers + `AGENTS.md` carve-out + skill row.
- [ ] **T10** Verify: `npm run check`, `npm run build`, browser screenshots, `scripts/smoke.mjs`.

## Global constraints

- Indonesian user-facing copy, verbatim where it already exists.
- Tailwind v4, existing tokens. No new theme system.
- No new npm dependencies. No WebSockets. No database.
- No `dangerouslySetInnerHTML` (repo rule).
- `npm run check` + `npm run build` both gate this work.
