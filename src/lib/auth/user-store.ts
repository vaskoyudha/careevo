import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { bacaSecret } from "@/lib/config/secrets";
import { isRole, type Role } from "./types";

export const USERS_COOKIE = "ls_users";
const USERS_MAX_AGE = 60 * 60 * 24 * 30;
const MAX_USERS = 20;

export interface StoredUser {
  email: string;
  nama: string;
  username: string;
  role: Role;
  passwordHash: string;
}

export function hashPassword(password: string): string {
  return createHash("sha256").update(`careevo:${password}`).digest("hex");
}

function sign(body: string): string {
  return createHmac("sha256", bacaSecret("SESSION_SECRET"))
    .update(body)
    .digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function isStoredUser(value: unknown): value is StoredUser {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.email === "string" &&
    typeof candidate.nama === "string" &&
    typeof candidate.username === "string" &&
    typeof candidate.passwordHash === "string" &&
    isRole(candidate.role)
  );
}

function decode(raw: string | undefined): StoredUser[] {
  if (!raw) return [];
  const [body, signature] = raw.split(".");
  if (!body || !signature) return [];
  if (!safeEqual(signature, sign(body))) return [];
  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredUser);
  } catch {
    return [];
  }
}

function encode(users: StoredUser[]): string {
  const body = Buffer.from(JSON.stringify(users), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export async function listStoredUsers(): Promise<StoredUser[]> {
  const jar = await cookies();
  return decode(jar.get(USERS_COOKIE)?.value);
}

export async function findStoredUser(
  email: string,
): Promise<StoredUser | undefined> {
  const normalized = email.trim().toLowerCase();
  const users = await listStoredUsers();
  return users.find((user) => user.email.toLowerCase() === normalized);
}

export async function isEmailTaken(email: string): Promise<boolean> {
  return Boolean(await findStoredUser(email));
}

export async function addStoredUser(user: StoredUser): Promise<void> {
  const jar = await cookies();
  const users = decode(jar.get(USERS_COOKIE)?.value);
  const normalized = user.email.toLowerCase();
  const next = [
    ...users.filter((item) => item.email.toLowerCase() !== normalized),
    user,
  ].slice(-MAX_USERS);

  jar.set(USERS_COOKIE, encode(next), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: USERS_MAX_AGE,
  });
}
