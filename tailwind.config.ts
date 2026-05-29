import type { Config } from "tailwindcss";

// Tokens mirror Claude.ai's light-mode palette. See CLAUDE.md §6 / UIdesignspec.md §10.
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#FAF9F5",
        subtle: "#F0EEE6",
        surface: "#FFFFFF",
        hover: "#F2F0E9",
        active: "#EBE8DF",
        primary: "#262624",
        secondary: "#5C5A54",
        muted: "#82807A",
        "on-accent": "#FFFFFF",
        "on-dark": "#FAF9F5",
        border: "#E6E3DA",
        "border-strong": "#D8D4C8",
        "border-subtle": "#EFEDE4",
        accent: {
          DEFAULT: "#D97757",
          hover: "#C2603F",
          strong: "#BF5D3B",
          subtle: "#F6E9E2",
          border: "#E8C4B4",
        },
        success: { DEFAULT: "#5B8C6E", subtle: "#E7EFE8" },
        warning: { DEFAULT: "#C9912F", subtle: "#F6EDD9" },
        danger: { DEFAULT: "#BF5340", subtle: "#F4E4DF" },
        info: { DEFAULT: "#5A7A99", subtle: "#E5ECF1" },
        mastery: {
          0: "#E6E3DA",
          1: "#E8C9BC",
          2: "#EBD2A6",
          3: "#CFD9B8",
          4: "#A9C7B0",
        },
      },
      fontFamily: {
        sans: ['"Styrene A"', "ui-sans-serif", "system-ui", "-apple-system", '"Segoe UI"', '"Inter"', "Arial", "sans-serif"],
        serif: ['"Tiempos Text"', '"Source Serif 4"', "Georgia", "serif"],
        mono: ["ui-monospace", '"SF Mono"', '"JetBrains Mono"', "Menlo", "monospace"],
      },
      fontSize: {
        caption: ["12px", { lineHeight: "1.45", fontWeight: "500" }],
        small: ["13px", { lineHeight: "1.5" }],
        body: ["15px", { lineHeight: "1.55" }],
        "body-lg": ["17px", { lineHeight: "1.6" }],
        h3: ["18px", { lineHeight: "1.4", fontWeight: "600" }],
        h2: ["22px", { lineHeight: "1.3", fontWeight: "600" }],
        h1: ["28px", { lineHeight: "1.25", fontWeight: "600" }],
        display: ["36px", { lineHeight: "1.15", fontWeight: "500" }],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
        xl: "24px",
        full: "9999px",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(40,38,36,0.04)",
        sm: "0 1px 3px rgba(40,38,36,0.06), 0 1px 2px rgba(40,38,36,0.04)",
        md: "0 4px 12px rgba(40,38,36,0.08)",
        lg: "0 12px 28px rgba(40,38,36,0.12)",
      },
      ringColor: { focus: "rgba(217,119,87,0.35)" },
      maxWidth: { read: "72ch", shell: "1200px", column: "720px" },
    },
  },
  plugins: [],
};

export default config;
