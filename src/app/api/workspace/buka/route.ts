import { getSession } from "@/lib/auth/session";
import { batasiRequestMasuk } from "@/lib/rate-limit/next";
import { prosesManajer } from "@/lib/workspace";
import { tiketUntuk } from "@/lib/workspace/tiket";

/**
 * GET /api/workspace/buka — gerbang **sesungguhnya** ke ruang kerja.
 *
 * ## Masalah yang dipecahkan
 *
 * Ruang kerja adalah capability URL: alamatnya tidak bisa ditebak (48 bit acak),
 * tetapi alamat yang bocor tidak bisa dicabut. Route ini menambahkan lapisan di
 * depannya: sebelum peramban boleh melihat IDE, ia harus datang dengan **sesi
 * Careevo yang sah** untuk peserta yang memenuhi syarat.
 *
 * Urutannya:
 *
 * 1. **Sesi.** Ini yang menjadikan alamat itu bukan lagi satu-satunya rahasia.
 * 2. Tiket bertanda tangan dari query, diperiksa terhadap **identitas sesi**
 *    (bukan terhadap dirinya sendiri), sehingga tiket milik orang lain tidak
 *    berguna walaupun dicuri.
 * 3. Keadaan ruang kerja ditanyakan ke manajer.
 *
 * ## Kenapa **tidak** ada pemeriksaan Origin di sini
 *
 * Route mutasi di repo ini (`/api/jalankan`, `/api/workspace`) memeriksa
 * `originDiizinkan` lebih dulu, dan itu benar untuk mereka: mereka menerima
 * POST dari `fetch`, dan `fetch` selalu mengirim `Origin`. Route ini **tidak**,
 * karena ia dimuat sebagai `src` iframe — dan navigasi GET **tidak mengirim
 * `Origin`** sama sekali. Memasang pemeriksaan itu di sini akan menolak setiap
 * pemuatan yang sah dengan 403, dan `originDiizinkan` fail-closed pada Origin
 * yang absen, jadi kegagalannya menyeluruh, bukan sebagian.
 *
 * Yang menggantikan perlindungan CSRF di sini adalah sifat operasinya sendiri:
 * ini GET yang tidak mengubah apa pun. Cookie sesi `ls_session` ber-`SameSite=Lax`
 * dan **tidak** dikirim pada permintaan lintas situs, jadi situs pihak ketiga
 * tidak bisa memuat route ini dengan sesi peserta. Dan satu-satunya efeknya bila
 * berhasil adalah pengalihan ke ruang kerja milik **pemilik sesi itu sendiri** —
 * tidak ada data yang bocor ke pemanggil.
 *
 * ## Kenapa tiket, kalau sesi sudah diperiksa di sini
 *
 * Karena yang memuat IDE adalah **iframe**, dan iframe menuju origin yang
 * berbeda (port atau subdomain tersendiri). Cookie sesi Careevo tidak ikut ke
 * sana, jadi ruang kerja tidak bisa memeriksa sesi sendiri. Tiket adalah cara
 * memindahkan keputusan "peserta ini boleh" dari origin aplikasi ke origin
 * ruang kerja: ia bertanda tangan, berumur pendek, dan terikat pada satu
 * `(userId, courseId)`.
 *
 * ## Apa yang **belum** dilindungi, dan itu disebut supaya tidak terbaca selesai
 *
 * Setelah pengalihan, peramban memuat alamat ruang kerja langsung
 * (`http://127.0.0.1:<port>` di pengembangan, `https://<kunci>.ws.<domain>` di
 * produksi). Alamat itu **tidak** memeriksa tiket: yang harus memeriksanya
 * adalah reverse proxy di depan subdomain, dan **proxy itu belum ada**. Di
 * pengembangan, port-nya hanya terikat loopback sehingga hanya mesin ini yang
 * bisa menjangkaunya. Di produksi, sampai proxy itu ditulis, keamanan ruang
 * kerja bersandar pada kunci 48 bit di alamatnya — dan itu **bukan** kontrol
 * akses. Tiket dan route ini adalah setengah yang sudah selesai dari pekerjaan
 * itu, bukan keseluruhannya.
 *
 * ## Kenapa 302, bukan 200 JSON
 *
 * Route ini dipanggil sebagai `src` iframe. Kalau ia mengembalikan JSON,
 * peramban menampilkan JSON itu di dalam bingkai. Redirect membuat peramban
 * sendiri yang memuat ruang kerja, sehingga tidak ada HTML IDE yang dilewatkan
 * melalui proses Next — yang penting karena IDE memuat ratusan aset dan satu
 * koneksi WebSocket.
 */

export const dynamic = "force-dynamic";

/** Balasan galat: teks pendek, karena yang melihatnya adalah iframe. */
function galat(status: number, pesan: string): Response {
  return new Response(pesan, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function GET(request: Request): Promise<Response> {
  const sesi = await getSession();
  if (!sesi) {
    return galat(401, "Sesi tidak ditemukan. Silakan masuk terlebih dahulu.");
  }

  const batas = await batasiRequestMasuk(request, "workspace", {
    tambahan: `workspace:${sesi.email}`,
  });
  if (batas) return batas;

  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId") ?? "";
  const tiket = url.searchParams.get("tiket") ?? "";

  if (!courseId || !tiket) {
    return galat(400, "Permintaan tidak lengkap.");
  }

  // Tiket diperiksa terhadap **identitas sesi**, bukan terhadap dirinya sendiri.
  // Perbandingan itu yang membuat tiket yang dicuri dari peserta lain tidak
  // berguna: isinya menunjuk `userId` pemilik aslinya, dan itu tidak sama
  // dengan pemilik sesi ini.
  const rahasia = process.env.CAREEVO_WORKSPACE_SECRET ?? "";
  const isi = tiketUntuk(rahasia, tiket, sesi.userId, courseId);
  if (!isi) {
    return galat(403, "Tiket ruang kerja tidak berlaku. Muat ulang halaman Project.");
  }

  // Keadaan ruang kerja ditanyakan ke manajer. Route ini **tidak menyalakan**
  // apa pun: menyalakan adalah aksi eksplisit lewat `/api/workspace`, dan
  // membuat iframe yang bisa menyalakan kontainer berarti satu render halaman
  // yang membuka 2 GB memori tanpa peserta memintanya.
  //
  // `host` diteruskan supaya URL ruang kerja memakai origin yang sama dengan
  // halaman yang membukanya; manajer memvalidasinya lewat allowlist.
  const host = new URL(request.url).hostname;
  const keadaan = await prosesManajer.status({ userId: sesi.userId, courseId, host });
  if (keadaan.status !== "ok" || !keadaan.hidup || !keadaan.url) {
    return galat(409, "Ruang kerja belum siap. Buka halaman Ruang kerja lalu tekan Siapkan.");
  }

  // Alamat ruang kerja + tiket. Tiket ditaruh di **query**, bukan di header,
  // karena yang menerimanya adalah reverse proxy/ruang kerja, bukan aplikasi ini.
  const tujuan = new URL(keadaan.url);
  tujuan.searchParams.set("tiket", tiket);

  return new Response(null, {
    status: 302,
    headers: { location: tujuan.toString(), "cache-control": "no-store" },
  });
}
