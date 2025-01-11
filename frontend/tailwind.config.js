/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme");

const containerScreens = Object.assign({}, defaultTheme.screens);
delete containerScreens["2xl"];

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    screens: {
      xs: "475px",
      ...defaultTheme.screens,
    },
    container: {
      center: true,
      screens: containerScreens,
    },
    extend: {
      fontFamily: {
        sans: ["Inter var", "Inter", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        primary: {
          50: "#eef8f2",
          100: "#d4ede1",
          200: "#b2ddc9",
          300: "#81ceb0",
          400: "#50c79c",
          500: "#1aab7c",
          600: "#099067",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
          950: "#022c1f",
        },
        'teal': {
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#50A19E', // EA LV krāsa
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        'cyan': {
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#2D3047', // EA LV krāsa
        },
        'pink': {
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#DA1884', // EA LV krāsa
          600: '#db2777',
          700: '#be185d',
          800: '#9d174d',
          900: '#831843', 
        },
        'gray': {
          100: '#f3f4f6',
          200: '#DCCFCE', // EA LV krāsa
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280', 
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827', 
        },
        // TODO: change 4 tailwind palettes, change one of colors slightly 
        // 'ealv-teal': '#50A19E',
        // 'ealv-darkblue': '#2D3047',
        // 'ealv-pink': '#DA1884',
        // 'ealv-lightgray': '#DCCFCE',
      },
      spacing: {
        128: "32rem",
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            a: {
              "&:hover": {
                opacity: 0.7,
              },
            },
            // https://tailwindcss.com/docs/typography-plugin#adding-custom-color-themes
            "--tw-prose-links": theme("colors.primary[700]"),
            "--tw-prose-body": theme("colors.slate[700]"),
            "--tw-prose-headings": theme("colors.slate[900]"),
            "--tw-prose-lead": theme("colors.slate[600]"),
            "--tw-prose-bold": theme("colors.slate[700]"),
            "--tw-prose-counters": theme("colors.slate[500]"),
            "--tw-prose-bullets": theme("colors.slate[300]"),
            "--tw-prose-hr": theme("colors.slate[200]"),
            "--tw-prose-quotes": theme("colors.slate[900]"),
            "--tw-prose-quote-borders": theme("colors.slate[200]"),
            "--tw-prose-captions": theme("colors.slate[500]"),
            "--tw-prose-kbd": theme("colors.slate[900]"),
            "--tw-prose-code": theme("colors.slate[900]"),
            "--tw-prose-pre-code": theme("colors.slate[200]"),
            "--tw-prose-pre-bg": theme("colors.slate[800]"),
            "--tw-prose-th-borders": theme("colors.slate[300]"),
            "--tw-prose-td-borders": theme("colors.slate[200]"),
            "--tw-prose-invert-body": theme("colors.slate[300]"),
            "--tw-prose-invert-headings": theme("colors.white"),
            "--tw-prose-invert-lead": theme("colors.slate[400]"),
            "--tw-prose-invert-links": theme("colors.white"),
            "--tw-prose-invert-bold": theme("colors.white"),
            "--tw-prose-invert-counters": theme("colors.slate[400]"),
            "--tw-prose-invert-bullets": theme("colors.slate[600]"),
            "--tw-prose-invert-hr": theme("colors.slate[700]"),
            "--tw-prose-invert-quotes": theme("colors.slate[100]"),
            "--tw-prose-invert-quote-borders": theme("colors.slate[700]"),
            "--tw-prose-invert-captions": theme("colors.slate[400]"),
            "--tw-prose-invert-kbd": theme("colors.white"),
            "--tw-prose-invert-code": theme("colors.white"),
            "--tw-prose-invert-pre-code": theme("colors.slate[300]"),
            "--tw-prose-invert-pre-bg": "rgb(0 0 0 / 50%)",
            "--tw-prose-invert-th-borders": theme("colors.slate[600]"),
            "--tw-prose-invert-td-borders": theme("colors.slate[700]"),
          },
        },
        primary: {
          css: {
            "--tw-prose-headings": theme("colors.primary[700]"),
          },
        },
      }),
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
};
