"use client";

import { useActionState, useRef, useState } from "react";
import { Check, Trash2, Upload } from "lucide-react";
import {
  hapusBerkasAction,
  unggahBerkasAction,
  type ResumeFormState,
} from "@/actions/resume";
import type { BerkasUpload, Slot } from "@/lib/resume/types";

/**
 * CV / portfolio upload widget.
 *
 * Client-side guards (accept=".pdf", a size pre-check) are convenience only —
 * the server action re-validates the MIME type, the `%PDF-` magic bytes, and
 * the size, because a crafted request ignores everything the browser checks.
 */

const KOSONG: ResumeFormState = { ok: false };

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function BerkasUploader({
  slot,
  label,
  berkas,
  username,
}: {
  slot: Slot;
  label: string;
  berkas: BerkasUpload | null;
  username: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [unggahState, unggahAction, pending] = useActionState<ResumeFormState, FormData>(
    unggahBerkasAction,
    KOSONG,
  );
  const [, hapusAction] = useActionState<ResumeFormState, FormData>(hapusBerkasAction, KOSONG);

  return (
    <div className="rounded-xl border border-gray-200 bg-white/60 p-4">
      <p className="text-sm font-medium text-gray-900">{label}</p>

      {berkas ? (
        <p className="mt-1 text-xs text-gray-500">
          {berkas.namaAsli} · {formatBytes(berkas.ukuran)}
        </p>
      ) : (
        <p className="mt-1 text-xs text-gray-500">Belum ada berkas. PDF, maks 5MB.</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form action={unggahAction}>
          <input type="hidden" name="slot" value={slot} />
          <input
            ref={fileRef}
            type="file"
            name="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-800 hover:bg-gray-100"
          >
            <Upload className="size-4" aria-hidden="true" />
            Pilih PDF
          </button>
          {fileName ? <span className="ml-2 text-xs text-gray-500">{fileName}</span> : null}
          <button
            type="submit"
            disabled={pending || !fileName}
            className="grad-btn ml-2 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Check className="size-4" aria-hidden="true" />
            {pending ? "Mengunggah…" : "Unggah"}
          </button>
        </form>

        {berkas ? (
          <>
            <a
              href={`/p/${username}/berkas/${slot}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-blue-600"
            >
              Lihat
            </a>
            <form action={hapusAction} className="inline">
              <input type="hidden" name="slot" value={slot} />
              <button
                type="submit"
                className="inline-flex items-center gap-1 text-xs font-medium text-red-600"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                Hapus
              </button>
            </form>
          </>
        ) : null}
      </div>

      {unggahState.message ? (
        <p
          role="alert"
          className={
            unggahState.ok
              ? "mt-2 text-xs text-emerald-700"
              : "mt-2 text-xs text-red-700"
          }
        >
          {unggahState.message}
        </p>
      ) : null}
    </div>
  );
}
