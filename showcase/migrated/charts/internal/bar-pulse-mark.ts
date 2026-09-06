import { createMark } from "@tanstack/charts";
import type { ChartMark, MarkRenderContext, MarkScene, SceneNode } from "@tanstack/charts";
import { barDepthAndRise, barDepthMaxDepth, resolveBandFrame } from "./bar-depth-geometry";
import type { ChartDatum } from "./types";

const PULSE_WAVE_HEIGHT_RATIO = 0.55;
const PULSE_WAVE_HEIGHT_MIN_PX = 36;

interface BarSilhouetteArgs {
  readonly bandX: number;
  readonly bandWidth: number;
  readonly topY: number;
  readonly bottomY: number;
  readonly depth: number;
  readonly perspectiveRise: number;
  readonly isRightOfCenter: boolean;
}

const buildBarSilhouettePath = (silhouette: Readonly<BarSilhouetteArgs>): string => {
  if (silhouette.depth <= 0) {
    return [`M ${silhouette.bandX} ${silhouette.topY}`, `L ${silhouette.bandX + silhouette.bandWidth} ${silhouette.topY}`, `L ${silhouette.bandX + silhouette.bandWidth} ${silhouette.bottomY}`, `L ${silhouette.bandX} ${silhouette.bottomY}`, "Z"].join(" ");
  }
  if (silhouette.isRightOfCenter) {
    return [
      `M ${silhouette.bandX - silhouette.depth} ${silhouette.topY - silhouette.perspectiveRise}`,
      `L ${silhouette.bandX + silhouette.bandWidth - silhouette.depth} ${silhouette.topY - silhouette.perspectiveRise}`,
      `L ${silhouette.bandX + silhouette.bandWidth} ${silhouette.topY}`,
      `L ${silhouette.bandX + silhouette.bandWidth} ${silhouette.bottomY}`,
      `L ${silhouette.bandX} ${silhouette.bottomY}`,
      `L ${silhouette.bandX - silhouette.depth} ${silhouette.bottomY - silhouette.perspectiveRise}`,
      "Z",
    ].join(" ");
  }
  return [
    `M ${silhouette.bandX} ${silhouette.topY}`,
    `L ${silhouette.bandX + silhouette.depth} ${silhouette.topY - silhouette.perspectiveRise}`,
    `L ${silhouette.bandX + silhouette.bandWidth + silhouette.depth} ${silhouette.topY - silhouette.perspectiveRise}`,
    `L ${silhouette.bandX + silhouette.bandWidth + silhouette.depth} ${silhouette.bottomY - silhouette.perspectiveRise}`,
    `L ${silhouette.bandX + silhouette.bandWidth} ${silhouette.bottomY}`,
    `L ${silhouette.bandX} ${silhouette.bottomY}`,
    "Z",
  ].join(" ");
}

interface BarPulseMarkOptions {
  readonly id: string;
  readonly data: readonly Readonly<ChartDatum>[];
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly yAccessor: (datum: Readonly<ChartDatum>) => number;
  readonly activeIndex?: number;
  readonly pulsePaused?: boolean;
  /** Id of the host-built wave linearGradient def (see buildPulseWaveStops). */
  readonly gradientId: string;
}

interface ActivePulseIndexArgs {
  readonly activeIndex: number | undefined;
  readonly dataLength: number;
  readonly pulsePaused: boolean | undefined;
}

// Validates the pulse target; undefined when the pulse must not render. Hoisted so barPulseMark stays short.
const resolveActivePulseIndex = (indexArgs: Readonly<ActivePulseIndexArgs>): number | undefined => {
  if (indexArgs.pulsePaused === true) {return undefined;}
  if (indexArgs.activeIndex === undefined || !Number.isFinite(indexArgs.activeIndex)) {return undefined;}
  if (indexArgs.activeIndex < 0 || indexArgs.activeIndex >= indexArgs.dataLength) {return undefined;}
  return indexArgs.activeIndex;
};

interface BarPulseChannelsArgs {
  readonly data: readonly Readonly<ChartDatum>[];
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly yAccessor: (datum: Readonly<ChartDatum>) => number;
}

interface BarPulseChannels {
  readonly xValues: string[];
  readonly yValues: readonly number[];
}

// Channel values for the pulse mark; hoisted so the mark factory stays short.
const buildBarPulseChannels = (channelArgs: Readonly<BarPulseChannelsArgs>): BarPulseChannels => ({
  xValues: channelArgs.data.map((datum) => channelArgs.categoryAccessor(datum)),
  yValues: channelArgs.data.map((datum) => channelArgs.yAccessor(datum)),
});

interface ActivePulseBarArgs {
  readonly activeIndex: number;
  readonly data: readonly Readonly<ChartDatum>[];
  readonly xValues: readonly string[];
  readonly yValues: readonly number[];
  readonly scales: MarkRenderContext["scales"];
}

interface ActivePulseBar {
  readonly xValue: string | undefined;
  readonly yValue: number;
  readonly baseline: number;
  readonly valuePos: number;
}

// Finite-number check for pulse channel values; hoisted so readers stay short.
const isNumber = <Value>(value: Value): value is Value & number => typeof value === "number";

// Active bar values plus its pixel positions; undefined when nothing may paint. Hoisted so the scene renderer stays short.
const readActivePulseBar = (readArgs: Readonly<ActivePulseBarArgs>): ActivePulseBar | undefined => {
  const datum = readArgs.data.at(readArgs.activeIndex);
  if (!datum) {return undefined;}
  const yValue = readArgs.yValues[readArgs.activeIndex];
  if (!isNumber(yValue) || !Number.isFinite(yValue) || yValue <= 0) {return undefined;}
  const baseline = readArgs.scales.y.map(0);
  const valuePos = readArgs.scales.y.map(yValue);
  return { baseline, valuePos, xValue: readArgs.xValues[readArgs.activeIndex], yValue };
};

interface DepthOffsetArgs {
  readonly bandX: number;
  readonly bandWidth: number;
  readonly innerWidth: number;
  readonly centerX: number;
}

interface DepthOffset {
  readonly absOffset: number;
  readonly isRightOfCenter: boolean;
}

// Perspective offset of the bar from the chart center; hoisted so the frame resolver stays short.
const resolveDepthOffset = (offsetArgs: Readonly<DepthOffsetArgs>): DepthOffset => {
  const cx = offsetArgs.bandX + offsetArgs.bandWidth / 2;
  const offsetFromCenter = offsetArgs.innerWidth > 0 ? (cx - offsetArgs.centerX) / (offsetArgs.innerWidth / 2) : 0;
  return { absOffset: Math.min(1, Math.abs(offsetFromCenter)), isRightOfCenter: offsetFromCenter > 0 };
};

interface PulseBarFrameArgs {
  readonly bandX: number;
  readonly bandWidth: number;
  readonly bandStep: number;
  readonly innerWidth: number;
  readonly centerX: number;
  readonly baseline: number;
  readonly valuePos: number;
}

interface PulseBarFrame {
  readonly bandX: number;
  readonly depth: number;
  readonly perspectiveRise: number;
  readonly isRightOfCenter: boolean;
  readonly topY: number;
  readonly bottomY: number;
  readonly barHeight: number;
}

// Bar frame in pixels; undefined when the bar has no positive length. Hoisted so the scene renderer stays short.
const resolvePulseBarFrame = (frameArgs: Readonly<PulseBarFrameArgs>): PulseBarFrame | undefined => {
  if (!Number.isFinite(frameArgs.valuePos)) {return undefined;}
  const barLengthPx = frameArgs.baseline - frameArgs.valuePos;
  if (barLengthPx <= 0) {return undefined;}
  const maxDepth = barDepthMaxDepth(frameArgs.bandStep, frameArgs.bandWidth);
  const offset = resolveDepthOffset({ bandWidth: frameArgs.bandWidth, bandX: frameArgs.bandX, centerX: frameArgs.centerX, innerWidth: frameArgs.innerWidth });
  const { depth, perspectiveRise } = barDepthAndRise(offset.absOffset, barLengthPx, maxDepth);
  return { bandX: frameArgs.bandX, barHeight: barLengthPx, bottomY: frameArgs.baseline, depth, isRightOfCenter: offset.isRightOfCenter, perspectiveRise, topY: frameArgs.valuePos };
};

interface PulseNodeArgs {
  readonly id: string;
  readonly frame: Readonly<PulseBarFrame>;
  readonly bandWidth: number;
  readonly gradientId: string;
}

// Silhouette + wave nodes; hoisted so the scene renderer stays a short decision chain.
const buildBarPulseNodes = (nodeArgs: Readonly<PulseNodeArgs>): SceneNode[] => {
  const silhouettePath = buildBarSilhouettePath({ bandWidth: nodeArgs.bandWidth, bandX: nodeArgs.frame.bandX, bottomY: nodeArgs.frame.bottomY, depth: nodeArgs.frame.depth, isRightOfCenter: nodeArgs.frame.isRightOfCenter, perspectiveRise: nodeArgs.frame.perspectiveRise, topY: nodeArgs.frame.topY });
  const waveHeight = Math.max(nodeArgs.frame.barHeight * PULSE_WAVE_HEIGHT_RATIO, PULSE_WAVE_HEIGHT_MIN_PX);
  const nodes: SceneNode[] = [
    {
      ariaHidden: true,
      children: [
        // Invisible silhouette read back as the clipPath source (no scene clipPath node type).
        {
          key: `${nodeArgs.id}:silhouette`,
          kind: "area",
          path: silhouettePath,
          points: [],
          style: { fill: "none" },
        },
        // Wave parked at sweep start (bar bottom); clipped + animated imperatively post-reveal.
        {
          height: waveHeight,
          key: `${nodeArgs.id}:wave`,
          kind: "rect",
          style: { fill: `url(#${nodeArgs.gradientId})` },
          width: nodeArgs.bandWidth + 2 * nodeArgs.frame.depth + 2,
          x: nodeArgs.frame.bandX - nodeArgs.frame.depth - 1,
          y: nodeArgs.frame.bottomY,
        },
      ],
      // Renamed off the `ts-chart__bar` substring so native motion role probing never matches.
      className: "bkm-chart__bar-pulse",
      key: nodeArgs.id,
      kind: "group",
    },
  ];
  return nodes;
};

interface PulseSceneArgs {
  readonly context: MarkRenderContext;
  readonly data: readonly Readonly<ChartDatum>[];
  readonly xValues: readonly string[];
  readonly yValues: readonly number[];
  readonly activeIndex: number;
  readonly gradientId: string;
  readonly id: string;
}

// Scene for the active bar; empty when nothing may paint. Hoisted so the mark factory stays short.
const renderBarPulseScene = (sceneArgs: Readonly<PulseSceneArgs>): MarkScene<ChartDatum, string, number> => {
  const active = readActivePulseBar({ activeIndex: sceneArgs.activeIndex, data: sceneArgs.data, scales: sceneArgs.context.scales, xValues: sceneArgs.xValues, yValues: sceneArgs.yValues });
  if (!active) {return { nodes: [], points: [] };}
  // Band geometry resolves at scene build from the package scale (V1.2/G6).
  const { bandPos, bandStep, bandWidth } = resolveBandFrame(sceneArgs.context.scales.x);
  const frame = resolvePulseBarFrame({ bandStep, bandWidth, bandX: bandPos(String(active.xValue)), baseline: active.baseline, centerX: sceneArgs.context.chart.x + sceneArgs.context.chart.width / 2, innerWidth: sceneArgs.context.chart.width, valuePos: active.valuePos });
  if (!frame) {return { nodes: [], points: [] };}
  return { nodes: buildBarPulseNodes({ bandWidth, frame, gradientId: sceneArgs.gradientId, id: sceneArgs.id }) };
};

interface BarPulseMarkInstanceArgs {
  readonly data: readonly Readonly<ChartDatum>[];
  readonly options: Readonly<BarPulseMarkOptions>;
  readonly index: number;
}

// Mark instance wiring; hoisted so barPulseMark stays a short validation + delegation.
const createBarPulseMarkInstance = (instanceArgs: Readonly<BarPulseMarkInstanceArgs>): ChartMark<ChartDatum, string, number> => {
  const channels = buildBarPulseChannels({ categoryAccessor: instanceArgs.options.categoryAccessor, data: instanceArgs.data, yAccessor: instanceArgs.options.yAccessor });
  // Motion forced off: the pulse choreography is imperative (WAAPI loop below), and this must never match native motion's role probe.
  return createMark(() => ({
    channels: {
      x: { scale: "x", values: channels.xValues },
      y: {
        includeZero: true,
        scale: "y",
        values: channels.yValues.filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
      },
    },
    id: instanceArgs.options.id,
    render: (context: MarkRenderContext): MarkScene<ChartDatum, string, number> => renderBarPulseScene({
      activeIndex: instanceArgs.index,
      context,
      data: instanceArgs.data,
      gradientId: instanceArgs.options.gradientId,
      id: instanceArgs.options.id,
      xValues: channels.xValues,
      yValues: channels.yValues,
    }),
  }), () => false);
};

const barPulseMark = (data: readonly Readonly<ChartDatum>[], options: Readonly<BarPulseMarkOptions>): ChartMark<ChartDatum, string, number> | null => {
  const index = resolveActivePulseIndex({ activeIndex: options.activeIndex, dataLength: data.length, pulsePaused: options.pulsePaused });
  if (index === undefined) {return null;}
  return createBarPulseMarkInstance({ data, index, options });
};

export {
  barPulseMark,
  buildBarSilhouettePath,
  PULSE_WAVE_HEIGHT_MIN_PX,
  PULSE_WAVE_HEIGHT_RATIO,
};
export { buildPulseWaveStops, PULSE_WAVE_DURATION_S, PULSE_WAVE_PEAK_OPACITY } from "./bar-pulse-clip";
export type { BarPulseMarkOptions };
export type { PulseWaveGradientStop } from "./bar-pulse-clip";
