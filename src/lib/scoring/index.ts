export * from "./jadwal";
export * from "./karya";
export * from "./validasi";
export * from "./vts";

export function hitungSkorTotal(
  jadwal: number,
  karya: number,
  validasi: number,
): number {
  const total = jadwal + karya + validasi;
  return Math.min(100, Math.max(0, Math.round(total)));
}
