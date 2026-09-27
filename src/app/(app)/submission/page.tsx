import { redirect } from "next/navigation";

/**
 * Rute lama `/submission` — kini surface submission hidup di dalam course
 * (`/belajar/[slug]/karya`). Arahkan ke `/progres`, daftar semua kursus yang
 * diambil, tempat peserta memilih course untuk membuka Project-nya.
 */
export default function SubmissionIndexPage() {
  redirect("/progres");
}
