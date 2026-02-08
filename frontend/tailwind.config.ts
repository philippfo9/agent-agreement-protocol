import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic shell colors (switch with theme via CSS vars)
        shell: {
          DEFAULT: "var(--shell-bg)",
          fg: "var(--shell-fg)",
          heading: "var(--shell-heading)",
          muted: "var(--shell-muted)",
          dim: "var(--shell-dim)",
          border: "var(--shell-border)",
          "border-strong": "var(--shell-border-strong)",
          hover: "var(--shell-hover)",
          "hover-strong": "var(--shell-hover-strong)",
          skeleton: "var(--shell-skeleton)",
        },
        card: {
          DEFAULT: "var(--card-bg)",
          border: "var(--card-border)",
        },
        input: {
          DEFAULT: "var(--input-bg)",
          border: "var(--input-border)",
          text: "var(--input-text)",
        },
        divider: "var(--divider)",
        "step-color": "var(--step-color)",
        // Static colors
        document: {
          DEFAULT: "#fafafa",
          border: "#e5e5e5",
        },
        accent: {
          DEFAULT: "#8b5cf6",
          hover: "#7c3aed",
          muted: "rgba(139, 92, 246, 0.1)",
        },
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
      },
      boxShadow: {
        document: "var(--doc-shadow)",
        "document-hover": "var(--doc-shadow-hover)",
        card: "0 2px 12px rgba(0, 0, 0, 0.3)",
      },
    },
  },
  plugins: [],
};
export default config;
