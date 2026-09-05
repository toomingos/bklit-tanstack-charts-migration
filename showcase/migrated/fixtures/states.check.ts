// V2.1 resolver check, scene half: builds a real pie definition.
// With the chart's focus-dim states and the focused-arc assertion.
import { createChartScene, defineChart } from "@tanstack/charts/scene";
import { polar, radialArc } from "@tanstack/charts/polar";
import type { ChartFocusState, ChartScene } from "@tanstack/charts";
import { withStates } from "@/migrated/charts/internal/with-states";
import { pieDimStates } from "@/migrated/charts/pie-chart";
import type { PieRowDatum } from "@/migrated/charts/pie-chart";

const CHECK_FILLS = ["#0ea5e9", "#f43f5e"];

const checkRows: readonly PieRowDatum[] = [
  { animate: true, cornerRadius: 0, dx: 0, dy: 0, endAngle: 2.6, fill: CHECK_FILLS[0] ?? "#0ea5e9", innerRadius: 0, outerRadius: 100, sliceIndex: 0, startAngle: 0 },
  { animate: true, cornerRadius: 0, dx: 0, dy: 0, endAngle: 6.28, fill: CHECK_FILLS[1] ?? "#f43f5e", innerRadius: 0, outerRadius: 100, sliceIndex: 1, startAngle: 2.6 },
];

interface StatesCheckInput {
  readonly scene: ChartScene;
  readonly focus: ChartFocusState;
}

interface StateResolver {
  readonly resolve: (scene: ChartScene, focus: ChartFocusState) => ResolvedStatesScene;
  readonly hasStates: (nodes: ChartScene["nodes"]) => boolean;
}

interface ResolvedStatesScene {
  readonly scene: { readonly nodes: readonly unknown[] };
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

const asNodes = (value: unknown): readonly unknown[] => {
  if (!isObject(value) || !("nodes" in value) || !Array.isArray(value.nodes)) {
    throw new Error("states check: resolver returned no scene nodes");
  }
  return value.nodes;
};

const collectFills = (node: unknown, out: string[]): void => {
  if (!isObject(node)) {
    return;
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectFills(child, out);
    }
    return;
  }
  if (isObject(node.style) && isString(node.style.fill)) {
    out.push(node.style.fill);
  }
};

const buildStatesCheckInput = (): StatesCheckInput => {
  const sliceMark = radialArc(checkRows, {
    endAngle: "endAngle",
    fill: (datum: Readonly<PieRowDatum>) => datum.fill,
    id: "states-check-slices",
    key: (datum: Readonly<PieRowDatum>) => String(datum.sliceIndex),
    startAngle: "startAngle",
  });
  const containerMark = polar({ marks: [sliceMark], scales: { angle: null, radius: null } });
  const dimStates = pieDimStates({ getFill: (index: number) => CHECK_FILLS[index] ?? "#0ea5e9", sliceConfigOf: () => undefined });
  const definition = defineChart({
    marks: [withStates(containerMark, checkRows, dimStates)],
    scales: { x: null, y: null },
  });
  const scene = createChartScene(definition, { height: 360, width: 640 });
  const focusedPoint = scene.points.find((point) => point.datumIndex === 0) ?? scene.points.at(0);
  if (!focusedPoint) {
    throw new Error("states check: radialArc emitted no points");
  }
  return { focus: { group: [focusedPoint], pinned: false, primary: focusedPoint, source: "pointer" }, scene };
};

const runStatesCheckWith = (resolver: StateResolver): string => {
  const input = buildStatesCheckInput();
  if (!resolver.hasStates(input.scene.nodes)) {
    throw new Error("states check: scene has no mark states (withStates wrapper missing?)");
  }
  const resolved = resolver.resolve(input.scene, input.focus);
  const fills: string[] = [];
  for (const node of asNodes(resolved.scene)) {
    collectFills(node, fills);
  }
  const focusedFill = CHECK_FILLS[0] ?? "#0ea5e9";
  const others = fills.filter((fill) => fill !== focusedFill);
  if (!fills.includes(focusedFill)) {
    throw new Error(`states check: focused arc lost its base fill (fills: ${fills.join(", ")})`);
  }
  if (others.every((fill) => fill === focusedFill)) {
    throw new Error(`states check: no arc dimmed for the focused arc (fills: ${fills.join(", ")})`);
  }
  return `states resolver: focused arc keeps ${focusedFill}, other resolves to ${others[0]}`;
};

export { buildStatesCheckInput, runStatesCheckWith };
