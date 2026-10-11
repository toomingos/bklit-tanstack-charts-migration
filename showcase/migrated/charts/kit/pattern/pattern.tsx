import type { ReactElement, ReactNode } from "react";

// Base Pattern renders the bare <pattern> element; the resource host owns the one <defs>.
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
