import { memo } from 'react';
import type { ReactElement, ReactNode } from 'react';

interface SunburstBreadcrumbProps {
  readonly className?: string;
  readonly children: ReactNode;
}

const BREADCRUMB_DEFAULT_STYLE = { marginBottom: 16 } as const;

const renderSunburstBreadcrumb = ({ className, children }: Readonly<SunburstBreadcrumbProps>): ReactElement => (
    <nav
      aria-label="Drill-down path"
      className={className}
      style={className !== undefined && className !== "" ? undefined : BREADCRUMB_DEFAULT_STYLE}
    >
      {children}
    </nav>
  );

const SunburstBreadcrumb = memo(renderSunburstBreadcrumb);

SunburstBreadcrumb.displayName = "SunburstBreadcrumb";

export {
  SunburstBreadcrumb,
};
export type { SunburstBreadcrumbProps };
