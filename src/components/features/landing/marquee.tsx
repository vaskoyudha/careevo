const STACK = [
  "Next.js",
  "Tailwind",
  "Supabase",
  "Zod",
  "HMAC",
  "PWA",
  "Vitest",
  "Playwright",
  "Socrates",
  "Sentinel",
  "Navigator",
  "Trusted Web",
];

export function Marquee() {
  const track = [...STACK, ...STACK];

  return (
    <section className="ax-section ax-marquee-section" aria-label="Stack dan agen">
      <p className="ax-label">Dibangun dengan · diverifikasi bersama</p>
      <div className="ax-marquee" aria-hidden="true">
        <div className="ax-marquee-track">
          {track.map((item, index) => (
            <span key={`${item}-${index}`}>{item}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
