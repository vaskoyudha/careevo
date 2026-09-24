"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModulEditor } from "./modul-editor";
import { UnggahBerkas } from "./unggah-berkas";
import { useActionState } from "react";
import { updateCourseAction, type CourseActionState } from "@/actions/courses";
import { cn } from "@/lib/utils";
import type { Course } from "@/types/course";

/**
 * Halaman detail kursus: identitas kursus, sampul, dan kurikulum (modul +
 * materi).
 *
 * Sampul diunggah lewat route handler (di luar transaksi action), jadi alurnya:
 * unggah dapat path -> simpan path ke kursus lewat `updateCourseAction`.
 */

const KOSONG: CourseActionState = { ok: false };

type Tab = "kurikulum" | "identitas";

export function KursusDetail({ course }: { course: Course }) {
  const [tab, setTab] = useState<Tab>("kurikulum");
  const modul = course.modul ?? [];
  const jumlahMateri = modul.reduce((total, m) => total + (m.materi ?? []).length, 0);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">{course.title}</h2>
            <p className="card-sub">
              {course.provider} · {course.duration_min} menit ·{" "}
              {modul.length > 0
                ? `${modul.length} modul tersimpan · ${jumlahMateri} materi`
                : "belum ada modul tersimpan (memakai 5 modul turunan)"}
            </p>
          </div>
          <Link
            href="/admin/courses"
            className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ← Kembali
          </Link>
        </div>

        <div className="flex gap-1 border-b border-gray-200">
          {(
            [
              ["kurikulum", "Modul & Materi"],
              ["identitas", "Identitas & Sampul"],
            ] as Array<[Tab, string]>
          ).map(([nilai, label]) => (
            <button
              key={nilai}
              type="button"
              onClick={() => setTab(nilai)}
              aria-selected={tab === nilai}
              role="tab"
              className={cn(
                "-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm font-medium",
                tab === nilai
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-800",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="pt-4">
          {tab === "kurikulum" ? (
            <ModulEditor courseId={course.id} modul={modul} />
          ) : (
            <IdentitasKursus course={course} />
          )}
        </div>
      </div>
    </div>
  );
}

function IdentitasKursus({ course }: { course: Course }) {
  const [state, formAction, pending] = useActionState<CourseActionState, FormData>(
    updateCourseAction,
    KOSONG,
  );
  const [cover, setCover] = useState(course.cover_image ?? "");

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={course.id} />
      <input type="hidden" name="cover_image" value={cover} />

      <div className="space-y-2">
        <Label>Sampul kursus</Label>
        <UnggahBerkas
          courseId={course.id}
          jenis="gambar"
          label="Unggah sampul"
          onSukses={(hasil) => setCover(hasil.path)}
        />
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt="Pratinjau sampul kursus"
            className="mt-2 h-32 w-full max-w-sm rounded-xl border border-gray-200 object-cover"
          />
        ) : (
          <p className="field-hint">
            Belum ada sampul. Kartu katalog akan memakai thumbnail bawaan.
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="judul">Judul kursus</Label>
          <Input id="judul" name="title" defaultValue={course.title} required />
          {state.fieldErrors?.title ? <p className="field-error">{state.fieldErrors.title}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="provider">Provider</Label>
          <Input id="provider" name="provider" defaultValue={course.provider} required />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="deskripsi">Deskripsi</Label>
        <textarea
          id="deskripsi"
          name="description"
          rows={4}
          defaultValue={course.description}
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
          required
        />
        {state.fieldErrors?.description ? (
          <p className="field-error">{state.fieldErrors.description}</p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="url">URL materi eksternal</Label>
          <Input id="url" name="url" type="url" defaultValue={course.url} required />
          <p className="field-hint">Hanya http/https.</p>
          {state.fieldErrors?.url ? <p className="field-error">{state.fieldErrors.url}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="durasi">Durasi (menit)</Label>
          <Input
            id="durasi"
            name="duration_min"
            type="number"
            min={1}
            defaultValue={course.duration_min}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={course.status}
            className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
          >
            <option value="published">published</option>
            <option value="draft">draft</option>
            <option value="archived">archived</option>
          </select>
        </div>
      </div>

      {state.message ?? state.error ? (
        <p
          role="alert"
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            state.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
          )}
        >
          {state.message ?? state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="cursor-pointer rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
      >
        {pending ? "Menyimpan…" : "Simpan identitas"}
      </button>
    </form>
  );
}
