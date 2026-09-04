// 2-D matrix math for the vendored @visx/zoom port in ./zoom-engine.
// Split out so zoom-engine.tsx stays under the size limits.

interface TransformMatrix {
  readonly scaleX: number;
  readonly scaleY: number;
  readonly translateX: number;
  readonly translateY: number;
  readonly skewX: number;
  readonly skewY: number;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

type Translate = Pick<TransformMatrix, "translateX" | "translateY">;
type Scale = Pick<TransformMatrix, "scaleX" | "scaleY">;

// Wheel/pinch step factors (bklit @visx/zoom parity): zoom-in multiplies by 1.1,
// Zoom-out uses its approximate inverse 0.9.
const ZOOM_STEP_IN_FACTOR = 1.1;
const ZOOM_STEP_OUT_FACTOR = 0.9;


const identityMatrix = (): TransformMatrix => (
  {
    scaleX: 1,
    scaleY: 1,
    skewX: 0,
    skewY: 0,
    translateX: 0,
    translateY: 0,
  }
);

const createMatrix = ({
  scaleX = 1,
  scaleY = 1,
  translateX = 0,
  translateY = 0,
  skewX = 0,
  skewY = 0,
}: Partial<TransformMatrix>): TransformMatrix => (
  { scaleX, scaleY, skewX, skewY, translateX, translateY }
);

const inverseMatrix = ({
  scaleX,
  scaleY,
  translateX,
  translateY,
  skewX,
  skewY,
}: TransformMatrix): TransformMatrix => {
  const denominator = scaleX * scaleY - skewY * skewX;
  return {
    scaleX: scaleY / denominator,
    scaleY: scaleX / denominator,
    skewX: skewX / -denominator,
    skewY: skewY / -denominator,
    translateX: (scaleY * translateX - skewX * translateY) / -denominator,
    translateY: (skewY * translateX - scaleX * translateY) / denominator,
  };
}

const applyMatrixToPoint = (matrix: TransformMatrix, { x, y }: Point): Point => (
  {
    x: matrix.scaleX * x + matrix.skewX * y + matrix.translateX,
    y: matrix.skewY * x + matrix.scaleY * y + matrix.translateY,
  }
);

const applyInverseMatrixToPoint = (matrix: TransformMatrix, { x, y }: Point): Point => applyMatrixToPoint(inverseMatrix(matrix), { x, y });


const scaleMatrix = (scaleX: TransformMatrix["scaleX"], maybeScaleY?: TransformMatrix["scaleY"]): TransformMatrix => {
  const scaleY = maybeScaleY !== undefined && maybeScaleY !== 0 && !Number.isNaN(maybeScaleY) ? maybeScaleY : scaleX;
  return createMatrix({ scaleX, scaleY });
}

const translateMatrix = (translateX: TransformMatrix["translateX"], translateY: TransformMatrix["translateY"]): TransformMatrix => createMatrix({ translateX, translateY });


const multiplyMatrices = (matrix1: TransformMatrix, matrix2: TransformMatrix): TransformMatrix => (
  {
    scaleX: matrix1.scaleX * matrix2.scaleX + matrix1.skewX * matrix2.skewY,
    scaleY: matrix1.skewY * matrix2.skewX + matrix1.scaleY * matrix2.scaleY,
    skewX: matrix1.scaleX * matrix2.skewX + matrix1.skewX * matrix2.scaleY,
    skewY: matrix1.skewY * matrix2.scaleX + matrix1.scaleY * matrix2.skewY,
    translateX: matrix1.scaleX * matrix2.translateX + matrix1.skewX * matrix2.translateY + matrix1.translateX,
    translateY: matrix1.skewY * matrix2.translateX + matrix1.scaleY * matrix2.translateY + matrix1.translateY,
  }
);

const composeMatrices = (...matrices: readonly TransformMatrix[]): TransformMatrix => {
  switch (matrices.length) {
    case 0: {
      throw new Error("composeMatrices() requires arguments: was called with no args");
    }
    case 1: {
      return matrices[0];
    }
    case 2: {
      return multiplyMatrices(matrices[0], matrices[1]);
    }
    default: {
      const [matrix1, matrix2, ...restMatrices] = matrices;
      const matrix = multiplyMatrices(matrix1, matrix2);
      return composeMatrices(matrix, ...restMatrices);
    }
  }
}

export type { TransformMatrix, Point, Translate, Scale };
export {
  ZOOM_STEP_IN_FACTOR,
  ZOOM_STEP_OUT_FACTOR,
  identityMatrix,
  createMatrix,
  inverseMatrix,
  applyMatrixToPoint,
  applyInverseMatrixToPoint,
  scaleMatrix,
  translateMatrix,
  multiplyMatrices,
  composeMatrices,
};
