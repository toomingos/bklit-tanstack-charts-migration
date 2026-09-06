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
    {
      // pie-hover-chrome.ts builds an offset proxy that IMPLEMENTS d3-path's `Path` interface.
      // `Path.arc(x, y, radius, startAngle, endAngle, anticlockwise?)` is six parameters by
      // d3's definition, so the arity is fixed by the library, not by us: grouping them into
      // an options object breaks `Path` assignability (TS2322) and the proxy stops being a
      // thing d3-shape can draw into. This is the one place where max-params contradicts the
      // library we are migrating onto, so the rule yields here rather than the code.
      files: ["migrated/charts/internal/pie-hover-chrome.ts"],
      rules: {
        "max-params": "off",
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
    // id-length: x/y/z/r are the channel vocabulary of TanStack mark options (z carries
    // series identity, r the dot radius), d is the SVG path-data attribute, and i/j are
    // loop indices. These names are fixed by the mark API and the SVG spec, so renaming
    // them is not available. All other one-character names (v, p, s, a, b, …) are
    // renamed in code.
    "id-length": ["error", { exceptions: ["x", "y", "z", "r", "d", "i", "j"] }],
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
    // jsx-props-no-spreading, calibrated rather than dropped. Every hit spread an OPEN SVG prop
    // surface -- `Omit<SVGProps<SVGLinearGradientElement>, keyof OwnProps>` and friends -- where
    // enumerating ~150 attributes explicitly is infeasible and a partial list silently drops
    // caller props. `html: "ignore"` covers the DOM-element spreads (16 -> 13). The exceptions are
    // one-hop forwarders that immediately re-spread onto such an element: the visx preset
    // gradients (GradientOrangeRed and 10 siblings) forward to LinearGradientImpl, and Gauge's
    // dispatcher forwards to GaugeLinear/GaugeArc. Expanding the Gauge dispatcher by hand was
    // tried and traded its 2 findings for 4 forbid-component-props on className/style.
    "react/jsx-props-no-spreading": ["error", { html: "ignore", exceptions: ["LinearGradientImpl", "RadialGradientImpl", "GaugeLinear", "GaugeArc"] }],
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
    // unicorn/no-useless-undefined is OFF. Both shapes it flagged here are forced:
    // 21 hits were `useRef<T | undefined>(undefined)` -- React 19 types `useRef` with a
    // required argument, so dropping it is TS2554 (verified against this tsconfig); and
    // 16 were `return undefined;` in a useEffect callback whose other branch returns a
    // cleanup, where typescript/consistent-return requires the explicit value. Rewriting
    // one file to bare `return;` traded 3 findings for 6 (consistent-return x3,
    // no-useless-return x2, no-redundant-jump x1).
    "unicorn/no-useless-undefined": "off",

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


    // ── Calibrated against the TanStack/bklit patterns this migration must preserve ──
    // Each entry below was reported by an executor agent that first attempted the fix and
    // measured the result. The governing rule for this migration is 1:1 API parity with bklit
    // and idiomatic TanStack Charts usage; where a lint rule contradicts that, the rule yields.

    // forbid-component-props (26 hits) forbids `className` and `style` on components. Both are
    // declared public API here: TanStack's own RendererChartProps declares
    // `className?: string; style?: CSSProperties`, bklit declares `className` on every chart
    // (bar-chart.tsx:77) and on ReferenceArea, and Base UI's Progress.Track/Indicator are styled
    // that way by documentation. The hits are spread over ~20 files in 5 independent slices.
    // Satisfying it means renaming public props across the surface -- a silent prop drop against
    // the parity contract -- so the rule is off rather than the API broken.
    "react/forbid-component-props": "off",

    // react/refs (18 hits) fires on any ref that *may* be read during render. In this codebase
    // refs are handed to TanStack mark/strategy factories (createBarFocusStrategy,
    // createSankeyMark, createHoverSource, ChartScale.resolve) which only store them and
    // read `.current` at event/render-callback time, outside React's render. Agents verified the
    // rule cannot distinguish store-for-later from read-now, and that it cascades: adding one
    // reference flagged three untouched lines. Every sanctioned alternative was tested and traded
    // for other findings -- useState shapes trip hook-use-state, useEffectEvent readers trip
    // rules-of-hooks "escapes", effect-sync reads stale reveal state and corrupts replay.
    "react/refs": "off",

    // no-multi-comp (17 hits). The largest group is internal/gradients.tsx, a verbatim visx port
    // whose 12 components must stay in one file because their displayNames are load-bearing (pie
    // and gauge classify children by displayName to hoist defs). The rest are container/body
    // pairs where the outer component exists only to probe container width. The compliant fix is
    // one file per component, which would destroy the verbatim property for zero behaviour gain.
    "react/no-multi-comp": "off",

    // only-export-components (2 remaining). Chart modules export their context and hooks
    // (ChoroplethZoomContext, useChoropleth) next to the component as public API, matching bklit.
    "react/only-export-components": "off",

    // exhaustive-effect-dependencies (5 hits) has no way to express a *trigger* dependency: the
    // effect body does not read revealSignature / revealEpoch / playKey / loopEpoch, but must
    // re-run when they change to re-enter the reveal phase. bklit upstream carries a
    // `biome-ignore` on the identical dep set (heatmap-chart.tsx:578). Removing the dep silently
    // breaks phase replay; this repo allows no suppressions, so the rule is off.
    "react/exhaustive-effect-dependencies": "off",

    // no-react-children (5 hits). The bklit component APIs are children-collectors --
    // <PieChart><PieCenter/><PieSlice/></PieChart>, <RadarChart><RadarArea/></RadarChart> --
    // so Children.toArray/forEach role dispatch over opaque ReactNode is the documented React
    // API for exactly this. `for...of` breaks single and Fragment children.
    "react/no-react-children": "off",
    // github/array-foreach (1) is the same Children.forEach call, flagged again.
    "github/array-foreach": "off",

    // hook-use-state (3). `const [coordinator] = useState(() => createHoverCoordinator())` is
    // React's documented lazy-initial-state idiom for a stable singleton, used identically in
    // pie, funnel and ring. Adding a setter to satisfy the rule creates dead code that trips
    // no-unused-vars and no-dead-store instead.
    "react/hook-use-state": "off",

    // react-doctor parent-notification rules (9 hits across no-pass-data-to-parent,
    // no-pass-live-state-to-parent, no-prop-callback-in-effect). They all flag `onPhaseChange`,
    // bklit's public reveal-phase callback, implemented with React's useEffectEvent + useEffect.
    // It fires once per phase transition, not per render. Routing it through a ref silences the
    // linter while keeping the identical parent re-render -- evasion, not a fix.
    "react-doctor/no-pass-data-to-parent": "off",
    "react-doctor/no-pass-live-state-to-parent": "off",
    "react-doctor/no-prop-callback-in-effect": "off",

    // no-many-boolean-props (2). The booleans are 1:1 with bklit's public ChartLegendProps
    // toggles (showProgress/showMarker/showValue/showPercentage). Grouping them into an object
    // forces inline literals at call sites, which react-perf/jsx-no-new-object-as-prop then flags.
    "react-doctor/no-many-boolean-props": "off",

    // no-unsafe-dictionary-type (7). `Record<string, unknown>` is bklit's own public datum type
    // (ColorAccessor takes `(datum: Record<string, unknown>, index: number)`), and chart data is
    // genuinely heterogeneous user input. Narrowing ChartDatum to a value union was attempted and
    // produced 5 tsc errors that prove the union is dishonest: candlestick stringifies boolean
    // x-values, live-line passes config objects carrying CurveFactory, and the demos pass
    // bklit-shaped `Record<string, unknown>[]` -- a user-facing API break.
    "anti-slop/no-unsafe-dictionary-type": "off",

    // no-unknown-parameters (3). The `unknown` comes from TanStack's interfaces, not from this
    // code: ResolvedScale.map is `(value: unknown) => number` in dom-types.d.ts, and the one
    // remaining local case is coerce-date's I/O-boundary parser, whose whole job is to accept
    // unknown input behind type guards. Renaming does not help; the rule fires on any `unknown`.
    "anti-slop/no-unknown-parameters": "off",

    // unicorn/no-array-callback-reference (3) is a name collision, not a finding: `yScale.map(y)`
    // is TanStack ResolvedScale.map called with a number, not Array.prototype.map with a
    // callback. Wrapping it in an arrow as the rule advises breaks scale projection.
    "unicorn/no-array-callback-reference": "off",
    // unicorn/no-array-sort (1) is the same collision on d3-shape's pie generator `.sort(null)`;
    // `toSorted` does not exist on it.
    "unicorn/no-array-sort": "off",

    // github/require-passive-events (2). Both handlers call preventDefault() to suppress
    // scroll/zoom during pinch-selection, which passive listeners make a no-op (browsers warn).
    // The file already proves the choice is deliberate: touchend, whose handler never calls
    // preventDefault, is registered `passive: true`.
    "github/require-passive-events": "off",

    // unicorn/prefer-global-this (1) is wrong here under @types/node: globalThis.setTimeout
    // resolves to the Node overload returning Timeout, so the rewrite fails tsc with TS2322.
    // window.setTimeout is the correctly DOM-typed API for a browser chart.
    "unicorn/prefer-global-this": "off",

    // promise/prefer-await-to-callbacks (2) + node/callback-return (1) fire on
    // scheduleAfterTwoFrames, a requestAnimationFrame/setTimeout chain that returns a canceller.
    // async/await cannot return a synchronous canceller, and Node's `return callback()` is
    // meaningless for a `() => void` guarded by a cancelled flag.
    "promise/prefer-await-to-callbacks": "off",
    "node/callback-return": "off",

    // sonarjs/no-built-in-override (1): visx's Zoom API exposes `toString` on the transform
    // object and zoom-engine.ts:110 calls it explicitly; it is never used for coercion.
    "sonarjs/no-built-in-override": "off",

    // __qaSetMarkerFan is a cross-process contract with the protected screenshot harness
    // (qa/screenshot.mjs sets it via addInitScript), so the name cannot change. Bracket access
    // trips typescript/dot-notation and Reflect.get trips anti-slop/no-reflect-get, so the
    // underscore rule is widened for it instead. (sonarjs/variable-name flags the same name once
    // and is left on: its `format` option is not the eslint spelling and widening it there
    // disabled the rule's real coverage, so that single hit stays a known residual.)
    "no-underscore-dangle": ["error", { allow: ["__qaSetMarkerFan"] }],

    // ── Known residuals (rules kept ON; these 7 hits are accepted, not hidden) ──
    // pie-hover-chrome.ts: no-unsafe-type-assertion x2 + no-reflect-get x1 -- all three are the
    //   gap between @types/d3-shape and d3's actual runtime contract, re-verified against the
    //   installed typings: (a) `Arc.context()` is typed CanvasRenderingContext2D|null, but
    //   arc.js only ever calls moveTo/lineTo/arc/closePath and accepts any object, so a Path
    //   proxy cannot be *proven* to be a full canvas context because it is not one; (b) the
    //   arc closure mirrors d3's own build-then-attach-methods idiom, which TS cannot verify;
    //   (c) `digits` exists at runtime via withPath() but is absent from the `Arc` interface,
    //   which has no index signature, so it cannot be spelled with typed access. The value read
    //   through Reflect.get is now proven by a type predicate rather than asserted.
    // css-var-maps.ts + index.ts: no-deprecated x2 -- heatmapCssVars is deprecated upstream in
    //   bklit and still publicly exported there, so parity requires re-exporting it.
    // marker-group-content.tsx: variable-name -- the __qaSetMarkerFan harness contract above.
    // sankey-mark.ts: sort-keys -- key order is load-bearing for const-generic inference.
    //
    // Note for future work: `react-hooks/exhaustive-deps` and the compiler memo rules
    // (preserve-manual-memoization / memo-dependencies) are jointly unsatisfiable for a ref
    // object returned from a custom hook -- the first demands it in the dep array, the others
    // reject it. Three separate extractions hit this independently. The convention adopted here
    // is to keep the ref inside the hook and expose stable accessors (getX() / setX(fn)), which
    // satisfies all three honestly. Prefer that over adding the ref to deps.

    // Deliberately OFF (contradict rules above or redundant with tsc):
    // no-ternary, sort-imports (oxfmt sorts), react/react-in-jsx-scope,
    // no-undef, no-restricted-exports, import/no-named-export,
    // import/prefer-default-export, oxc/no-optional-chaining,
    // oxc/no-rest-spread-properties, oxc/no-async-await,
    // unicorn/prefer-top-level-await, github/no-dataset,
    // sonarjs/cyclomatic-complexity, sonarjs/shorthand-property-grouping.
  },
});
