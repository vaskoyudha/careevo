/**
 * Permukaan `@/lib/workspace` untuk konsumen **server** — barrel.
 *
 * ## Komponen klien mengimpor `./port`, bukan barrel ini
 *
 * `./proses-manajer` membaca `CAREEVO_WORKSPACE_SECRET` dan tidak boleh masuk
 * bundel peramban. Karena barrel ini mengekspornya, mengimpor `@/lib/workspace`
 * dari komponen klien menarik rahasia itu ke sisi peramban — persis alasan yang
 * sama dengan `@/lib/exec/index.ts`.
 */

export type {
  KeadaanWorkspace,
  MintaWorkspace,
  NadaWorkspace,
  PetakanWorkspace,
  PortWorkspace,
  StatusWorkspace,
} from "./port";
export { petakanWorkspace } from "./port";
export { ProsesManajer, prosesManajer } from "./proses-manajer";
