// Hint-content resolution for sunburst, split from sunburst-hint so the
// Component file exports components only.
import type { ReactNode } from "react";
import type { SunburstHintContext, SunburstHintProps } from './sunburst-hint';

type SunburstHintRenderFn = (context: Readonly<SunburstHintContext>) => ReactNode;

const isHintRenderFn = <Children,>(children: Children): children is Children & SunburstHintRenderFn => typeof children === "function";

const resolveSunburstHintContent = (children: SunburstHintProps["children"], context: SunburstHintContext): ReactNode => {
  if (isHintRenderFn(children)) {return children(context);}
  return children ?? context.hintText;
};

export { resolveSunburstHintContent };
export type { SunburstHintRenderFn };
