import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      "no-empty-pattern": "off",
    },
  },
  {
    files: ["types.d.ts"],
    rules: {
      "no-var": "off",
    },
  },
  {
    files: ["src/content/recorder.ts"],
    rules: {
      "no-var": "off",
    },
  },
);
