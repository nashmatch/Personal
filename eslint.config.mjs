import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // This app fetches on mount and setState()s the result in .then() —
      // the standard client-side data-fetching pattern. The newer
      // react-hooks rule flags that idiom as if it were a render-loop bug.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated Cloudflare build output:
    ".open-next/**",
    ".wrangler/**",
  ]),
]);

export default eslintConfig;
