import { defineConfig } from "eslint/config";

/** @type {import("eslint").Linter.Config[]} */
const config = defineConfig([
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);

export default config;
