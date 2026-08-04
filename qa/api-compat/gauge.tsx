// Q2 API-compatibility fixture: exercises the full public prop surface of
// the migrated Gauge family (both orientations) against
// repos/bklit-ui/packages/ui/src/charts/{gauge,gauge-label-layout,
// notch-gauge-shared}.tsx. Must typecheck with zero errors via
// `tsc --noEmit` (included from bench/app/tsconfig.json) ONCE Fable adds
// Gauge's registry export lines to migrated/charts/index.ts — see this
// deliverable's own report for the exact lines; until then, the
// `@migrated/charts` import below is expected to be unresolved (same
// self-resolving state every other family's fixture was in before its own
// index.ts wiring landed). Runtime smoke is covered by the bench scenarios
// (bklit-gauge.tsx / migrated-gauge.tsx, bklit-gaugelinear.tsx /
// migrated-gaugelinear.tsx).
import * as React from "react";
import {
  Gauge,
  type GaugeEnterTransition,
  type GaugeLabelAlign,
  type GaugeLabelPlacement,
  type GaugeOrientation,
  type GaugeProps,
} from "@migrated/charts";

const tweenTransition: GaugeEnterTransition = { type: "tween", duration: 0.6, ease: [0.85, 0, 0.15, 1] };
const springTransition: GaugeEnterTransition = { type: "spring", bounce: 0.3, stiffness: 260, damping: 22, mass: 1 };

const labelPlacements: GaugeLabelPlacement[] = ["top", "bottom", "left", "right"];
const labelAligns: GaugeLabelAlign[] = ["start", "center", "end"];
const orientations: GaugeOrientation[] = ["arc", "linear"];

export function GaugeApiFixture() {
  return (
    <>
      {/* Canonical registry-example path (D28 basis) — arc, no orientation
          override, no size props (fully responsive ParentSize branch). */}
      <Gauge
        centerValue={72}
        defaultLabel="Score"
        formatOptions={{ style: "percent" }}
        totalNotches={40}
        value={72}
      />

      {/* Fixed-size arc, custom geometry (spacing/notchCornerRadius/
          uniformWidth/startAngle/endAngle/notchLengthPercent), custom
          fills + opacities (no gradient). */}
      <Gauge
        activeFill="var(--chart-1)"
        activeFillOpacity={0.9}
        endAngle={420}
        height={280}
        inactiveFill="var(--border)"
        inactiveFillOpacity={0.5}
        notchCornerRadius={2}
        notchLengthPercent={80}
        orientation="arc"
        spacing={30}
        startAngle={120}
        totalNotches={30}
        uniformWidth
        value={45}
        width={360}
      />

      {/* Arc with gradients — theme-palette gradient path (useGradient,
          no activeGradient) and an explicit two-stop active/inactive
          gradient pair, exercised separately. */}
      <Gauge orientation="arc" useGradient value={58} width={340} height={260} />
      <Gauge
        activeGradient={["#bef264", "#10b981"]}
        inactiveGradient={["#333333", "#999999"]}
        orientation="arc"
        useGradient
        value={33}
        width={340}
        height={260}
      />

      {/* Arc with children-as-defs (custom `<linearGradient>` — D28's ONLY
          use of `children`; honored on linear, a documented no-op on arc —
          see gauge.tsx's file header). `children` must remain type-
          compatible on BOTH orientations regardless. */}
      <Gauge minWidth={280} orientation="arc" value={64}>
        <linearGradient id="fixture-arc-defs-noop">
          <stop offset="0%" stopColor="#000" />
          <stop offset="100%" stopColor="#fff" />
        </linearGradient>
      </Gauge>

      {/* Arc explicit enterTransition variants (tween / spring bounce
          shorthand) + enterStaggerScale. */}
      <Gauge enterStaggerScale={1.5} enterTransition={tweenTransition} orientation="arc" value={80} width={320} height={240} />
      <Gauge enterStaggerScale={0.5} enterTransition={springTransition} orientation="arc" value={20} width={320} height={240} />

      {/* Arc, no centerValue — center readout omitted entirely. */}
      <Gauge orientation="arc" totalNotches={12} value={50} width={300} height={220} />

      {/* Arc, responsive (no width/height — ParentSize branch), custom
          className/style/minWidth. */}
      <Gauge className="fixture-gauge" minWidth={320} orientation="arc" style={{ margin: "0 auto" }} value={90} />

      {/* Canonical docs-mdx linear path (D28 basis). */}
      <Gauge
        centerValue={428_000}
        defaultLabel="ARR run rate"
        inactiveFillOpacity={0.4}
        labelAlign="center"
        labelPlacement="bottom"
        notchCornerRadius={3}
        orientation="linear"
        spacing={0}
        totalNotches={72}
        useGradient
        value={72}
      />

      {/* Linear, fixed width, every labelPlacement/labelAlign combination
          (including the preserved bklit left/right sizing quirk — see
          gauge.tsx's file header — deliberately exercised here, not
          "fixed"). */}
      {labelPlacements.map((placement) =>
        labelAligns.map((align) => (
          <Gauge
            centerValue={50}
            key={`${placement}-${align}`}
            labelAlign={align}
            labelPlacement={placement}
            orientation="linear"
            value={50}
            width={280}
          />
        )),
      )}

      {/* Linear, uniformWidth rectangular notches + notchWidthPercent +
          linearHeight override, no width prop (responsive). */}
      <Gauge
        linearHeight={32}
        minWidth={220}
        notchWidthPercent={60}
        orientation="linear"
        totalNotches={24}
        uniformWidth
        value={40}
      />

      {/* Linear, tapered (uniformWidth=false) notches, prefix/suffix,
          formatOptions. */}
      <Gauge
        formatOptions={{ notation: "compact", maximumFractionDigits: 1 }}
        orientation="linear"
        prefix="$"
        suffix="/mo"
        uniformWidth={false}
        value={62}
        width={300}
      />

      {/* Linear geometryScrubbing — plain static paths, no WAAPI reveal. */}
      <Gauge geometryScrubbing orientation="linear" value={70} width={260} />

      {/* Linear with children-as-defs — full-fidelity path (D28's disclosed
          arc-vs-linear gap: this is where the escape hatch actually works). */}
      <Gauge orientation="linear" value={55} width={280}>
        <linearGradient id="fixture-linear-defs">
          <stop offset="0%" stopColor="#bef264" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </Gauge>

      {/* Linear explicit enterTransition + enterStaggerScale, custom
          className/style. */}
      <Gauge
        className="fixture-gauge-linear"
        enterStaggerScale={2}
        enterTransition={tweenTransition}
        orientation="linear"
        style={{ width: "100%" }}
        value={28}
        width={320}
      />

      {/* Orientation driven by a variable of the exported union type. */}
      {orientations.map((orientation) => (
        <Gauge centerValue={10} key={orientation} orientation={orientation} value={10} width={200} height={160} />
      ))}

      {/* Exhaustive `GaugeProps` reference (kept last, purely for typecheck
          coverage of every documented prop at once). */}
      {((): GaugeProps => ({
        orientation: "linear",
        value: 66,
        totalNotches: 50,
        spacing: 20,
        notchCornerRadius: 2,
        uniformWidth: true,
        startAngle: 135,
        endAngle: 405,
        useGradient: true,
        activeGradient: ["#bef264", "#10b981"],
        inactiveGradient: ["#333333", "#999999"],
        centerValue: 66,
        defaultLabel: "Total",
        prefix: "~",
        suffix: "%",
        formatOptions: { notation: "standard", maximumFractionDigits: 0 },
        labelPlacement: "top",
        labelAlign: "start",
        inactiveFill: "var(--border)",
        activeFill: "var(--chart-1)",
        inactiveFillOpacity: 0.8,
        activeFillOpacity: 1,
        children: null,
        className: "fixture-gauge-exhaustive",
        width: 320,
        height: 240,
        minWidth: 220,
        notchLengthPercent: 90,
        notchWidthPercent: 70,
        linearHeight: 24,
        enterTransition: springTransition,
        enterStaggerScale: 1,
        geometryScrubbing: false,
        style: { width: "100%" },
      }))() && null}
    </>
  );
}
