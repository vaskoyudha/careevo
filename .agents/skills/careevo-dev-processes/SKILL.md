---
name: careevo-dev-processes
description: >-
  Which out-of-Next processes Careevo needs running in local development, what
  each one owns, and how they are supervised. Use when a feature says "service
  unavailable" / "layanan tidak tersedia" (workspace) or "galat_runner" (the
  C++ lab "Jalankan" button), when a lab or IDE frame never loads, after adding
  or rotating CAREEVO_WORKSPACE_SECRET or CAREEVO_RUNNER_SECRET, or before
  restarting either process. Covers the :8021 runner and :8022 workspace manager
  user units and why a missing process shows up as a broken feature.
license: MIT
metadata:
  owner: careevo
  area: dev-processes
---

# Careevo's out-of-Next dev processes

Careevo's Next app is not the whole system. Two features are served by
**separate Node processes** that Next only forwards to. Neither is started by
`npm run dev` or `npm run dev:full`, and both fail **closed** — so when one is
down, the participant sees a normal-looking UI with a generic error, not a
crash. That is the trap this skill exists to prevent.

| Process | Port | Unit | Owns |
|---|---|---|---|
| Code runner | `:8021` | `careevo-runner.service` | "Jalankan" on lab C++ — compile + run in a sandboxed container |
| Workspace manager | `:8022` | `careevo-workspace.service` | `/belajar/[slug]/ruang-kerja` — one code-server container per participant |

Both bind **loopback only** and authenticate every request with a shared
secret. Both are eslint-ignored `.mjs` outside the Next build graph, by design:
`server.mjs` handles bind/auth/spawn, `soal.mjs` holds the entire sandbox audit
surface (every podman flag), so "what may participant code do?" is answerable by
reading one file.

## Symptom → cause

| What you see | What is actually wrong |
|---|---|
| "Layanan ruang kerja sedang tidak tersedia." | Workspace manager down, or secret mismatch → `galat_manajer` |
| `galat_runner` on "Jalankan" | Runner down, or `CAREEVO_RUNNER_SECRET` unset/mismatched |
| `/api/workspace` returns `status: "terkunci"` | **Not** a process problem — the course is not completed via the verified path |
| Workspace frame blank after it was working | Manager restarted and lost its in-memory `kunci → port` map; it rediscovers via `podman port` on the next `status` |

`galat_manajer` and `galat_runner` both deliberately hide the real cause from
the participant (`port.ts` maps them to fixed copy). **Debug from `journalctl`,
not from the browser.**

## Operating them

```bash
systemctl --user status  careevo-workspace.service careevo-runner.service
systemctl --user restart careevo-workspace.service   # after secret changes
systemctl --user stop    careevo-runner.service
journalctl --user -u careevo-workspace.service -n 50
```

Both are `enabled` under `default.target.wants`, and this account has
`Linger=yes`, so they start at boot **without** a login session. They are
`Restart=always`, so a crash self-heals in ~5s.

## The secrets, and why a mismatch is invisible

Each process reads a shared secret from `/etc/...`-style env or `.env.local`;
the app reads the **same name** from its own environment. If they differ, the
process replies `401`, and the app collapses that into the same
"service unavailable" copy as a dead process.

- `CAREEVO_WORKSPACE_SECRET` → `src/lib/workspace/proses-manajer.ts` ↔ workspace manager
- `CAREEVO_RUNNER_SECRET` → `src/lib/exec/proses-lokal.ts` ↔ runner

Empty means **reject everything** (fail-closed), never "serve openly".

For a systemd unit, `EnvironmentFile=` points at `.env.local`. Two constraints
there: no inline `#` comments after values, and no shell expansion — systemd
parses it literally, unlike `set -a; . .env.local`. Verify after editing:

```bash
systemctl --user show careevo-workspace.service -p Environment | tr ' ' '\n' | grep CAREEVO
```

## Verifying without a browser

The manager answers `{ok:true,hidup:false}` for a workspace that does not exist
— that is a **healthy** answer, not an error. `401` means the secret is wrong.

```bash
S=$(grep -oP '(?<=CAREEVO_WORKSPACE_SECRET=).*' .env.local)
curl -s -X POST http://127.0.0.1:8022/status \
  -H "content-type: application/json" -H "x-workspace-secret: $S" \
  -d '{"userId":"x","courseId":"y"}'          # {"ok":true,"hidup":false}
```

End-to-end through the real gate (needs a session cookie and, for the
workspace, a **verified course completion** — otherwise `terkunci`):

```bash
curl -s -X POST localhost:3000/api/jalankan -H "content-type: application/json" \
  -H "Origin: http://localhost:3000" -H "Cookie: ls_session=$TOKEN" \
  -d '{"bahasa":"cpp","kode":"#include <iostream>\nint main(){std::cout<<\"ok\";}","dapatDijalankan":true}'
```

## Things that are easy to get wrong

- **Do not add podman flags to `server.mjs`.** They live only in `soal.mjs` via
  `bangunArgumenPodman`. `src/lib/exec/sandbox.test.ts` and the workspace tests
  lock them; moving one out removes the security guard, not just coverage.
- **The workspace manager's in-memory map is not the source of truth** — podman
  is. Restarting the manager is safe; containers keep running and are
  rediscovered. Never "fix" it by persisting the map to disk.
- **`berhenti` never deletes the volume.** Participant work lives in
  `careevo-ws-<kunci>-data`. Read `podman volume ls` before removing anything.
- **`podman rm -f` succeeds even when the container is already gone**, so a
  non-zero exit is the only real failure signal (see `berhenti` in `server.mjs`).
- Both images must be present: `docker.io/codercom/code-server:4.140.0` and
  `docker.io/library/gcc:13`. First run pulls them if not.
