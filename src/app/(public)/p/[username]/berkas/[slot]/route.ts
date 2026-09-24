import { ambilBerkas, ambilResumeByUsername } from "@/lib/resume/store";
import type { Slot } from "@/lib/resume/types";

/**
 * GET /p/[username]/berkas/[slot] — stream an uploaded PDF from a public profile.
 *
 * The CV and portfolio are public by product decision (a candidate shares them
 * with recruiters, like LinkedIn). Access is intentionally unauthenticated, but
 * the file is only reachable through a profile that still resolves by username,
 * and the on-disk name comes from that profile's metadata, never the URL — so a
 * crafted path cannot read another owner's file.
 */
export const dynamic = "force-dynamic";

function isSlot(value: string): value is Slot {
  return value === "cv" || value === "portofolio";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string; slot: string }> },
) {
  const { username, slot } = await params;
  if (!isSlot(slot)) return new Response("Not found", { status: 404 });

  const resume = await ambilResumeByUsername(decodeURIComponent(username));
  if (!resume) return new Response("Not found", { status: 404 });

  const meta = resume.berkas[slot];
  if (!meta) return new Response("Not found", { status: 404 });

  const bytes = await ambilBerkas(resume.owner, meta.nama);
  if (!bytes) return new Response("Not found", { status: 404 });

  // `Content-Disposition: inline` so a browser previews the PDF; `download=`
  // is offered by the UI link that points here with `?unduh=1`.
  const unduh = new URL(_request.url).searchParams.get("unduh") === "1";
  const safeName = meta.namaAsli.replace(/["\r\n]/g, "");

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${unduh ? "attachment" : "inline"}; filename="${safeName}"`,
      // No caching of user files in shared caches.
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
