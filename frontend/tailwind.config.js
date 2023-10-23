/** @type {import('tailwindcss').Config} */
const colors = require("tailwindcss/colors");
const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    screens: {
      xs: "475px",
      ...defaultTheme.screens,
    },
    extend: {
      fontFamily: {
        sans: ["Inter var", "Inter", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        primary: colors.emerald,
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
