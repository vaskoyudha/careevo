import { AxInner, AxLabel, AxSection } from "@/components/ui/section";

const MAPPING = [
  {
    theme: "Trusted Web",
    impl: "Attestation HMAC lintas bahasa; audit append-only publik",
    proof: "Halaman Audit: siapa pun dapat verify",
  },
  {
    theme: "Anti-fraud",
    impl: "Nonce tunggal + chain hash per entry; Sentinel karantina loker",
    proof: "Simulasi tamper → chain FAIL",
  },
  {
    theme: "Privacy-by-design",
    impl: "Zero-PII; sesi terverifikasi, kamera dirancang terbatas dan belum aktif, tanpa deteksi identitas",
    proof: "Tidak ada modul fingerprint/face",
  },
  {
    theme: "Resilient infra",
    impl: "PWA offline-first dengan cache lokal",
    proof: "Demo offline Playwright",
  },
  {
    theme: "Accountable AI",
    impl: "Navigator · Socrates · Sentinel; setiap keputusan ditandatangani",
    proof: "Agent log ter-commit ke audit chain",
  },
];

const SDG = [
  {
    num: "8.6",
    title: "SDG 8.6 · Pemuda NEET",
    body:
      "Menurunkan proporsi muda tanpa kerja, pendidikan, atau pelatihan lewat jembatan terverifikasi course ke kerja pertama.",
  },
  {
    num: "4.4",
    title: "SDG 4.4 · Keterampilan Kerja",
    body:
      "Socrates dan rubrik memaksa pemahaman aktif, bukan cognitive debt, sehingga keterampilan kerja relevan terbukti.",
  },
  {
    num: "16.4",
    title: "SDG 16.4 · Anti-kejahatan Finansial",
    body:
      "Sentinel dan filter no-fee memutus loker palsu serta aliran dana scam yang menyasar pencari kerja muda.",
  },
];

export function ThemeSdg() {
  return (
    <AxSection id="verifikasi" labelledBy="theme-title">
      <AxInner wide>
        <AxLabel>NextGen Secure → fitur</AxLabel>
        <h2 id="theme-title" className="ax-h2">
          Kesesuaian tema &amp; SDG
        </h2>
        <div className="table-wrap" style={{ marginTop: "1.5rem" }}>
          <table className="map-table ax-table">
            <caption className="sr-only">
              Pemetaan subtema NextGen Secure ke fitur Careevo
            </caption>
            <thead>
              <tr>
                <th scope="col">Subtema</th>
                <th scope="col">Implementasi</th>
                <th scope="col">Bukti verifikasi</th>
              </tr>
            </thead>
            <tbody>
              {MAPPING.map((row) => (
                <tr key={row.theme}>
                  <td>{row.theme}</td>
                  <td>{row.impl}</td>
                  <td>{row.proof}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ax-sdg">
          {SDG.map((item) => (
            <div className="ax-sdg-item" key={item.num}>
              <span className="ax-sdg-num">{item.num}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </AxInner>
    </AxSection>
  );
}
