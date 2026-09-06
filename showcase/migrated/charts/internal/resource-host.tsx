// R10 seam: remove when TanStack/charts I4/I5 ship
import { Children } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";

// Hidden defs host beside the chart svg; url(#id) paints resolve document-wide.
const RESOURCE_HOST_STYLE: CSSProperties = { height: 0, overflow: "hidden", position: "absolute", width: 0 };

interface ResourceHostProps {
  readonly idPrefix: string;
  readonly resources: ReactNode;
}

// Sole renderer of pattern, radialGradient and sweep defs; linear gradients stay in spec.gradients.
const ResourceHost = ({ idPrefix, resources }: Readonly<ResourceHostProps>): ReactElement | null => {
  if (Children.toArray(resources).length === 0) {
    return null;
  }
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      height={0}
      id={`${idPrefix}-resources`}
      style={RESOURCE_HOST_STYLE}
      width={0}
    >
      <defs>{resources}</defs>
    </svg>
  );
};

export { ResourceHost };
export type { ResourceHostProps };
