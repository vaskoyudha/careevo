import Link from "next/link";
import {
  BadgeCheck,
  Bug,
  CalendarClock,
  ClipboardCheck,
  Code2,
  Cpu,
  Database,
  GitBranch,
  Layers,
  MessagesSquare,
  ScanSearch,
  ShieldCheck,
  Terminal,
  Workflow,
} from "lucide-react";
import { Reveal } from "./primitives";

const ROW_ONE = [CalendarClock, Code2, MessagesSquare, ClipboardCheck, ShieldCheck, BadgeCheck, ScanSearch];
const ROW_TWO = [Workflow, GitBranch, Database, Terminal, Layers, Bug, Cpu];

function Tile({
  icon: Icon,
  faded = false,
}: {
  icon?: React.ElementType;
  faded?: boolean;
}) {
  return (
    <div
      className={`inline-flex size-14 items-center justify-center rounded-lg border border-gray-200 bg-white lg:size-18 ${
        faded ? "opacity-40" : ""
      }`}
    >
      {Icon ? (
        <Icon className="h-7 w-7 text-gray-700 lg:h-10 lg:w-10" strokeWidth={1.5} />
      ) : null}
    </div>
  );
}

export function MarketingIntegrations() {
  return (
    <section
      id="loop"
      className="relative bg-white pt-10 pb-10 lg:pt-28 lg:pb-20"
    >

      <div className="relative z-30 mx-auto max-w-7xl px-6">
        <div className="mx-auto mb-8 max-w-2xl text-center lg:mb-16">
          <Reveal>
            <h2 className="mb-3 text-3xl font-medium -tracking-[1.9px] text-gray-900 lg:mb-4 lg:text-6xl">
              Satu alur terarah dari belajar sampai dapat kerja
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="text-sm text-gray-500 lg:text-base">
              Jadwal belajar, bimbingan Sokratik, verifikasi bukti kerja, hingga
              rekomendasi lowongan kerja tersambung dalam satu alur terstruktur.
            </p>
          </Reveal>
        </div>

        <Reveal delay={120}>
          <div className="mx-auto max-w-full space-y-4 overflow-hidden [-webkit-mask-image:linear-gradient(to_right,transparent_0,black_64px,black_calc(100%-64px),transparent_100%)] [mask-image:linear-gradient(to_right,transparent_0,black_64px,black_calc(100%-64px),transparent_100%)] lg:max-w-258 lg:space-y-6 lg:[-webkit-mask-image:linear-gradient(to_right,transparent_0,black_128px,black_calc(100%-200px),transparent_100%)] lg:[mask-image:linear-gradient(to_right,transparent_0,black_128px,black_calc(100%-200px),transparent_100%)]">
            <div className="flex flex-wrap justify-center gap-3 lg:gap-6">
              <Tile faded />
              <Tile icon={ROW_ONE[0]} />
              <Tile icon={ROW_ONE[1]} />
              <Tile icon={ROW_ONE[2]} />
              <Tile icon={ROW_ONE[3]} />
              <Tile icon={ROW_ONE[4]} />
              <Tile icon={ROW_ONE[5]} />
              <Tile icon={ROW_ONE[6]} />
              <Tile faded />
            </div>
            <div className="flex flex-wrap justify-center gap-3 lg:gap-6">
              <Tile faded />
              <Tile icon={ROW_TWO[0]} />
              <Tile icon={ROW_TWO[1]} />
              <Tile icon={ROW_TWO[2]} />
              <Tile icon={ROW_TWO[3]} />
              <Tile icon={ROW_TWO[4]} />
              <Tile icon={ROW_TWO[5]} />
              <Tile icon={ROW_TWO[6]} />
              <Tile faded />
            </div>

            <div className="text-center">
              <Link
                href="/daftar"
                className="grad-btn mt-10 inline-block rounded-lg px-4 py-2.5 text-base font-medium transition duration-300"
              >
                Mulai gratis
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
