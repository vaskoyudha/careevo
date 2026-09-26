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
    // SiJago: a complete second Next app (its own `app/`, package.json,
    // tailwind config, tsconfig and lint rules), derived from the DeepTutor
    // project and carrying its own licence. It is neither type-checked nor
    // linted by Careevo's config — see `features/sijago/README.md`.
    "features/sijago/**",
    // career-ops engine: vendored verbatim from the career-ops repo into
    // `engine/`. It is plain Node `.mjs` (its own lints/tests live upstream),
    // never part of the Next build graph — it is orchestrated via child_process
    // from `src/lib/career-ops/`. Linting it here would flag thousands of
    // upstream-styled lines and fight the vendored copy.
    "engine/**",
    // career-ops reference clone: the original upstream checkout kept next to
    // the vendored engine. It is not part of Careevo (it is not even committed);
    // its own `web/` app has its own lint/tsconfig rules.
    "career-ops/**",
    // Artefak operasional — bukan kode aplikasi. Tanpa ini `eslint` (tanpa
    // argumen, dipakai `npm run lint`) menyapu build worktree subagent dan
    // scratch plugin Remember, sehingga gerbang lint menjadi tidak terbaca.
    ".claude/**",
    ".remember/**",
  ]),
]);

export default eslintConfig;
