export const ROLES = ["user", "verifikator", "admin"] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function normalizeOwner(owner: string): string {
  return owner.trim().toLowerCase();
}

export interface SessionUser {
  email: string;
  nama: string;
  username: string;
  role: Role;
}

export interface SessionPayload extends SessionUser {
  iat: number;
}

export interface DemoAccount extends SessionUser {
  password: string;
}

export interface AuthFormValues {
  email?: string;
  nama?: string;
  username?: string;
  role?: string;
}

export interface AuthFormState {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  values?: AuthFormValues;
}
