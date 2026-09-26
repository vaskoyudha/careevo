# Personalized Learning Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Each task is independently reviewable; preserve the red → green → verification → commit sequence.

**Goal:** Add a deterministic, owner-isolated `/belajar/jalur` experience that selects an enrolled or recommended course, derives module statuses, and links learners back into the existing course flow.

**Architecture:** Extend the signed enrollment cookie with an optional normalized `owner` while preserving legacy decoding. Add a pure `bangunJalurPersonalisasi(...)` policy that accepts plain data, filters against `profile.owner`, and delegates course ranking and curriculum generation to existing modules. Render the result through a server component inside `LearnerShell`; add one item to `LearnerChrome` only.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, server actions, HMAC-signed cookies, Vitest node tests, existing HTTP smoke/onboarding scripts.

**Spec:** `docs/superpowers/specs/2026-09-24-personalized-learning-path-design.md`

## Global Constraints

- Keep user-facing copy in Indonesian.
- Use existing Tailwind v4 tokens and learner-shell spacing; do not add a new navbar or theme system.
- Learner pages use `LearnerShell`; do not use `AppShell` for `/belajar/jalur`.
- Do not modify the public `src/components/ui/chrome.tsx` navbar.
- Do not add LLM calls, RAG, embeddings, document ingestion, books, immersive reading, WebSockets, a database, or new dependencies.
- Do not label module completion as knowledge mastery; use `progres belajar` and `langkah berikutnya`.
- Preserve unrelated working-tree changes. Stage exact task files only.
- Do not add `.test.tsx`; Vitest includes `src/**/*.test.ts` only.
- `npm run check` does not run build, smoke, or onboarding e2e; run those gates explicitly.
- Use the existing signed-cookie architecture. This slice is browser-scoped and not cross-device durable.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `src/lib/auth/types.ts` | Canonical `normalizeOwner()` helper. |
| Create | `src/lib/auth/types.test.ts` | Owner normalization contract. |
| Modify | `src/lib/profile/store.ts` | Re-export the shared owner helper. |
| Modify | `src/lib/onboarding/store.ts` | Re-export the shared owner helper. |
| Modify | `src/lib/courses/enrollment.ts` | Optional owner field, legacy codec, owner-filtered reads/mutations, capacity check. |
| Modify | `src/lib/courses/enrollment.test.ts` | Owner and legacy codec tests. |
| Modify | `src/actions/enrollment.ts` | Pass the authenticated owner through enrollment mutations. |
| Modify | `src/actions/enrollment.test.ts` | Cross-account action isolation tests. |
| Modify | `src/app/(app)/belajar/page.tsx` | Pass `session.email` to enrollment reads. |
| Modify | `src/app/(app)/belajar/[slug]/page.tsx` | Pass `session.email` to enrollment reads. |
| Modify | `src/lib/onboarding/rekomendasi.ts` | Catalog-order/stable-ID tie-break. |
| Modify | `src/lib/onboarding/rekomendasi.test.ts` | Recommendation tie tests. |
| Create | `src/lib/learning/personalized-path.ts` | Pure path selection and module-status policy. |
| Create | `src/lib/learning/personalized-path.test.ts` | Pure policy tests. |
| Create | `src/components/features/learning/jalur-belajar-view.tsx` | Server-rendered path overview. |
| Create | `src/app/(app)/belajar/jalur/page.tsx` | Auth/profile/data orchestration. |
| Modify | `scripts/smoke.mjs` | Add the new route to smoke coverage. |
| Modify | `scripts/e2e-onboarding.mjs` | Verify redirects and signed-cookie path states. |
| Modify | `src/components/ui/learner-chrome.tsx` | Add the learner-only link and exclusive active matching. |
| Unchanged | `src/app/(app)/layout.tsx` | Existing auth/profile gate remains authoritative. |
| Unchanged | `src/components/ui/learner-shell.tsx` | Reuse the existing learner shell. |
| Unchanged | `src/components/ui/chrome.tsx` | Public navbar remains unchanged. |
| Unchanged | `src/app/globals.css` | Existing navbar morph behavior remains unchanged. |
| Unchanged | `package.json` | No dependency or script changes. |

## Interfaces

### Shared owner helper

```ts
export function normalizeOwner(owner: string): string;
```

Behavior: `owner.trim().toLowerCase()`.

### Enrollment interface after Task 1

```ts
export interface Pendaftaran {
  course_id: string;
  slug: string;
  enrolled_at: string;
  selesai_modul: string[];
  owner?: string;
}

export async function listPendaftaran(owner: string): Promise<Pendaftaran[]>;
export async function cariPendaftaran(
  courseId: string,
  owner: string,
): Promise<Pendaftaran | undefined>;
export async function daftarKursus(
  courseId: string,
  slug: string,
  owner: string,
): Promise<Pendaftaran[]>;
export async function tandaiModul(
  courseId: string,
  modulId: string,
  owner: string,
): Promise<Pendaftaran | null>;
export async function pendaftaranPenuh(): Promise<boolean>;
```

`owner` is optional only at the codec boundary for legacy compatibility. New writes always include a normalized owner. Ownerless records are invisible to owner-scoped reads and mutations.

### Personalized-path interface

```ts
export type PersonalizedPathInput = {
  profile: OnboardingProfile;
  catalog: EntriKatalog[];
  enrollments: Pendaftaran[];
};

export type PathModule = {
  id: string;
  title: string;
  status: "completed" | "current" | "upcoming";
  href: string;
};

export type NextLearningAction = {
  kind: "continue-course" | "start-course" | "explore-courses";
  label: string;
  href: string;
  moduleId?: string;
};

export type PersonalizedPath = {
  course: EntriKatalog | null;
  source: "active-enrollment" | "recommendation" | "empty";
  modules: PathModule[];
  nextAction: NextLearningAction | null;
};

export function bangunJalurPersonalisasi(
  input: PersonalizedPathInput,
): PersonalizedPath;
```

Action policy:

```ts
// Active enrollment
{
  kind: "continue-course",
  label: "Lanjutkan belajar",
  href: `/belajar/${course.slug}#kurikulum`,
  moduleId: currentModule.id,
}

// Recommendation
{
  kind: "start-course",
  label: "Mulai kursus",
  href: `/belajar/${course.slug}`,
}

// Empty catalog/no recommendation
{
  kind: "explore-courses",
  label: "Jelajahi kursus",
  href: "/belajar",
}
```

All module links use `/belajar/${course.slug}#kurikulum`. If all modules are complete, `nextAction` is `null` and the view renders a separate `Ulas kursus` link.

---

## Task 1: Owner-Scope Enrollment Records

**Category:** `deep` — privacy-critical cookie, action, and read behavior.

**Files:**

- Modify `src/lib/auth/types.ts`
- Create `src/lib/auth/types.test.ts`
- Modify `src/lib/profile/store.ts`
- Modify `src/lib/onboarding/store.ts`
- Modify `src/lib/courses/enrollment.ts`
- Modify `src/lib/courses/enrollment.test.ts`
- Modify `src/actions/enrollment.ts`
- Modify `src/actions/enrollment.test.ts`
- Modify `src/app/(app)/belajar/page.tsx`
- Modify `src/app/(app)/belajar/[slug]/page.tsx`

**Produces:** the enrollment interface above. Existing signed cookies without `owner` remain decodable but are ignored by personalized reads.

- [ ] **Step 1: Write the failing owner-normalization test**

```ts
import { describe, expect, it } from "vitest";
import { normalizeOwner } from "./types";

describe("normalizeOwner", () => {
  it("normalizes account identifiers for owner comparisons", () => {
    expect(normalizeOwner("  RAKA@Careevo.Test  ")).toBe("raka@careevo.test");
  });
});
```

- [ ] **Step 2: Add failing codec cases**

Keep the current ownerless fixture and add an owned record:

```ts
const OWNED: Pendaftaran = {
  course_id: "crs-2",
  slug: "membangun-rest-api-modern-dengan-nodejs",
  owner: "raka@careevo.test",
  enrolled_at: "2026-09-02T08:00:00.000Z",
  selesai_modul: [],
};
```

Add these test names:

```text
decodePendaftaran mempertahankan entri lama tanpa owner
decodePendaftaran mempertahankan entri owner yang sudah dinormalisasi
decodePendaftaran membuang owner dengan tipe atau nilai kosong
```

- [ ] **Step 3: Add failing action/read-isolation cases**

Extend `src/actions/enrollment.test.ts` using its existing cookie jar and session mocks. Cover:

```text
owner written normalized after daftarKursusAction
owner remains normalized after tandaiModulAction
listPendaftaran filters another account
two accounts can hold separate records for the same course_id
cariPendaftaran cannot retrieve another account's record
ownerless legacy record is ignored by owner-scoped reads
tandaiModulAction changes only the active owner's record
pendaftaranPenuh counts the full signed-cookie array
```

The same-course case must create both records:

```ts
[
  { owner: "a@careevo.test", course_id: "crs-1", ... },
  { owner: "b@careevo.test", course_id: "crs-1", ... },
]
```

- [ ] **Step 4: Run the red test**

```bash
npx vitest run src/lib/auth/types.test.ts src/lib/courses/enrollment.test.ts src/actions/enrollment.test.ts
```

Expected: FAIL because the shared helper, owner field, and owner-required signatures do not exist.

- [ ] **Step 5: Centralize owner normalization**

Add `normalizeOwner()` to `src/lib/auth/types.ts`. Import and re-export it from `src/lib/profile/store.ts` and `src/lib/onboarding/store.ts` so existing public exports remain valid.

- [ ] **Step 6: Extend the signed enrollment codec**

Add optional `owner` to `Pendaftaran`. `isPendaftaran()` must accept an absent owner for legacy cookies, but reject a present owner that is not a non-empty string. Do not synthesize an owner while decoding.

- [ ] **Step 7: Implement owner-filtered reads and non-destructive writes**

Use a shared predicate:

```ts
function milikPemilik(item: Pendaftaran, owner: string): boolean {
  return item.owner !== undefined &&
    normalizeOwner(item.owner) === normalizeOwner(owner);
}
```

`listPendaftaran(owner)` and `cariPendaftaran(courseId, owner)` filter the full decoded array. `daftarKursus` and `tandaiModul` must read the full array, mutate only the matching owner/course record, and write the full array back. Never write a filtered owner subset.

Use `pendaftaranPenuh()` to enforce the existing global 50-record browser cap without exposing records from other owners.

- [ ] **Step 8: Pass the session owner through all callers**

Change the enrollment action helper so the authenticated session email is available to all operations. Use these exact calls:

```ts
cariPendaftaran(target.id, session.email);
listPendaftaran(session.email);
daftarKursus(target.id, target.slug, session.email);
tandaiModul(target.id, modulId, session.email);
```

Update both existing learner course pages to pass `session.email` to `listPendaftaran()`.

- [ ] **Step 9: Run the green gate**

```bash
npx vitest run src/lib/auth/types.test.ts src/lib/courses/enrollment.test.ts src/actions/enrollment.test.ts src/lib/profile/store.test.ts src/lib/onboarding/store.test.ts src/lib/onboarding/integration.test.ts
npm run typecheck
```

Expected: all listed tests pass and TypeScript exits 0.

- [ ] **Step 10: Commit the owner boundary**

```bash
git add src/lib/auth/types.ts src/lib/auth/types.test.ts src/lib/profile/store.ts src/lib/onboarding/store.ts src/lib/courses/enrollment.ts src/lib/courses/enrollment.test.ts src/actions/enrollment.ts src/actions/enrollment.test.ts "src/app/(app)/belajar/page.tsx" "src/app/(app)/belajar/[slug]/page.tsx"
git commit -m "feat(enrollment): scope course progress by owner"
```

---

## Task 2: Add the Deterministic Personalized-Path Policy

**Category:** `deep` — pure domain policy with selection, ordering, and state invariants.

**Files:**

- Create `src/lib/learning/personalized-path.ts`
- Create `src/lib/learning/personalized-path.test.ts`
- Modify `src/lib/onboarding/rekomendasi.ts`
- Modify `src/lib/onboarding/rekomendasi.test.ts`

**Consumes:** Task 1’s owner-bearing `Pendaftaran`, `rekomendasiKursus`, `modulKursus`, `irisModulSelesai`, and `normalizeOwner`.

- [ ] **Step 1: Add failing recommendation-tie tests**

Create two equal-score entries in catalog order `[id-z, id-a]` with titles that would choose `id-a` under title sorting:

```ts
expect(
  rekomendasiKursus([idZ, idA], profile, 1).map((entry) => entry.id),
).toEqual(["id-z"]);
```

Call the function twice and assert identical output.

- [ ] **Step 2: Add failing path-policy tests**

Use a complete `OnboardingProfile`, real `EntriKatalog` data, `modulKursus()` IDs, and plain enrollment arrays. Cover:

```text
active owner enrollment overrides a higher recommendation
newest valid owned enrollment wins, then course_id ascending tie
unowned, other-owner, invalid-date, and missing-course entries are ignored
recommendation is used when no valid owned enrollment exists
equal-score recommendations preserve catalog order
completed IDs produce completed statuses
an out-of-order completed ID remains completed
the first incomplete module is current
later incomplete modules are upcoming
all complete modules produce nextAction null
empty catalog returns course null, source empty, modules [], explore action
catalog completed flags and global task statuses do not create progress
duplicate completion IDs do not alter module status
```

For out-of-order completion, assert:

```ts
expect(result.modules.map((module) => module.status)).toEqual([
  "completed",
  "current",
  "completed",
  "upcoming",
  "upcoming",
]);
```

For a recommendation:

```ts
expect(result).toMatchObject({
  source: "recommendation",
  nextAction: {
    kind: "start-course",
    label: "Mulai kursus",
    href: "/belajar/test-course",
  },
});
```

- [ ] **Step 3: Run the red test**

```bash
npx vitest run src/lib/onboarding/rekomendasi.test.ts src/lib/learning/personalized-path.test.ts
```

Expected: FAIL because the tie policy is wrong and `personalized-path.ts` does not exist.

- [ ] **Step 4: Update recommendation tie ordering**

Keep score-descending behavior, then use catalog order and stable ID:

```ts
const catalogIndex = new Map(
  input.catalog.map((entry, index) => [entry.id, index]),
);
```

Sort equal scores with:

```ts
b.score - a.score ||
catalogIndex.get(a.entry.id)! - catalogIndex.get(b.entry.id)! ||
a.entry.id.localeCompare(b.entry.id)
```

Do not change scoring weights, track inference, or the existing course-store projection.

- [ ] **Step 5: Implement the pure path policy**

Normalize `profile.owner`, filter owned enrollments, validate dates and catalog membership, then sort by newest enrollment and course ID:

```ts
const owner = normalizeOwner(input.profile.owner);
const owned = input.enrollments.filter((item) => milikPemilik(item, owner));
const validOwned = owned
  .flatMap((item) => {
    const course = input.catalog.find((candidate) => candidate.id === item.course_id);
    const enrolledAt = Date.parse(item.enrolled_at);
    return course && Number.isFinite(enrolledAt) ? [{ item, course, enrolledAt }] : [];
  })
  .sort(
    (a, b) =>
      b.enrolledAt - a.enrolledAt ||
      a.item.course_id.localeCompare(b.item.course_id),
  );
```

Select the first valid owned course, otherwise use `rekomendasiKursus(input.catalog, input.profile, 1)[0]`. Build modules with `modulKursus()` and filter completion IDs with `irisModulSelesai()` and a `Set`.

Map module statuses so completed IDs remain completed, the first incomplete module is current, and later modules are upcoming. Set `nextAction` to `null` when all modules are complete.

- [ ] **Step 6: Run the green gate**

```bash
npx vitest run src/lib/onboarding/rekomendasi.test.ts src/lib/learning/personalized-path.test.ts src/lib/courses/kurikulum.test.ts
npm run typecheck
```

Expected: all tests pass and TypeScript exits 0.

- [ ] **Step 7: Commit the path policy**

```bash
git add src/lib/onboarding/rekomendasi.ts src/lib/onboarding/rekomendasi.test.ts src/lib/learning/personalized-path.ts src/lib/learning/personalized-path.test.ts
git commit -m "feat(learning): add deterministic path policy"
```

---

## Task 3: Add the `/belajar/jalur` Route and Signed-Cookie Coverage

**Category:** `visual-engineering` — server-rendered learner view and route acceptance.

**Files:**

- Create `src/components/features/learning/jalur-belajar-view.tsx`
- Create `src/app/(app)/belajar/jalur/page.tsx`
- Modify `scripts/smoke.mjs`
- Modify `scripts/e2e-onboarding.mjs`

**Consumes:** `PersonalizedPath`, `OnboardingProfile`, `getProfile(owner)`, `katalogBelajar()`, `listPendaftaran(owner)`, and `LearnerShell`.

- [ ] **Step 1: Add failing signed-cookie route checks**

Extend `scripts/e2e-onboarding.mjs` with a helper that fetches with `redirect: "manual"`, checks status/location, and checks required/forbidden HTML markers.

Add these cases:

```text
no session -> /belajar/jalur -> 307 Location /masuk
session without profile -> /belajar/jalur -> 307 Location /onboarding
valid profile, no enrollment -> data-path-source="recommendation"
owner enrollment with m1/m2 complete -> data-path-source="active-enrollment" and data-module-status="current"
ownerless legacy enrollment -> recommendation, not active-enrollment
```

Use this owned enrollment payload in the e2e setup:

```js
{
  course_id: "crs-1",
  slug: "fullstack-web-development-nextjs-15-react-19",
  owner: session.email,
  enrolled_at: "2026-09-02T08:00:00.000Z",
  selesai_modul: ["crs-1-m1", "crs-1-m2"],
}
```

- [ ] **Step 2: Add the route to smoke coverage**

Add `/belajar/jalur` to the `routes` array. Keep the report denominator derived from `routes.length`; do not hardcode a route count.

- [ ] **Step 3: Run the route checks red**

Start the app:

```bash
npm run dev -- --port 3103
```

In another terminal:

```bash
npm run smoke -- http://localhost:3103
npm run e2e:onboarding -- http://localhost:3103
```

Expected: `/belajar/jalur` is 404 and the new e2e cases fail.

- [ ] **Step 4: Create the server-rendered view**

`JalurBelajarView` must render:

```text
Jalur Belajar
Kursus pilihan
Progres belajar
Langkah berikutnya
Daftar modul
Selesai
Sedang dipelajari
Mendatang
Mulai kursus
Lanjutkan belajar
Jelajahi kursus
Kursus selesai
Ulas kursus
Belum ada kursus yang cocok
```

Use `data-path-source={path.source}` on the root section and `data-module-status={module.status}` on each module item. Use native `Link` elements, an accessible progressbar only when a course exists, responsive `min-w-0`/`break-words`, and no fixed-width module card. Use `hitungProgres()` for the displayed percentage. Never use global task fixtures or mastery wording.

- [ ] **Step 5: Create the route page**

Use the existing `(app)` gate and `LearnerShell`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/onboarding/store";
import { katalogBelajar } from "@/lib/courses/katalog";
import { listPendaftaran } from "@/lib/courses/enrollment";
import { bangunJalurPersonalisasi } from "@/lib/learning/personalized-path";
import { LearnerShell } from "@/components/ui/learner-shell";
import { JalurBelajarView } from "@/components/features/learning/jalur-belajar-view";

export const metadata: Metadata = { title: "Jalur Belajar" };

export default async function JalurBelajarPage() {
  const session = await getSession();
  if (!session) return null;

  const [profile, catalog, enrollments] = await Promise.all([
    getProfile(session.email),
    katalogBelajar(),
    listPendaftaran(session.email),
  ]);

  if (!profile) notFound();

  const path = bangunJalurPersonalisasi({ profile, catalog, enrollments });

  return (
    <LearnerShell session={session}>
      <JalurBelajarView path={path} profile={profile} />
    </LearnerShell>
  );
}
```

Do not modify `src/app/(app)/layout.tsx`; route groups do not add URL segments.

- [ ] **Step 6: Run the route green gate**

With the server on port 3103:

```bash
npm run typecheck
npm run smoke -- http://localhost:3103
npm run e2e:onboarding -- http://localhost:3103
npm run build
```

Expected: typecheck/build exit 0, smoke includes `OK ... /belajar/jalur`, and all signed-cookie route checks pass.

- [ ] **Step 7: Commit the route vertical slice**

```bash
git add "src/app/(app)/belajar/jalur/page.tsx" src/components/features/learning/jalur-belajar-view.tsx scripts/smoke.mjs scripts/e2e-onboarding.mjs
git commit -m "feat(learning): add Jalur Belajar route"
```

---

## Task 4: Add the Learner Navbar Item and Run Final Gates

**Category:** `visual-engineering` — small navigation change with accessibility and responsive verification.

**Files:**

- Modify `src/components/ui/learner-chrome.tsx`

**Produces:** one accessible `Jalur Belajar` link at `/belajar/jalur`, with exclusive active matching.

- [ ] **Step 1: Record the red state**

On a running server, open `/belajar` with an authenticated learner state and inspect the accessibility tree. Expected before implementation: no link to `/belajar/jalur`.

- [ ] **Step 2: Add the learner-only item**

Reuse the already-installed `lucide-react` `Route` icon:

```ts
{
  href: "/belajar/jalur",
  label: "Jalur Belajar",
  icon: (
    <Route
      width={15}
      height={15}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    />
  ),
}
```

Place it after `Belajar`. Do not add it to public `Chrome`, the footer, or `ExploreMenu`.

- [ ] **Step 3: Make active matching exclusive**

Use longest matching href:

```ts
const activeHref = navItems
  .filter(
    (item) =>
      pathname === item.href || pathname.startsWith(`${item.href}/`),
  )
  .sort((a, b) => b.href.length - a.href.length)[0]?.href;
```

Then:

```ts
const active = item.href === activeHref;
```

On `/belajar/jalur`, only `Jalur Belajar` receives `is-active` and `aria-current="page"`. On `/belajar/[slug]`, `Belajar` remains active.

- [ ] **Step 4: Run navbar checks**

Use Playwright at 320, 768, and 1280 CSS pixels and verify:

```text
Jalur Belajar is present in the accessibility tree
link is keyboard reachable and activatable
on /belajar/jalur it is the sole aria-current="page" nav link
document.documentElement.scrollWidth <= window.innerWidth
focus indicators remain visible
browser console has no new errors
navbar morph still flips at scrollY > 24
```

- [ ] **Step 5: Run all required gates**

```bash
npm run check
npm run build
git diff --check
```

With a running server:

```bash
npm run smoke -- http://localhost:3000
npm run e2e:onboarding -- http://localhost:3000
```

Expected: every command exits 0, the smoke total is derived from `routes.length`, and e2e redirects/body states pass.

- [ ] **Step 6: Commit navigation**

```bash
git add src/components/ui/learner-chrome.tsx
git commit -m "feat(nav): add Jalur Belajar learner link"
```

---

## Commit Strategy

Use four commits only:

1. `feat(enrollment): scope course progress by owner`
2. `feat(learning): add deterministic path policy`
3. `feat(learning): add Jalur Belajar route`
4. `feat(nav): add Jalur Belajar learner link`

Tests and their production change stay in the same commit. Do not amend failed commits, force-push, stage unrelated files, or commit `.next`, screenshots, cookies, or browser artifacts.

## Dependency and Migration Risks

1. Ownerless legacy records remain decodable but disappear from personalized progress; users must re-enroll.
2. Enrollment identity becomes `(owner, course_id)`; every lookup must pass an owner.
3. Mutations must write the complete signed array after filtering only for lookup.
4. The existing 50-record cap remains browser-global; changing it is out of scope.
5. Equal-score recommendations change from title order to catalog order/stable ID.
6. Completed IDs remain completed even when an earlier module is incomplete.
7. External curriculum URLs are material, not routes; path links use `/belajar/${slug}#kurikulum`.
8. Fixture `completed` flags and global task statuses are not learner evidence.
9. The slice remains browser-bound and does not become cross-device state.
10. Existing Next.js smoke checks only prove reachability; signed-cookie e2e assertions must prove the new personalized states.

## Success Criteria

- New enrollment writes include normalized owners.
- Same-course records from different accounts remain isolated.
- Ownerless records never appear as personalized progress.
- Recommendation ties are deterministic.
- Active enrollment selection uses newest valid timestamp, then course ID.
- Module IDs come only from `modulKursus()` and stale IDs are ignored.
- Completed/current/upcoming states handle gaps, duplicates, all-complete, and recommendation cases.
- `/belajar/jalur` uses `(app)` and `LearnerShell`.
- Missing learner sessions/profiles follow existing redirects.
- The page performs no LLM, RAG, or external data call.
- `Jalur Belajar` appears only in the learner navbar and is the sole active item on its route.
- The route has no horizontal overflow at 320px.
- Indonesian copy avoids knowledge-mastery claims.
- `npm run check`, `npm run build`, smoke, and onboarding e2e exit 0.
- No unrelated working-tree file is modified or committed.
