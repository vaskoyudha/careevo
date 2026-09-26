#!/usr/bin/env node
// E2E: verify the onboarding gate and personalized learner route using signed
// cookies minted with the same dev secret the app uses. Exercises: session-only
// -> /onboarding redirect; session+profile -> learner route states.
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
async function checkRoute({
  label,
  path,
  cookie = "",
  status,
  location,
  required = [],
  forbidden = [],
}) {
  const res = await fetch(base + path, {
    redirect: "manual",
    headers: cookie ? { cookie } : {},
  });
  const body = await res.text();
  const actualLocation = res.headers.get("location") ?? "";
  const problems = [];
  if (res.status !== status) problems.push(`status ${res.status}`);
  if (location !== undefined && actualLocation !== location) {
    problems.push(`location ${actualLocation || "(none)"}`);
  }
  for (const marker of required) {
    if (!body.includes(marker)) problems.push(`missing ${marker}`);
  }
  for (const marker of forbidden) {
    if (body.includes(marker)) problems.push(`unexpected ${marker}`);
  }
  const ok = problems.length === 0;
  if (!ok) failed++;
  console.log(
    `${ok ? "OK " : "ERR"} ${res.status} ${path}${actualLocation ? ` -> ${actualLocation}` : ""}  [${label}]${ok ? "" : ` (${problems.join("; ")})`}`,
  );
}

const sessionCookie = `ls_session=${encode(session)}`;
const profileCookie = `ls_profile=${encode(profile)}`;
const ownedEnrollment = {
  course_id: "crs-1",
  slug: "fullstack-web-development-nextjs-15-react-19",
  owner: session.email,
  enrolled_at: "2026-09-02T08:00:00.000Z",
  selesai_modul: ["crs-1-m1", "crs-1-m2"],
};
const legacyEnrollment = {
  course_id: "crs-1",
  slug: "fullstack-web-development-nextjs-15-react-19",
  enrolled_at: "2026-09-02T08:00:00.000Z",
  selesai_modul: ["crs-1-m1", "crs-1-m2"],
};
const ownedEnrollmentCookie = `ls_enroll=${encode([ownedEnrollment])}`;
const legacyEnrollmentCookie = `ls_enroll=${encode([legacyEnrollment])}`;

console.log("— without session —");
await checkRoute({ label: "no-session", path: "/dashboard", status: 307 });
await checkRoute({ label: "no-session", path: "/onboarding", status: 307 });
await checkRoute({
  label: "jalur redirects to login",
  path: "/belajar/jalur",
  status: 307,
  location: "/masuk",
});

console.log("\n— session, NO profile —");
await checkRoute({
  label: "jalur redirects to onboarding",
  path: "/belajar/jalur",
  cookie: sessionCookie,
  status: 307,
  location: "/onboarding",
});
await checkRoute({
  label: "dashboard gate",
  path: "/dashboard",
  cookie: sessionCookie,
  status: 307,
  location: "/onboarding",
});
await checkRoute({
  label: "belajar gate",
  path: "/belajar",
  cookie: sessionCookie,
  status: 307,
  location: "/onboarding",
});
await checkRoute({ label: "onboarding open", path: "/onboarding", cookie: sessionCookie, status: 200 });

console.log("\n— session + profile —");
const learnerCookie = `${sessionCookie}; ${profileCookie}`;
await checkRoute({ label: "dashboard ok", path: "/dashboard", cookie: learnerCookie, status: 200 });
await checkRoute({
  label: "onboarding bounce",
  path: "/onboarding",
  cookie: learnerCookie,
  status: 307,
  location: "/dashboard",
});
await checkRoute({ label: "edit mode stays", path: "/onboarding?edit=1", cookie: learnerCookie, status: 200 });
await checkRoute({ label: "demo public", path: "/onboarding/demo", status: 200 });
await checkRoute({
  label: "public login has no learner path",
  path: "/masuk",
  status: 200,
  forbidden: ["data-path-source"],
});
await checkRoute({
  label: "recommendation path",
  path: "/belajar/jalur",
  cookie: learnerCookie,
  status: 200,
  required: ['data-path-source="recommendation"', "Mulai kursus"],
  forbidden: ['data-path-source="active-enrollment"'],
});
await checkRoute({
  label: "owned enrollment path",
  path: "/belajar/jalur",
  cookie: `${learnerCookie}; ${ownedEnrollmentCookie}`,
  status: 200,
  required: [
    'data-path-source="active-enrollment"',
    'data-module-status="current"',
    "Lanjutkan belajar",
  ],
  forbidden: ['data-path-source="recommendation"'],
});
await checkRoute({
  label: "legacy enrollment remains recommendation",
  path: "/belajar/jalur",
  cookie: `${learnerCookie}; ${legacyEnrollmentCookie}`,
  status: 200,
  required: ['data-path-source="recommendation"', "Mulai kursus"],
  forbidden: ['data-path-source="active-enrollment"'],
});

console.log("\n— mastery path —");
await checkRoute({
  label: "mastery index opens",
  path: "/belajar/mastery",
  cookie: learnerCookie,
  status: 200,
  required: ["Jalur Penguasaan"],
});
await checkRoute({
  label: "mastery needs a session",
  path: "/belajar/mastery",
  cookie: undefined,
  status: 307,
  location: "/masuk",
});
await checkRoute({
  label: "unknown mastery topic is 404",
  path: "/belajar/mastery/aaaaaaaaaaaa",
  cookie: learnerCookie,
  status: 404,
});
await checkRoute({
  label: "path-escaping mastery id is 404",
  path: "/belajar/mastery/..%2F..%2Fetc%2Fpasswd",
  cookie: learnerCookie,
  status: 404,
});
await checkRoute({
  label: "malformed mastery id is 404",
  path: "/belajar/mastery/SHORT",
  cookie: learnerCookie,
  status: 404,
});

console.log("\n— books —");
await checkRoute({
  label: "book library opens",
  path: "/belajar/buku",
  cookie: learnerCookie,
  status: 200,
  required: ["Buku"],
});
await checkRoute({
  label: "book library needs a session",
  path: "/belajar/buku",
  cookie: undefined,
  status: 307,
  location: "/masuk",
});
await checkRoute({
  label: "unknown book is 404",
  path: "/belajar/buku/aaaaaaaaaaaa",
  cookie: learnerCookie,
  status: 404,
});
await checkRoute({
  label: "path-escaping book id is 404",
  path: "/belajar/buku/..%2F..%2Fetc%2Fpasswd",
  cookie: learnerCookie,
  status: 404,
});
await checkRoute({
  label: "malformed book id is 404",
  path: "/belajar/buku/SHORT",
  cookie: learnerCookie,
  status: 404,
});

console.log("\n— practice quizzes —");
await checkRoute({
  label: "latihan index opens",
  path: "/belajar/latihan",
  cookie: learnerCookie,
  status: 200,
  required: ["Latihan Soal", "Buat latihan baru"],
});
await checkRoute({
  label: "latihan needs a session",
  path: "/belajar/latihan",
  cookie: undefined,
  status: 307,
  location: "/masuk",
});
// 404 rather than 403: a 403 would confirm the id exists, which is the very
// leak the owner-scoped store exists to prevent.
await checkRoute({
  label: "unknown latihan is 404",
  path: "/belajar/latihan/aaaaaaaaaaaa",
  cookie: learnerCookie,
  status: 404,
});
await checkRoute({
  label: "path-escaping latihan id is 404",
  path: "/belajar/latihan/..%2F..%2Fetc%2Fpasswd",
  cookie: learnerCookie,
  status: 404,
});
await checkRoute({
  label: "malformed latihan id is 404",
  path: "/belajar/latihan/SHORT",
  cookie: learnerCookie,
  status: 404,
});

console.log("\n— profile owned by a different account (same browser) —");
const otherSessionCookie = `ls_session=${encode(otherSession)}`;
await checkRoute({
  label: "not inherited",
  path: "/dashboard",
  cookie: `${otherSessionCookie}; ${profileCookie}`,
  status: 307,
  location: "/onboarding",
});
await checkRoute({
  label: "onboarding open",
  path: "/onboarding",
  cookie: `${otherSessionCookie}; ${profileCookie}`,
  status: 200,
});

console.log(`\n${failed === 0 ? "PASS" : "FAIL"} — ${failed} failing check(s).`);
process.exit(failed === 0 ? 0 : 1);
