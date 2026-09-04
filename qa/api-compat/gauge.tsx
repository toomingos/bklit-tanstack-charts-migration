// Q2 API fixture: exercises migrated Gauge family public props (both orientations); must typecheck (tsc --noEmit).
// OPEN: index.ts not yet wired with Gauge exports; tsc reports TS2305 until then.
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
      <Gauge
        centerValue={72}
        defaultLabel="Score"
        formatOptions={{ style: "percent" }}
        totalNotches={40}
        value={72}
      />

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

      {/* children-as-defs is honored on linear but a documented no-op on arc; must typecheck on both. */}
      <Gauge minWidth={280} orientation="arc" value={64}>
        <linearGradient id="fixture-arc-defs-noop">
          <stop offset="0%" stopColor="#000" />
          <stop offset="100%" stopColor="#fff" />
        </linearGradient>
      </Gauge>

      <Gauge enterStaggerScale={1.5} enterTransition={tweenTransition} orientation="arc" value={80} width={320} height={240} />
      <Gauge enterStaggerScale={0.5} enterTransition={springTransition} orientation="arc" value={20} width={320} height={240} />

      <Gauge orientation="arc" totalNotches={12} value={50} width={300} height={220} />

      <Gauge className="fixture-gauge" minWidth={320} orientation="arc" style={{ margin: "0 auto" }} value={90} />

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

      {/* Preserved bklit left/right sizing quirk, deliberately exercised, not "fixed". */}
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

      <Gauge
        linearHeight={32}
        minWidth={220}
        notchWidthPercent={60}
        orientation="linear"
        totalNotches={24}
        uniformWidth
        value={40}
      />

      <Gauge
        formatOptions={{ notation: "compact", maximumFractionDigits: 1 }}
        orientation="linear"
        prefix="$"
        suffix="/mo"
        uniformWidth={false}
        value={62}
        width={300}
      />

      <Gauge geometryScrubbing orientation="linear" value={70} width={260} />

      <Gauge orientation="linear" value={55} width={280}>
        <linearGradient id="fixture-linear-defs">
          <stop offset="0%" stopColor="#bef264" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </Gauge>

      <Gauge
        className="fixture-gauge-linear"
        enterStaggerScale={2}
        enterTransition={tweenTransition}
        orientation="linear"
        style={{ width: "100%" }}
        value={28}
        width={320}
      />

      {orientations.map((orientation) => (
        <Gauge centerValue={10} key={orientation} orientation={orientation} value={10} width={200} height={160} />
      ))}

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
