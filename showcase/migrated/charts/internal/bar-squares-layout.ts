const bandWidthForSquares = (bandWidth: number, seriesCount: number, groupGap: number): number => {
  if (!bandWidth || seriesCount === 0) {return 0;}
  const effectiveGroupGap = seriesCount > 1 ? groupGap : 0;
  return (bandWidth - effectiveGroupGap * (seriesCount - 1)) / seriesCount;
}

interface SquareColumnLayout {
  count: number;
  positions: number[];
  columnHeight: number;
  squareSize: number;
  gap: number;
}

interface SquareColumnInput {
  readonly barLengthPx: number;
  readonly squareSize: number;
  readonly gap: number;
  readonly fit?: boolean;
}

const layoutFittedSquareColumn = (params: Readonly<SquareColumnInput>): SquareColumnLayout => {
  const { barLengthPx, squareSize, gap } = params;
  const count = Math.max(
    1,
    Math.floor((barLengthPx + gap) / (squareSize + gap))
  );
  const effectiveGap =
    count > 1
      ? Math.max(0, (barLengthPx - count * squareSize) / (count - 1))
      : 0;
  const step = squareSize + effectiveGap;
  const positions: number[] = [];
  for (let i = 0; i < count; i += 1) {
    positions.push(barLengthPx - squareSize - i * step);
  }
  return {
    columnHeight: barLengthPx,
    count,
    gap: effectiveGap,
    positions,
    squareSize,
  };
}

const layoutFilledSquareColumn = (params: Readonly<SquareColumnInput>): SquareColumnLayout => {
  const { barLengthPx, squareSize, gap } = params;
  const step = squareSize + gap;
  const count = Math.max(1, Math.round(barLengthPx / step));
  const columnHeight = count * squareSize + Math.max(0, count - 1) * gap;
  const positions: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const offsetFromBottom = i * step;
    positions.push(columnHeight - squareSize - offsetFromBottom);
  }
  return { columnHeight, count, gap, positions, squareSize };
}

const computeSquareColumn = ({
  barLengthPx,
  squareSize,
  gap,
  fit = false,
}: SquareColumnInput): SquareColumnLayout => {
  if (barLengthPx <= 0 || squareSize <= 0) {
    return { columnHeight: 0, count: 0, gap, positions: [], squareSize };
  }
  if (fit) {return layoutFittedSquareColumn({ barLengthPx, fit, gap, squareSize });}
  return layoutFilledSquareColumn({ barLengthPx, fit, gap, squareSize });
}

const topSquareCenterY = ({
  baselineY,
  barLengthPx,
  squareSize,
  gap,
  fit = false,
}: SquareColumnInput & { readonly baselineY: number }): number => {
  const {
    count,
    squareSize: size,
    columnHeight,
  } = computeSquareColumn({
    barLengthPx,
    fit,
    gap,
    squareSize,
  });

  if (count === 0) {
    return baselineY;
  }

  const topY = baselineY - columnHeight;
  return topY + size / 2;
}

export { bandWidthForSquares, computeSquareColumn, topSquareCenterY };
export type { SquareColumnLayout, SquareColumnInput };
