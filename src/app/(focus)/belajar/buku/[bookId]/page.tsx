import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isValidSessionId } from "@/lib/ids";
import { getBook } from "@/lib/book/store";
import { BookReader } from "@/components/features/book/book-reader";

export const metadata: Metadata = { title: "Buku" };

export default async function BookPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const { bookId } = await params;
  if (!isValidSessionId(bookId)) notFound();

  // A well-formed id that is absent, or owned by someone else, is a 404.
  const bundle = await getBook(session.email, bookId);
  if (!bundle) notFound();

  return <BookReader bundle={bundle} />;
}
