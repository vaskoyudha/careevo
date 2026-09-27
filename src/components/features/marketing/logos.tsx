import {
  RiDiscordFill,
  RiDropboxFill,
  RiFigmaFill,
  RiGithubFill,
  RiGoogleFill,
  RiNotionFill,
  RiSlackFill,
  RiSupabaseFill,
  RiVercelFill,
} from "@remixicon/react";

import { Reveal } from "./primitives";

/*
  Each entry pairs a brand with its own mark, so a name is never captioned with
  someone else's logo. The list is placeholder content — the label below says
  as much ("Contoh nama mitra…") — and is meant to be replaced with real partner
  marks before this strip carries an actual claim. Swap an entry for a local
  asset with `<img>` when a partner supplies artwork; Remixicon has no mark for
  them.
*/
const LOGOS = [
  { name: "Slack", Icon: RiSlackFill },
  { name: "GitHub", Icon: RiGithubFill },
  { name: "Notion", Icon: RiNotionFill },
  { name: "Figma", Icon: RiFigmaFill },
  { name: "Vercel", Icon: RiVercelFill },
  { name: "Supabase", Icon: RiSupabaseFill },
  { name: "Google", Icon: RiGoogleFill },
  { name: "Discord", Icon: RiDiscordFill },
  { name: "Dropbox", Icon: RiDropboxFill },
];

function LogoRow({ ariaHidden = false }: { ariaHidden?: boolean }) {
  return (
    <ul
      aria-hidden={ariaHidden || undefined}
      className="flex animate-infinite-scroll items-center justify-center [&_li]:mx-5"
    >
      {LOGOS.map(({ name, Icon }) => (
        <li
          key={name}
          className="flex items-center gap-2.5 text-gray-400 transition-colors duration-200 ease-out hover:text-gray-600 motion-reduce:transition-none"
        >
          <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
          <span className="text-lg font-semibold tracking-tight whitespace-nowrap">
            {name}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function MarketingLogos() {
  return (
    <section className="relative z-10 -mt-24 pb-10 lg:-mt-28 lg:pb-20">
      {/*
        Negative top margin pulls this partner strip up into the tail of the
        wave artwork in `#agen` (guild-agents.tsx) instead of leaving it on
        flat white below the fade. The wave mask is fully transparent by 100%,
        so the overlap lands in the already-faded part of the image and keeps
        the `text-gray-700` label and logo names at their existing contrast.
        `relative` + `z-10` keep this section above the wallpaper, which sits
        at `-z-10`; the `pb-10 lg:pb-20` restores the bottom rhythm that the
        negative margin would otherwise remove.

        Keep this offset small. Raising it far enough to sit in the artwork's
        opaque band (26%-78%) puts the logo names straight across the gradient
        at the bottom of the image, which is what erases the fade — the
        gradient is still there, it just has grey text sitting on top of it.
      */}
      <Reveal className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-10 text-base text-gray-700">
            Dipercaya oleh tim yang bertumbuh
          </p>
          <div className="partner-marquee inline-flex w-full flex-nowrap overflow-hidden">
            <LogoRow />
            <LogoRow ariaHidden />
          </div>
        </div>
      </Reveal>
    </section>
  );
}
