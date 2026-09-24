"use client";

import type { ReactNode } from "react";
import { AuthBrandPanel } from "@/components/ui/auth-brand-panel";

/**
 * Two-column auth shell: the black brand panel on the left, the page title and
 * form on the right. Shared by /masuk and /daftar; the onboarding screen reuses
 * the same brand panel through `OnboardingShell`.
 */
export default function AuthSectionTwo({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="min-h-screen bg-white p-3 text-black antialiased [font-synthesis:none]">
      <div className="grid min-h-[calc(100vh-1.5rem)] gap-6 lg:grid-cols-[0.94fr_1.06fr]">
        <AuthBrandPanel className="order-2 min-h-[760px] lg:order-1 lg:min-h-0 lg:py-20 xl:py-24" />

        <div className="order-1 flex min-h-[760px] items-center justify-center px-6 py-12 sm:px-10 lg:order-2 lg:min-h-0 lg:px-14 xl:px-20">
          <div className="mx-auto w-full max-w-[500px] text-center">
            <h1 className="m-0 text-3xl font-medium tracking-[-0.04em] text-black sm:text-4xl lg:text-[42px] lg:leading-[1.05]">
              {title}
            </h1>
            <div className="mt-7">{children}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
