#!/usr/bin/env node
// E2E: verify the onboarding gate using signed cookies minted with the same
// dev secret the app uses. Exercises: session-only -> /onboarding redirect;
// session+profile -> dashboard 200; onboarding page -> 307 back to dashboard.
// Usage: node scripts/e2e-onboarding.mjs [baseUrl]

import { createHmac } from "node:crypto";

const base = process.argv[2] ?? "http://localhost:3000";
const SECRET = process.env.SESSION_SECRET ?? "dev-session-secret-careevo";

function sign(body) {
  return createHmac("sha256", SECRET).update(body).digest("base64url");
}
function encode(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

const session = {
  email: "e2e@careevo.test",
  nama: "E2E Tester",
  username: "e2etester",
  role: "user",
  iat: Date.now(),
};

const profile = {
  owner: session.email,
  experience: "dasar",
  background: "mahasiswa",
  interests: ["web-dev"],
  goal: "dapat-kerja",
  weeklyHours: 8,
  workPreference: "remote",
  completedAt: new Date().toISOString(),
  version: 2,
};

// Same browser cookie, but the session belongs to a *different* account than
// the profile's owner: the profile must be ignored (this is the register bug).
const otherSession = { ...session, email: "someone-else@careevo.test", username: "else" };

let failed = 0;
async function check(label, path, cookie, expect) {
  const res = await fetch(base + path, {
    redirect: "manual",
    headers: cookie ? { cookie } : {},
  });
  const ok = expect(res);
  if (!ok) failed++;
  const loc = res.headers.get("location") ?? "";
  console.log(`${ok ? "OK " : "ERR"} ${res.status} ${path}${loc ? ` -> ${loc}` : ""}  [${label}]`);
}

const sessionCookie = `ls_session=${encode(session)}`;
const profileCookie = `ls_profile=${encode(profile)}`;

console.log("— without session —");
await check("no-session", "/dashboard", "", (r) => r.status === 307);
await check("no-session", "/onboarding", "", (r) => r.status === 307);

console.log("\n— session, NO profile —");
await check("gate", "/dashboard", sessionCookie, (r) => r.status === 307 && (r.headers.get("location") ?? "").includes("/onboarding"));
await check("gate", "/belajar", sessionCookie, (r) => r.status === 307);
await check("onboarding open", "/onboarding", sessionCookie, (r) => r.status === 200);

console.log("\n— session + profile —");
await check("dashboard ok", "/dashboard", `${sessionCookie}; ${profileCookie}`, (r) => r.status === 200);
await check("onboarding bounce", "/onboarding", `${sessionCookie}; ${profileCookie}`, (r) => r.status === 307 && (r.headers.get("location") ?? "").includes("/dashboard"));
await check("edit mode stays", "/onboarding?edit=1", `${sessionCookie}; ${profileCookie}`, (r) => r.status === 200);
await check("demo public", "/onboarding/demo", "", (r) => r.status === 200);

console.log("\n— profile owned by a different account (same browser) —");
const otherSessionCookie = `ls_session=${encode(otherSession)}`;
await check("not inherited", "/dashboard", `${otherSessionCookie}; ${profileCookie}`, (r) => r.status === 307 && (r.headers.get("location") ?? "").includes("/onboarding"));
await check("onboarding open", "/onboarding", `${otherSessionCookie}; ${profileCookie}`, (r) => r.status === 200);

console.log(`\n${failed === 0 ? "PASS" : "FAIL"} — ${failed} failing check(s).`);
process.exit(failed === 0 ? 0 : 1);
