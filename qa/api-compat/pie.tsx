// Q2 API fixture: exercises migrated PieChart family public props; must typecheck (tsc --noEmit).
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

// Stand-ins for @visx/gradient + @visx/pattern (unresolvable outside bench/app's node_modules tree; this
// fixture may not add deps or edit shared harness config). displayName-tagged so defs-hoisting by displayName
// plus `PieData.fill: "url(#id)"` are exercised without either package's implementation.
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
      <PieChart data={data} size={280}>
        {data.map((item, index) => (
          <PieSlice index={index} key={item.label} />
        ))}
      </PieChart>

      <PieChart data={data} innerRadius={80} size={320}>
        {data.map((item, index) => (
          <PieSlice index={index} key={item.label} />
        ))}
        <PieCenter defaultLabel="Traffic" />
      </PieChart>

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

      <PieChart cornerRadius={6} data={data} innerRadius={60} padAngle={0.03} size={300}>
        {data.map((item, index) => (
          <PieSlice index={index} key={item.label} />
        ))}
      </PieChart>

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

      <PieChart data={data} geometryScrubbing innerRadius={60} size={260}>
        {data.map((item, index) => (
          <PieSlice index={index} key={item.label} />
        ))}
        <PieCenter />
      </PieChart>

      {/* className on PieSlice is declared but inert (bklit itself never applies it). */}
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

      {/* `PieData.fill: url(#id)` defs-hoisting via displayName detection. */}
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

      <PieChart data={data}>
        {data.map((item, index) => (
          <PieSlice index={index} key={item.label} />
        ))}
      </PieChart>

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
