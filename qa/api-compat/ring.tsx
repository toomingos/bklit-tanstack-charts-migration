// Q2 API-compatibility fixture: exercises the full public prop surface of
// the migrated RingChart family (RingChart/Ring/RingCenter) against
// repos/bklit-ui/packages/ui/src/charts/{ring-chart,ring,ring-context,
// ring-center}.tsx. Must typecheck with zero errors via `tsc --noEmit`
// (included from bench/app/tsconfig.json). Runtime smoke is covered by the
// bench scenarios (bklit-ring.tsx / migrated-ring.tsx).
import * as React from "react";
import {
  Ring,
  RingCenter,
  RingChart,
  type RingCenterRenderProps,
  type RingChartProps,
  type RingData,
  type RingEnterTransition,
  type RingLineCap,
} from "@migrated/charts";

// `maxValue` is REQUIRED on RingData (the missing field that type-breaks
// bklit's own registry example, docs/LOG.md D27) — every datum here has it.
const data: RingData[] = [
  { label: "Move", value: 420, maxValue: 500 },
  { label: "Exercise", value: 28, maxValue: 30, color: "var(--chart-2)" },
  { label: "Stand", value: 10, maxValue: 12 },
  { label: "Focus", value: 3, maxValue: 8 },
];

const tweenTransition: RingEnterTransition = { type: "tween", duration: 0.9, ease: [0.85, 0, 0.15, 1] };
const springTransition: RingEnterTransition = { type: "spring", bounce: 0.2, stiffness: 120, damping: 14, mass: 1 };

const lineCaps: RingLineCap[] = ["round", "butt"];

export function RingChartApiFixture() {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const onHoverChange = (index: number | null): void => {
    setHoveredIndex(index);
  };

  return (
    <>
      {/* Canonical docs-demo path (D27 basis) — fixed size, one Ring per
          datum, always-mounted RingCenter, uncontrolled hover. */}
      <RingChart data={data} size={280}>
        {data.map((item, index) => (
          <Ring index={index} key={item.label} />
        ))}
        <RingCenter />
      </RingChart>

      {/* Custom concentric geometry (strokeWidth/ringGap/baseInnerRadius)
          plus the dead-in-bklit `animationDuration` prop (declared, never
          read — preserved for API compatibility, see ring-chart.tsx header). */}
      <RingChart animationDuration={800} baseInnerRadius={48} data={data} ringGap={4} size={260} strokeWidth={10}>
        {data.map((item, index) => (
          <Ring index={index} key={item.label} />
        ))}
      </RingChart>

      {/* Partial start/end angle (three-quarter arc). */}
      <RingChart data={data} endAngle={Math.PI} size={280} startAngle={-Math.PI / 2}>
        {data.map((item, index) => (
          <Ring index={index} key={item.label} />
        ))}
        <RingCenter defaultLabel="Progress" />
      </RingChart>

      {/* Controlled hover mode — hoveredIndex/onHoverChange threaded
          through; per-Ring color override, showGlow toggles (dead in bklit
          at runtime, API-preserved), lineCap variants, animate=false. */}
      <RingChart
        className="fixture-ring"
        data={data}
        hoveredIndex={hoveredIndex}
        onHoverChange={onHoverChange}
        size={300}
        style={{ width: "100%" }}
      >
        <Ring color="var(--chart-1)" index={0} showGlow />
        <Ring index={1} lineCap="butt" showGlow={false} />
        <Ring animate={false} index={2} />
        <Ring index={3} lineCap={lineCaps[3 % lineCaps.length]} />
        <RingCenter />
      </RingChart>

      {/* Explicit enterTransition (tween) + enterStaggerScale. */}
      <RingChart data={data} enterStaggerScale={1.5} enterTransition={tweenTransition} size={260}>
        {data.map((item, index) => (
          <Ring animate index={index} key={item.label} />
        ))}
      </RingChart>

      {/* Spring enterTransition (bounce shorthand + explicit constants). */}
      <RingChart data={data} enterTransition={springTransition} size={260}>
        {data.map((item, index) => (
          <Ring index={index} key={item.label} />
        ))}
      </RingChart>

      {/* geometryScrubbing — plain static paths, no WAAPI reveal / spring
          hover morphing; RingCenter still mounts (always showing the
          default variant while scrubbing). */}
      <RingChart data={data} geometryScrubbing size={260}>
        {data.map((item, index) => (
          <Ring index={index} key={item.label} />
        ))}
        <RingCenter />
      </RingChart>

      {/* RingCenter full surface — custom render-prop children (only
          invoked while hovered, ring-center.tsx `if (children &&
          hoveredData)`), format options, prefix/suffix, class overrides. */}
      <RingChart data={data} size={320}>
        {data.map((item, index) => (
          <Ring index={index} key={item.label} />
        ))}
        <RingCenter
          className="fixture-center"
          defaultLabel="Activity"
          formatOptions={{ notation: "compact", maximumFractionDigits: 1 }}
          labelClassName="fixture-center-label"
          prefix="~"
          suffix=" pts"
          valueClassName="fixture-center-value"
        >
          {({ value, label, isHovered, data: ringData }: RingCenterRenderProps) => (
            <div>
              <strong>{ringData.color ?? "default"}</strong>
              <div>{isHovered ? "hovered" : "idle"}</div>
              <div>{label}</div>
              <div>{value}</div>
            </div>
          )}
        </RingCenter>
      </RingChart>

      {/* Responsive sizing (no `size` prop — parent-container measured). */}
      <RingChart data={data}>
        {data.map((item, index) => (
          <Ring index={index} key={item.label} />
        ))}
      </RingChart>

      {/* Exhaustive `RingChartProps` reference (kept last, purely for
          typecheck coverage of every documented prop at once). */}
      {((): RingChartProps => ({
        data,
        size: 280,
        strokeWidth: 12,
        ringGap: 6,
        baseInnerRadius: 60,
        animationDuration: 1100,
        className: "fixture-ring",
        style: { width: "100%" },
        hoveredIndex: null,
        onHoverChange: () => {},
        startAngle: -Math.PI / 2,
        endAngle: (3 * Math.PI) / 2,
        enterTransition: tweenTransition,
        enterStaggerScale: 1,
        geometryScrubbing: false,
        children: null,
      }))() && null}
    </>
  );
}
