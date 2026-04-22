/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#07C160",
          50: "#E8FBF1",
          100: "#CCF5DD",
          200: "#9DECBE",
          300: "#5DE09A",
          400: "#2FD17E",
          500: "#07C160",
          600: "#06A652",
          700: "#058844",
          800: "#046935",
          900: "#034C26",
        },
        ink: {
          50: "#F8F9FA",
          100: "#F2F3F5",
          200: "#E5E7EB",
          300: "#D1D5DB",
          400: "#9CA3AF",
          500: "#6B7280",
          600: "#4B5563",
          700: "#374151",
          800: "#1F2937",
          900: "#111827",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro SC",
          "SF Pro Text",
          "PingFang SC",
          "Hiragino Sans GB",
          "Microsoft YaHei",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)",
        bubble: "0 1px 2px rgba(0,0,0,0.06)",
        nav: "0 -1px 0 rgba(0,0,0,0.06)",
      },
      borderRadius: {
        xl: "14px",
        "2xl": "18px",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 150ms ease",
        "slide-up": "slide-up 220ms cubic-bezier(0.22,1,0.36,1)",
      },
    },
  },
  plugins: [],
};
