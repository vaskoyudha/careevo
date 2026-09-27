/**
 * Kontrak deep-link "Tutor AI" — **murni**, tanpa IO.
 *
 * Dipisah dari `components/features/learning/kursus-ai-panel.tsx` dan
 * `app/(app)/ai-mastery/page.tsx` karena keduanya `.tsx`, dan vitest di repo ini
 * hanya mengimpor `.test.ts` pada environment `node` — logika yang di dalam
 * komponen tidak bisa diuji sama sekali. URL yang dibangun di sini adalah bagian
 * paling rawan dari fitur itu (encoding id, id yang hilang), jadi ia harus punya
 * test sendiri. Lihat `tutor-ai.test.ts`.
 *
 * Bentuk parameternya bukan ciutan Careevo: AI Mastery (aplik DeepTutor yang
 * di-frame di `/ai-mastery`) sudah membaca `?course=<id>&capability=course_study`
 * untuk mengikat state kursus sebelum giliran model pertama. Kontrak yang sama
 * dipakai `CourseNextStep` dan `lib/course-handoff.ts` di dalam aplikasi itu.
 * Careevo hanya meneruskannya.
 */

/**
 * Capability yang membaca state kursus (silabus, jalur mastery, bank soal,
 * posisi baca) sebelum giliran pertama.
 *
 * Nilainya bukan pilihan sampla: di backend, `course_study` hanya aktif bila
 * capability ini **dan** id kursus tervalidasi terikat ke giliran itu
 * (`deeptutor/capabilities/course_study/capability.py`, `is_active`).
 */
export const KAPABILITAS_COURSE_STUDY = "course_study";

/** Route Careevo yang meng-frame AI Mastery. */
const RUTE_AI_MASTERY = "/ai-mastery";

/**
 * Link ke tutor AI untuk satu kursus.
 *
 * Id kursus **di-encode**. `courses.id` adalah `text` di database, bukan uuid,
 * jadi ia boleh memuat `&`, `?`, atau spasi; menempelkannya mentah membuat
 * `?course=a&b` terpecah jadi dua parameter dan kursus yang tiba di AI Mastery
 * bukan kursus yang diklik.
 *
 * Id kosong/whitespace jatuh ke route polos, bukan `?course=&capability=…`.
 * Kegagalan di sini tidak boleh menjadi link yang secara diam-diam berarti
 * sesuatu yang lain — id yang tidak ada adalah data yang hilang, bukan data
 * yang salah.
 */
export function tautanTutorAi(
  courseId: string,
  capability: string = KAPABILITAS_COURSE_STUDY,
): string {
  const id = courseId.trim();
  if (!id) return RUTE_AI_MASTERY;

  const url = new URL(RUTE_AI_MASTERY, "http://careevo.invalid");
  url.searchParams.set("course", id);
  if (capability) url.searchParams.set("capability", capability);
  return `${url.pathname}${url.search}`;
}

/**
 * URL frame untuk aplikasi AI Mastery, dari query yang datang di `/ai-mastery`.
 *
 * Tanpa query hasilnya persis `baseUrl` — navbar (`chrome.tsx`,
 * `chrome-parts.tsx`) dan `mastery-topic-view.tsx` menautkan `/ai-mastery`
 * polos, dan menempelkan `?` kosong pada ketiganya mengubah perilaku pemanggil
 * yang tidak ikut disentuh.
 *
 * `baseUrl` tidak valid dilempar, bukan diteruskan: `AI_MASTERY_WEB_URL` salah
 * konfigurasi harus gagal saat render, bukan memuat frame yang diam-diam kosong.
 */
export function urlFrameAiMastery(
  baseUrl: string,
  query: { course?: string | null; capability?: string | null },
): string {
  const course = query.course?.trim();
  const capability = query.capability?.trim();

  // `baseUrl` dikembalikan apa adanya saat tidak ada yang ditambahkan.
  // `new URL("http://localhost:3790").toString()` menambah garis miring
  // belakang, jadi menormalkan selalu mengubah `src` untuk tiga pemanggil
  // yang tidak ikut disentuh — navbar dan halaman mastery.
  if (!course && !capability) {
    // Tetap divalidasi supaya konfigurasi rusak tidak lolos diam-diam.
    new URL(baseUrl);
    return baseUrl;
  }

  const url = new URL(baseUrl);
  if (course) url.searchParams.set("course", course);
  if (capability) url.searchParams.set("capability", capability);
  return url.toString();
}

/** Path rute chromeless AI Mastery yang dipakai drawer tutor. */
const RUTE_EMBED_TUTOR = "/embed/chat";

/**
 * URL rute embed AI Mastery untuk drawer tutor.
 *
 * Berbeda dari `urlFrameAiMastery` yang mengembalikan `baseUrl` apa adanya saat
 * tidak ada query, di sini **path-nya sendiri** yang bermakna: `/embed/chat`
 * adalah rute chromeless yang tidak mewarisi `AppShell`/sidebar. Karena itu
 * `baseUrl` polos tidak pernah menjadi hasil yang benar.
 *
 * Id kursus di-encode dengan alasan yang sama seperti `tautanTutorAi`:
 * `courses.id` adalah `text`, jadi ia boleh memuat `&` — menempelkannya mentah
 * memecah query dan kursus yang tiba bukan kursus yang diklik.
 *
 * `baseUrl` tidak valid dilempar (`new URL` melempar), mengikuti
 * `urlFrameAiMastery`: salah konfigurasi harus gagal saat render, bukan memuat
 * frame yang diam-diam kosong.
 */
export function urlFrameTutorEmbed(
  baseUrl: string,
  query: { course?: string | null; capability?: string | null },
): string {
  const course = query.course?.trim();
  const capability = query.capability?.trim();

  const url = new URL(RUTE_EMBED_TUTOR, baseUrl);
  if (course) url.searchParams.set("course", course);
  if (capability) url.searchParams.set("capability", capability);
  return url.toString();
}
