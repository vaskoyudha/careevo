import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/onboarding/store";
import { katalogBelajar } from "@/lib/courses/katalog";
import { listPendaftaran } from "@/lib/courses/enrollment";
import { bangunJalurPersonalisasi } from "@/lib/learning/personalized-path";
import { hasLlm } from "@/lib/llm/port";
import { listBooks } from "@/lib/book/store";
import { BookLibrary } from "@/components/features/book/book-library";

export const metadata: Metadata = { title: "Buku" };

export default async function BookIndexPage() {
  const session = await getSession();
  if (!session) return null;

  const [profile, catalog, enrollments, books] = await Promise.all([
    getProfile(session.userId, session.email),
    katalogBelajar(),
    listPendaftaran(session.email),
    listBooks(session.email),
  ]);

  const path = profile ? bangunJalurPersonalisasi({ profile, catalog, enrollments }) : null;

  return (
    <BookLibrary
      books={books}
      suggestedCourse={path?.course ?? null}
      hasProfile={Boolean(profile)}
      pakaiModel={hasLlm()}
    />
  );
}
