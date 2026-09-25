import { ambilBerkas, ambilResumeByUsername } from "@/lib/resume/store";
import type { Slot } from "@/lib/resume/types";
import { batasiRequestMasuk } from "@/lib/rate-limit/next";

/**
 * GET /p/[username]/berkas/[slot] — stream an uploaded PDF from a public profile.
 *
 * The CV and portfolio are public by product decision (a candidate shares them
 * with recruiters, like LinkedIn). Access is intentionally unauthenticated, but
 * the file is only reachable through a profile that still resolves by username,
 * and the on-disk name comes from that profile's metadata, never the URL — so a
 * crafted path cannot read another owner's file.
 *
 * Rate limiting lives HERE, not in `proxy.ts`. This is a Route Handler, so it
 * can answer `429` with `Retry-After` itself; keeping the check in the handler
 * means a later matcher edit cannot silently drop it (the Next docs warn that a
 * matcher change also skips Server Actions on that path). The username is added
 * as a second bucket so one profile cannot be used to drain a shared IP's
 * allowance — same reasoning as a per-account key elsewhere.
 */
export const dynamic = "force-dynamic";

function isSlot(value: string): value is Slot {
  return value === "cv" || value === "portofolio";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string; slot: string }> },
) {
  const { username, slot } = await params;
  if (!isSlot(slot)) return new Response("Not found", { status: 404 });

  // Decoded ONCE, and guarded. Route params arrive URL-encoded in this Next
  // version, so the store must receive the decoded value or a `user%40x` segment
  // silently misses every profile. The guard also closes a 500: a malformed
  // segment (e.g. a lone `%`) makes `decodeURIComponent` throw `URIError`, and
  // that must be a 404, not an unhandled crash.
  //
  // The decoded value keys the limiter too, so rotating encodings cannot mint a
  // fresh bucket for the same target. It is only ever a bucket key — never the
  // thing that locates a file (that comes from the profile metadata below).
  let kunci = "";
  try {
    kunci = decodeURIComponent(username);
  } catch {
    kunci = "";
  }

  const ditolak = await batasiRequestMasuk(request, "pdfPublik", {
    tambahan: kunci ? `pdf:${kunci}` : undefined,
  });
  if (ditolak) return ditolak;

  // An empty username cannot address any profile, so it is not found. Checked
  // after the limiter so a crafted bad segment still consumes the IP bucket.
  if (!kunci) return new Response("Not found", { status: 404 });

  const resume = await ambilResumeByUsername(kunci);
  if (!resume) return new Response("Not found", { status: 404 });

  const meta = resume.berkas[slot];
  if (!meta) return new Response("Not found", { status: 404 });

  const bytes = await ambilBerkas(resume.owner, meta.nama);
  if (!bytes) return new Response("Not found", { status: 404 });

  // `Content-Disposition: inline` so a browser previews the PDF; `download=`
  // is offered by the UI link that points here with `?unduh=1`.
  const unduh = new URL(request.url).searchParams.get("unduh") === "1";
  const safeName = meta.namaAsli.replace(/["\r\n]/g, "");

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      // Defence in depth. `aturanKeamanan()` di next.config.ts sudah memasang
      // nosniff untuk seluruh path, tetapi ini satu-satunya endpoint publik
      // tanpa autentikasi yang memantulkan berkas unggahan satu pengguna ke
      // pengguna lain — persis kasus yang disebut docs Next 16 untuk header
      // ini. Menuliskannya di sini membuat jaminan itu tetap ada walau aturan
      // global nanti diubah, dan mendokumentasikan mengapa endpoint ini
      // membutuhkannya. `validasiBerkas` (dipakai `src/actions/resume.ts`)
      // sudah menolak berkas yang magic bytes-nya bukan `%PDF-`, tapi
      // sniffing-lah yang membuat `Content-Type` di atas benar-benar mengikat.
      "X-Content-Type-Options": "nosniff",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${unduh ? "attachment" : "inline"}; filename="${safeName}"`,
      // No caching of user files in shared caches.
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
