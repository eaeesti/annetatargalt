import nextPlugin from "eslint-config-next";

const config = [
  {
    ignores: [".next/**", "node_modules/**", "out/**"],
  },
  ...nextPlugin,
];

export default config;
