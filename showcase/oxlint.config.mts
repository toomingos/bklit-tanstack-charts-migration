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
  jsPlugins: [...jsPlugins.jsPlugins, "./oxlint-plugins/comments.js"],
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
    // Size/complexity thresholds below are raised off their stock defaults. The defaults
    // (max-lines 300, max-statements 10, max-lines-per-function 50, complexity 20,
    // max-dependencies 10) describe ordinary application code; a chart entry point is a single
    // large render body that composes scales, motion, focus and tooltip plumbing, and splitting
    // one to reach 300 lines moves render-time work across component boundaries and risks the
    // element identity and animation behaviour this migration exists to preserve. Values are set
    // above the domain-normal bulk and below the genuine outliers, so each still flags a real
    // extraction candidate rather than the whole chart directory.
    "max-statements": ["error", { max: 50 }],
    "max-lines-per-function": ["error", { max: 400 }],
    complexity: ["error", { max: 40 }],
    // react-doctor/no-giant-component hardcodes 300 lines and accepts no options, duplicating
    // max-lines-per-function above at a threshold that cannot be tuned for this domain.
    "react-doctor/no-giant-component": "off",
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
    // prefer-named-capture-group is OFF: tsconfig targets ES2017 and named groups are ES2018,
    // so every one of its 8 hits is a TS1503 compile error if "fixed". Re-enable together with a
    // target bump, not before.
    "prefer-named-capture-group": "off",
    // react/todo is OFF: these are React Compiler "not yet implemented" notices about its own
    // lowering (object getters/setters, `??=`, reorderable binary expressions), not defects in
    // this code, and the compiler is not enabled here (see react-compiler-no-manual-memoization).
    "react/todo": "off",
    "react/jsx-max-depth": ["error", { max: 5 }],
    // unicorn/no-null is OFF: it contradicts the library this codebase exists to migrate to.
    // TanStack Charts 0.15.0 prescribes null. Its channel types are
    // `Channel<TDatum, ChartValue | null | undefined>` (436 `| null` in the shipped .d.ts), and
    // the docs are explicit: "Use null or undefined for missing observations to ensure lines and
    // areas correctly represent gaps", "a null group indicates an ungrouped state", and "model
    // missing observations as null or undefined rather than zero". The 297 hits were the library's
    // own vocabulary — `scales: { x: null, y: null }`, `setControlledFocus(null)`, `onHover(null)`
    // — plus React's render-nothing contract (`return null`). Rewriting them to undefined would
    // migrate away from TanStack's documented data model, which is the opposite of the goal.
    // This also closes the contradiction noted above no-undefined and no-undefined-assignment:
    // with no-null off, `undefined` and `null` can each be used where the API asks for them.
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
    "max-params": ["error", { max: 5 }],
    "unicorn/prefer-global-this": "error",
    "import/no-namespace": "error",
    "react/forbid-component-props": "error",
    "import/no-default-export": "error",
    "unicorn/no-array-callback-reference": "error",
    "no-implicit-coercion": "error",
    // Side-effect stylesheet imports are how Vite loads chart CSS; there is nothing to assign.
    "import/no-unassigned-import": ["error", { allow: ["**/*.css"] }],
    "unicorn/max-nested-calls": "error",
    "no-underscore-dangle": "error",
    "unicorn/prefer-string-raw": "error",
    "max-lines": ["error", { max: 1200 }],
    "init-declarations": "error",
    "capitalized-comments": "error",
    // Local plugin (oxlint-plugins/comments.js). Long prose blocks here have consistently drifted
    // out of date with the code they describe, and a comment needing a paragraph usually means the
    // code below it should be clearer. JSDoc is exempt: the jsdoc/require-* rules below mandate it.
    "comments/max-lines": ["error", { max: 2 }],
    "no-restricted-properties": "error",
    "typescript/explicit-member-accessibility": "error",
    // prefer-readonly-parameter-types is OFF. It does not ask for readonly data types, it asks
    // for a transitively readonly program: a parameter still fires when any type reachable from
    // it has a mutable member, so a type cannot be converted without converting every signature
    // that receives it in the same change.
    // Measured over three codemods here: 1685 interface members made readonly cleared 49
    // findings, 70 `{ current: T }` annotations rewritten to RefObject<T> cleared 26, and of 222
    // array member types converted to `readonly T[]` only 73 survived -- 149 had to be reverted
    // because tsc rejected the readonly array flowing into a still-mutable parameter -- clearing
    // 10. That readonly work is kept; it is the real immutability this rule was pointing at.
    // What remained was 709 findings, 62% of everything left in this directory. 385 of them were
    // already wrapped in Readonly<> and fired anyway; 125 root in TanStack's own exported types
    // (ChartPoint, ChartMark, ChartRendererRenderContext, ChartTooltipBodyRenderContext), which
    // this repo cannot make deeply readonly; the rest root in React's mutable escape hatches --
    // refs, state setters, event handlers -- which are mutable by definition.
    // Clearing them would mean rewriting every function signature in the migrated chart code,
    // which is a behaviour risk this migration should not take on for a lint rule.
    "typescript/prefer-readonly-parameter-types": "off",
    "typescript/require-await": "error",
    "promise/always-return": "error",
    "promise/catch-or-return": "error",
    "import/max-dependencies": ["error", { max: 35 }],
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
    // sonarjs/max-lines and sonarjs/max-lines-per-function duplicate the eslint rules above at a
    // second threshold; one file-length budget is enough.
    "sonarjs/max-lines": "off",
    "sonarjs/max-lines-per-function": "off",

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
    // sonarjs/function-name defaults to ^[_a-z][a-zA-Z0-9]*$, which forbids PascalCase. All 65
    // hits were React components, and React requires PascalCase to distinguish them from host
    // elements in JSX. Widened rather than disabled so genuinely misnamed functions still flag.
    "sonarjs/function-name": ["error", { format: "^[_a-zA-Z][a-zA-Z0-9]*$" }],
    // anti-slop/no-shape-in-symbol-names is OFF: 27 of its 28 hits are `shapeRendering`, the
    // React spelling of the SVG shape-rendering attribute. The name comes from the SVG spec, not
    // from this codebase, and cannot be changed without breaking rendering. (The one real hit,
    // `geoShape` in the choropleth code, is left as a known residual.)
    "anti-slop/no-shape-in-symbol-names": "off",

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
