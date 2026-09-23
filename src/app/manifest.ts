import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Careevo — Learn. Verify. Earn.",
    short_name: "Careevo",
    description:
      "Jembatan dari course ke pekerjaan pertama: proses belajar terekam, badge HMAC, dan loker teraudit.",
    start_url: "/",
    display: "standalone",
    background_color: "#ECF3F7",
    theme_color: "#0A3D62",
    lang: "id",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
