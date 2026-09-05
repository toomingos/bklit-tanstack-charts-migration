// Sets `states` on the initialized mark for option types that omit the field.
// Upstream TanStack/charts#126 (I1); resolver: dist/scene.js:187-197.
import type { ChartMark, ChartMarkState, ChartValue } from "@tanstack/charts";

// Narrow carrier for `InitializedMarkBase.states` (dist/types.d.ts:672).
// Avoids `any` at the call sites.
interface InitializedStates<TDatum> {
  readonly states: {
    readonly data: readonly unknown[];
    readonly definitions: readonly ChartMarkState<TDatum>[];
  };
}

const withStates = <
  TDatum,
  TXPointValue extends ChartValue,
  TYPointValue extends ChartValue,
  TXScaleValue extends ChartValue,
  TYScaleValue extends ChartValue,
  TXScaleId extends string,
  TYScaleId extends string,
>(
  mark: ChartMark<TDatum, TXPointValue, TYPointValue, TXScaleValue, TYScaleValue, TXScaleId, TYScaleId>,
  data: readonly unknown[],
  definitions: readonly ChartMarkState<TDatum>[],
): ChartMark<TDatum, TXPointValue, TYPointValue, TXScaleValue, TYScaleValue, TXScaleId, TYScaleId> => ({
  ...mark,
  initialize: (context) => {
    const states: InitializedStates<TDatum>["states"] | undefined =
      definitions.length > 0 ? { data, definitions } : undefined;
    return { ...mark.initialize(context), states };
  },
});

export { withStates };
