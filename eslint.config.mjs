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
    // Worktrees de otras sesiones (git worktree add .claude/worktrees/<id>):
    // cada uno trae su propio .next y su propio código, y no son de esta
    // rama. ".next/**" no los cubre porque el glob no matchea anidado.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
