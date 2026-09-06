import { memo } from "react";
import type { NamedExoticComponent, ReactElement, ReactNode } from "react";
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

const RenderSunburstHint = (_props: SunburstHintProps): ReactElement | null => null;

const SunburstHint: NamedExoticComponent<SunburstHintProps> = memo(RenderSunburstHint);


SunburstHint.displayName = "SunburstHint";

export { SunburstHintDisplay } from "./sunburst-hint-display";
export type { SunburstHintDisplayProps } from "./sunburst-hint-display";
export { SunburstHint };
export type { SunburstHintContext, SunburstHintProps };
