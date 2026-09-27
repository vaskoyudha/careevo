"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import { LogOut, X } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import type { SessionPayload } from "@/lib/auth/types";

export type MobileNavItem = {
  href: string;
  label: string;
  icon?: ReactNode;
};

export function MobileNavDrawer({
  open,
  onClose,
  triggerRef,
  items,
  session,
  title = "Navigasi utama",
  id = "mobile-navigation-drawer",
}: {
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  items: MobileNavItem[];
  session?: SessionPayload | null;
  title?: string;
  id?: string;
}) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = panelRef.current?.querySelector<HTMLElement>(
      "a[href], button:not([disabled])",
    );
    focusable?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = panelRef.current?.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled])",
      );
      if (!elements?.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      triggerRef.current?.focus();
    };
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  return createPortal(
    <>
      <button
        type="button"
        className="mobile-nav-scrim"
        aria-label="Tutup menu navigasi"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="mobile-nav-drawer"
      >
        <div className="mobile-nav-drawer-head">
          {/* The brand, not the string "Navigasi Careevo". The aside already
              carries `aria-label={title}`, so the accessible name survives;
              this is the visual mark only. The logo is the same asset the
              navbar uses, so the drawer and the bar it came from agree. */}
          <Image
            src="/careevo-logo.png"
            alt=""
            width={250}
            height={64}
            aria-hidden="true"
            className="h-8 w-auto object-contain"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup menu navigasi"
            className="mobile-nav-close"
          >
            <X size={20} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
        <nav aria-label={title} className="mobile-nav-links">
          {items.map((item) => (
            <Link key={item.href} href={item.href} onClick={onClose}>
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="mobile-nav-account">
          {session ? (
            <>
              <Link href="/dashboard" onClick={onClose}>Dashboard</Link>
              <Link href="/profil" onClick={onClose}>Profil</Link>
              <Link href="/pengaturan" onClick={onClose}>Pengaturan</Link>
              <form action={logoutAction}>
                <button type="submit" onClick={onClose}>
                  <LogOut size={17} strokeWidth={1.7} aria-hidden="true" />
                  Keluar
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/masuk" onClick={onClose}>Masuk</Link>
              <Link href="/daftar" onClick={onClose}>Daftar</Link>
            </>
          )}
        </div>
      </aside>
    </>,
    document.body,
  );
}
