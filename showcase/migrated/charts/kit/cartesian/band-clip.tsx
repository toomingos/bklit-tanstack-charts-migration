// Owned clipPath the hover highlight paths are clipped by; band-spring.ts moves its rect per frame (no host var, so no restyle).
import type { CSSProperties, ReactElement } from "react";

const HOST_STYLE: CSSProperties = { height: 0, overflow: "hidden", position: "absolute", width: 0 };

export const HighlightBandClip = ({ id }: Readonly<{ id: string }>): ReactElement => (
  <svg aria-hidden="true" focusable="false" height={0} style={HOST_STYLE} width={0}>
    <defs>
      <clipPath clipPathUnits="userSpaceOnUse" id={id}>
        <rect data-bkm-band="" height={20000} width={0} x={0} y={-10000} />
      </clipPath>
    </defs>
  </svg>
);
