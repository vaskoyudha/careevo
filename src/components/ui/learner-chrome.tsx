"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "./icons";
import { ExploreMenu } from "./explore-menu";
import { AiMasteryLink } from "./ai-mastery-link";
import { AccountMenu, learnerNavItems } from "./chrome-parts";
import type { SessionPayload } from "@/lib/auth/types";

export function LearnerChrome({
  session,
  queryAwal = "",
}: {
  session: SessionPayload;
  queryAwal?: string;
}) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <a href="#main" className="skip-link">
        Lewati ke konten utama
      </a>
      <div className={`chrome relative ${scrolled ? "is-scrolled" : "is-top"}`}>
        <Link className="chrome-brand" href="/" aria-label="Careevo">
          <Image
            src="/careevo-logo.png"
            alt="Careevo"
            width={250}
            height={64}
            priority
            className="h-12 w-auto object-contain transition-transform duration-300 hover:scale-105"
          />
        </Link>
        <nav className="nav-float" aria-label="Navigasi utama">
          <ExploreMenu />
          {learnerNavItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "nav-item is-active" : "nav-item"}
                aria-current={active ? "page" : undefined}
              >
                {item.icon}
                <span className="max-lg:sr-only">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="chrome-actions">
          <form
            role="search"
            action="/belajar"
            method="get"
            className="learner-search hidden min-w-0 flex-1 items-center md:flex"
          >
            <label htmlFor="learner-search" className="sr-only">
              Cari kursus
            </label>
            <div className="flex h-10 w-full max-w-xs items-center gap-2 rounded-full border border-black/15 bg-white/80 pr-1 pl-3.5 focus-within:border-[#0056D2]">
              <Search className="h-4 w-4 shrink-0 text-black/50" aria-hidden="true" />
              <input
                id="learner-search"
                name="q"
                type="search"
                autoComplete="off"
                defaultValue={queryAwal}
                key={queryAwal}
                placeholder="Mau belajar apa?"
                className="w-full bg-transparent text-[13.5px] text-black outline-none placeholder:text-black/45"
              />
              <button
                type="submit"
                className="brand-fill shrink-0 cursor-pointer rounded-full px-3.5 py-1.5 text-[13px] font-semibold"
              >
                Cari
              </button>
            </div>
          </form>
          <AiMasteryLink />
          <AccountMenu session={session} />
        </div>
      </div>
    </>
  );
}
