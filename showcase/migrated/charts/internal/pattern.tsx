import type { ReactElement, ReactNode } from "react";

// Base Pattern nests its own <defs> by design (ported verbatim with the quirk).
// Pattern lives here so pattern-lines holds only the public component.
interface PatternProps {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly children: ReactNode;
}

const Pattern = ({ id, width, height, children }: Readonly<PatternProps>): ReactElement => (
    <defs>
      <pattern
        id={id}
        width={width}
        height={height}
        patternUnits="userSpaceOnUse"
      >
        {children}
      </pattern>
    </defs>
  );

export { Pattern };
export type { PatternProps };
