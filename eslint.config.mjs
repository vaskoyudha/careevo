import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "mockup/**",
    // Artefak operasional — bukan kode aplikasi. Tanpa ini `eslint` (tanpa
    // argumen, dipakai `npm run lint`) menyapu build worktree subagent dan
    // scratch plugin Remember, sehingga gerbang lint menjadi tidak terbaca.
    ".claude/**",
    ".remember/**",
  ]),
]);

export default eslintConfig;
