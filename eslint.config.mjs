import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "app/generated/prisma/**"]),
  { rules: { "react-hooks/set-state-in-effect": "off" } },
]);
