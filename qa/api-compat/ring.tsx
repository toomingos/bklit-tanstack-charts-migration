// Q2 API fixture: exercises migrated RingChart family public props; must typecheck (tsc --noEmit).
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

// `maxValue` is REQUIRED on RingData (bklit's own registry example omits it and type-breaks).
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
      <RingChart data={data} size={280}>
        {data.map((item, index) => (
          <Ring index={index} key={item.label} />
        ))}
        <RingCenter />
      </RingChart>

      {/* `animationDuration` is dead in bklit (declared, never read); preserved for API compatibility. */}
      <RingChart animationDuration={800} baseInnerRadius={48} data={data} ringGap={4} size={260} strokeWidth={10}>
        {data.map((item, index) => (
          <Ring index={index} key={item.label} />
        ))}
      </RingChart>

      <RingChart data={data} endAngle={Math.PI} size={280} startAngle={-Math.PI / 2}>
        {data.map((item, index) => (
          <Ring index={index} key={item.label} />
        ))}
        <RingCenter defaultLabel="Progress" />
      </RingChart>

      {/* Controlled hover; per-Ring color override, showGlow toggles (dead in bklit at runtime, API-preserved). */}
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

      <RingChart data={data} enterStaggerScale={1.5} enterTransition={tweenTransition} size={260}>
        {data.map((item, index) => (
          <Ring animate index={index} key={item.label} />
        ))}
      </RingChart>

      <RingChart data={data} enterTransition={springTransition} size={260}>
        {data.map((item, index) => (
          <Ring index={index} key={item.label} />
        ))}
      </RingChart>

      {/* geometryScrubbing: static paths, no WAAPI reveal; RingCenter still mounts (default variant while scrubbing). */}
      <RingChart data={data} geometryScrubbing size={260}>
        {data.map((item, index) => (
          <Ring index={index} key={item.label} />
        ))}
        <RingCenter />
      </RingChart>

      {/* RingCenter render-prop children run only while hovered. */}
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

      <RingChart data={data}>
        {data.map((item, index) => (
          <Ring index={index} key={item.label} />
        ))}
      </RingChart>

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
