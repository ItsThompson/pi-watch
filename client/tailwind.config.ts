import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page: "#161d26",
        container: "#0f1b2a",
        divider: "#2a2f38",
        primary: "#d1d5db",
        muted: "#6b7280",
        activity: {
          idle: "#2ea043",
          processing: "#d29922",
          running: "#58a6ff",
          pending: "#f85149",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
