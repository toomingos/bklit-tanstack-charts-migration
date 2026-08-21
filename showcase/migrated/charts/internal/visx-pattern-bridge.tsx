import {
  PatternCircles as VisxPatternCircles,
  PatternLines as VisxPatternLines,
} from "@visx/pattern";
import type { ComponentProps } from "react";

export function PatternLines(props: ComponentProps<typeof VisxPatternLines>) {
  return <VisxPatternLines {...props} />;
}
PatternLines.displayName = "PatternLines";

export function PatternCircles(
  props: ComponentProps<typeof VisxPatternCircles>,
) {
  return <VisxPatternCircles {...props} />;
}
PatternCircles.displayName = "PatternCircles";
