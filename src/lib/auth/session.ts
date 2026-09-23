import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  isRole,
  type DemoAccount,
  type Role,
  type SessionPayload,
  type SessionUser,
} from "./types";
import { findStoredUser, hashPassword } from "./user-store";

export const ROLE = {
  USER: "user",
  VERIFIKATOR: "verifikator",
  ADMIN: "admin",
} as const satisfies Record<string, Role>;

export type { Role, SessionPayload, SessionUser };

export const COOKIE_NAME = "ls_session";
export const DEMO_PASSWORD = "careevo";

const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-session-secret-careevo";
const SESSION_MAX_AGE = 60 * 60 * 8;

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: "user@careevo.test",
    nama: "Raka Pratama",
    username: "raka",
    role: ROLE.USER,
    password: DEMO_PASSWORD,
  },
  {
    email: "verifikator@careevo.test",
    nama: "Dewi Larasati",
    username: "dewi",
    role: ROLE.VERIFIKATOR,
    password: DEMO_PASSWORD,
  },
  {
    email: "admin@careevo.test",
    nama: "Admin Careevo",
    username: "admin",
    role: ROLE.ADMIN,
    password: DEMO_PASSWORD,
  },
];

function sign(body: string): string {
  return createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function encodeToken(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeToken(token: string): SessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  if (!safeEqual(signature, sign(body))) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;

    const candidate = parsed as Record<string, unknown>;
    if (
      typeof candidate.email !== "string" ||
      typeof candidate.nama !== "string" ||
      typeof candidate.username !== "string" ||
      typeof candidate.iat !== "number" ||
      !isRole(candidate.role)
    ) {
      return null;
    }

    if (Date.now() - candidate.iat > SESSION_MAX_AGE * 1000) {
      return null;
    }

    return {
      email: candidate.email,
      nama: candidate.nama,
      username: candidate.username,
      role: candidate.role,
      iat: candidate.iat,
    };
  } catch {
    return null;
  }
}

function toSessionUser(account: DemoAccount): SessionUser {
  return {
    email: account.email,
    nama: account.nama,
    username: account.username,
    role: account.role,
  };
}

export async function authenticate(
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const normalized = email.trim().toLowerCase();

  const account = DEMO_ACCOUNTS.find(
    (item) => item.email.toLowerCase() === normalized,
  );
  if (account) {
    if (!safeEqual(account.password, password)) return null;
    return toSessionUser(account);
  }

  const stored = await findStoredUser(normalized);
  if (!stored) return null;
  if (!safeEqual(stored.passwordHash, hashPassword(password))) return null;

  return {
    email: stored.email,
    nama: stored.nama,
    username: stored.username,
    role: stored.role,
  };
}

export function isDemoEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return DEMO_ACCOUNTS.some((item) => item.email.toLowerCase() === normalized);
}

export async function createSession(user: SessionUser): Promise<void> {
  const jar = await cookies();
  const token = encodeToken({ ...user, iat: Date.now() });
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decodeToken(token);
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
