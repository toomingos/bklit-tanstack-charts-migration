// Q2 API-compatibility fixture: exercises the full public prop surface of
// the migrated PieChart family (PieChart/PieSlice/PieCenter) against
// repos/bklit-ui/packages/ui/src/charts/{pie-chart,pie-slice,pie-context,
// pie-center}.tsx. Must typecheck with zero errors via `tsc --noEmit`
// (included from bench/app/tsconfig.json). Runtime smoke is covered by the
// bench scenarios (bklit-pie.tsx / migrated-pie.tsx).
import * as React from "react";
import {
  PieCenter,
  PieChart,
  PieSlice,
  type PieCenterRenderProps,
  type PieChartProps,
  type PieData,
  type PieEnterTransition,
  type PieSliceHoverEffect,
} from "@migrated/charts";

// --- Local gradient/pattern stand-ins (disclosed adaptation) --------------
// bklit's canonical fill-url demos use `@visx/gradient`/`@visx/pattern`
// (already-installed deps, real usage confirmed in
// repos/bklit-ui/apps/web/components/docs/pie-chart-demo.tsx). Both packages
// are only resolvable from within bench/app's own node_modules tree
// (vite.config.ts's alias list documents this exact constraint for
// d3-scale/d3-shape/d3-array, and does not extend it to @visx/gradient or
// @visx/pattern); qa/api-compat sits outside that tree, and this migration
// agent may not edit vite.config.ts/tsconfig.json (shared harness
// infrastructure another agent currently owns) or add a new dependency to
// resolve it. These minimal, displayName-tagged stand-ins exercise the
// EXACT behavior under test instead -- defs-hoisting by displayName
// (`isDefsComponent`, pie-chart.tsx) and `PieData.fill: "url(#id)"` --
// without depending on either package's own implementation.
function LinearGradientFixture({ id, from, to }: { id: string; from: string; to: string }) {
  return (
    <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stopColor={from} />
      <stop offset="100%" stopColor={to} />
    </linearGradient>
  );
}
LinearGradientFixture.displayName = "LinearGradient";

function RadialGradientFixture({ id, from, to }: { id: string; from: string; to: string }) {
  return (
    <radialGradient id={id}>
      <stop offset="0%" stopColor={from} />
      <stop offset="100%" stopColor={to} />
    </radialGradient>
  );
}
RadialGradientFixture.displayName = "RadialGradient";

function PatternLinesFixture({
  id,
  background,
  stroke,
  width,
  height,
}: {
  id: string;
  background: string;
  stroke: string;
  width: number;
  height: number;
}) {
  return (
    <pattern height={height} id={id} patternUnits="userSpaceOnUse" width={width}>
      <rect fill={background} height={height} width={width} />
      <line stroke={stroke} x1="0" x2="0" y1="0" y2={height} />
    </pattern>
  );
}
PatternLinesFixture.displayName = "PatternLines";

const data: PieData[] = [
  { label: "Direct", value: 42 },
  { label: "Organic", value: 28, color: "var(--chart-2)" },
  { label: "Referral", value: 15 },
  { label: "Social", value: 9 },
  { label: "Email", value: 6 },
];

const gradientFillData: PieData[] = [
  { label: "Direct", value: 42, fill: "url(#pie-fixture-linear-gradient)" },
  { label: "Organic", value: 28, fill: "url(#pie-fixture-radial-gradient)" },
  { label: "Referral", value: 15, fill: "url(#pie-fixture-pattern)" },
  { label: "Social", value: 9, color: "var(--chart-4)" },
];

const tweenTransition: PieEnterTransition = { type: "tween", duration: 0.9, ease: [0.85, 0, 0.15, 1] };
const springTransition: PieEnterTransition = { type: "spring", bounce: 0.2, stiffness: 120, damping: 14, mass: 1 };

const hoverEffects: PieSliceHoverEffect[] = ["translate", "grow", "none"];

export function PieChartApiFixture() {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const onHoverChange = (index: number | null): void => {
    setHoveredIndex(index);
  };

  return (
    <>
      {/* Canonical demo path (docs demo parity) -- solid pie, no PieCenter,
          matching the registry example / bklit-pie.tsx's own scope. */}
      <PieChart data={data} size={280}>
        {data.map((item, index) => (
          <PieSlice index={index} key={item.label} />
        ))}
      </PieChart>

      {/* Donut + PieCenter (default stat display, no custom render-prop),
          custom colors already covered via `data[1].color` above. */}
      <PieChart data={data} innerRadius={80} size={320}>
        {data.map((item, index) => (
          <PieSlice index={index} key={item.label} />
        ))}
        <PieCenter defaultLabel="Traffic" />
      </PieChart>

      {/* Donut + PieCenter with custom render-prop children, format
          options, prefix/suffix, and value/label className overrides. */}
      <PieChart data={data} innerRadius={90} size={320}>
        {data.map((item, index) => (
          <PieSlice hoverEffect="grow" index={index} key={item.label} />
        ))}
        <PieCenter
          defaultLabel="Sessions"
          formatOptions={{ notation: "compact", maximumFractionDigits: 1 }}
          labelClassName="fixture-center-label"
          prefix="~"
          suffix=" visits"
          valueClassName="fixture-center-value"
        >
          {({ value, label, isHovered, data: sliceData }: PieCenterRenderProps) => (
            <div>
              <strong>{sliceData.color ?? "default"}</strong>
              <div>{isHovered ? "hovered" : "idle"}</div>
              <div>{label}</div>
              <div>{value}</div>
            </div>
          )}
        </PieCenter>
      </PieChart>

      {/* padAngle + cornerRadius (rounded, separated donut slices). */}
      <PieChart cornerRadius={6} data={data} innerRadius={60} padAngle={0.03} size={300}>
        {data.map((item, index) => (
          <PieSlice index={index} key={item.label} />
        ))}
      </PieChart>

      {/* Partial start/end angle (half-donut gauge-style range), custom
          hoverOffset on the chart. */}
      <PieChart
        data={data}
        endAngle={Math.PI / 2}
        hoverOffset={16}
        innerRadius={70}
        size={280}
        startAngle={-Math.PI / 2}
      >
        {data.map((item, index) => (
          <PieSlice index={index} key={item.label} />
        ))}
      </PieChart>

      {/* Controlled hover mode -- `hoveredIndex`/`onHoverChange` threaded
          through, per-slice hoverOffset override, showGlow toggled off on
          one slice, explicit color/fill overrides on others. */}
      <PieChart
        className="fixture-pie"
        data={data}
        hoveredIndex={hoveredIndex}
        innerRadius={50}
        onHoverChange={onHoverChange}
        size={300}
        style={{ width: "100%" }}
      >
        <PieSlice color="var(--chart-1)" index={0} showGlow />
        <PieSlice fill="var(--chart-2)" index={1} showGlow={false} />
        <PieSlice hoverOffset={24} index={2} />
        <PieSlice hoverEffect="none" index={3} />
        <PieSlice index={4} />
        <PieCenter />
      </PieChart>

      {/* All three hoverEffect variants side by side, animate=false on one
          (mount with no reveal sweep -- slices present at rest immediately),
          enterStaggerScale + explicit enterTransition (tween) on another. */}
      <PieChart data={data} size={260}>
        {data.map((item, index) => (
          <PieSlice hoverEffect={hoverEffects[index % hoverEffects.length]} index={index} key={item.label} />
        ))}
      </PieChart>

      <PieChart data={data} enterStaggerScale={1.5} enterTransition={tweenTransition} size={260}>
        {data.map((item, index) => (
          <PieSlice animate index={index} key={item.label} />
        ))}
      </PieChart>

      <PieChart data={data} enterTransition={springTransition} size={260}>
        {data.map((item, index) => (
          <PieSlice index={index} key={item.label} />
        ))}
      </PieChart>

      <PieChart data={data} size={260}>
        {data.map((item, index) => (
          <PieSlice animate={false} index={index} key={item.label} />
        ))}
      </PieChart>

      {/* geometryScrubbing -- plain static paths, no animation, no pointer
          events; PieCenter still mounts (its own hover subscription is a
          no-op while scrubbing, always showing the default variant). */}
      <PieChart data={data} geometryScrubbing innerRadius={60} size={260}>
        {data.map((item, index) => (
          <PieSlice index={index} key={item.label} />
        ))}
        <PieCenter />
      </PieChart>

      {/* Custom colors via `PieData.color`, plus className on PieSlice
          (declared prop, inert -- see pie-chart.tsx's PieSliceProps doc
          comment for why: bklit itself never applies it). */}
      <PieChart
        data={[
          { label: "A", value: 10, color: "#22c55e" },
          { label: "B", value: 20, color: "#3b82f6" },
          { label: "C", value: 30, color: "#f97316" },
        ]}
        size={240}
      >
        <PieSlice className="slice-a" index={0} />
        <PieSlice className="slice-b" index={1} />
        <PieSlice className="slice-c" index={2} />
      </PieChart>

      {/* `PieData.fill` supporting `url(#id)` gradient/pattern references --
          defs-hoisting via displayName detection (LinearGradient/
          RadialGradient/PatternLines all get hoisted into <defs>). */}
      <PieChart data={gradientFillData} innerRadius={40} size={280}>
        <LinearGradientFixture from="#8b5cf6" id="pie-fixture-linear-gradient" to="#ec4899" />
        <RadialGradientFixture from="#facc15" id="pie-fixture-radial-gradient" to="#f97316" />
        <PatternLinesFixture
          background="#f1f5f9"
          height={6}
          id="pie-fixture-pattern"
          stroke="#0f172a"
          width={6}
        />
        {gradientFillData.map((item, index) => (
          <PieSlice index={index} key={item.label} />
        ))}
      </PieChart>

      {/* Responsive sizing (no `size` prop). */}
      <PieChart data={data}>
        {data.map((item, index) => (
          <PieSlice index={index} key={item.label} />
        ))}
      </PieChart>

      {/* Exhaustive `PieChartProps` reference (kept last, purely for
          typecheck coverage of every documented prop at once). */}
      {((): PieChartProps => ({
        data,
        size: 280,
        innerRadius: 0,
        padAngle: 0,
        cornerRadius: 0,
        startAngle: -Math.PI / 2,
        endAngle: (3 * Math.PI) / 2,
        className: "fixture-pie",
        hoveredIndex: null,
        onHoverChange: () => {},
        hoverOffset: 10,
        enterTransition: tweenTransition,
        enterStaggerScale: 1,
        geometryScrubbing: false,
        children: null,
      }))() && null}
    </>
  );
}
