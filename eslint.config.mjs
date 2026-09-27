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
    // DeepTutor backend: vendored upstream app (git-tracked, 1k+ TS files) kept
    // in `backend/`. Its own web app has its own eslint/tsconfig rules and is
    // never part of the Careevo build graph; linting it here floods
    // `npm run lint` with upstream errors and drowns the Careevo signal.
    "backend/**",
    // career-ops engine: vendored verbatim from the career-ops repo into
    // `engine/`. It is plain Node `.mjs` (its own lints/tests live upstream),
    // never part of the Next build graph — it is orchestrated via child_process
    // from `src/lib/career-ops/`. Linting it here would flag thousands of
    // upstream-styled lines and fight the vendored copy.
    "engine/**",
    // careevo runner: layanan eksekusi C++. Proses Node `.mjs` terpisah yang
    // menjalankan podman, diorkestrasi dari route handler lewat HTTP dan
    // karena itu di luar build graph Next. Aturannya milik Node, bukan aturan
    // browser, jadi `nextTs` akan menilai kode Node dengan kriteria klien.
    // Cara yang sama seperti `engine/**` di atas.
    "src/lib/exec/runner/**",
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
