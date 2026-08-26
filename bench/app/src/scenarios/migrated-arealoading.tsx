// P5.7 A10 gate fixture — migrated half. IDENTICAL usage to
// `bklit-arealoading.tsx`, only the import source changes, so the capture pair
// isolates the component and nothing else. Prop-less on purpose: A10's defaults
// are part of what is being gated.
import { AreaChartLoading } from "@migrated/charts";

export default function MigratedAreaLoading() {
  return <AreaChartLoading />;
}
