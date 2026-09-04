
type ReferenceAreaIfOverflow = "hidden" | "visible" | "discard";

interface ReferenceAreaRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface ComputeReferenceAreaRectOptions {
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly x1?: Readonly<Date> | number;
  readonly x2?: Readonly<Date> | number;
  readonly y1?: number;
  readonly y2?: number;
  readonly ifOverflow?: ReferenceAreaIfOverflow;
  readonly xScale: (value: Readonly<Date>) => number;
  readonly yScale: (value: number) => number;
}

const toDate = (value: Readonly<Date> | number): Date => value instanceof Date ? value : new Date(value);


type MissingValue = null | undefined;

const isMissingValue = (value: Readonly<Date> | number | MissingValue): value is MissingValue => value === null || value === undefined;

const resolveXPixel = (xScale: (value: Readonly<Date>) => number, value: Readonly<Date> | number | undefined, fallback: number): number => {
  if (isMissingValue(value)) {return fallback;}
  return xScale(toDate(value));
}

const resolveYPixel = (yScale: (value: number) => number, value: number | undefined, fallback: number): number => {
  if (isMissingValue(value)) {return fallback;}
  return yScale(value);
}

const clampRectToPlot = (rect: Readonly<ReferenceAreaRect>, innerWidth: number, innerHeight: number): ReferenceAreaRect | null => {
  const x1 = Math.max(0, rect.x);
  const y1 = Math.max(0, rect.y);
  const x2 = Math.min(innerWidth, rect.x + rect.width);
  const y2 = Math.min(innerHeight, rect.y + rect.height);
  const width = x2 - x1;
  const height = y2 - y1;
  if (width <= 0 || height <= 0) {return null;}
  return { height, width, x: x1, y: y1 };
}

const isFullyInsidePlot = (rect: Readonly<ReferenceAreaRect>, innerWidth: number, innerHeight: number): boolean => (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.width <= innerWidth &&
    rect.y + rect.height <= innerHeight
  );


interface ReferenceAreaBoundsOptions {
  readonly x1?: Readonly<Date> | number;
  readonly x2?: Readonly<Date> | number;
  readonly y1?: number;
  readonly y2?: number;
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly xScale: (value: Readonly<Date>) => number;
  readonly yScale: (value: number) => number;
}

const resolveReferenceAreaBounds = (options: Readonly<ReferenceAreaBoundsOptions>): ReferenceAreaRect => {
  const { x1, x2, y1, y2, innerWidth, innerHeight, xScale, yScale } = options;
  const left = resolveXPixel(xScale, x1, 0);
  const right = resolveXPixel(xScale, x2, innerWidth);
  const top = resolveYPixel(yScale, y1, 0);
  const bottom = resolveYPixel(yScale, y2, innerHeight);
  const width = Math.abs(right - left);
  const height = Math.abs(bottom - top);
  return { height, width, x: Math.min(left, right), y: Math.min(top, bottom) };
}

interface ApplyReferenceAreaOverflowOptions {
  readonly rect: Readonly<ReferenceAreaRect>;
  readonly ifOverflow: ReferenceAreaIfOverflow;
  readonly innerWidth: number;
  readonly innerHeight: number;
}

const applyReferenceAreaOverflow = (options: Readonly<ApplyReferenceAreaOverflowOptions>): ReferenceAreaRect | null => {
  const { rect, ifOverflow, innerWidth, innerHeight } = options;
  if (ifOverflow === "visible") {return rect;}
  if (ifOverflow === "discard") {
    return isFullyInsidePlot(rect, innerWidth, innerHeight) ? rect : null;
  }
  return clampRectToPlot(rect, innerWidth, innerHeight);
}

const computeReferenceAreaRect = (options: Readonly<ComputeReferenceAreaRectOptions>): ReferenceAreaRect | null => {
  const { innerWidth, innerHeight, ifOverflow = "hidden" } = options;

  if (innerWidth <= 0 || innerHeight <= 0) {return null;}

  const bounds = resolveReferenceAreaBounds(options);
  if (bounds.width <= 0 || bounds.height <= 0) {return null;}

  return applyReferenceAreaOverflow({ ifOverflow, innerHeight, innerWidth, rect: bounds });
}

export type { ApplyReferenceAreaOverflowOptions, ReferenceAreaIfOverflow, ReferenceAreaRect, ComputeReferenceAreaRectOptions };
export { applyReferenceAreaOverflow, clampRectToPlot, isFullyInsidePlot, computeReferenceAreaRect };
