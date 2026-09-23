import { AxInner, AxLabel, AxSection } from "@/components/ui/section";

const TRACKS = [
  {
    name: "Web Dev",
    test: "IDE-lite: Monaco + preview + test otomatis",
    verify: "Playwright + Lighthouse + diff + snapshot + Socrates",
    status: "Ya (demo)",
  },
  {
    name: "Data",
    test: "Notebook-kit: CSV kotor + tugas clean/chart/insight",
    verify: "Evaluation script + video explain 3 menit",
    status: "Visi",
  },
  {
    name: "Game Dev",
    test: "Build-kit: template WebGL, ubah 1 mekanik",
    verify: "Build jalan + checklist + video playtest",
    status: "Visi",
  },
  {
    name: "Cyber Sec",
    test: "Lab-kit CTF: flag varian baru + writeup",
    verify: "Flag benar + writeup konsisten + waktu",
    status: "Visi",
  },
];

export function TrackCs() {
  return (
    <AxSection labelledBy="track-title">
      <AxInner wide>
        <AxLabel>Track CS</AxLabel>
        <h2 id="track-title" className="ax-h2">
          Empat track, satu standar bukti
        </h2>
        <p className="ax-lead">
          Web Development jadi demo MVP; tiga track lain masuk peta visi.
        </p>
        <div className="table-wrap" style={{ marginTop: "1.5rem" }}>
          <table className="map-table ax-table">
            <caption className="sr-only">
              Track Computer Science dan bentuk verifikasinya di Careevo
            </caption>
            <thead>
              <tr>
                <th scope="col">Track</th>
                <th scope="col">Bentuk Uji</th>
                <th scope="col">Verifikasi</th>
                <th scope="col">Status MVP</th>
              </tr>
            </thead>
            <tbody>
              {TRACKS.map((track) => (
                <tr key={track.name}>
                  <td>{track.name}</td>
                  <td>{track.test}</td>
                  <td>{track.verify}</td>
                  <td>{track.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AxInner>
    </AxSection>
  );
}
