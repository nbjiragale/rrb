import type { MetadataRoute } from "next";

// PWA manifest (L2). Installable; warm-ivory theming.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RRB NTPC Learning Platform",
    short_name: "RRB NTPC",
    description: "Spaced-repetition review, practice, and study planning.",
    start_url: "/review",
    display: "standalone",
    background_color: "#FAF9F5",
    theme_color: "#FAF9F5",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
