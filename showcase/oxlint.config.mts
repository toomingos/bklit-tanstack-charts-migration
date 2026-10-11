import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";
import next from "ultracite/oxlint/next";
import jsPlugins, { jsPluginSettings } from "ultracite/oxlint/js-plugins";
import antiSlop from "ultracite/oxlint/anti-slop";
import tanstackPublic from "./oxlint-plugins/tanstack-public-subpaths.mjs";

// Ultracite presets plus opt-in js-plugins and anti-slop. Type-aware core
// rules only execute under `--type-aware` with `oxlint-tsgolint` installed.
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
  jsPlugins: [...jsPlugins.jsPlugins, "./oxlint-plugins/comments.js", "./oxlint-plugins/bklit.js"],
  settings: jsPluginSettings,
  overrides: [
    {
      // Tool configs and oxlint JS plugins: the loader reads `default`, node imports are the API.
      files: ["*.config.{ts,mts,js,mjs}", "oxlint-plugins/*.js"],
      rules: {
        "import/no-default-export": "off",
        "import/no-nodejs-modules": "off",
      },
    },
    {
      // AGENTS.md hazard rules.
      files: ["**/*"],
      rules: {
        "no-restricted-properties": ["error", {
          property: "getAnimations",
          message: "AGENTS.md: never call getAnimations per element after bulk CSS mutations. A single getAnimations({ subtree: true }) per change is the exception; allow-list it with a disable comment giving the reason.",
        }],
        "no-restricted-imports": ["error", {
          patterns: [{ ...tanstackPublic, message: "Private TanStack path: only the subpaths in the package `exports` map (1.1.0) are public." }],
        }],
        "bklit/no-ts-dom-reach-in": "error",
        "bklit/timer-needs-citation": "error",
      },
    },
  ],
  rules: {
    // Native render-allocation rules ultracite defers to react-doctor; the natives
    // are cheaper and catch the same allocations in render.
    "react-perf/jsx-no-jsx-as-prop": "error",
    "react-perf/jsx-no-new-array-as-prop": "error",
    "react-perf/jsx-no-new-function-as-prop": "error",
    "react/no-array-index-key": "error",
    "oxc/no-map-spread": "error",
    "unicorn/explicit-length-check": "error",
    "max-depth": "error",
    "no-console": "error",
    "sort-keys": "off",
    "no-magic-numbers": "off",
    "id-length": "off",
    // Raised off stock defaults for chart entry points (single large render bodies);
    // set above the domain-normal bulk so each still flags a real extraction candidate.
    "max-statements": ["error", { max: 50 }],
    "max-lines-per-function": ["error", { max: 400 }],
    complexity: ["error", { max: 40 }],
    // react-doctor/no-giant-component hardcodes 300 lines and accepts no options, duplicating
    // max-lines-per-function above at a threshold that cannot be tuned for this domain.
    "react-doctor/no-giant-component": "off",
    // ES5 fixed the reassignable-`undefined` hazard this targets, and its "use null" escape
    // contradicts unicorn/no-null below while React/TS require `undefined`; do not re-enable.
    "no-global-assign": "error",
    "no-shadow-restricted-names": "error",
    // Same `undefined`-vs-`null` contradiction one rule over: every hit clears legitimate
    // mutable state, and retyping the slot to `| null` just moves the finding to no-null.
    "sonarjs/no-undefined-assignment": "off",
    // Named groups are ES2018 but tsconfig targets ES2017, so each fix is a TS1503
    // compile error. Re-enable together with a target bump, not before.
    "prefer-named-capture-group": "off",
    // The compiler lowering-notices rule below is OFF: its hits describe the compiler's own
    // lowering, not defects in this code, and the compiler is not enabled here.
    "react/todo": "off",
    "react/jsx-max-depth": ["error", { max: 5 }],
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
    "max-params": ["error", { max: 5 }],
    "import/no-namespace": "error",
    "import/no-default-export": "error",
    "no-implicit-coercion": "error",
    // Side-effect stylesheet imports load chart CSS; there is nothing to assign.
    "import/no-unassigned-import": ["error", { allow: ["**/*.css"] }],
    "unicorn/max-nested-calls": "error",
    "unicorn/prefer-string-raw": "error",
    "max-lines": ["error", { max: 1200 }],
    "init-declarations": "error",
    "capitalized-comments": "off",
    // Long prose drifts out of date; a paragraph-long comment means the code below
    // should be clearer. JSDoc stays exempt.
    "comments/max-lines": ["error", { max: 2 }],
    "typescript/explicit-member-accessibility": "error",
    // It demands a transitively readonly program (any reachable mutable member still fires),
    // so compliance means rewriting every signature at once — a behaviour risk, not a lint fix.
    "typescript/prefer-readonly-parameter-types": "off",
    "typescript/require-await": "error",
    "promise/always-return": "error",
    "promise/catch-or-return": "error",
    "import/max-dependencies": ["error", { max: 35 }],
    // The family/kit layout requires `../kit` imports (families import only kit/), and bklit-ui
    // itself uses `../` throughout; the rule forbids the architecture. Off.
    "import/no-relative-parent-imports": "off",
    // bklit-ui writes `function X` declarations (570 vs 103 arrows under packages/ui/src/charts);
    // match it, while still allowing the arrows it uses for callbacks and small helpers.
    "func-style": ["error", "declaration", { allowArrowFunctions: true }],
    "import/exports-last": "off",
    "import/group-exports": "off",
    // bklit-ui carries one @param across ~570 functions; signatures are typed, so a per-function
    // @param/@returns block restates tsc and cannot coexist with the 2-line comment budget. Off.
    "jsdoc/require-param": "off",
    "jsdoc/require-param-type": "off",
    "jsdoc/require-returns": "off",
    "jsdoc/require-returns-type": "off",
    // Every hit spreads an open SVG prop surface (~150 attributes) where a partial list
    // silently drops caller props; `html: "ignore"` plus one-hop forwarders stay excepted.
    "react/jsx-props-no-spreading": ["error", { html: "ignore", exceptions: ["LinearGradientImpl", "RadialGradientImpl", "GaugeLinear", "GaugeArc"] }],
    "react/jsx-no-literals": "error",
    "node/no-sync": "error",
    // Non-conflicting js-plugins-preset rules ultracite leaves off (the conflicting ones
    // duplicate rules already on, so they stay off).
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

    // Bridge rules: no-implicit-buggy-globals has 0 hits so it stays on, but the bridge
    // supplies no globals or manifest data, so the other two flag false positives. Kept off.
    "github/no-implicit-buggy-globals": "error",
    // The default bans `typeof` even inside the validating parser it asks for, contradicting
    // no-unsafe-type-assertion; `allowInTypeGuards` keeps the validate-once-in-a-guard intent.
    "anti-slop/no-runtime-typeof": ["error", { allowInTypeGuards: true }],
    // The default format forbids PascalCase, which React requires for components;
    // widened so genuinely misnamed functions still flag.
    "sonarjs/function-name": ["error", { format: "^[_a-zA-Z][a-zA-Z0-9]*$" }],
    // 27 of 28 hits are `shapeRendering`, the SVG spec's own attribute spelling, which
    // cannot change without breaking rendering. (The one real hit stays a known residual.)
    "anti-slop/no-shape-in-symbol-names": "off",
    // Both flagged shapes are forced: React 19 `useRef` requires its argument (TS2554), and
    // effect cleanups need the explicit value for typescript/consistent-return. Kept off.
    "unicorn/no-useless-undefined": "off",

    // The compiler is off, so nothing caches these values; the memo calls are deliberate
    // and benchmark-validated — removing them regresses the render timings this migration owns.
    "react-doctor/react-compiler-no-manual-memoization": "off",

    // JSX must live in .tsx, and .tsx without JSX should be .ts.
    "react/jsx-filename-extension": [
      "error",
      { allow: "as-needed", extensions: ["tsx"] },
    ],


    // Calibrated against TanStack/bklit patterns the migration must preserve: 1:1 API
    // parity wins where a rule contradicts it, after an attempted fix measured the result.

    // `className`/`style` are public API (TanStack RendererChartProps, bklit charts, Base UI
    // docs); renaming them would silently drop props against the parity contract. Off.
    "react/forbid-component-props": "off",

    // Refs are only stored by TanStack factories and read at event/callback time, never during
    // render; every sanctioned alternative traded this finding for other findings. Off.
    "react/refs": "off",

    // Gradients.tsx is a verbatim visx port whose load-bearing displayNames require one file;
    // one-file-per-component would destroy that property for zero behaviour gain. Off.
    "react/no-multi-comp": "off",

    // only-export-components (2 remaining). Chart modules export their context and hooks
    // (ChoroplethZoomContext, useChoropleth) next to the component as public API, matching bklit.
    "react/only-export-components": "off",

    // The effect re-runs on trigger-only deps it never reads; dropping them silently breaks
    // phase replay, and this repo allows no suppressions, so the rule is off.
    "react/exhaustive-effect-dependencies": "off",

    // Bklit chart APIs collect children (<PieChart><PieCenter/>...), so Children.toArray/forEach
    // role dispatch over opaque ReactNode is the documented React API for exactly this. Off.
    "react/no-react-children": "off",
    // github/array-foreach (1) is the same Children.forEach call, flagged again.
    "github/array-foreach": "off",

    // Lazy-initial-state singletons (`const [coordinator] = useState(...)`); a setter only to
    // satisfy the rule is dead code that trips no-unused-vars and no-dead-store instead. Off.
    "react/hook-use-state": "off",

    // `onPhaseChange` is bklit's public reveal-phase callback (fires per transition, not render);
    // routing it through a ref would silence the linter while keeping the re-render. Off.
    "react-doctor/no-pass-data-to-parent": "off",
    "react-doctor/no-pass-live-state-to-parent": "off",
    "react-doctor/no-prop-callback-in-effect": "off",

    // The booleans are 1:1 with bklit's public ChartLegendProps toggles; grouping them forces
    // inline literals that react-perf/jsx-no-new-object-as-prop then flags. Off.
    "react-doctor/no-many-boolean-props": "off",

    // `Record<string, unknown>` is bklit's public datum type for genuinely heterogeneous input;
    // narrowing it broke tsc and the user-facing API. Off.
    "anti-slop/no-unsafe-dictionary-type": "off",

    // The `unknown` comes from TanStack's own interfaces and an I/O-boundary parser behind
    // type guards; renaming cannot help since the rule fires on any `unknown`. Off.
    "anti-slop/no-unknown-parameters": "off",

    // Name collision, not a finding: `yScale.map(y)` is TanStack ResolvedScale.map with a
    // number, and wrapping it in an arrow breaks scale projection. Off.
    "unicorn/no-array-callback-reference": "off",
    // unicorn/no-array-sort (1) is the same collision on d3-shape's pie generator `.sort(null)`;
    // `toSorted` does not exist on it.
    "unicorn/no-array-sort": "off",

    // Both handlers call preventDefault() to suppress scroll/zoom, which passive listeners make
    // a no-op; touchend (no preventDefault) already proves the choice deliberate. Off.
    "github/require-passive-events": "off",

    // globalThis.setTimeout resolves to the Node overload (TS2322); window.setTimeout
    // is the correctly DOM-typed API for a browser chart. Off.
    "unicorn/prefer-global-this": "off",

    // scheduleAfterTwoFrames returns a synchronous canceller, which async/await cannot
    // express; Node's `return callback()` is meaningless for a guarded `() => void`. Off.
    "promise/prefer-await-to-callbacks": "off",
    "node/callback-return": "off",

    // sonarjs/no-built-in-override (1): visx's Zoom API exposes `toString` on the transform
    // object and zoom-engine.ts:110 calls it explicitly; it is never used for coercion.
    "sonarjs/no-built-in-override": "off",

    // __qaSetMarkerFan is a cross-process contract with the protected screenshot harness, so the
    // name cannot change; the underscore rule is widened for it instead of touching the code.
    "no-underscore-dangle": ["error", { allow: ["__qaSetMarkerFan"] }],

    // Known residuals, accepted not hidden: the d3-shape typings gap, the upstream-deprecated
    // re-export, the harness-contract name, and load-bearing key order. Rules stay ON.

    // Chart code writes `data-bkm-*` through get/set/removeAttribute so the names match the CSS
    // attribute selectors and bklit's own markup; `dataset` camelCases them and drops that tie. Off.
    "unicorn/prefer-dom-node-dataset": "off",
    // Tuple-slot reads like `propsFor(table, "x")[0]` are the carrier idiom; object destructuring stays on.
    "prefer-destructuring": ["error", { array: false, object: true }],

    // ── bklit Biome rules ported (L6 dry run) ──
    "unicorn/prefer-number-properties": "error", // useNumberNamespace
    "react/jsx-no-useless-fragment": "error", // noUselessFragments
    "typescript/consistent-type-imports": "error", // useImportType
    "unicorn/new-for-builtins": "error", // useConsistentBuiltinInstantiation
    "jsx-a11y/no-aria-hidden-on-focusable": "error", // noAriaHiddenOnFocusable
    "jsx-a11y/no-static-element-interactions": "error", // noStaticElementInteractions
    "jsx-a11y/no-noninteractive-element-interactions": "error", // noNoninteractiveElementInteractions

    // Deliberately OFF: contradicting rules above, or redundant with tsc and oxfmt. The
    // names stay listed here so re-enabling any of them is a conscious diff.
  },
});
