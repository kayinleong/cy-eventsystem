import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // functions/ is a separate npm package with its own tsconfig + CommonJS
    // build output. Don't lint the compiled artifact or its node_modules from
    // the root project; the source files in functions/src/ are linted on their
    // own terms if functions/ adds its own ESLint config.
    "functions/lib/**",
    "functions/node_modules/**",
  ]),
]);

export default eslintConfig;
