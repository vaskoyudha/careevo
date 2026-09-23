import type { Role } from "./types";

export function isStaffRole(role: Role): boolean {
  return role === "verifikator" || role === "admin";
}

export function homeForRole(role: Role): string {
  return isStaffRole(role) ? "/review" : "/dashboard";
}
