import type { ReactNode } from "react";
import type { ArcDatum, Focus } from "./sunburst-types";


interface SunburstHintContext {
  readonly hintText: string;
  readonly hoveredArc: Readonly<ArcDatum> | null;
  readonly focus: Readonly<Focus>;
}

interface SunburstHintProps {
  readonly className?: string;
  readonly children?: ReactNode | ((context: SunburstHintContext) => ReactNode);
}

const SunburstHint = (_props: SunburstHintProps): null => null;


SunburstHint.displayName = "SunburstHint";

export { SunburstHintDisplay } from "./sunburst-hint-display";
export type { SunburstHintDisplayProps } from "./sunburst-hint-display";
export { SunburstHint };
export type { SunburstHintContext, SunburstHintProps };
