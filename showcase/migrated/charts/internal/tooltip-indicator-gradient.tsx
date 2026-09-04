import type { ReactElement } from 'react';
import type { IndicatorFadeGradientStop } from './fade-mask';

interface IndicatorFadeGradientDefProps {
  gradientId: string;
  fadeStops: readonly Readonly<IndicatorFadeGradientStop>[];
  indicatorFill: string;
}

// Extracted so the fade-gradient's <linearGradient>/<stop> tree stays within
// The jsx-max-depth budget of the component that renders the indicator itself.
const IndicatorFadeGradientDef = ({
  gradientId,
  fadeStops,
  indicatorFill,
}: Readonly<IndicatorFadeGradientDefProps>): ReactElement => (
  <linearGradient id={gradientId} x1="0%" x2="0%" y1="0%" y2="100%">
    {fadeStops.map((stop) => (
      <stop key={stop.offset} offset={stop.offset} stopColor={indicatorFill} stopOpacity={stop.opacity} />
    ))}
  </linearGradient>
);

export { IndicatorFadeGradientDef };
