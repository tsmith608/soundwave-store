import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [".next/**", "node_modules/**", "storage/**", "docs/**", "scripts/_qr_discreet_render.ts"],
  },
  {
    rules: {
      // The studio intentionally runs some effects once / on selected deps (documented inline).
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
export default config;
