import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    // Small client screens initialize from sessionStorage and API requests in effects.
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
]);
