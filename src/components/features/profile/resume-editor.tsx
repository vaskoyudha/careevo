"use client";

import { useActionState } from "react";
import {
  Award,
  Briefcase,
  Check,
  ExternalLink,
  FileText,
  FolderGit2,
  GraduationCap,
} from "lucide-react";
import {
  hapusPendidikanAction,
  hapusPengalamanAction,
  hapusProyekAction,
  hapusSertifikatAction,
  simpanPendidikanAction,
  simpanPengalamanAction,
  simpanProyekAction,
  simpanProfilRingkasAction,
  simpanSertifikatAction,
  simpanSkillAction,
  type ResumeFormState,
} from "@/actions/resume";
import { BerkasUploader } from "@/components/features/profile/berkas-uploader";
import {
  EDIT_TRIGGER_CLASS,
  EntryDialog,
  TRIGGER_CLASS,
  type FieldSpec,
} from "@/components/features/profile/resume-fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Resume } from "@/lib/resume/types";

/**
 * The interactive resume editor shown on the owner's `/profil`.
 *
 * It mirrors `ResumeView`'s layout but adds add/edit/delete affordances. Each
 * list section pairs a header "+ Tambah" `EntryDialog` with per-row edit and
 * delete controls that post the section's server action. The public page uses
 * the read-only `ResumeView`; keeping them separate avoids shipping the editor
 * (and its actions) to a public page.
 */

const KOSONG: ResumeFormState = { ok: false };

const FIELDS = {
  pengalaman: [
    { name: "jabatan", label: "Jabatan", required: true, placeholder: "Frontend Developer" },
    { name: "perusahaan", label: "Perusahaan", required: true, placeholder: "Acme" },
    { name: "periode", label: "Periode", placeholder: "Jan 2024 — Sekarang" },
    { name: "lokasi", label: "Lokasi", placeholder: "Jakarta · Hybrid" },
    { name: "deskripsi", label: "Deskripsi", type: "textarea", placeholder: "Apa yang kamu kerjakan" },
  ] as FieldSpec[],
  proyek: [
    { name: "nama", label: "Nama proyek", required: true },
    { name: "deskripsi", label: "Deskripsi", type: "textarea" },
    { name: "url", label: "Link demo", placeholder: "proyek.example.com" },
    { name: "repo", label: "Link repo", placeholder: "github.com/..." },
  ] as FieldSpec[],
  pendidikan: [
    { name: "institusi", label: "Institusi", required: true, placeholder: "Universitas Indonesia" },
    { name: "jurusan", label: "Jurusan", placeholder: "S1 Teknik Informatika" },
    { name: "periode", label: "Periode", placeholder: "2020 — 2024" },
  ] as FieldSpec[],
  sertifikasi: [
    { name: "nama", label: "Nama sertifikat", required: true },
    { name: "penerbit", label: "Penerbit", placeholder: "Google" },
    { name: "url", label: "Link kredensial" },
  ] as FieldSpec[],
};

function SectionHead({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  children?: React.ReactNode;
}) {
  return (
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
      {children}
    </div>
  );
}

function Kosong({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm text-gray-500">{children}</p>;
}

/** A row-level "edit" affordance that opens the section's dialog prefilled. */
function EditTrigger(props: React.ComponentProps<typeof EntryDialog>) {
  return <EntryDialog {...props} triggerIcon="pencil" triggerClassName={EDIT_TRIGGER_CLASS} />;
}

export function ResumeEditor({ resume, username }: { resume: Resume; username: string }) {
  const [ringkasState, ringkasAction, ringkasPending] = useActionState<ResumeFormState, FormData>(
    simpanProfilRingkasAction,
    KOSONG,
  );
  const [skillState, skillAction, skillPending] = useActionState<ResumeFormState, FormData>(
    simpanSkillAction,
    KOSONG,
  );

  return (
    <div className="space-y-4">
      {/* About + contact */}
      <section className="glass-card rounded-2xl p-6">
        <SectionHead icon={<FileText className="size-5" strokeWidth={1.75} aria-hidden="true" />} title="Tentang & kontak" />
        <form action={ringkasAction} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resume-headline">Headline</Label>
            <Input
              id="resume-headline"
              name="headline"
              defaultValue={resume.headline}
              placeholder="Frontend developer · React, TypeScript"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="resume-ringkasan">Ringkasan</Label>
            <Textarea
              id="resume-ringkasan"
              name="ringkasan"
              defaultValue={resume.ringkasan}
              placeholder="Ceritakan singkat tentang dirimu"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="resume-username">Username publik</Label>
              <Input id="resume-username" name="username" defaultValue={resume.username || username} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resume-lokasi">Lokasi</Label>
              <Input id="resume-lokasi" name="lokasi" defaultValue={resume.kontak.lokasi} placeholder="Bandung, Indonesia" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resume-linkedin">LinkedIn</Label>
              <Input id="resume-linkedin" name="linkedin" defaultValue={resume.kontak.linkedin} placeholder="linkedin.com/in/..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resume-github">GitHub</Label>
              <Input id="resume-github" name="github" defaultValue={resume.kontak.github} placeholder="github.com/..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resume-situs">Situs / portofolio</Label>
              <Input id="resume-situs" name="situs" defaultValue={resume.kontak.situs} placeholder="namaku.dev" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resume-telepon">Telepon</Label>
              <Input id="resume-telepon" name="telepon" defaultValue={resume.kontak.telepon} placeholder="+62..." />
            </div>
          </div>

          {ringkasState.message ? (
            <p
              role="alert"
              className={ringkasState.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"}
            >
              {ringkasState.message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={ringkasPending}
            className="grad-btn inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Check className="size-4" aria-hidden="true" />
            {ringkasPending ? "Menyimpan…" : "Simpan"}
          </button>
        </form>
      </section>

      {/* Files */}
      <section className="glass-card rounded-2xl p-6">
        <SectionHead icon={<FileText className="size-5" strokeWidth={1.75} aria-hidden="true" />} title="Berkas" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <BerkasUploader slot="cv" label="CV" berkas={resume.berkas.cv} username={username} />
          <BerkasUploader slot="portofolio" label="Portofolio" berkas={resume.berkas.portofolio} username={username} />
        </div>
      </section>

      {/* Pengalaman */}
      <section className="glass-card rounded-2xl p-6">
        <SectionHead
          icon={<Briefcase className="size-5" strokeWidth={1.75} aria-hidden="true" />}
          title="Riwayat kerja"
          count={resume.pengalaman.length || undefined}
        >
          <EntryDialog
            title="Tambah riwayat kerja"
            fields={FIELDS.pengalaman}
            action={simpanPengalamanAction}
            triggerLabel="Tambah"
            triggerClassName={TRIGGER_CLASS}
          />
        </SectionHead>
        {resume.pengalaman.length === 0 ? (
          <Kosong>Belum ada riwayat kerja.</Kosong>
        ) : (
          <ol className="mt-4 space-y-4">
            {resume.pengalaman.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{item.jabatan}</p>
                    <p className="text-sm text-gray-700">
                      {item.perusahaan}
                      {item.lokasi ? ` · ${item.lokasi}` : ""}
                    </p>
                    {item.periode ? <p className="text-xs text-gray-500">{item.periode}</p> : null}
                    {item.deskripsi ? <p className="mt-1 text-sm text-gray-600">{item.deskripsi}</p> : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <EditTrigger
                    title="Edit riwayat kerja"
                    fields={FIELDS.pengalaman}
                    action={simpanPengalamanAction}
                    triggerLabel=""
                    entry={{ ...item }}
                  />
                  <form action={hapusPengalamanAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" className="text-xs font-medium text-red-600">
                      Hapus
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Proyek */}
      <section className="glass-card rounded-2xl p-6">
        <SectionHead
          icon={<FolderGit2 className="size-5" strokeWidth={1.75} aria-hidden="true" />}
          title="Proyek"
          count={resume.proyek.length || undefined}
        >
          <EntryDialog
            title="Tambah proyek"
            fields={FIELDS.proyek}
            action={simpanProyekAction}
            triggerLabel="Tambah"
            triggerClassName={TRIGGER_CLASS}
          />
        </SectionHead>
        {resume.proyek.length === 0 ? (
          <Kosong>Belum ada proyek.</Kosong>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {resume.proyek.map((item) => (
              <div key={item.id} className="rounded-xl border border-gray-200 bg-white/60 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">{item.nama}</p>
                  <div className="flex shrink-0 items-center gap-3">
                    <EditTrigger
                      title="Edit proyek"
                      fields={FIELDS.proyek}
                      action={simpanProyekAction}
                      triggerLabel=""
                      entry={{ ...item }}
                    />
                    <form action={hapusProyekAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <button type="submit" className="text-xs font-medium text-red-600">
                        Hapus
                      </button>
                    </form>
                  </div>
                </div>
                {item.deskripsi ? <p className="mt-1 text-sm text-gray-600">{item.deskripsi}</p> : null}
                <div className="mt-2 flex flex-wrap gap-3">
                  {item.url ? (
                    <a href={item.url.startsWith("http") ? item.url : `https://${item.url}`} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600">
                      <ExternalLink className="size-3.5" aria-hidden="true" /> Demo
                    </a>
                  ) : null}
                  {item.repo ? (
                    <a href={item.repo.startsWith("http") ? item.repo : `https://${item.repo}`} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600">
                      <FolderGit2 className="size-3.5" aria-hidden="true" /> Repo
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pendidikan */}
      <section className="glass-card rounded-2xl p-6">
        <SectionHead
          icon={<GraduationCap className="size-5" strokeWidth={1.75} aria-hidden="true" />}
          title="Pendidikan"
          count={resume.pendidikan.length || undefined}
        >
          <EntryDialog
            title="Tambah pendidikan"
            fields={FIELDS.pendidikan}
            action={simpanPendidikanAction}
            triggerLabel="Tambah"
            triggerClassName={TRIGGER_CLASS}
          />
        </SectionHead>
        {resume.pendidikan.length === 0 ? (
          <Kosong>Belum ada pendidikan.</Kosong>
        ) : (
          <ul className="mt-4 space-y-3">
            {resume.pendidikan.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.institusi}</p>
                  <p className="text-sm text-gray-700">{item.jurusan}</p>
                  {item.periode ? <p className="text-xs text-gray-500">{item.periode}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <EditTrigger
                    title="Edit pendidikan"
                    fields={FIELDS.pendidikan}
                    action={simpanPendidikanAction}
                    triggerLabel=""
                    entry={{ ...item }}
                  />
                  <form action={hapusPendidikanAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" className="text-xs font-medium text-red-600">
                      Hapus
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Skill */}
      <section className="glass-card rounded-2xl p-6">
        <SectionHead icon={<Award className="size-5" strokeWidth={1.75} aria-hidden="true" />} title="Skill" />
        <form action={skillAction} className="mt-4 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="resume-skill">Skill (pisahkan dengan koma)</Label>
            <Input
              id="resume-skill"
              name="skill"
              defaultValue={resume.skill.join(", ")}
              placeholder="React, TypeScript, Tailwind"
            />
          </div>
          {skillState.message ? (
            <p role="alert" className={skillState.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"}>
              {skillState.message}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={skillPending}
            className="grad-btn inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Check className="size-4" aria-hidden="true" />
            {skillPending ? "Menyimpan…" : "Simpan"}
          </button>
        </form>
        {resume.skill.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {resume.skill.map((s) => (
              <span key={s} className="inline-flex rounded-full border border-blue-200/80 bg-white/70 px-3 py-1 text-xs font-medium text-blue-700">
                {s}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      {/* Sertifikasi */}
      <section className="glass-card rounded-2xl p-6">
        <SectionHead
          icon={<Award className="size-5" strokeWidth={1.75} aria-hidden="true" />}
          title="Sertifikasi"
          count={resume.sertifikasi.length || undefined}
        >
          <EntryDialog
            title="Tambah sertifikat"
            fields={FIELDS.sertifikasi}
            action={simpanSertifikatAction}
            triggerLabel="Tambah"
            triggerClassName={TRIGGER_CLASS}
          />
        </SectionHead>
        {resume.sertifikasi.length === 0 ? (
          <Kosong>Belum ada sertifikasi.</Kosong>
        ) : (
          <ul className="mt-4 space-y-3">
            {resume.sertifikasi.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.nama}</p>
                  {item.penerbit ? <p className="text-xs text-gray-500">{item.penerbit}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <EditTrigger
                    title="Edit sertifikat"
                    fields={FIELDS.sertifikasi}
                    action={simpanSertifikatAction}
                    triggerLabel=""
                    entry={{ ...item }}
                  />
                  <form action={hapusSertifikatAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" className="text-xs font-medium text-red-600">
                      Hapus
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
