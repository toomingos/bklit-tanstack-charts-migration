
/** Leftmost bisect — returns first index i such that accessor(data[i]) >= target. */

interface BisectDateLeftParams<Datum> {
  readonly data: readonly Datum[];
  readonly accessor: (datum: Datum) => number;
  readonly target: number;
  readonly loBound: number;
  readonly hiBound: number;
}

interface BisectCursor {
  lo: number;
  hi: number;
}

interface BisectStepParams<Datum> {
  readonly data: readonly Datum[];
  readonly accessor: (datum: Datum) => number;
  readonly target: number;
  readonly mid: number;
  readonly cursor: BisectCursor;
}

const midIndex = (lo: number, hi: number): number => (lo + hi - ((lo + hi) % 2)) / 2;

const midValueAt = <Datum>(data: readonly Datum[], accessor: (datum: Datum) => number, mid: number): number | undefined => {
  const midDatum = data[mid];
  if (midDatum === undefined) {return undefined;}
  return accessor(midDatum);
};

// Advances one binary-search step; reports false on the out-of-range guard.
// Mutates `cursor` in place so the hot loop allocates nothing per iteration.
const stepBisectCursor = <Datum>(params: Readonly<BisectStepParams<Datum>>): boolean => {
  const midVal = midValueAt(params.data, params.accessor, params.mid);
  if (midVal === undefined) {return false;}
  if (midVal < params.target) {params.cursor.lo = params.mid + 1;}
  else {params.cursor.hi = params.mid;}
  return true;
};

const bisectDateLeft = <Datum>(params: Readonly<BisectDateLeftParams<Datum>>): number => {
  const cursor: BisectCursor = { hi: params.hiBound, lo: params.loBound };
  while (cursor.lo < cursor.hi) {
    const mid = midIndex(cursor.lo, cursor.hi);
    const step = { accessor: params.accessor, cursor, data: params.data, mid, target: params.target };
    if (!stepBisectCursor(step)) {break;}
  }
  return cursor.lo;
}

/** Nearest datum by bisect; strict `>` tie-break favors the earlier point (bklit parity). */

interface NeighborIndexParams<Datum> {
  readonly data: readonly Datum[];
  readonly accessor: (datum: Datum) => number;
  readonly target: number;
  readonly index: number;
}

interface NeighborTieBreakParams<Datum> {
  readonly accessor: (datum: Datum) => number;
  readonly target: number;
  readonly index: number;
  readonly prevDatum: Datum;
  readonly nextDatum: Datum;
}

const breakNeighborTie = <Datum>(params: Readonly<NeighborTieBreakParams<Datum>>): number => {
  const prevVal = params.accessor(params.prevDatum);
  const nextVal = params.accessor(params.nextDatum);
  if (params.target - prevVal > nextVal - params.target) {return params.index;}
  return params.index - 1;
}

const nearestIndexFromNeighbors = <Datum>(params: Readonly<NeighborIndexParams<Datum>>): number => {
  const prevDatum = params.data[params.index - 1];
  const nextDatum = params.data[params.index];
  if (prevDatum === undefined || prevDatum === null) {return -1;}
  if (nextDatum === undefined || nextDatum === null) {return params.index - 1;}
  return breakNeighborTie({ accessor: params.accessor, index: params.index, nextDatum, prevDatum, target: params.target });
}

const resolveNearestIndex = <Datum>(data: readonly Datum[], accessor: (datum: Datum) => number, target: number): number => {
  const index = bisectDateLeft({ accessor, data, hiBound: data.length, loBound: 1, target });
  return nearestIndexFromNeighbors({ accessor, data, index, target });
}

export { bisectDateLeft, resolveNearestIndex };
export type { BisectCursor, BisectDateLeftParams, BisectStepParams, NeighborIndexParams, NeighborTieBreakParams };
