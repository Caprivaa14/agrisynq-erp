import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        // ── Brand: Deep Navy (Sidebar, High-contrast UI)
        navy: {
          50:  "#f0f4f8",
          100: "#d9e2ec",
          200: "#bcccdc",
          300: "#9fb3c8",
          400: "#829ab1",
          500: "#627d98",
          600: "#486581",
          700: "#334e68",
          800: "#243b53",
          900: "#1B2A4A",   // PRIMARY SIDEBAR BG
          950: "#0F172A",   // DEEPEST NAVY
        },
        // ── Brand: Leaf Green (Primary actions, positive states)
        leaf: {
          50:  "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",   // PRIMARY CTA
          700: "#15803d",   // HOVER
          800: "#166534",
          900: "#14532d",
        },
        // ── Brand: Harvest Gold (Highlights, financial metrics, warnings)
        gold: {
          50:  "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",   // PRIMARY GOLD
          600: "#d97706",   // DEEPER GOLD
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
        },
        // ── Surface: Premium Light backgrounds
        surface: {
          bg:     "#F8FAFC",   // Main app canvas
          card:   "#FFFFFF",   // Cards, panels
          subtle: "#F1F5F9",   // Secondary surface
          border: "#E2E8F0",   // Dividers, borders
          hover:  "#EEF2FF",   // Row hover
        },
        // ── Typography
        ink: {
          DEFAULT: "#0F172A",  // Primary text
          muted:   "#475569",  // Secondary text (slate-600)
          faint:   "#94A3B8",  // Disabled, placeholders
        },
        // ── Status colours
        danger: {
          50:  "#fef2f2",
          100: "#fee2e2",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
        },
        warning: {
          50:  "#fffbeb",
          100: "#fef3c7",
          500: "#f59e0b",
          600: "#d97706",
        },
        success: {
          50:  "#f0fdf4",
          100: "#dcfce7",
          500: "#22c55e",
          600: "#16a34a",
        },
        info: {
          50:  "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563eb",
        },
      },
      boxShadow: {
        card:   "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
        panel:  "0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)",
        modal:  "0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.08)",
        input:  "0 1px 2px 0 rgb(0 0 0 / 0.05)",
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        sm: "0.375rem",
        md: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
      },
      spacing: {
        sidebar: "256px",
        topbar:  "60px",
      },
      fontSize: {
        "2xs": ["0.65rem", { lineHeight: "1rem" }],
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "slide-in-left": {
          from: { transform: "translateX(-100%)" },
          to:   { transform: "translateX(0)" },
        },
        "slide-down": {
          from: { transform: "translateY(-4px)", opacity: "0" },
          to:   { transform: "translateY(0)",    opacity: "1" },
        },
      },
      animation: {
        "fade-in":      "fade-in 0.2s ease-out",
        "slide-in-left":"slide-in-left 0.25s ease-out",
        "slide-down":   "slide-down 0.15s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
