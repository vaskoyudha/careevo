---
name: careevo-attribution
description: >-
  Licensing and attribution rules for Careevo, which ports code from MIT-licensed
  career-ops. Use when adding code adapted from another project, when copying or
  porting a module, when asked about licences or provenance, when writing file
  headers, or when preparing a release or public repo.
license: MIT
metadata:
  owner: careevo
  area: legal
---

# Careevo attribution

Careevo contains code adapted from **career-ops**. This is a licence condition,
not a courtesy. Getting it wrong is a legal problem, not a style problem.

## What was ported

| Careevo file | Adapted from | Licence |
|---|---|---|
| `src/lib/jobs/trust.ts` | career-ops `providers/_trust-validator.mjs` + `lib/ascii-fold.mjs` | MIT |
| `src/lib/jobs/filters.ts` | career-ops `scan.mjs` (`buildLocationFilter`, `buildContentFilter`, `buildSalaryFilter`) | MIT |

Upstream: <https://github.com/career-ops-hq/career-ops>
Copyright © 2026 Santiago Fernández de Valderrama.

## The rule

**Every file containing adapted code carries the notice in its header.** The
existing files show the exact form:

```ts
/**
 * trust.ts — URL/domain trust validation for job postings.
 *
 * Adapted from career-ops (MIT), © 2026 Santiago Fernández de Valderrama.
 * Source: providers/_trust-validator.mjs + lib/ascii-fold.mjs
 * https://github.com/career-ops-hq/career-ops
 */
```

Keep the `Adapted from` line, the copyright, and the upstream URL. Name the
specific upstream file(s) so a reader can diff against them.

## What MIT permits, and what it does not

MIT is permissive: use, copy, modify, merge, publish, distribute, sublicense,
and sell. The one condition is that the copyright notice and permission notice
appear in all copies or substantial portions.

MIT covers the **code**. It does **not** grant the name or brand. career-ops'
`TRADEMARK.md` is explicit: the code is free, the "career-ops" name is reserved
for the project and its maintainers.

Therefore, in Careevo:

- **Do** reuse and adapt the code, with the header notice.
- **Do** say "adapted from career-ops" or "based on career-ops" if describing lineage.
- **Do not** brand anything as "career-ops", or imply endorsement by that project.
- **Do not** reuse its logos or visual identity.

## Adding a new port

1. Put the notice in the new file's header, naming the upstream file(s).
2. Add a row to the table in this skill.
3. If the port is substantial, consider a top-level `NOTICE` file listing every
   adapted file — the repo does not have one yet, and adding it is the safest
   option if the ported surface grows.
4. Note any behavioural changes you made, especially deliberate divergences.
   `src/lib/jobs/trust.ts` adds Indonesian boards (Glints, Jobstreet, Kalibrr) to
   the ATS allowlist, which upstream does not have — a reader diffing the two
   should not mistake that for a mistake.

## Third-party data

Separate from licensing: the Indonesian job-board providers in career-ops scrape
Glints and Jobstreet through undocumented endpoints. Careevo has **not** adopted
those (the live feed is deferred). If it ever does, the endpoints' own terms of
service become Careevo's problem, and that is a decision to make deliberately
rather than by copying a file.

## When unsure

Prefer attribution. Adding a correct notice costs one comment block; omitting a
required one is a licence violation. If a port's provenance is unclear, say so
in the header rather than leaving it silent.
