import { BarRow } from "@/components/ui/progress-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { CheckinWidget } from "./checkin-widget";
import { jalankanNavigator } from "@/lib/agents/navigator";
import { getTask, tasks, profile, cleanJobs } from "@/lib/fixtures";
import Link from "next/link";

/**
 * Dashboard peserta. Struktur dan peran tiap blok tidak berubah; kartunya
 * mengikuti kartu katalog belajar (`rounded-xl`, border gray-200, shadow-xs)
 * supaya dashboard, jelajah, dan katalog belajar terbaca sebagai satu produk.
 */

/** Kartu panel dashboard — kartu katalog belajar, dipakai semua blok di bawah. */
const CARD = "rounded-xl border border-gray-200 bg-white p-5 shadow-xs";
/** Kepala kartu: judul + deskripsi di kiri, aksi/badge di kanan. */
function CardHead({
  title,
  sub,
  aside,
}: {
  title: string;
  sub: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
      <div>
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        <p className="mt-0.5 text-[13px] text-gray-500">{sub}</p>
      </div>
      {aside}
    </div>
  );
}

/** Chip status kecil (Navigator count / role). */
function InfoChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-[#0056D2]">
      {children}
    </span>
  );
}

/** Satu baris rekomendasi: judul + chip + meta. Pola row belajar (hairline). */
function RecRow({
  href,
  title,
  chips,
  meta,
}: {
  href: string;
  title: string;
  chips: string[];
  meta: string;
}) {
  return (
    <li className="border-b border-gray-100 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link
          href={href}
          className="min-w-0 flex-1 text-sm font-bold text-gray-900 hover:text-[#0056D2]"
        >
          {title}
        </Link>
        <span className="flex shrink-0 flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-[#0056D2]"
            >
              {chip}
            </span>
          ))}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-gray-500">{meta}</p>
    </li>
  );
}

export function DashboardView() {
  const completedTaskIds = tasks
    .filter((task) => task.status === "passed")
    .map((task) => task.id);

  const trendingTags = [...new Set(cleanJobs().flatMap((job) => job.tags))].slice(0, 8);

  const { recommendations } = jalankanNavigator({
    scoreJadwal: profile.scores[0].value,
    scoreKarya: profile.scores[1].value,
    scoreValidasi: profile.scores[2].value,
    completedTaskIds,
    trendingTags,
  });

  const hoursThisWeek = 7;
  const weeklyTarget = 10;

  const stats = [
    { label: "Skor total", value: String(profile.score_total), note: "Jadwal + Karya + Validasi" },
    { label: "Streak", value: "5 hari", note: "Kepatuhan jadwal 82%" },
    { label: "Jam minggu ini", value: `${hoursThisWeek}/${weeklyTarget}`, note: "Target minimal 10 jam" },
    { label: "Badge aktif", value: String(profile.badges.length), note: "Terverifikasi HMAC" },
  ];

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl bg-[#EBF3FB] px-4 py-3">
            <span className="block text-[11px] font-bold tracking-wider text-[#0056D2] uppercase">
              {stat.label}
            </span>
            <span className="mt-1 block font-mono text-2xl font-semibold text-gray-900">
              {stat.value}
            </span>
            <p className="mt-0.5 text-xs text-gray-500">{stat.note}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className={CARD} aria-labelledby="checkin-title">
          <CardHead
            title="Sesi belajar hari ini"
            sub="Jadwal 19.00 - 21.00, target 2 jam"
            aside={<StatusBadge status="clean" label="Hari ini" />}
          />
          <CheckinWidget />
        </section>

        <section className={CARD} aria-labelledby="skor-title">
          <CardHead
            title="Rincian skor"
            sub="Skor 0 sampai 100, terbuka dan bisa dijelaskan"
            aside={
              <span className="flex shrink-0 items-baseline gap-1">
                <b className="font-mono text-2xl text-gray-900">{profile.score_total}</b>
                <span className="text-sm text-gray-500">/100</span>
              </span>
            }
          />
          {profile.scores.map((score) => (
            <BarRow
              key={score.label}
              label={score.label}
              value={score.value}
              max={score.max}
              tone={score.value / score.max >= 0.8 ? "ok" : "warn"}
            />
          ))}
          <p className="mt-3 text-xs text-gray-500">
            Karya dinilai rubrik 5 kriteria oleh verifikator. Validasi butuh approve verifikator dan Socrates.
          </p>
        </section>
      </div>

      <section className={CARD} aria-labelledby="nav-title">
        <CardHead
          title="Rekomendasi Navigator"
          sub="Rule-based dari skill gap vs tren loker. Navigator tidak mengubah skor."
          aside={<InfoChip>{recommendations.length} task</InfoChip>}
        />
        <ul className="m-0 list-none p-0">
          {recommendations.map((rec) => {
            const task = getTask(rec.task_id);
            if (!task) return null;
            return (
              <RecRow
                key={rec.task_id}
                href={`/challenge/${task.id}`}
                title={task.title}
                chips={[task.level, `${task.estimate_min} menit`]}
                meta={rec.reason}
              />
            );
          })}
        </ul>
      </section>

      <section className={CARD} aria-labelledby="cari-title">
        <CardHead
          title="Cari lowongan"
          sub="Pindai papan lowongan publik, lalu buka dan lacak yang kamu minati"
          aside={<InfoChip>Job seeker</InfoChip>}
        />
        <p className="text-xs leading-relaxed text-gray-500">
          Lowongan ditemukan disimpan sebagai inbox, belum jadi lamaran. Tidak ada
          yang dikirim otomatis — kamu yang memutuskan.
        </p>
        <Link
          className="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-[#0056D2] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#00419e]"
          href="/loker/inbox"
        >
          Buka lowongan ditemukan
        </Link>
      </section>

      <section className={CARD} aria-labelledby="badge-title">
        <CardHead
          title="Badge terbaru"
          sub="Setiap badge punya attestation publik di /verify"
        />
        <ul className="m-0 list-none p-0">
          {profile.badges.map((badge) => (
            <li
              key={badge.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-gray-100 py-3 last:border-b-0"
            >
              <span className="min-w-0 flex-1 text-sm font-bold text-gray-900">
                {badge.task_title}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="font-mono text-xs text-gray-600">{badge.score}/100</span>
                <StatusBadge status="approved" label="Terverifikasi" />
              </span>
              <span className="w-full text-xs text-gray-500">
                {badge.track} · {badge.issued_at}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
