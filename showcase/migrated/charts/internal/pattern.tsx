import type { ReactElement, ReactNode } from "react";

// Base Pattern renders the bare <pattern> element (V3.4b-ii: the R10 seam
// Owns the one <defs>; the nested-defs quirk goes away with it).
interface PatternProps {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly children: ReactNode;
}

const Pattern = ({ id, width, height, children }: Readonly<PatternProps>): ReactElement => (
  <pattern
    id={id}
    width={width}
    height={height}
    patternUnits="userSpaceOnUse"
  >
    {children}
  </pattern>
);

export { Pattern };
export type { PatternProps };
