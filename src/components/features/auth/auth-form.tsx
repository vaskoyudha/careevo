"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { loginAction, registerAction } from "@/actions/auth";
import type { AuthFormState } from "@/lib/auth/types";
import { cn } from "@/lib/utils";

const initialState: AuthFormState = { ok: false };

type AuthMode = "masuk" | "daftar";

const copy: Record<AuthMode, { submit: string; pending: string }> = {
  masuk: { submit: "Masuk", pending: "Memproses..." },
  daftar: { submit: "Buat akun", pending: "Mendaftar..." },
};

const inputClass =
  "w-full min-w-0 flex-1 truncate bg-transparent text-base text-black outline-none placeholder:text-transparent focus:outline-none focus-visible:outline-none";

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className={cn(
          "auth-field group relative flex h-11 items-center rounded-[8px] border border-black/20 bg-white px-4 text-base leading-none transition-colors",
        )}
      >
        <span
          className={cn(
            "auth-field-label pointer-events-none absolute text-black",
          )}
        >
          {label}
        </span>
        {children}
      </label>
      {hint && !error ? (
        <span className="mt-1.5 block text-xs text-black/40">{hint}</span>
      ) : null}
      {error ? (
        <span className="mt-1.5 block text-xs text-[#e4572e]" id={`${id}-error`} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function AuthForm({
  mode,
  defaultEmail,
  defaultPassword,
}: {
  mode: AuthMode;
  defaultEmail?: string;
  defaultPassword?: string;
}) {
  const isDaftar = mode === "daftar";
  const action = isDaftar ? registerAction : loginAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const errors = state.errors ?? {};
  const text = copy[mode];

  return (
    <form action={formAction} noValidate className="text-left">
      {state.message ? (
        <p
          className="mb-5 rounded-[8px] border border-[#e4572e]/35 bg-[#e4572e]/10 px-3 py-2 text-sm text-[#e4572e]"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <SocialButton icon={<GoogleIcon />} label="Daftar dengan Google" />
        <SocialButton icon={<AppleIcon />} label="Daftar dengan Apple" />
      </div>

      <div className="my-8 flex items-center gap-4 text-sm text-black/60">
        <div className="h-px flex-1 bg-black/15" />
        atau
        <div className="h-px flex-1 bg-black/15" />
      </div>

      <div className="space-y-5">
        {isDaftar ? (
          <>
            <Field id="nama" label="Nama" error={errors.nama}>
              <input
                id="nama"
                name="nama"
                type="text"
                autoComplete="name"
                placeholder=" "
                defaultValue={state.values?.nama}
                className={inputClass}
                aria-invalid={errors.nama ? true : undefined}
                aria-describedby={errors.nama ? "nama-error" : undefined}
              />
            </Field>
            <Field id="username" label="Username" error={errors.username}>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                placeholder=" "
                defaultValue={state.values?.username}
                className={inputClass}
                aria-invalid={errors.username ? true : undefined}
                aria-describedby={errors.username ? "username-error" : undefined}
              />
            </Field>
          </>
        ) : null}

        <Field id="email" label="Email" error={errors.email}>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder=" "
            defaultValue={state.values?.email ?? defaultEmail}
            className={inputClass}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
        </Field>

        <Field
          id="password"
          label="Password"
          hint={isDaftar ? "Minimal 8 karakter" : undefined}
          error={errors.password}
        >
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={isDaftar ? "new-password" : "current-password"}
            placeholder=" "
            defaultValue={defaultPassword}
            className={inputClass}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "password-error" : undefined}
          />
        </Field>

        {isDaftar ? (
          <div className="space-y-3 pt-6 text-xs leading-4 text-black/30 sm:text-[13px]">
            <p className="text-black/45">
              Pendaftaran publik membuat akun pencari kerja. Akun verifikator diterbitkan lewat
              undangan admin.
            </p>
            <CheckboxLine>
              <span className="text-black/55">
                Saya menyetujui pemrosesan data sesuai UU PDP (wajib).
              </span>
            </CheckboxLine>
          </div>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-9 flex h-12 w-full items-center justify-center rounded-[10px] border border-black/40 bg-black text-lg font-medium text-white transition-colors hover:bg-black/85 disabled:opacity-60"
      >
        {pending ? text.pending : text.submit}
      </button>

      <p className="mt-4 mb-0 text-center text-sm text-black/50">
        {isDaftar ? (
          <>
            Sudah punya akun?{" "}
            <Link href="/masuk" className="font-medium text-black underline underline-offset-2">
              Masuk
            </Link>
          </>
        ) : (
          <>
            Belum punya akun?{" "}
            <Link href="/daftar" className="font-medium text-black underline underline-offset-2">
              Daftar
            </Link>
          </>
        )}
      </p>
    </form>
  );
}

function SocialButton({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      disabled
      title="Belum tersedia di demo"
      className="flex h-9 items-center justify-center gap-2 rounded-[8px] border border-black/25 bg-white px-3 text-sm leading-none text-black transition-colors hover:bg-black/[0.03]"
    >
      <span className="shrink-0">{icon}</span>
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

function CheckboxLine({ children }: { children: ReactNode }) {
  return (
    <label className="flex items-start gap-3">
      <span className="relative mt-0.5 size-3 shrink-0">
        <input
          type="checkbox"
          name="consent"
          value="on"
          className="peer size-full appearance-none rounded-[2px] border border-black/25 bg-white checked:border-black checked:bg-black"
        />
        <svg
          viewBox="0 0 12 12"
          className="pointer-events-none absolute inset-0 hidden size-full p-px text-white peer-checked:block"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 6.2 5 8.1 9 3.9"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span>{children}</span>
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
        fill="#EB4335"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.54c-.03-3.02 2.47-4.47 2.58-4.54-1.41-2.06-3.6-2.34-4.38-2.37-1.86-.19-3.64 1.1-4.58 1.1-.95 0-2.42-1.07-3.98-1.04-2.05.03-3.94 1.19-4.99 3.02-2.13 3.69-.54 9.16 1.53 12.15 1.01 1.46 2.22 3.1 3.81 3.04 1.53-.06 2.11-.99 3.96-.99s2.37.99 3.99.96c1.65-.03 2.69-1.49 3.69-2.96 1.16-1.69 1.64-3.33 1.66-3.41-.04-.02-3.2-1.23-3.24-4.87ZM14.03 3.66c.84-1.02 1.41-2.43 1.25-3.84-1.21.05-2.68.81-3.55 1.83-.78.9-1.46 2.34-1.28 3.72 1.35.1 2.73-.69 3.58-1.71Z" />
    </svg>
  );
}
