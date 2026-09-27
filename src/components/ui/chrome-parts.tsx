"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import {
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
  Sparkle,
  UserRound,
  type LucideIcon,
} from "./icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { logoutAction } from "@/actions/auth";
import type { SessionPayload } from "@/lib/auth/types";

/**
 * Navbar atoms shared by the three bars that render a signed-in learner.
 *
 * `LearnerChrome` (light glass, morphs on scroll), `AiMasteryNavbar` (dark
 * winged bar), and `Chrome` (marketing/public) are different bars, but they
 * show the same account affordances to the same signed-in learner, and the
 * account menu is a server-action logout plus four links. Duplicating either
 * would let the three drift — the failure mode this repo has already paid for
 * once, when the navbar grew a `ModeToggle` that competed with `Belajar`
 * instead of complementing it.
 *
 * `Chrome` is now the third consumer, because it used to print a hardcoded
 * `Masuk`/`Daftar` pair to people who already had a session. Before that it
 * never looked at auth at all, so "signed in" simply did not exist as an input
 * to it.
 *
 * Deliberately NOT shared with `Chrome`: the `learnerNavItems` list itself.
 * It currently holds the same five destinations as `Chrome`'s `navItems` — but
 * only by coincidence. They were once different (the learner bar carried
 * `/progres`, since moved to the dashboard sidebar; `/submission` was once
 * here too, and now lives inside each course at `/belajar/[slug]/karya`),
 * and they are free to diverge again: one list is signed-in
 * wayfinding, the other is a marketing bar deciding at render time whether the
 * visitor has a session. Two lists that look alike are not the same list — do
 * not merge them.
 */

export type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

export const learnerNavItems: NavItem[] = [
  {
    href: "/belajar",
    label: "Belajar",
    icon: <GraduationCap size={15} strokeWidth={1.5} aria-hidden="true" />,
  },
  // AI Mastery is a destination, not a utility, so it belongs in this row with a
  // visible name beside the icon like every other item. It used to be an
  // icon-only button parked in `.chrome-actions`; read next to `Cari` and the
  // avatar it looked like a control, and being `xl:block` it disappeared
  // entirely on phones — where the nav collapses to icons and it now stays
  // reachable. `MessageSquare` matches the "Belajar di AI Mastery" link in
  // `mastery-topic-view.tsx`; `Sparkle`/`Sparkles` were the alternatives and
  // both read as a near-duplicate of `Careevo Plus` a few items away.
  {
    href: "/ai-mastery",
    label: "AI Mastery",
    icon: <MessageSquare size={15} strokeWidth={1.5} aria-hidden="true" />,
  },
  {
    href: "/loker",
    label: "Loker",
    icon: <Briefcase size={15} strokeWidth={1.5} aria-hidden="true" />,
  },
  {
    href: "/careevo-plus",
    label: "Careevo Plus",
    icon: <Sparkle size={15} strokeWidth={1.5} aria-hidden="true" />,
  },
  {
    href: "/business",
    label: "Bisnis",
    icon: <Building2 size={15} strokeWidth={1.5} aria-hidden="true" />,
  },
];

/**
 * "Dashboard" action button, parked in `.chrome-actions` right beside the
 * account menu (the "profile") on the learner navbars. Renders as a styled brand
 * button using the blue-white gradient.
 */
export function DashboardButton() {
  const pathname = usePathname();
  const active =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  return (
    <Link
      href="/dashboard"
      aria-current={active ? "page" : undefined}
      className={cn(
        "chrome-btn chrome-btn-brand gap-1.5",
        active && "ring-2 ring-white/60 shadow-md"
      )}
    >
      <LayoutDashboard size={14} strokeWidth={1.75} aria-hidden="true" />
      <span>Dashboard</span>
    </Link>
  );
}

/**
 * Kartu aksi di dalam panel akun.
 *
 * Resep ini **sengaja berbeda** dari tile di `explore-menu.tsx`
 * (`rounded-lg border border-border px-3 py-2.5`,
 * `hover:border-primary hover:bg-accent`). Dulu sama persis, dan itu masih
 * tertulis sebagai "resep yang sama" di komentar versi lama. Bedanya disengaja:
 * kartu di sini polos putih tanpa garis tepi, dan hover-nya hanya mengubah
 * warna latar.
 *
 * Alasannya bukan selera saja. Panel ini sudah punya `border` dan `shadow`
 * sendiri, tiap baris sudah punya ikon plus chevron, dan penanda kelompok
 * (`DropdownMenuSeparator`) sudah membagi barisnya. Garis 1px di sekeliling
 * setiap kartu jadi border di dalam border — dan itulah yang membuat isi
 * panel terbaca sebagai tumpukan kotak, bukan sebagai satu daftar.
 *
 * Kalau suatu saat ini diseragamkan balik dengan tile Explore, pastikan itu
 * keputusan sadar: `cn` di repo ini hanya menyambung string (bukan
 * `tailwind-merge`), jadi `border` yang masih menempel dari pemanggil lain
 * akan menang atau kalah purely karena urutan emisi Tailwind, bukan urutan
 * ditulis — persis jebakan yang membuat `px-2` vs `px-3` sulit direview.
 * Dan karena itu resepnya di sini, bukan di tiap caller: `DropdownMenuItem`
 * STILL membawa `rounded-sm px-2 py-1.5`-nya sendiri, jadi pemanggil yang
 * menulis padding sendiri akan rebutan urutan emisi, bukan urutan tertulis.
 */
const KARTU_AKUN =
  "w-full cursor-pointer items-center gap-3 rounded-lg bg-white px-3 py-2.5 text-left transition-colors hover:bg-accent";

/** Avatar bundar untuk kartu menu; `size` dictated by the tile that uses it. */
function InisialAkun({
  nama,
  className,
}: {
  nama: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-[#0056D2] font-bold text-white uppercase",
        className
      )}
      aria-hidden="true"
    >
      {nama.charAt(0)}
    </span>
  );
}

/** `Role` is `user | verifikator | admin`; the badge shows it in Indonesian. */
const LABEL_PERAN: Record<SessionPayload["role"], string> = {
  user: "Peserta",
  verifikator: "Verifikator",
  admin: "Admin",
};

/**
 * Tiga tujuan yang selalu ada, dalam urutan yang sering dipakai: lihat
 * progres dulu, lalu ubah data, lalu ubah setelan. Dinyusun sebagai data
 * supaya kartu dan ikon-ikonnya tidak ditulis ulang tiga kali — setiap
 * penambahan item cukup satu baris, bukan satu blok JSX.
 */
const TUJUAN_AKUN: { href: string; label: string; Ikon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", Ikon: LayoutDashboard },
  { href: "/profil", label: "Profil", Ikon: UserRound },
  { href: "/pengaturan", label: "Pengaturan", Ikon: Settings },
];

/**
 * Dokumen legal — **terpisah** dari `TUJUAN_AKUN`, bukan digabung ke sana.
 *
 * Tiga tujuan di atas adalah navigasi: ke tempat kamu melakukan sesuatu.
 * Dua di bawah adalah dokumen yang kamu baca. Memcampurkannya dalam satu
 * grid akan menandai privat sebagai "tujuan akun", dan panel akan tumbuh
 * jadi lima kartu identik yang semua binnen sama prioritasnya.
 *
 * Karena itu baris ini dipisah oleh separator yang sama dengan yang memisahkan
 * "Keluar": kelompok baru, bobot baru. `Settings` sudah punya ikon
 * `Settings`; di sini ikonnya `FileText` supaya dua baris dokumen
 * terbaca sebagai pasangan, bukan sebagai pengaturan keempat.
 *
 * `legal-documen.tsx` yang dirender halaman-halaman ini berbahasa Indonesia
 * dan tidak butuh sesi, jadi keduanya tetap terbuka untuk tamu yang belum
 * masuk — persis seperti yang diklaim FAQ.
 */
const DOKUMEN_HUKUM: { href: string; label: string; Ikon: LucideIcon }[] = [
  { href: "/privasi", label: "Kebijakan Privasi", Ikon: FileText },
  { href: "/syarat", label: "Syarat & Ketentuan", Ikon: FileText },
];

/**
 * Jeda sebelum panel menutup sendiri, dalam ms.
 *
 * `DropdownMenuContent` dirender ke dalam `Portal`, jadi saat kursor berjalan
 * dari trigger ke panel ia sempat melewati celah `sideOffset` (8px) — tanpa
 * jeda, panel akan menutup tepat di tengah perjalanan itu dan kursor mendarat
 * di atas ruang kosong. Jeda ini menutup celah itu; penutupannya tetap
 * responsibility `onPointerLeave`, bukan timer yang membuka.
 */
const TUNDA_TUTUP_MS = 140;

export function AccountMenu({ session }: { session: SessionPayload }) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const batalkanTutup = () => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const jadwalkanTutup = () => {
    batalkanTutup();
    closeTimer.current = setTimeout(() => setOpen(false), TUNDA_TUTUP_MS);
  };

  const bukaLewatHover = (event: ReactPointerEvent<HTMLElement>) => {
    // `pointerType` guard: a tap on a touch screen also emits `pointerenter`,
    // and a panel must not spring open under a finger that was only aiming
    // somewhere else. The click path below still works there.
    if (event.pointerType !== "mouse") return;
    batalkanTutup();
    setOpen(true);
  };

  // A timer that survives unmount fires `setOpen` on a dead component.
  useEffect(() => () => batalkanTutup(), []);

  // Record which input modality is actually driving things, because
  // `:focus-visible` cannot answer it here: Radix restores focus to the
  // trigger when the menu closes, and that programmatic focus reports
  // `focus-visible: true` even when a mouse hover was the only thing that
  // ever happened. A `:focus-visible`-only indicator would therefore light
  // up on every mouse hover — the exact highlight this trigger must not
  // draw — while keyboard focus still needs one. Writing the attribute
  // imperatively keeps this off the render path.
  useEffect(() => {
    const el = triggerRef.current;
    if (!el) return;
    const catat = (sumber: "keyboard" | "pointer") => {
      if (el.dataset.input !== sumber) el.dataset.input = sumber;
    };
    const padaKeyDown = () => catat("keyboard");
    // `pointerover` bubbles, so the document hears it; `pointerenter` does
    // not, and a bare `mousemove` would rewrite the attribute on every frame.
    const padaPointerOver = () => catat("pointer");
    document.addEventListener("keydown", padaKeyDown, true);
    document.addEventListener("pointerover", padaPointerOver, true);
    return () => {
      document.removeEventListener("keydown", padaKeyDown, true);
      document.removeEventListener("pointerover", padaPointerOver, true);
    };
  }, []);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          ref={triggerRef}
          aria-label="Buka menu akun"
          onPointerEnter={bukaLewatHover}
          onPointerLeave={jadwalkanTutup}
          // Hover tidak lagi menyorot trigger sama sekali — baik pil
          // `hover:bg-white/85` yang lama maupun outline biru 2px dari
          // global `:focus-visible`. Outline yang itu tidak bisa dimatikan dari
          // sini: aturannya unlayered di globals.css, jadi selalu mengalahkan
          // utility Tailwind apa pun di `@layer utilities` — utility
          // `focus-visible:outline-none` yang pernah ada di sini tidak pernah
          // aktif. Sekarang dimatikan lewat `.account-menu-trigger` di
          // globals.css. Fokus keyboard tetap terlihat sebagai isian lembut,
          // hanya saat `data-input="keyboard"` — bukan `:focus-visible`, yang
          // ikut true saat Radix mengembalikan fokus setelah hover-tutup dan
          // akan memunculkan sorotan itu persis di jalur yang harus bersih.
          className="account-menu-trigger group flex cursor-pointer items-center gap-1 rounded-full p-1 select-none data-[input=keyboard]:bg-white/70"
        >
          <InisialAkun nama={session.nama} className="size-8 text-xs" />
          <ChevronDown
            className="h-3.5 w-3.5 shrink-0 text-black/60 transition-transform duration-200 group-data-[state=open]:rotate-180"
            strokeWidth={2}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        surface="panel"
        onPointerEnter={bukaLewatHover}
        onPointerLeave={jadwalkanTutup}
        className="w-80 max-w-[calc(100vw-1rem)] rounded-2xl border border-border bg-card p-0 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2),0_10px_20px_-5px_rgba(0,0,0,0.08)]"
      >
        {/* Identitas di atas, dipisah garis — jadi kartu pertama di
            bawahnya tidak pernah Sharing header dengan kartu aksi. */}
        <DropdownMenuLabel
          surface="band"
          className="flex items-center gap-3 border-b border-border px-4 py-3.5"
        >
          <InisialAkun nama={session.nama} className="size-10 text-sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-foreground">
              {session.nama}
            </span>
            <span className="mt-0.5 block truncate text-[12px] font-normal text-muted-foreground">
              {session.email}
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-[#0056D2]/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-[#0056D2] uppercase">
            {LABEL_PERAN[session.role]}
          </span>
        </DropdownMenuLabel>

        <div className="grid gap-2 p-3">
          {TUJUAN_AKUN.map(({ href, label, Ikon }) => (
            <DropdownMenuItem key={href} asChild surface="card">
              <Link href={href} className={KARTU_AKUN}>
                <Ikon
                  size={16}
                  strokeWidth={1.5}
                  className="size-4 shrink-0 text-ocean-deep"
                  aria-hidden="true"
                />
                <span className="truncate text-[13px]">{label}</span>
                <ChevronRight
                  size={14}
                  strokeWidth={1.5}
                  className="ml-auto size-3.5 shrink-0 text-text-tertiary"
                  aria-hidden="true"
                />
              </Link>
            </DropdownMenuItem>
          ))}
        </div>

        <DropdownMenuSeparator className="mx-0" />

        {/* Dokumen legal, kelompok sendiri di bawah tiga tujuan navigasi. */}
        <div className="grid gap-2 p-3 pt-2">
          {DOKUMEN_HUKUM.map(({ href, label, Ikon }) => (
            <DropdownMenuItem key={href} asChild surface="card">
              <Link href={href} className={KARTU_AKUN}>
                <Ikon
                  size={16}
                  strokeWidth={1.5}
                  className="size-4 shrink-0 text-ocean-deep"
                  aria-hidden="true"
                />
                <span className="truncate text-[13px]">{label}</span>
                <ChevronRight
                  size={14}
                  strokeWidth={1.5}
                  className="ml-auto size-3.5 shrink-0 text-text-tertiary"
                  aria-hidden="true"
                />
              </Link>
            </DropdownMenuItem>
          ))}
        </div>

        <DropdownMenuSeparator className="mx-0" />

        {/* Keluar sendirian di kaki panel: hanya satu aksi yang membatalkan
            sesi, jadi ia tidak boleh berbagi grid dengan tiga tujuan
            navigasi — dan `variant="destructive"` tetap berlaku walau
            permukaannya kartu. */}
        <div className="p-3 pt-2">
          <DropdownMenuItem
            surface="card"
            variant="destructive"
            disabled={isPending}
            onSelect={() => {
              startTransition(() => {
                void logoutAction();
              });
            }}
            className={cn(
              KARTU_AKUN,
              // Only the background moves: `hover:border-destructive/40` is gone
              // with the card border, and a coloured border rule with no border
              // to colour is a rule that silently does nothing.
              "hover:bg-destructive/5"
            )}
          >
            <LogOut
              size={16}
              strokeWidth={1.5}
              className="size-4 shrink-0"
              aria-hidden="true"
            />
            <span className="truncate text-[13px]">
              {isPending ? "Keluar…" : "Keluar"}
            </span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
