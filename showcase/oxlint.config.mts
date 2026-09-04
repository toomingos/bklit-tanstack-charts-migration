import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";
import next from "ultracite/oxlint/next";
import jsPlugins, { jsPluginSettings } from "ultracite/oxlint/js-plugins";
import antiSlop from "ultracite/oxlint/anti-slop";

// Ultracite presets + the opt-in js-plugins (react-doctor / sonarjs / github)
// and anti-slop presets. Type-aware typescript rules in core only execute when
// oxlint runs with `--type-aware` (see the `lint` script) and
// `oxlint-tsgolint` is installed.
export default defineConfig({
  extends: [core, react, next, jsPlugins, antiSlop],
  ignorePatterns: [
    ...(core.ignorePatterns ?? []),
    "repos/**",
    ".next/**",
    "next-env.d.ts",
    "app/**",
    "components/**",
    "lib/**",
    "hooks/**",
    "packages/bklit-charts/**",
    "scripts/**",
  ],
  // oxlint does not merge `settings` or `jsPlugins` from extended configs;
  // both must be declared on the root config.
  jsPlugins: jsPlugins.jsPlugins,
  settings: jsPluginSettings,
  overrides: [
    {
      // Tool config files: default exports and node imports are the API.
      files: ["*.config.{ts,mts,js,mjs}", "eslint.config.js"],
      rules: {
        "capitalized-comments": "off",
        "import/no-default-export": "off",
        "import/no-nodejs-modules": "off",
        "sort-keys": "off",
      },
    },
  ],
  rules: {
    // ── Rules ultracite turns off that apply to a render-hot chart library ──
    // ultracite defers these to react-doctor, but the native rules are
    // cheaper and catch the same allocations in render.
    "react-perf/jsx-no-jsx-as-prop": "error",
    "react-perf/jsx-no-new-array-as-prop": "error",
    "react-perf/jsx-no-new-function-as-prop": "error",
    "react/no-array-index-key": "error",
    "oxc/no-map-spread": "error",
    "unicorn/explicit-length-check": "error",
    "max-depth": "error",
    "no-console": "error",
    // Size / readability limits ultracite leaves off.
    // no-magic-numbers: 0/1/2/-1 are identity/step/sign values, not magic —
    // naming them (`const ZERO = 0`) makes chart geometry worse, not better.
    // Everything else (durations, radii, easing coefficients, percentages)
    // must be a named constant.
    "no-magic-numbers": [
      "error",
      {
        detectObjects: false,
        enforceConst: true,
        ignore: [-1, 0, 1, 2],
        ignoreArrayIndexes: true,
        ignoreDefaultValues: true,
      },
    ],
    // id-length: x/y are the coordinate vocabulary of every chart primitive and
    // i/j are loop indices; renaming them obscures the math. All other
    // one-character names (d, v, p, s, a, b, …) are renamed in code.
    "id-length": ["error", { exceptions: ["x", "y", "i", "j"] }],
    "max-statements": "error",
    "max-lines-per-function": "error",
    // no-undefined is deliberately NOT enabled. It is an oxlint `restriction` rule
    // aimed at ES3, where the `undefined` global was reassignable; ES5 fixed that and
    // only shadowing remains. ESLint's own docs name the targeted replacement for that
    // hazard — no-global-assign + no-shadow-restricted-names, both enabled below and
    // both currently at zero. Enabling no-undefined here was a mistake: oxlint's own
    // escape hatch for it is "use null", but unicorn/no-null is on two lines down, so
    // the pair left no legal way to express absence. TypeScript (strictNullChecks,
    // noUncheckedIndexedAccess) and React both require `undefined` as a real value —
    // React's defaultProps and default parameters apply to undefined but NOT to null,
    // so the two are not interchangeable. With no-undefined on, agents invented an
    // `asUndefined()` helper that typescript/no-confusing-void-expression then flagged
    // 431 times; the rule cost ~450 findings and 537 obfuscated call sites to remove
    // ~255. Do not re-enable it.
    "no-global-assign": "error",
    "no-shadow-restricted-names": "error",
    // Same contradiction as no-undefined, one rule over: sonarjs/no-undefined-assignment's
    // entire message is "Use null instead", and unicorn/no-null (below) forbids null. Its
    // 35 hits are all legitimate — clearing mutable state (`hoveredKey = undefined`), a
    // cancelled rAF handle typed `number | undefined`, an optional field's default — and
    // "fixing" any of them means retyping the slot as `| null`, which no-null then flags.
    // unicorn/no-useless-undefined stays ON: it has a satisfiable path (drop the argument,
    // `return;` over `return undefined;`) that needs no null.
    "sonarjs/no-undefined-assignment": "off",
    "react/jsx-max-depth": "error",
    "unicorn/no-null": "error",
    "typescript/explicit-function-return-type": "error",
    // Zero current hits — enabled to keep it that way.
    "react/no-unknown-property": "error",
    "react/jsx-boolean-value": "error",
    "react/forward-ref-uses-ref": "error",
    "new-cap": "error",
    "jsx-a11y/no-autofocus": "error",
    // ultracite disables this for oxc-project/oxc#21949; re-enabled here —
    // revert if the autofix misbehaves on hex/exponent literals.
    "unicorn/number-literal-case": "error",

    // ── Remaining ultracite-off rules, enabled for this codebase ──
    "react-perf/jsx-no-new-object-as-prop": "error",
    "no-continue": "error",
    "typescript/explicit-module-boundary-types": "error",
    "react/no-multi-comp": "error",
    "react/only-export-components": "error",
    "max-params": "error",
    "unicorn/prefer-global-this": "error",
    "import/no-namespace": "error",
    "react/forbid-component-props": "error",
    "import/no-default-export": "error",
    "unicorn/no-array-callback-reference": "error",
    "no-implicit-coercion": "error",
    "import/no-unassigned-import": "error",
    "unicorn/max-nested-calls": "error",
    "no-underscore-dangle": "error",
    "unicorn/prefer-string-raw": "error",
    "max-lines": "error",
    "init-declarations": "error",
    "capitalized-comments": "error",
    "no-restricted-properties": "error",
    "typescript/explicit-member-accessibility": "error",
    "typescript/prefer-readonly-parameter-types": "error",
    "typescript/require-await": "error",
    "promise/always-return": "error",
    "promise/catch-or-return": "error",
    "import/max-dependencies": "error",
    "import/no-relative-parent-imports": "error",
    "import/exports-last": "error",
    "import/group-exports": "error",
    "jsdoc/require-param": "error",
    "jsdoc/require-param-type": "error",
    "jsdoc/require-returns": "error",
    "jsdoc/require-returns-type": "error",
    "react/jsx-props-no-spreading": "error",
    "react/jsx-no-literals": "error",
    "node/no-sync": "error",
    // js-plugins preset rules ultracite leaves off (non-conflicting ones only;
    // github/no-dataset, sonarjs/cyclomatic-complexity and
    // sonarjs/shorthand-property-grouping conflict with rules already on).
    "github/unescaped-html-literal": "error",
    "sonarjs/nested-control-flow": "error",
    "sonarjs/elseif-without-else": "error",
    "sonarjs/max-lines": "error",
    "sonarjs/max-lines-per-function": "error",

    // ── ESM / browser-only regression guards (0 hits today) ──
    "import/no-commonjs": "error",
    "import/no-dynamic-require": "error",
    "typescript/no-require-imports": "error",
    "typescript/no-var-requires": "error",
    "import/no-nodejs-modules": "error",
    "import/unambiguous": "error",
    "node/no-top-level-await": "error",
    "unicorn/no-process-exit": "error",
    "node/no-process-env": "error",

    // ── Nursery rules (0 hits today; may be renamed on oxlint upgrades) ──
    "no-useless-assignment": "error",
    "import/export": "error",
    "import/named": "error",
    "promise/no-return-in-finally": "error",
    "react/require-render-return": "error",
    "unicorn/no-useless-iterator-to-array": "error",
    // Type-aware nursery — only run under `--type-aware`.
    "typescript/no-unnecessary-condition": "error",
    "typescript/prefer-optional-chain": "error",

    // ── JS-plugin bridge rules ultracite disables ──
    // no-implicit-buggy-globals: 0 hits here, enabled.
    // no-reference-error: the bridge provides no globals, so every DOM type
    // (SVGSVGElement, window, …) is flagged — 289 false positives. Kept off.
    // no-implicit-dependencies: no manifest resolution, flags the
    // @showcase/* workspace imports. Kept off.
    "github/no-implicit-buggy-globals": "error",
    // no-runtime-typeof asks you to "parse input at its I/O boundary, then branch on the
    // domain value". Left at its default (allowInTypeGuards: false) it bans `typeof`
    // everywhere including inside the parser it is asking for, which makes it unsatisfiable
    // next to typescript/no-unsafe-type-assertion: this library's I/O boundary is untyped
    // React children props, so the only alternatives are runtime validation or an unsafe
    // cast, and that rule forbids the cast. The rule ships its own escape hatch for exactly
    // this — `allowInTypeGuards` permits `typeof` inside a function returning a type
    // predicate (`(v: unknown): v is T`). Enabling it keeps the rule's real intent (validate
    // once, in a named guard) while removing the contradiction. It clears nothing on its own;
    // the remaining hits are inline checks that still need extracting into guards.
    "anti-slop/no-runtime-typeof": ["error", { allowInTypeGuards: true }],

    // React Compiler is NOT enabled (no `experimental.reactCompiler` in
    // next.config.mjs), so nothing caches these values automatically. The
    // useMemo/useCallback calls here are deliberate and benchmark-validated —
    // removing them regresses the render timings this migration exists to
    // improve. Re-enable this rule if/when the compiler is turned on.
    "react-doctor/react-compiler-no-manual-memoization": "off",

    // JSX must live in .tsx, and .tsx without JSX should be .ts.
    "react/jsx-filename-extension": [
      "error",
      { allow: "as-needed", extensions: ["tsx"] },
    ],

    // Deliberately OFF (contradict rules above or redundant with tsc):
    // no-ternary, sort-imports (oxfmt sorts), react/react-in-jsx-scope,
    // no-undef, no-restricted-exports, import/no-named-export,
    // import/prefer-default-export, oxc/no-optional-chaining,
    // oxc/no-rest-spread-properties, oxc/no-async-await,
    // unicorn/prefer-top-level-await, github/no-dataset,
    // sonarjs/cyclomatic-complexity, sonarjs/shorthand-property-grouping.
  },
});
