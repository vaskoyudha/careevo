"use client";

import { useState } from "react";
import { ArrowUp, ChevronDown, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ChatCariLowongan — the board's search surface, shaped like a chat composer.
 *
 * Visual reference is the AI Mastery landing state: a tall rounded composer with
 * its own bottom toolbar, and suggestion lines beneath it. Two states, one
 * component: with an empty query the heading is shown and the composer is tall,
 * because there is nothing below it to compete with; once a query exists the
 * heading collapses and the composer shrinks to a bar, so the results sit close
 * under the thing that produced them.
 *
 * The composer filters the real board on submit-and-type — there is no send
 * round-trip and no model. `aria-live` on the count is what announces the result
 * change to a screen reader, since a bare filter swap is otherwise silent.
 */

/**
 * Suggestions are real queries, not decoration. Each is a phrase whose filler
 * words `uraiKueri` strips, leaving terms the fixture corpus actually contains —
 * `kueri-chat.test.ts` pins that they return results rather than an empty board.
 */
const SARAN = [
  "Lowongan remote",
  "React",
  "Jakarta",
  "Node.js",
] as const;

export function ChatCariLowongan({
  nilai,
  onChange,
  hasil,
}: {
  nilai: string;
  onChange: (next: string) => void;
  hasil: number;
}) {
  const [kirim, setKirim] = useState(false);
  const ada = nilai.trim().length > 0;

  const submit = () => {
    setKirim(true);
    onChange(nilai);
    // A tick, so a second identical query still re-announces the result count.
    window.setTimeout(() => setKirim(false), 0);
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Heading — only while the composer is the whole story.
          `inert`, not just `aria-hidden`: collapsing to `grid-rows-[0fr]` leaves
          the subtree mounted and laid out, and `aria-hidden` removes nothing from
          the tab order. Without `inert`, Tab walks into an invisible heading. */}
      <div
        className={cn(
          "grid transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
          ada ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
        )}
        aria-hidden={ada}
        inert={ada}
      >
        <div className="overflow-hidden">
          <div className="pb-5 text-center">
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-[#3b82f6] to-[#bfdbfe] text-white shadow-sm">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <h3 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-neutral-900 sm:text-[28px]">
              Lowongan seperti apa yang kamu cari?
            </h3>
            <p className="mx-auto mt-2 max-w-md text-balance text-sm text-neutral-500">
              Tulis bebas — lokasi, teknologi, atau level gaji. Semua lowongan sudah diaudit
              Sentinel, jadi yang tampil tidak meminta biaya.
            </p>
          </div>
        </div>
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={cn(
          "rounded-2xl border bg-white shadow-sm transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "focus-within:border-[#388AF3] focus-within:shadow-md focus-within:ring-4 focus-within:ring-[#388AF3]/10",
          ada ? "border-neutral-200 p-2" : "border-neutral-200 p-2.5",
        )}
      >
        <label htmlFor="chat-cari-lowongan" className="sr-only">
          Cari lowongan kerja
        </label>
        <textarea
          id="chat-cari-lowongan"
          rows={ada ? 1 : 2}
          value={nilai}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Coba: lowongan React remote, atau backend Node.js di Jakarta…"
          className={cn(
            "w-full resize-none border-0 bg-transparent px-3 py-2 text-neutral-900 outline-none placeholder:text-neutral-400",
            "text-[15px] leading-relaxed",
            ada ? "min-h-[44px]" : "min-h-[76px]",
          )}
        />

        <div className="flex items-center justify-between gap-2 px-1.5 pt-1">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-600">
            <Search className="size-3.5" aria-hidden />
            Cari lowongan
            <ChevronDown className="size-3.5 text-neutral-400" aria-hidden />
          </span>

          <button
            type="submit"
            aria-label="Cari lowongan"
            className={cn(
              "inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 active:scale-95",
              ada
                ? "bg-neutral-900 text-white hover:bg-neutral-800"
                : "bg-neutral-100 text-neutral-400",
            )}
          >
            <ArrowUp className="size-4" aria-hidden />
          </button>
        </div>
      </form>

      {/* Suggestions — the empty state only, mirroring the AI Mastery reference.
          `inert` for the same reason as the heading: these are four real buttons,
          and a collapsed block that is still tabbable is four invisible tab stops. */}
      <div
        className={cn(
          "grid transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
          ada ? "mt-0 grid-rows-[0fr] opacity-0" : "mt-3 grid-rows-[1fr] opacity-100",
        )}
        aria-hidden={ada}
        inert={ada}
      >
        <ul className="overflow-hidden">
          {SARAN.map((saran) => (
            <li key={saran}>
              <button
                type="button"
                onClick={() => onChange(saran)}
                className="group flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
              >
                <span>{saran}</span>
                <ArrowUp
                  className="size-3.5 shrink-0 -rotate-45 text-neutral-300 transition-colors group-hover:text-[#388AF3]"
                  aria-hidden
                />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* One polite live region for every result change, filter or chat. */}
      <p aria-live="polite" className="sr-only">
        {kirim || ada ? `${hasil} lowongan cocok` : ""}
      </p>
    </div>
  );
}
