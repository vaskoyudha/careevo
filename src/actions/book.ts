"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/onboarding/store";
import { katalogBelajar } from "@/lib/courses/katalog";
import { listPendaftaran } from "@/lib/courses/enrollment";
import { modulKursus } from "@/lib/courses/kurikulum";
import { bangunJalurPersonalisasi } from "@/lib/learning/personalized-path";
import { hasLlm } from "@/lib/llm/port";
import { createBookRecord, deleteBook, saveCompiledBook } from "@/lib/book/store";
import { StubBookCompiler } from "@/lib/book/compiler";
import { GeminiBookCompiler } from "@/lib/book/compiler-gemini";
import type { BookDepth } from "@/lib/book/types";

/**
 * Server actions for generated books.
 *
 * Compilation is synchronous and server-side: the whole book is assembled in
 * one pass and written as one file. There is no streaming progress bar because
 * there is nothing to stream — with the stub compiler the book is ready
 * immediately, and a real model run is a handful of sequential calls. Faking a
 * progress bar for work that takes 40ms would be theatre.
 */

function parseDepth(raw: FormDataEntryValue | null): BookDepth {
  const value = String(raw ?? "standard");
  return value === "brief" || value === "deep" ? value : "standard";
}

/** Create a book from a course and compile it, then open the reader. */
export async function buatBukuAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/masuk");

  const profile = await getProfile(session.userId, session.email);
  if (!profile) redirect("/onboarding");

  const [catalog, enrollments] = await Promise.all([
    katalogBelajar(),
    listPendaftaran(session.email),
  ]);

  const requested = String(formData.get("courseId") ?? "").trim();
  const path = bangunJalurPersonalisasi({ profile, catalog, enrollments });
  const course = requested ? catalog.find((entry) => entry.id === requested) : path.course;
  if (!course) {
    revalidatePath("/belajar/buku");
    return;
  }

  const modules = modulKursus(course);
  if (modules.length === 0) {
    revalidatePath("/belajar/buku");
    return;
  }

  const depth = parseDepth(formData.get("depth"));
  const intent = String(formData.get("intent") ?? "").trim().slice(0, 400);

  const book = await createBookRecord({
    owner: session.email,
    title: `Buku: ${course.title}`,
    description: `Buku belajar yang disusun dari ${course.title} (${course.provider}).`,
    depth,
    courseId: course.id,
    courseSlug: course.slug,
  });

  // The port decides: a key means the real compiler, no key means the stub.
  // Both produce a complete, readable book.
  const compiler = hasLlm() ? new GeminiBookCompiler() : new StubBookCompiler();
  const result = await compiler.compile({
    book,
    course,
    modules,
    ...(intent ? { intent } : {}),
    profile,
  });

  await saveCompiledBook({
    book,
    spine: result.spine,
    pages: result.pages,
    compiledBy: result.compiledBy,
  });

  redirect(`/belajar/buku/${book.id}`);
}

export async function hapusBukuAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/masuk");

  const bookId = String(formData.get("bookId") ?? "");
  if (bookId.length === 0) return;
  await deleteBook(session.email, bookId);
  revalidatePath("/belajar/buku");
  redirect("/belajar/buku");
}
