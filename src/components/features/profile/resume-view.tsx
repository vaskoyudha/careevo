import {
  Award,
  Briefcase,
  ExternalLink,
  FileText,
  FolderGit2,
  GraduationCap,
} from "lucide-react";
import { LandingBtnLink } from "@/components/ui/landing-btn";
import type { Resume } from "@/lib/resume/types";

/**
 * Read-only rendering of a resume's sections.
 *
 * Shared by the owner's `/profil` and the public `/p/[username]` page so the
 * two never drift. Purely presentational (no client hooks) — the interactive
 * add/edit/delete lives in `resume-editor.tsx` around this.
 *
 * `username` drives the upload links (`/p/<username>/berkas/...`); `unduh`
 * toggles the download vs. preview disposition.
 */

function href(url: string): string {
  if (!url) return "";
  return /^https?:\/\//.test(url) ? url : `https://${url}`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function SectionShell({
  icon,
  title,
  count,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-card rounded-2xl p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="glass-chip inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
            {icon}
          </span>
          <h2 className="text-lg font-medium text-gray-900">
            {title}
            {typeof count === "number" ? (
              <span className="ml-2 text-sm font-normal text-gray-400">{count}</span>
            ) : null}
          </h2>
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Kosong({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-500">{children}</p>;
}

export function ResumeView({
  resume,
  username,
  emptyHint,
}: {
  resume: Resume;
  username: string;
  /** Shown when a section is empty — differs between owner and public view. */
  emptyHint?: { pengalaman?: string; proyek?: string; pendidikan?: string; skill?: string; sertifikasi?: string };
}) {
  const hint = emptyHint ?? {};
  const cv = resume.berkas.cv;
  const portofolio = resume.berkas.portofolio;

  return (
    <div className="space-y-4">
      {/* Berkas (CV / portofolio) */}
      <SectionShell icon={<FileText className="size-5" strokeWidth={1.75} aria-hidden="true" />} title="Berkas">
        <div className="flex flex-wrap gap-3">
          {cv ? (
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white/60 px-4 py-3">
              <FileText className="size-5 text-blue-600" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">CV · {cv.namaAsli}</p>
                <p className="text-xs text-gray-500">{formatBytes(cv.ukuran)}</p>
              </div>
              <div className="flex items-center gap-2">
                <LandingBtnLink
                  variant="secondary"
                  href={`/p/${username}/berkas/cv`}
                  target="_blank"
                  className="h-9 px-3 text-sm"
                >
                  Lihat
                </LandingBtnLink>
                <LandingBtnLink
                  href={`/p/${username}/berkas/cv?unduh=1`}
                  className="h-9 px-3 text-sm"
                >
                  Unduh
                </LandingBtnLink>
              </div>
            </div>
          ) : (
            <Kosong>Belum ada CV.</Kosong>
          )}

          {portofolio ? (
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white/60 px-4 py-3">
              <FolderGit2 className="size-5 text-blue-600" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">Portofolio · {portofolio.namaAsli}</p>
                <p className="text-xs text-gray-500">{formatBytes(portofolio.ukuran)}</p>
              </div>
              <div className="flex items-center gap-2">
                <LandingBtnLink
                  variant="secondary"
                  href={`/p/${username}/berkas/portofolio`}
                  target="_blank"
                  className="h-9 px-3 text-sm"
                >
                  Lihat
                </LandingBtnLink>
                <LandingBtnLink
                  href={`/p/${username}/berkas/portofolio?unduh=1`}
                  className="h-9 px-3 text-sm"
                >
                  Unduh
                </LandingBtnLink>
              </div>
            </div>
          ) : null}
        </div>
      </SectionShell>

      {/* Pengalaman */}
      <SectionShell
        icon={<Briefcase className="size-5" strokeWidth={1.75} aria-hidden="true" />}
        title="Riwayat kerja"
        count={resume.pengalaman.length || undefined}
      >
        {resume.pengalaman.length === 0 ? (
          <Kosong>{hint.pengalaman ?? "Belum ada riwayat kerja."}</Kosong>
        ) : (
          <ol className="space-y-4">
            {resume.pengalaman.map((item) => (
              <li key={item.id} className="flex gap-3">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{item.jabatan}</p>
                  <p className="text-sm text-gray-700">
                    {item.perusahaan}
                    {item.lokasi ? ` · ${item.lokasi}` : ""}
                  </p>
                  {item.periode ? <p className="text-xs text-gray-500">{item.periode}</p> : null}
                  {item.deskripsi ? (
                    <p className="mt-1 text-sm leading-relaxed text-gray-600">{item.deskripsi}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </SectionShell>

      {/* Proyek */}
      <SectionShell
        icon={<FolderGit2 className="size-5" strokeWidth={1.75} aria-hidden="true" />}
        title="Proyek"
        count={resume.proyek.length || undefined}
      >
        {resume.proyek.length === 0 ? (
          <Kosong>{hint.proyek ?? "Belum ada proyek."}</Kosong>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {resume.proyek.map((item) => (
              <div key={item.id} className="rounded-xl border border-gray-200 bg-white/60 p-4">
                <p className="text-sm font-semibold text-gray-900">{item.nama}</p>
                {item.deskripsi ? (
                  <p className="mt-1 text-sm leading-relaxed text-gray-600">{item.deskripsi}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-3">
                  {item.url ? (
                    <a
                      href={href(item.url)}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600"
                    >
                      <ExternalLink className="size-3.5" aria-hidden="true" /> Demo
                    </a>
                  ) : null}
                  {item.repo ? (
                    <a
                      href={href(item.repo)}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600"
                    >
                      <FolderGit2 className="size-3.5" aria-hidden="true" /> Repo
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionShell>

      {/* Pendidikan */}
      <SectionShell
        icon={<GraduationCap className="size-5" strokeWidth={1.75} aria-hidden="true" />}
        title="Pendidikan"
        count={resume.pendidikan.length || undefined}
      >
        {resume.pendidikan.length === 0 ? (
          <Kosong>{hint.pendidikan ?? "Belum ada pendidikan."}</Kosong>
        ) : (
          <ul className="space-y-3">
            {resume.pendidikan.map((item) => (
              <li key={item.id}>
                <p className="text-sm font-semibold text-gray-900">{item.institusi}</p>
                <p className="text-sm text-gray-700">{item.jurusan}</p>
                {item.periode ? <p className="text-xs text-gray-500">{item.periode}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </SectionShell>

      {/* Skill */}
      <SectionShell
        icon={<Award className="size-5" strokeWidth={1.75} aria-hidden="true" />}
        title="Skill"
        count={resume.skill.length || undefined}
      >
        {resume.skill.length === 0 ? (
          <Kosong>{hint.skill ?? "Belum ada skill."}</Kosong>
        ) : (
          <div className="flex flex-wrap gap-2">
            {resume.skill.map((s) => (
              <span
                key={s}
                className="inline-flex rounded-full border border-blue-200/80 bg-white/70 px-3 py-1 text-xs font-medium text-blue-700"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </SectionShell>

      {/* Sertifikasi */}
      <SectionShell
        icon={<Award className="size-5" strokeWidth={1.75} aria-hidden="true" />}
        title="Sertifikasi"
        count={resume.sertifikasi.length || undefined}
      >
        {resume.sertifikasi.length === 0 ? (
          <Kosong>{hint.sertifikasi ?? "Belum ada sertifikasi."}</Kosong>
        ) : (
          <ul className="space-y-3">
            {resume.sertifikasi.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.nama}</p>
                  {item.penerbit ? <p className="text-xs text-gray-500">{item.penerbit}</p> : null}
                </div>
                {item.url ? (
                  <a
                    href={href(item.url)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-xs font-medium text-blue-600"
                  >
                    Lihat
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionShell>
    </div>
  );
}
