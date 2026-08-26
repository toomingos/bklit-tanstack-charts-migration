// P5.7 B14 gate fixture — migrated half. Same call site as
// `bklit-barloading.tsx`; see that file for why this pair measures a divergence
// rather than asserting parity.
import { BarChartLoading } from "@migrated/charts";

export default function MigratedBarLoading() {
  return <BarChartLoading />;
}
