/**
 * Permukaan `@/lib/exec` untuk konsumen **server** — barrel.
 *
 * ## Komponen klien mengimpor `./port`, bukan barrel ini
 *
 * `./proses-lokal` membaca `CAREEVO_RUNNER_SECRET` dan tidak boleh masuk bundel
 * peramban. Karena barrel ini mengekspornya, mengimpor `@/lib/exec` dari
 * komponen klien menarik rahasia itu ke sisi peramban. Komponen klien yang butuh
 * `StatusJalankan`, `PetakanStatus`, atau `petakanStatus` mengimpornya langsung
 * dari `@/lib/exec/port`, yang murni.
 *
 * Keberadaan barrel ini justru alasan kedua nama itu penting: `port` (kontrak
 * dan bahasa) terpisah dari `proses-lokal` (transport), dan hanya nama-nama
 * server yang dikumpulkan di sini.
 */

export type {
  HasilJalankan,
  MintaJalankan,
  NadaJalankan,
  PetakanStatus,
  PortJalankan,
  StatusJalankan,
} from "./port";
export { hasilGagal, petakanStatus } from "./port";
export { ProsesLokal, prosesLokal } from "./proses-lokal";
