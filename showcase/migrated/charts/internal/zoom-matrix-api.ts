import { useCallback, useRef, useState } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import {
  applyInverseMatrixToPoint,
  applyMatrixToPoint,
  composeMatrices,
  identityMatrix,
  inverseMatrix,
  scaleMatrix,
  translateMatrix,
} from "./zoom-math";
import type { Point, TransformMatrix, Translate } from "./zoom-math";

// Core matrix callbacks for Zoom, split out so zoom-engine.tsx stays under the
// Size limits. Hook order and dependency arrays are verbatim from Zoom.

interface ZoomTransform<ElementType> {
  readonly containerRef: RefObject<ElementType | null>;
  readonly matrixStateRef: RefObject<TransformMatrix>;
  readonly transformMatrix: TransformMatrix;
  readonly setTransformMatrixState: Dispatch<SetStateAction<TransformMatrix>>;
  readonly isDragging: boolean;
  readonly setIsDragging: Dispatch<SetStateAction<boolean>>;
  readonly startTranslate: Translate | undefined;
  readonly setStartTranslate: Dispatch<SetStateAction<Translate | undefined>>;
  readonly startPoint: Point | undefined;
  readonly setStartPoint: Dispatch<SetStateAction<Point | undefined>>;
}

// Transform state for Zoom; one hook so Zoom stays short.
const useZoomTransform = <ElementType extends Element>(initialTransformMatrix: TransformMatrix): ZoomTransform<ElementType> => {
  const containerRef = useRef<ElementType | null>(null);
  const matrixStateRef = useRef(initialTransformMatrix);
  const [transformMatrix, setTransformMatrix] = useState(initialTransformMatrix);
  const [isDragging, setIsDragging] = useState(false);
  const [startTranslate, setStartTranslate] = useState<Translate | undefined>();
  const [startPoint, setStartPoint] = useState<Point | undefined>();
  return { containerRef, isDragging, matrixStateRef, setIsDragging, setStartPoint, setStartTranslate, setTransformMatrixState: setTransformMatrix, startPoint, startTranslate, transformMatrix };
};

interface ZoomConstrainArgs {
  readonly constrain?: (transform: TransformMatrix, prevTransform: TransformMatrix) => TransformMatrix;
  readonly scaleXMin: number;
  readonly scaleXMax: number;
  readonly scaleYMin: number;
  readonly scaleYMax: number;
}

// Scale-bounds constrain for Zoom; one hook so Zoom stays short.
const useZoomConstrain = (constrainArgs: Readonly<ZoomConstrainArgs>): ((newTransformMatrix: TransformMatrix, prevTransformMatrix: TransformMatrix) => TransformMatrix) => {
  const { constrain, scaleXMin, scaleXMax, scaleYMin, scaleYMax } = constrainArgs;
  return useCallback(
    (newTransformMatrix: TransformMatrix, prevTransformMatrix: TransformMatrix) => {
      if (constrain) {return constrain(newTransformMatrix, prevTransformMatrix);}
      const { scaleX, scaleY } = newTransformMatrix;
      const shouldConstrainScaleX = scaleX > scaleXMax || scaleX < scaleXMin;
      const shouldConstrainScaleY = scaleY > scaleYMax || scaleY < scaleYMin;
      if (shouldConstrainScaleX || shouldConstrainScaleY) {
        return prevTransformMatrix;
      }
      return newTransformMatrix;
    },
    [constrain, scaleXMin, scaleXMax, scaleYMin, scaleYMax],
  );
};

interface ScaleAroundPointArgs {
  readonly matrix: TransformMatrix;
  readonly scaleX: number;
  readonly scaleY: number | undefined;
  readonly point: Point | undefined;
  readonly width: number;
  readonly height: number;
}

interface ScaleAroundPointResult {
  readonly matrix: TransformMatrix;
  readonly anchor: Point | undefined;
  readonly translate: Translate;
}

// Next matrix for scaling around a point; hoisted so the scale callback stays short.
const scaleAroundPoint = (scaleArgs: Readonly<ScaleAroundPointArgs>): ScaleAroundPointResult => {
  const scaleY = scaleArgs.scaleY !== undefined && scaleArgs.scaleY !== 0 && !Number.isNaN(scaleArgs.scaleY) ? scaleArgs.scaleY : scaleArgs.scaleX;
  const cleanPoint = scaleArgs.point ?? { x: scaleArgs.width / 2, y: scaleArgs.height / 2 };
  const translate = applyInverseMatrixToPoint(scaleArgs.matrix, cleanPoint);
  const matrix = composeMatrices(
    scaleArgs.matrix,
    translateMatrix(translate.x, translate.y),
    scaleMatrix(scaleArgs.scaleX, scaleY),
    translateMatrix(-translate.x, -translate.y),
  );
  return { anchor: scaleArgs.point, matrix, translate: { translateX: scaleArgs.matrix.translateX, translateY: scaleArgs.matrix.translateY } };
};

interface ZoomCoreApi {
  readonly setTransformMatrix: (matrix: TransformMatrix) => void;
  readonly applyToPoint: (point: Point) => Point;
  readonly applyInverseToPoint: (point: Point) => Point;
  readonly reset: () => void;
}

interface ZoomCoreApiArgs<ElementType> {
  readonly defaultConstrain: (newTransformMatrix: TransformMatrix, prevTransformMatrix: TransformMatrix) => TransformMatrix;
  readonly initialTransformMatrix: TransformMatrix;
  readonly transform: Readonly<ZoomTransform<ElementType>>;
}

// The setTransformMatrix/apply/reset callbacks for Zoom; one hook so Zoom stays short.
const useZoomCoreApi = <ElementType extends Element>(api: Readonly<ZoomCoreApiArgs<ElementType>>): ZoomCoreApi => {
  const { defaultConstrain, initialTransformMatrix } = api;
  const { matrixStateRef, setTransformMatrixState, transformMatrix } = api.transform;
  const setTransformMatrix = useCallback(
    (newTransformMatrix: TransformMatrix) => {
      setTransformMatrixState((prevTransformMatrix) => {
        const updatedTransformMatrix = defaultConstrain(newTransformMatrix, prevTransformMatrix);
        matrixStateRef.current = updatedTransformMatrix;
        return updatedTransformMatrix;
      });
    },
    [defaultConstrain, matrixStateRef, setTransformMatrixState],
  );

  const applyToPoint = useCallback(
    ({ x, y }: Point) => applyMatrixToPoint(transformMatrix, { x, y }),
    [transformMatrix],
  );

  const applyInverseToPoint = useCallback(
    ({ x, y }: Point) => applyInverseMatrixToPoint(transformMatrix, { x, y }),
    [transformMatrix],
  );

  const reset = useCallback(() => {
    setTransformMatrix(initialTransformMatrix);
  }, [initialTransformMatrix, setTransformMatrix]);

  return { applyInverseToPoint, applyToPoint, reset, setTransformMatrix };
};

interface ScaleSignatureLocal {
  readonly scaleX: TransformMatrix["scaleX"];
  readonly scaleY?: TransformMatrix["scaleY"];
  readonly point?: Point;
}

interface ZoomScaleApi {
  readonly scale: (scale: ScaleSignatureLocal) => void;
  readonly translate: (translate: Translate) => void;
  readonly setTranslate: (translate: Translate) => void;
  readonly translateTo: (point: Point) => void;
}

interface ZoomScaleApiArgs<ElementType> {
  readonly width: number;
  readonly height: number;
  readonly transform: Readonly<ZoomTransform<ElementType>>;
  readonly setTransformMatrix: (matrix: TransformMatrix) => void;
}

// Scale/translate callbacks for Zoom; one hook so Zoom stays short.
const useZoomScaleApi = <ElementType extends Element>(api: Readonly<ZoomScaleApiArgs<ElementType>>): ZoomScaleApi => {
  const { height, setTransformMatrix, width } = api;
  const { isDragging, matrixStateRef, setStartPoint, setStartTranslate, transformMatrix } = api.transform;
  const scale = useCallback(
    ({ scaleX, scaleY: maybeScaleY, point }: ScaleSignatureLocal) => {
      const next = scaleAroundPoint({ height, matrix: matrixStateRef.current, point, scaleX, scaleY: maybeScaleY, width });
      setTransformMatrix(next.matrix);
      if (isDragging) {
        setStartPoint(next.anchor);
        setStartTranslate(next.translate);
      }
    },
    [height, width, isDragging, matrixStateRef, setStartPoint, setStartTranslate, setTransformMatrix],
  );

  const translate = useCallback(
    ({ translateX, translateY }: Translate) => {
      const nextMatrix = composeMatrices(transformMatrix, translateMatrix(translateX, translateY));
      setTransformMatrix(nextMatrix);
    },
    [setTransformMatrix, transformMatrix],
  );

  const setTranslate = useCallback(
    ({ translateX, translateY }: Translate) => {
      const nextMatrix = { ...transformMatrix, translateX, translateY };
      setTransformMatrix(nextMatrix);
    },
    [setTransformMatrix, transformMatrix],
  );

  const translateTo = useCallback(
    ({ x, y }: Point) => {
      const point = applyInverseMatrixToPoint(transformMatrix, { x, y });
      setTranslate({ translateX: point.x, translateY: point.y });
    },
    [setTranslate, transformMatrix],
  );

  return { scale, setTranslate, translate, translateTo };
};

interface ZoomViewApi {
  readonly invert: () => TransformMatrix;
  readonly toStringInvert: () => string;
  readonly toString: () => string;
  readonly center: () => void;
  readonly clear: () => void;
}

interface ZoomViewApiArgs {
  readonly width: number;
  readonly height: number;
  readonly transformMatrix: TransformMatrix;
  readonly applyInverseToPoint: (point: Point) => Point;
  readonly translate: (translate: Translate) => void;
  readonly setTransformMatrix: (matrix: TransformMatrix) => void;
}

// Invert/string/center/clear callbacks for Zoom; one hook so Zoom stays short.
const useZoomViewApi = (api: Readonly<ZoomViewApiArgs>): ZoomViewApi => {
  const { applyInverseToPoint, height, setTransformMatrix, transformMatrix, translate, width } = api;
  const invert = useCallback(() => inverseMatrix(transformMatrix), [transformMatrix]);

  const toStringInvert = useCallback(() => {
    const { translateX, translateY, scaleX, scaleY, skewX, skewY } = invert();
    return `matrix(${scaleX}, ${skewY}, ${skewX}, ${scaleY}, ${translateX}, ${translateY})`;
  }, [invert]);

  const toString = useCallback(() => {
    const { translateX, translateY, scaleX, scaleY, skewX, skewY } = transformMatrix;
    return `matrix(${scaleX}, ${skewY}, ${skewX}, ${scaleY}, ${translateX}, ${translateY})`;
  }, [transformMatrix]);

  const center = useCallback(() => {
    const centerPoint = { x: width / 2, y: height / 2 };
    const inverseCentroid = applyInverseToPoint(centerPoint);
    translate({
      translateX: inverseCentroid.x - centerPoint.x,
      translateY: inverseCentroid.y - centerPoint.y,
    });
  }, [height, width, applyInverseToPoint, translate]);

  const clear = useCallback(() => {
    setTransformMatrix(identityMatrix());
  }, [setTransformMatrix]);

  return { center, clear, invert, toString, toStringInvert };
};

export type { ZoomConstrainArgs, ZoomCoreApi, ZoomCoreApiArgs, ZoomScaleApi, ZoomScaleApiArgs, ZoomTransform, ZoomViewApi, ZoomViewApiArgs, ScaleAroundPointArgs, ScaleAroundPointResult };
export { scaleAroundPoint, useZoomConstrain, useZoomCoreApi, useZoomScaleApi, useZoomTransform, useZoomViewApi };
