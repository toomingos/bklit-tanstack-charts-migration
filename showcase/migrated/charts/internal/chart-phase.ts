
type ChartStatus = "loading" | "ready";

type ChartPhase =
  | "loading"
  | "exiting"
  | "gridTweenReady"
  | "revealing"
  | "ready"
  | "exitingReady"
  | "gridTweenLoading"
  | "revealingLoading";

const DEFAULT_CHART_STATUS: ChartStatus = "ready";

const DEFAULT_Y_DOMAIN_TWEEN_MS = 500;

/** A y-domain move under 2% of the larger span is snapped, not tweened — below that the animation is invisible but still costs a 500ms mid-flight grid window. */
const Y_DOMAIN_TWEEN_SKIP_THRESHOLD = 0.02;

/** Default y-domain upper bound for the skeleton/target domain before data resolves. */
const DEFAULT_Y_DOMAIN_MAX = 100;

// Tuple-typed defaults so the lifecycle literal below needs no narrowing assertion.
const DEFAULT_SKELETON_Y_DOMAIN: [number, number] = [0, DEFAULT_Y_DOMAIN_MAX];
const DEFAULT_TARGET_Y_DOMAIN: [number, number] = [0, DEFAULT_Y_DOMAIN_MAX];

const resolveRestingChartPhase = (status: ChartStatus): ChartPhase => status === "loading" ? "loading" : "ready";


const isChartInteractionPhase = (phase: ChartPhase): boolean => phase === "ready";


const DEFAULT_CHART_LIFECYCLE = {
  chartPhase: "ready",
  chartStatus: "ready",
  loadingLabel: undefined,
  yDomainSkeletonByAxis: { left: DEFAULT_SKELETON_Y_DOMAIN },
  yDomainTargetByAxis: { left: DEFAULT_TARGET_Y_DOMAIN },
  yDomainTweenDuration: DEFAULT_Y_DOMAIN_TWEEN_MS,
} as const satisfies {
  chartPhase: ChartPhase;
  chartStatus: ChartStatus;
  loadingLabel: undefined;
  yDomainTweenDuration: number;
  yDomainSkeletonByAxis: Record<string, [number, number]>;
  yDomainTargetByAxis: Record<string, [number, number]>;
};

export { DEFAULT_CHART_STATUS, DEFAULT_Y_DOMAIN_TWEEN_MS, Y_DOMAIN_TWEEN_SKIP_THRESHOLD, resolveRestingChartPhase, isChartInteractionPhase, DEFAULT_CHART_LIFECYCLE };
export type { ChartStatus, ChartPhase };
