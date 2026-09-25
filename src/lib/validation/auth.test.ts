import { describe, expect, it } from "vitest";
import { registerRoleSchema, registerSchema } from "./auth";

const AKUN = {
  nama: "Rina Wati",
  username: "rinawati",
  email: "rina@contoh.test",
  password: "rahasia-panjang",
  consent: true as const,
};

describe("registerRoleSchema", () => {
  // Public registration mints learners only. Staff provisioning is an
  // invitation/admin workflow; a public schema that accepts a role enum is how
  // `verifikator` became self-service in the first place.
  it("accepts only the learner role", () => {
    expect(registerRoleSchema.safeParse("user").success).toBe(true);
    expect(registerRoleSchema.safeParse("verifikator").success).toBe(false);
    expect(registerRoleSchema.safeParse("admin").success).toBe(false);
    expect(registerRoleSchema.safeParse("ADMIN").success).toBe(false);
    expect(registerRoleSchema.safeParse("").success).toBe(false);
  });

  it("has no default that could pick a role on its own", () => {
    expect(registerRoleSchema.safeParse(undefined).success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("accepts a well-formed learner registration", () => {
    const parsed = registerSchema.safeParse({ ...AKUN, role: "user" });
    expect(parsed.success).toBe(true);
  });

  it("rejects a registration that tries to become staff", () => {
    for (const role of ["verifikator", "admin", "ADMIN", "staff"]) {
      const parsed = registerSchema.safeParse({ ...AKUN, role });
      expect(parsed.success).toBe(false);
    }
  });

  it("does not silently default a missing role to a valid one", () => {
    // `registerAction` always supplies `role: "user"`, so a missing key is a bug
    // in the caller, not something the schema should paper over.
    expect(registerSchema.safeParse(AKUN).success).toBe(false);
  });
});
