"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ResourceFixture, TaskFixture } from "@/lib/fixtures";

const GRADIENTS = [
  "from-blue-600 via-blue-500 to-sky-400",
  "from-indigo-600 via-violet-500 to-fuchsia-400",
  "from-emerald-600 via-teal-500 to-cyan-400",
  "from-amber-500 via-orange-500 to-rose-400",
  "from-slate-700 via-slate-600 to-slate-400",
  "from-cyan-600 via-sky-500 to-blue-400",
];

function gradientFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

function levelLabel(level: string) {
  if (level === "dasar") return "Pemula";
  if (level === "menengah") return "Menengah";
  return "Lanjutan";
}

export interface KursusTerdaftar {
  id: string;
  slug: string;
  title: string;
  provider: string;
  progres: number;
  selesai: number;
  total: number;
}

type EntriSumber = ResourceFixture & { slug?: string };

function CourseCard({ resource }: { resource: EntriSumber }) {
  const href = `/belajar/${resource.slug ?? resource.id}`;
  return (
    <article className="w-64 shrink-0 overflow-hidden rounded-xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.08)] ring-1 ring-black/5 lg:w-72">
      <Link href={href} aria-label={`Lihat detail ${resource.title}`} className="block">
        <span className={cn("relative block h-36 bg-gradient-to-br", gradientFor(resource.id))}>
          <span
            aria-hidden="true"
            className="absolute right-3 bottom-2 text-3xl font-bold text-white/90"
          >
            {resource.provider.charAt(0)}
          </span>
          <span className="absolute top-3 left-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
            {resource.type}
          </span>
        </span>
      </Link>
      <div className="p-4">
        <p className="mb-1 flex items-center gap-2 text-xs text-gray-500">
          <span
            aria-hidden="true"
            className="inline-flex size-5 items-center justify-center rounded-sm bg-blue-700 text-[10px] font-bold text-white"
          >
            {resource.provider.charAt(0)}
          </span>
          <span className="truncate">{resource.provider}</span>
        </p>
        <h3 className="mb-1 line-clamp-2 min-h-10 text-sm font-semibold text-gray-900">
          <Link href={href} className="hover:underline">
            {resource.title}
          </Link>
        </h3>
        <p className="mb-2 text-xs text-gray-500">
          {levelLabel(resource.level)} · {resource.duration_min} mnt
        </p>
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
            {resource.tags[0] ?? "Umum"}
          </span>
          <span className="inline-flex rounded-full border border-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-600">
            {resource.is_free ? "Gratis" : "Berbayar"}
          </span>
          {resource.completed ? (
            <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              Selesai
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function CarouselRow({ children, label }: { children: React.ReactNode; label: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const scroll = (dir: -1 | 1) =>
    scroller.current?.scrollBy({ left: dir * 300, behavior: "smooth" });
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`${label} sebelumnya`}
        onClick={() => scroll(-1)}
        className="absolute -left-3 top-24 z-10 flex size-9 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50"
      >
        ‹
      </button>
      <button
        type="button"
        aria-label={`${label} berikutnya`}
        onClick={() => scroll(1)}
        className="absolute -right-3 top-24 z-10 flex size-9 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50"
      >
        ›
      </button>
      <div
        ref={scroller}
        className="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </div>
  );
}

const HERO_SLIDES = [
  {
    eyebrow: "Careevo Plus",
    title: "Hemat 40% untuk 3 bulan Careevo Plus",
    body: "Fleksibel untuk pelajar sibuk. Mulai dengan harga khusus bulan ini.",
    cta: "Lihat penawaran",
    href: "/careevo-plus",
  },
  {
    eyebrow: "Belajar AI praktis",
    title: "AI dari konsep sampai studi kasus",
    body: "Alur, penilaian, dan tools yang dipakai tim produk modern.",
    cta: "Jelajahi kursus AI",
    href: "#katalog",
  },
  {
    eyebrow: "Untuk tim",
    title: "Tutup gap skill tim lebih cepat",
    body: "Pelatihan terstruktur dengan progres yang bisa dipantau.",
    cta: "Lihat paket tim",
    href: "/careevo-plus#paket",
  },
];

function Hero({ query, onQuery }: { query: string; onQuery: (v: string) => void }) {
  const [slide, setSlide] = useState(0);
  return (
    <section className="bg-[#f5f7fa]">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-14">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 lg:text-4xl">
            Belajar tanpa batas
          </h1>
          <p className="mt-3 max-w-md text-base leading-relaxed text-gray-600">
            Resource terkurasi, challenge praktik, dan verifikasi karya — satu
            alur dari belajar sampai siap kerja.
          </p>
          <form
            role="search"
            className="mt-5 flex max-w-md items-center gap-2 rounded-full border border-gray-400 bg-white p-1.5 pl-4 focus-within:border-[#0056D2]"
            onSubmit={(e) => {
              e.preventDefault();
              document.getElementById("katalog")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <span aria-hidden="true" className="text-gray-400">
              ⌕
            </span>
            <input
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Cari: HTML, React, interview…"
              aria-label="Cari resource belajar"
              className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
            />
            <a
              href="#katalog"
              className="shrink-0 rounded-full bg-[#0056D2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00419e]"
            >
              Cari
            </a>
          </form>
          <p className="mt-3 text-xs text-gray-500">
            Populer: HTML · React · TypeScript · Testing
          </p>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-800 via-blue-600 to-sky-400 p-6 text-white lg:p-8">
          <p className="text-xs font-semibold tracking-widest text-white/80 uppercase">
            {HERO_SLIDES[slide].eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white lg:text-3xl">
            {HERO_SLIDES[slide].title}
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/85">
            {HERO_SLIDES[slide].body}
          </p>
          <Link
            href={HERO_SLIDES[slide].href}
            className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            {HERO_SLIDES[slide].cta}
          </Link>
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              aria-label="Slide sebelumnya"
              onClick={() => setSlide((s) => (s + HERO_SLIDES.length - 1) % HERO_SLIDES.length)}
              className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-white/40 hover:bg-white/10"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Slide berikutnya"
              onClick={() => setSlide((s) => (s + 1) % HERO_SLIDES.length)}
              className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-white/40 hover:bg-white/10"
            >
              ›
            </button>
            <div className="flex gap-1.5">
              {HERO_SLIDES.map((s, i) => (
                <button
                  key={s.title}
                  type="button"
                  aria-label={`Ke slide ${i + 1}`}
                  aria-current={i === slide}
                  onClick={() => setSlide(i)}
                  className={cn(
                    "h-1.5 cursor-pointer rounded-full transition-all",
                    i === slide ? "w-6 bg-white" : "w-1.5 bg-white/50",
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const POPULAR_TABS = [
  { label: "Paling populer", filter: (r: ResourceFixture) => r.completed },
  { label: "Rilis baru", filter: (r: ResourceFixture) => !r.completed },
  {
    label: "Kursus AI & data",
    filter: (r: ResourceFixture) =>
      r.tags.some((t) => /algoritma|interview|api|testing/i.test(t)),
  },
] as const;

const ROLE_TABS = ["AI Engineer", "Software Developer", "Data Analyst", "QA Engineer"] as const;

const TRENDING = ["HTML", "React", "TypeScript", "Testing", "Node.js", "Git", "Aksesibilitas"];

const GOALS = [
  "Mulai karier saya",
  "Pindah karier",
  "Tumbuh di peran saat ini",
  "Eksplor topik di luar kerja",
] as const;

const TESTIMONIALS = [
  {
    name: "Sari P.",
    text: "Struktur belajarnya jelas — resource, challenge, lalu review. Saya bisa belajar sambil kerja tanpa ketinggalan progres.",
  },
  {
    name: "Dimas A.",
    text: "Challenge praktiknya yang paling membantu. Bukan cuma nonton, tapi langsung membangun dan dapat umpan balik.",
  },
  {
    name: "Rina K.",
    text: "Verifikasi karya membuat portofolio saya lebih dipercaya saat melamar. Prosesnya transparan dari awal.",
  },
  {
    name: "Bagus T.",
    text: "Filter levelnya pas — mulai dari dasar sampai lanjut tanpa bingung mau lanjut ke mana.",
  },
];

const FAQS = [
  {
    q: "Apakah materi di Careevo diakui pemberi kerja?",
    a: "Careevo menggabungkan resource dari penyedia tepercaya dengan challenge praktik dan verifikasi karya. Setiap karya yang lolos review tercatat dengan atestasi sehingga bisa diverifikasi lewat halaman publik dan profil.",
  },
  {
    q: "Apakah sertifikat Careevo bermanfaat?",
    a: "Berguna sebagai bukti skill yang bisa diverifikasi — bukan sekadar klaim. Lengkapi dengan tautan demo dan skor challenge agar pemberi kerja bisa menilai langsung kualitas karyamu.",
  },
  {
    q: "Apa itu Careevo Plus?",
    a: "Paket berlangganan untuk membuka seluruh jalur belajar, challenge premium, dan prioritas review dalam satu harga. Lihat halaman Careevo Plus untuk detail paket dan harga.",
  },
  {
    q: "Apakah ada materi gratis?",
    a: "Ya. Sebagian besar resource bertanda Gratis bisa diakses tanpa membayar. Gunakan filter Gratis saja di katalog untuk melihat semuanya.",
  },
  {
    q: "Bagaimana cara mulai dari nol?",
    a: "Pilih level Pemula di katalog, selesaikan 2–3 resource dasar, lalu kerjakan challenge pertama. Progres modul tercatat otomatis setiap resource selesai.",
  },
  {
    q: "Bagaimana Careevo membantu karier saya?",
    a: "Alurnya: belajar terukur → challenge praktik → review verifikator → karya terverifikasi di profil publik. Karya yang terverifikasi bisa dibagikan ke perekrut lewat halaman loker.",
  },
  {
    q: "Bagaimana cara mendaftar kursus dan melacak progres?",
    a: "Buka halaman detail kursus lalu tekan Daftar gratis. Setiap kursus dibagi menjadi 5 modul — tandai modul yang selesai dan progresmu tersimpan otomatis, lalu lanjutkan ke challenge praktik terkait.",
  },
];

export function BelajarHome({
  resources,
  tasks,
  terdaftar = [],
  queryAwal = "",
}: {
  resources: EntriSumber[];
  tasks: TaskFixture[];
  terdaftar?: KursusTerdaftar[];
  queryAwal?: string;
}) {
  const [query, setQuery] = useState(queryAwal);
  const [popularTab, setPopularTab] = useState(0);
  const [role, setRole] = useState<(typeof ROLE_TABS)[number]>("Software Developer");
  const [goal, setGoal] = useState<(typeof GOALS)[number]>(GOALS[0]);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [story, setStory] = useState(0);

  const nextTask = tasks.find((t) => t.status === "available" || t.status === "review");
  const completedCount = resources.filter((r) => r.completed).length;

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return resources;
    return resources.filter((r) =>
      [r.title, r.provider, ...r.tags].join(" ").toLowerCase().includes(q),
    );
  }, [resources, query]);

  const popular = useMemo(
    () => resources.filter(POPULAR_TABS[popularTab].filter),
    [resources, popularTab],
  );
  const popularList = (popular.length > 0 ? popular : resources).slice(0, 8);

  const roleList = useMemo(() => {
    const keyword: Record<string, RegExp> = {
      "AI Engineer": /algoritma|interview|api/i,
      "Software Developer": /html|css|react|javascript|typescript|node/i,
      "Data Analyst": /data|performance|struktur/i,
      "QA Engineer": /testing|vitest|playwright|aksesibilitas/i,
    };
    const rx = keyword[role];
    const hit = resources.filter((r) =>
      [r.title, ...r.tags].join(" ").match(rx),
    );
    return (hit.length > 0 ? hit : resources).slice(0, 6);
  }, [resources, role]);

  const providers = useMemo(
    () => Array.from(new Set(resources.map((r) => r.provider))).slice(0, 10),
    [resources],
  );

  const topik = useMemo(() => {
    const hitung = new Map<string, number>();
    for (const resource of resources) {
      for (const tag of resource.tags) {
        hitung.set(tag, (hitung.get(tag) ?? 0) + 1);
      }
    }
    return [...hitung.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 12);
  }, [resources]);

  return (
    <div className="min-w-0 overflow-x-clip bg-white">
      {nextTask ? (
        <section aria-labelledby="lanjut-belajar" className="bg-[#e8effd]">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6 lg:px-8">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold tracking-wider text-[#0056D2] uppercase">
                Lanjutkan belajar
              </p>
              <p id="lanjut-belajar" className="mt-1 text-base font-semibold text-gray-900">
                {nextTask.title}
              </p>
              <p className="max-w-xl text-sm text-gray-600">{nextTask.brief}</p>
            </div>
            <Link
              href={`/challenge/${nextTask.id}`}
              className="shrink-0 rounded-full bg-[#0056D2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00419e]"
            >
              Buka challenge
            </Link>
          </div>
        </section>
      ) : null}

      <Hero query={query} onQuery={setQuery} />

      {terdaftar.length > 0 ? (
        <section aria-labelledby="pembelajaran-saya" className="bg-white">
          <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <h2 id="pembelajaran-saya" className="mb-1 text-xl font-bold tracking-tight text-gray-900">
              Pembelajaran saya
            </h2>
            <p className="mb-4 text-sm text-gray-600">
              Lanjutkan kursus yang sudah kamu mulai.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
            {terdaftar.map((kursus) => (
              <Link
                key={kursus.id}
                href={`/belajar/${kursus.slug}`}
                className="rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-blue-300 hover:bg-blue-50/40"
              >
                <p className="text-xs text-gray-500">{kursus.provider}</p>
                <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold text-gray-900">
                  {kursus.title}
                </h3>
                <div
                  role="progressbar"
                  aria-label={`Progres ${kursus.title} ${kursus.progres} persen`}
                  aria-valuenow={kursus.progres}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200"
                >
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{ width: `${kursus.progres}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-gray-500">
                  {kursus.progres}% · {kursus.selesai} dari {kursus.total} modul
                  {kursus.progres === 100 ? " · selesai 🎉" : " · lanjutkan →"}
                </p>
              </Link>
            ))}
            </div>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="baru-populer" className="bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="baru-populer" className="text-xl font-bold tracking-tight text-gray-900">
                Baru dan populer
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Pilihan teratas minggu ini dari katalog Careevo.
              </p>
            </div>
            <div className="flex gap-2" aria-label="Filter populer">
              {POPULAR_TABS.map((t, i) => (
                <button
                  key={t.label}
                  aria-pressed={popularTab === i}
                  onClick={() => setPopularTab(i)}
                  className={cn(
                    "cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                    popularTab === i
                      ? "border-[#0056D2] bg-[#0056D2] text-white"
                      : "border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <CarouselRow label="Katalog populer">
            {popularList.map((r) => (
              <CourseCard key={r.id} resource={r} />
            ))}
          </CarouselRow>
        </div>
      </section>

      <section aria-labelledby="ai-untuk-kerja" className="bg-[#f5f7fa]">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <h2 id="ai-untuk-kerja" className="max-w-2xl text-xl font-bold tracking-tight text-gray-900 lg:text-2xl">
            AI untuk pekerjaanmu — dan karier yang kamu mau
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-gray-600">
            Pilih bidangmu. Pelajari alur kerja, penilaian, dan tools yang
            mengubah bidang itu.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {ROLE_TABS.map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                aria-pressed={role === r}
                className={cn(
                  "cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                  role === r
                    ? "border-[#0056D2] bg-[#0056D2] text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50",
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="mt-6 flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {roleList.map((r) => (
              <CourseCard key={r.id} resource={r} />
            ))}
          </div>
        </div>
      </section>

      <section aria-label="Promo" className="bg-white">
        <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-10 sm:px-6 md:grid-cols-2 lg:px-8">
          <div className="rounded-2xl bg-gradient-to-br from-blue-800 to-blue-500 p-6 text-white">
            <p className="text-xs font-semibold tracking-widest text-white/80 uppercase">Careevo Plus</p>
            <h3 className="mt-1 text-xl font-bold text-white">Hancurkan hambatan belajar dengan harga hemat</h3>
            <Link
              href="/careevo-plus"
              className="mt-3 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              Dapatkan Careevo Plus
            </Link>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-500 p-6 text-white">
            <p className="text-xs font-semibold tracking-widest text-white/80 uppercase">Careevo untuk Tim</p>
            <h3 className="mt-1 text-xl font-bold text-white">Mulai dengan penghematan untuk tim yang bekerja keras</h3>
            <Link
              href="/careevo-plus#paket"
              className="mt-3 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              Lihat paket tim
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="mitra" className="border-y border-gray-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <h2 id="mitra" className="mb-4 text-xl font-bold tracking-tight text-gray-900">
            Belajar dari penerbit dan komunitas terkemuka
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {providers.map((p) => (
              <span
                key={p}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700"
              >
                <span
                  aria-hidden="true"
                  className="inline-flex size-5 items-center justify-center rounded-sm bg-gray-900 text-[10px] font-bold text-white"
                >
                  {p.charAt(0)}
                </span>
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section aria-label="Jalur" className="bg-white">
        <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-8">
          {[
            {
              title: "Luncurkan karier baru",
              body: "Mulai dari nol dengan jalur pemula dan challenge terstruktur.",
              href: "#katalog",
              cta: "Mulai jalur",
            },
            {
              title: "Coba Careevo untuk tim",
              body: "Pantau progres belajar seluruh anggota dalam satu tempat.",
              href: "/careevo-plus#paket",
              cta: "Untuk tim",
            },
            {
              title: "Raih pengakuan skill",
              body: "Kumpulkan karya terverifikasi yang bisa dibagikan ke perekrut.",
              href: "/dashboard",
              cta: "Lihat progres",
            },
          ].map((b) => (
            <div key={b.title} className="rounded-2xl border border-gray-200 bg-white p-6">
              <h3 className="text-lg font-bold text-gray-900">{b.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">{b.body}</p>
              <Link href={b.href} className="mt-3 inline-flex text-sm font-semibold text-[#0056D2] hover:underline">
                {b.cta} →
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="kategori" className="bg-[#f5f7fa]">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <h2 id="kategori" className="mb-1 text-xl font-bold tracking-tight text-gray-900">
            Jelajahi topik
          </h2>
          <p className="mb-4 text-sm text-gray-600">
            Topik paling banyak dicari, dihitung dari katalog saat ini.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {topik.map(([nama, jumlah]) => (
              <button
                key={nama}
                type="button"
                onClick={() => {
                  setQuery(nama);
                  document.getElementById("katalog")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="cursor-pointer rounded-xl border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:border-[#0056D2] hover:bg-blue-50/50"
              >
                <span className="block text-sm font-medium text-gray-800">{nama}</span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  {jumlah} kursus
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="tren" className="bg-[#f5f7fa]">
        <div className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
          <h2 id="tren" className="mb-3 text-xl font-bold tracking-tight text-gray-900">
            Pencarian populer
          </h2>
          <div className="flex flex-wrap gap-2">
            {TRENDING.map((t) => (
              <button
                key={t}
                onClick={() => setQuery(t)}
                aria-pressed={query === t}
                className={cn(
                  "cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                  query === t
                    ? "border-[#0056D2] bg-[#0056D2] text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="tujuan" className="bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <h2 id="tujuan" className="text-xl font-bold tracking-tight text-gray-900">
            Apa yang membawamu ke Careevo hari ini?
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {GOALS.map((g) => (
              <button
                key={g}
                onClick={() => setGoal(g)}
                aria-pressed={goal === g}
                className={cn(
                  "cursor-pointer rounded-2xl border p-4 text-left text-sm font-medium transition-colors",
                  goal === g
                    ? "border-[#0056D2] bg-blue-50/60 text-gray-900 shadow-sm"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50",
                )}
              >
                {g}
              </button>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-gray-200 bg-[#f5f7fa] p-6 lg:p-8">
            <h3 className="text-xl font-bold text-gray-900">
              Siap kerja untuk karier yang banyak dicari
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              {goal}: tanpa pengalaman pun bisa mulai dari level pemula.
            </p>
            <div className="mt-4 flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {resources.slice(0, 6).map((r) => (
                <CourseCard key={r.id} resource={r} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Hasil belajar" className="bg-white">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-6 px-4 pb-10 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div>
          <p className="text-4xl font-semibold text-gray-900">
            {completedCount}/{resources.length}
          </p>
          <h2 className="mt-1 text-2xl font-medium tracking-tight text-gray-900">
            progres modulmu sudah berjalan
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-600">
            Peserta yang konsisten menyelesaikan resource dan challenge
            melaporkan peluang kerja baru, pengetahuan bertambah, dan performa
            kerja yang meningkat.
          </p>
        </div>
        <div className="h-40 rounded-2xl bg-gradient-to-br from-blue-100 via-indigo-100 to-emerald-100 p-5">
          <div className="h-full w-full rounded-xl bg-white/70 p-4">
            <p className="text-xs font-semibold text-gray-500">Progres</p>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-200">
              <div
                role="progressbar"
                aria-label={`Progres modul ${Math.round((completedCount / Math.max(resources.length, 1)) * 100)} persen`}
                aria-valuenow={Math.round((completedCount / Math.max(resources.length, 1)) * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${Math.round((completedCount / Math.max(resources.length, 1)) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {Math.round((completedCount / Math.max(resources.length, 1)) * 100)}% resource selesai
            </p>
          </div>
        </div>
        </div>
      </section>

      <section aria-labelledby="cerita" className="bg-[#f5f7fa]">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <h2 id="cerita" className="mb-4 text-xl font-bold tracking-tight text-gray-900">
            Kenapa peserta memilih Careevo
          </h2>
          <div className="relative rounded-2xl border border-gray-200 bg-white p-6 lg:p-8">
            <blockquote key={story}>
              <p className="max-w-3xl text-lg leading-relaxed text-gray-800">
                “{TESTIMONIALS[story].text}”
              </p>
              <footer className="mt-3 text-sm font-semibold text-gray-900">
                {TESTIMONIALS[story].name}
              </footer>
            </blockquote>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                aria-label="Cerita sebelumnya"
                onClick={() => setStory((s) => (s + TESTIMONIALS.length - 1) % TESTIMONIALS.length)}
                className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-gray-200 hover:bg-gray-50"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Cerita berikutnya"
                onClick={() => setStory((s) => (s + 1) % TESTIMONIALS.length)}
                className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-gray-200 hover:bg-gray-50"
              >
                ›
              </button>
              {TESTIMONIALS.map((t, i) => (
                <button
                  key={t.name}
                  type="button"
                  aria-label={`Ke cerita ${i + 1}`}
                  aria-current={i === story}
                  onClick={() => setStory(i)}
                  className={cn(
                    "h-1.5 cursor-pointer rounded-full transition-all",
                    i === story ? "w-6 bg-[#0056D2]" : "w-1.5 bg-gray-300",
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="katalog" aria-labelledby="katalog-title" className="scroll-mt-20 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <h2 id="katalog-title" className="mb-1 text-xl font-bold tracking-tight text-gray-900">
            Katalog resource
          </h2>
          <p className="mb-4 text-sm text-gray-600">
            {searched.length} dari {resources.length} resource
            {query.trim() ? ` untuk “${query.trim()}”` : ""} · {completedCount} selesai
          </p>
          <div className="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {searched.map((r) => (
              <CourseCard key={r.id} resource={r} />
            ))}
          </div>
          {searched.length === 0 ? (
            <div className="mt-2 rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center">
              <p className="text-sm text-gray-600">
                Tidak ada hasil untuk “{query.trim()}”.
              </p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-2 cursor-pointer rounded-full bg-[#0056D2] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#00419e]"
              >
                Tampilkan semua
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="faq" className="bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
          <h2 id="faq" className="mb-4 text-xl font-bold tracking-tight text-gray-900">
            Pertanyaan umum
          </h2>
          <div className="divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white">
            {FAQS.map((f, i) => {
              const open = openFaq === i;
              const panelId = `faq-panel-${i}`;
              return (
                <div key={f.q}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : i)}
                    aria-expanded={open}
                    aria-controls={panelId}
                    className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="text-sm font-semibold text-gray-900">{f.q}</span>
                    <span aria-hidden="true" className="text-gray-400">
                      {open ? "−" : "+"}
                    </span>
                  </button>
                  {open ? (
                    <p id={panelId} className="px-5 pb-5 text-sm leading-relaxed text-gray-600">{f.a}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
