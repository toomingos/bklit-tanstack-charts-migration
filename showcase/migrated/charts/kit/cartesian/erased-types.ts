import type { ChartInteractionController, ChartMark, ChartPoint } from "@tanstack/charts";

// Lists of marks, points and controllers hold entries with different datum / scale generics; only `any` accepts them all.
/* oxlint-disable typescript/no-explicit-any -- generic erasure for heterogeneous TanStack collections */
export type AnyMark = ChartMark<any, any, any, any, any, any, any>;
export type AnyInteraction = ChartInteractionController<any, any, any>;
export type AnyPoint = ChartPoint<any, any, any>;
/* oxlint-enable typescript/no-explicit-any */

/** TanStack's mark / definition / renderer generics are invariant in the datum and scale types, which these builders erase;
 * every unchecked boundary cast goes through here. */
export function erase(value: unknown): never {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion, anti-slop/require-safety-comment-for-type-assertion -- the one erasure point, justified above
  return value as never;
}
