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

function CourseCard({ resource }: { resource: ResourceFixture }) {
  return (
    <article className="w-64 shrink-0 overflow-hidden rounded-xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.08)] ring-1 ring-black/5 lg:w-72">
      <div className={cn("relative h-36 bg-gradient-to-br", gradientFor(resource.id))}>
        <span
          aria-hidden="true"
          className="absolute right-3 bottom-2 text-3xl font-bold text-white/90"
        >
          {resource.provider.charAt(0)}
        </span>
        <span className="absolute top-3 left-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
          {resource.type}
        </span>
      </div>
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
          <a href={resource.url} target="_blank" rel="noreferrer" className="hover:underline">
            {resource.title}
          </a>
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
    <section className="overflow-hidden rounded-3xl bg-[#f2f5fa] px-6 py-10 lg:px-12 lg:py-14">
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <div>
          <h1 className="text-4xl font-medium tracking-tight text-gray-900 lg:text-5xl">
            Belajar tanpa batas
          </h1>
          <p className="mt-3 max-w-md text-base leading-relaxed text-gray-600">
            Resource terkurasi, challenge praktik, dan verifikasi karya — satu
            alur dari belajar sampai siap kerja.
          </p>
          <form
            role="search"
            className="mt-5 flex max-w-md items-center gap-2 rounded-full border border-gray-200 bg-white p-1.5 pl-4 shadow-sm"
            onSubmit={(e) => e.preventDefault()}
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
              className="shrink-0 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
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

const CATEGORIES = [
  "Bisnis",
  "Kecerdasan Artifisial",
  "Data Science",
  "Computer Science",
  "Teknologi Informasi",
  "Pengembangan Diri",
  "Kesehatan",
  "Bahasa",
  "Ilmu Sosial",
  "Seni & Humaniora",
  "Teknik & Sains",
  "Matematika & Logika",
];

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
];

export function BelajarHome({
  resources,
  tasks,
}: {
  resources: ResourceFixture[];
  tasks: TaskFixture[];
}) {
  const [query, setQuery] = useState("");
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

  return (
    <div className="min-w-0 space-y-10 overflow-x-clip">
      {nextTask ? (
        <section
          aria-labelledby="lanjut-belajar"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 px-5 py-4"
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wider text-blue-700 uppercase">
              Lanjutkan belajar
            </p>
            <h2 id="lanjut-belajar" className="text-base font-semibold text-gray-900">
              {nextTask.title}
            </h2>
            <p className="max-w-xl text-sm text-gray-600">{nextTask.brief}</p>
          </div>
          <Link
            href={`/challenge/${nextTask.id}`}
            className="shrink-0 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Buka challenge
          </Link>
        </section>
      ) : null}

      <Hero query={query} onQuery={setQuery} />

      <section aria-labelledby="baru-populer">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 id="baru-populer" className="text-2xl font-medium tracking-tight text-gray-900">
            Baru dan populer
          </h2>
          <div className="flex gap-2" role="tablist" aria-label="Filter populer">
            {POPULAR_TABS.map((t, i) => (
              <button
                key={t.label}
                role="tab"
                aria-selected={popularTab === i}
                onClick={() => setPopularTab(i)}
                className={cn(
                  "cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  popularTab === i
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200",
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
      </section>

      <section aria-labelledby="ai-untuk-kerja" className="rounded-3xl bg-gray-900 px-6 py-10 text-white lg:px-10">
        <h2 id="ai-untuk-kerja" className="max-w-2xl text-2xl font-medium tracking-tight text-white lg:text-3xl">
          AI untuk pekerjaanmu — dan karier yang kamu mau
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">
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
                "cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                role === r ? "bg-white text-gray-900" : "bg-white/10 text-white hover:bg-white/20",
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
      </section>

      <section aria-label="Promo" className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-gradient-to-br from-blue-800 to-blue-500 p-6 text-white">
          <p className="text-xs font-semibold tracking-widest text-white/80 uppercase">Careevo Plus</p>
          <h3 className="mt-1 text-xl font-semibold text-white">Hancurkan hambatan belajar dengan harga hemat</h3>
          <Link
            href="/careevo-plus"
            className="mt-3 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Dapatkan Careevo Plus
          </Link>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-500 p-6 text-white">
          <p className="text-xs font-semibold tracking-widest text-white/80 uppercase">Careevo untuk Tim</p>
          <h3 className="mt-1 text-xl font-semibold text-white">Mulai dengan penghematan untuk tim yang bekerja keras</h3>
          <Link
            href="/careevo-plus#paket"
            className="mt-3 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            Lihat paket tim
          </Link>
        </div>
      </section>

      <section aria-labelledby="mitra">
        <h2 id="mitra" className="mb-4 text-2xl font-medium tracking-tight text-gray-900">
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
      </section>

      <section aria-label="Jalur" className="grid gap-4 md:grid-cols-3">
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
            <h3 className="text-lg font-semibold text-gray-900">{b.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">{b.body}</p>
            <Link href={b.href} className="mt-3 inline-flex text-sm font-semibold text-blue-600 hover:underline">
              {b.cta} →
            </Link>
          </div>
        ))}
      </section>

      <section aria-labelledby="kategori">
        <h2 id="kategori" className="mb-4 text-2xl font-medium tracking-tight text-gray-900">
          Jelajahi kategori
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map((c) => (
            <a
              key={c}
              href="#katalog"
              onClick={() => setQuery("")}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-800 transition-colors hover:border-blue-300 hover:bg-blue-50/50"
            >
              {c}
            </a>
          ))}
        </div>
      </section>

      <section aria-labelledby="tren">
        <h2 id="tren" className="mb-3 text-2xl font-medium tracking-tight text-gray-900">
          Pencarian populer
        </h2>
        <div className="flex flex-wrap gap-2">
          {TRENDING.map((t) => (
            <button
              key={t}
              onClick={() => setQuery(t)}
              className="cursor-pointer rounded-full bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="tujuan" className="rounded-3xl bg-[#f2f5fa] px-6 py-10 lg:px-10">
        <h2 id="tujuan" className="text-2xl font-medium tracking-tight text-gray-900">
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
                  ? "border-blue-600 bg-white text-gray-900 shadow-sm"
                  : "border-transparent bg-white/60 text-gray-600 hover:bg-white",
              )}
            >
              {g}
            </button>
          ))}
        </div>
        <div className="mt-6 rounded-2xl bg-gray-900 p-6 text-white lg:p-8">
          <h3 className="text-xl font-semibold text-white">
            Siap kerja untuk karier yang banyak dicari
          </h3>
          <p className="mt-1 text-sm text-white/70">
            {goal}: tanpa pengalaman pun bisa mulai dari level pemula.
          </p>
          <div className="mt-4 flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {resources.slice(0, 6).map((r) => (
              <CourseCard key={r.id} resource={r} />
            ))}
          </div>
        </div>
      </section>

      <section aria-label="Hasil belajar" className="grid items-center gap-6 rounded-3xl border border-gray-200 bg-white p-6 lg:grid-cols-2 lg:p-10">
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
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${Math.round((completedCount / Math.max(resources.length, 1)) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {Math.round((completedCount / Math.max(resources.length, 1)) * 100)}% resource selesai
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="cerita">
        <h2 id="cerita" className="mb-4 text-2xl font-medium tracking-tight text-gray-900">
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
                onClick={() => setStory(i)}
                className={cn(
                  "h-1.5 cursor-pointer rounded-full transition-all",
                  i === story ? "w-6 bg-gray-900" : "w-1.5 bg-gray-300",
                )}
              />
            ))}
          </div>
        </div>
      </section>

      <section id="katalog" aria-labelledby="katalog-title" className="scroll-mt-6">
        <h2 id="katalog-title" className="mb-1 text-2xl font-medium tracking-tight text-gray-900">
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
          <p className="mt-2 text-sm text-gray-500">
            Tidak ada resource yang cocok. Coba kata kunci lain.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="faq">
        <h2 id="faq" className="mb-4 text-2xl font-medium tracking-tight text-gray-900">
          Pertanyaan umum
        </h2>
        <div className="divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white">
          {FAQS.map((f, i) => {
            const open = openFaq === i;
            return (
              <div key={f.q}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(open ? null : i)}
                  aria-expanded={open}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-sm font-semibold text-gray-900">{f.q}</span>
                  <span aria-hidden="true" className="text-gray-400">
                    {open ? "−" : "+"}
                  </span>
                </button>
                {open ? (
                  <p className="px-5 pb-5 text-sm leading-relaxed text-gray-600">{f.a}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
