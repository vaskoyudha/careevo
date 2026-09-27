import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  isEmbeddedChatRoute,
  routeSessionId,
  shouldRevalidateCachedSession,
} from "../features/chat/controllers/useChatRouteSession";

test("route/session selection and cached revalidation stay deterministic", () => {
  assert.equal(routeSessionId("session-1"), "session-1");
  assert.equal(routeSessionId(" "), null);
  assert.equal(
    shouldRevalidateCachedSession({
      routeSessionId: "session-1",
      selectedSessionId: "session-1",
      hasCachedMessages: true,
      isStreaming: false,
    }),
    true,
  );
  assert.equal(
    shouldRevalidateCachedSession({
      routeSessionId: "session-1",
      selectedSessionId: "session-1",
      hasCachedMessages: true,
      isStreaming: true,
    }),
    false,
  );
});

test("embed route detection stays on a path-segment boundary", () => {
  assert.equal(isEmbeddedChatRoute("/embed/chat"), true);
  assert.equal(isEmbeddedChatRoute("/embed/chat/x"), true);
  assert.equal(isEmbeddedChatRoute("/chat"), false);
  assert.equal(isEmbeddedChatRoute("/chat/abc"), false);
  assert.equal(isEmbeddedChatRoute("/embedded-x"), false);
});

/**
 * The predicate above is only half the fix; the other half is that every
 * navigation call site in `ChatWorkspace` consults it. A missing guard is
 * invisible to the predicate's own tests and to `tsc` — it just silently
 * ejects the frame into the sidebar layout. `handleSelectCapability`'s
 * `immersive_watching` push shipped unguarded exactly that way, so this
 * scans the real source: each `router.push` / `router.replace` /
 * `navigateTask` must have an `if (embeddedChat) return;` shortly above it.
 */
test("every ChatWorkspace navigation site is gated on the embed route", () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), "features/chat/components/ChatWorkspace.tsx"),
    "utf8",
  );
  const lines = source.split("\n");
  const guardAt: number[] = [];
  const navAt: number[] = [];
  lines.forEach((line, index) => {
    if (line.includes("if (embeddedChat) return;")) guardAt.push(index);
    if (
      line.includes("router.push(") ||
      line.includes("router.replace(") ||
      line.includes("navigateTask(")
    ) {
      navAt.push(index);
    }
  });

  assert.ok(navAt.length >= 6, `expected to find the navigation sites, got ${navAt.length}`);
  // Guards and navigations are not 1:1 — the watching/mode effect has two
  // `router.replace` calls behind one guard — so this checks coverage per
  // navigation rather than counting.
  assert.ok(
    guardAt.length >= 5,
    `expected at least 5 embed guards, found ${guardAt.length}`,
  );

  // Each navigation must sit in the same statement block as a guard a few
  // lines above it — not merely `embeddedChat` existing somewhere earlier.
  for (const nav of navAt) {
    const nearest = [...guardAt].reverse().find((guard) => guard < nav);
    assert.ok(nearest !== undefined, `navigation at line ${nav + 1} has no embed guard above it`);
    assert.ok(
      nav - nearest <= 12,
      `navigation at line ${nav + 1} is ${nav - nearest} lines from its embed guard; it should be in the same block`,
    );
  }
});
