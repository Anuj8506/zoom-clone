import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  globalIgnores(["test-results/**", "playwright-report/**"]),
  {
    // Small client screens initialize from sessionStorage and API requests in effects.
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
]);
