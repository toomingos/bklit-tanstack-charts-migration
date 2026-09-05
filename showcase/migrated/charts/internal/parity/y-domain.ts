type YDomain = [number, number];

type ChartPhase =
  | "loading"
  | "exiting"
  | "gridTweenReady"
  | "revealing"
  | "ready"
  | "exitingReady"
  | "gridTweenLoading"
  | "revealingLoading";

interface LineConfig {
  dataKey: string;
  stroke: string;
  strokeWidth: number;
  yAxisId?: string | number;
}

interface YDomainRecord {
  [axisId: string]: YDomain;
}

const Y_DOMAIN_TWEEN_SKIP_THRESHOLD = 0.02;
const DEFAULT_Y_AXIS_ID = "left";
const NICE_TARGET_TICKS = 5;
const DECIMAL_BASE = 10;
const NICE_STEP_HIGH = 5;
const NICE_STEP_MID = 2;
const NICE_STEP_LOW = 1;
const NICE_STEP_TEN = 10;
const FALLBACK_DOMAIN_MIN = 0;
const FALLBACK_DOMAIN_MAX = 100;

const normalizeYAxisId = (id?: string | number): string => {
  if (id === undefined || id === "") {
    return DEFAULT_Y_AXIS_ID;
  }
  return String(id);
};

const niceYDomain = (domain: YDomain): YDomain => {
  const [startVal, endVal] = domain;
  if (!Number.isFinite(startVal) || !Number.isFinite(endVal)) {
    return [startVal, endVal];
  }
  if (startVal === endVal) {
    return [startVal - 1, endVal + 1];
  }
  const span = Math.abs(endVal - startVal);
  const step = span / NICE_TARGET_TICKS || 1;
  const mag = DECIMAL_BASE ** Math.floor(Math.log10(step));
  const norm = step / mag;
  const niceStep: number = (() => {
    if (norm >= NICE_STEP_HIGH) {
      return NICE_STEP_TEN * mag;
    }
    if (norm >= NICE_STEP_MID) {
      return NICE_STEP_HIGH * mag;
    }
    if (norm >= NICE_STEP_LOW) {
      return NICE_STEP_MID * mag;
    }
    return mag;
  })();
  const lowVal = Math.min(startVal, endVal);
  const highVal = Math.max(startVal, endVal);
  const lowNice = Math.floor(lowVal / niceStep) * niceStep;
  const highNice = Math.ceil(highVal / niceStep) * niceStep;
  if (startVal <= endVal) {
    return [lowNice, highNice];
  }
  return [highNice, lowNice];
};

const shouldTweenYDomain = (from: YDomain, to: YDomain): boolean => {
  const span = Math.max(Math.abs(to[1] - to[0]), Math.abs(from[1] - from[0]), 1);
  const deltaMin = Math.abs(to[0] - from[0]) / span;
  const deltaMax = Math.abs(to[1] - from[1]) / span;
  return (
    deltaMin >= Y_DOMAIN_TWEEN_SKIP_THRESHOLD ||
    deltaMax >= Y_DOMAIN_TWEEN_SKIP_THRESHOLD
  );
};

const isLoadingChromePhase = (phase: ChartPhase): boolean =>
  phase === "loading" || phase === "revealingLoading";

const computeYDomainsByAxis = ({
  lines,
  resolveDomain,
}: {
  lines: LineConfig[];
  resolveDomain: (dataKeys: string[]) => YDomain;
}): YDomainRecord => {
  const groups = new Map<string, LineConfig[]>();
  for (const line of lines) {
    const axisId = normalizeYAxisId(line.yAxisId);
    const bucket = groups.get(axisId) ?? [];
    bucket.push(line);
    groups.set(axisId, bucket);
  }
  const domains: Record<string, YDomain> = {};
  for (const [axisId, axisLines] of groups) {
    const dataKeys = axisLines.map((line) => line.dataKey);
    domains[normalizeYAxisId(axisId)] = niceYDomain(resolveDomain(dataKeys));
  }
  if (!("left" in domains)) {
    domains.left = niceYDomain([FALLBACK_DOMAIN_MIN, FALLBACK_DOMAIN_MAX]);
  }
  return domains;
};

const mergeYDomainRecords = (
  ...records: Record<string, YDomain>[]
): YDomainRecord => {
  const merged: Record<string, YDomain> = {};
  for (const record of records) {
    for (const [axisId, domain] of Object.entries(record)) {
      merged[normalizeYAxisId(axisId)] = domain;
    }
  }
  return merged;
};

export {
  computeYDomainsByAxis,
  isLoadingChromePhase,
  mergeYDomainRecords,
  niceYDomain,
  shouldTweenYDomain,
};
