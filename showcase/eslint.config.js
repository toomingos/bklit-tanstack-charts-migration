import { defineConfig } from "eslint/config";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import pluginNext from "@next/eslint-plugin-next";
import pluginReactHooks from "eslint-plugin-react-hooks";

/** @type {import("eslint").Linter.Config[]} */
const config = defineConfig(
  {
    // Vendored reference clones (repos/), Next build output (.next/), and the
    // auto-generated next-env.d.ts are not part of the showcase lint gate.
    ignores: ["repos/**", ".next/**", "next-env.d.ts"],
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "@next/next": pluginNext,
    },
    rules: {
      ...pluginNext.configs.recommended.rules,
      ...pluginNext.configs["core-web-vitals"].rules,
    },
  },
  {
    plugins: {
      "react-hooks": pluginReactHooks,
    },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
);

export default config;
