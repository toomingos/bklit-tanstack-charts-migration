// P5.7 B14 gate fixture. Renders the legacy `<BarChartLoading>` PRESET
// COMPONENT directly. Migrated's B14 is a DELIBERATE mechanism divergence, not
// a literal port — legacy's one-liner is `<BarChart status="loading"
// data={[]} />`, which branches into `BarLoadingSkeleton`, a symbol DOC-10/FD7
// accepts as DELETED, and migrated's `BarChart` has no `status` prop at all.
// So this pair is not expected to reach parity the way A10's does; it exists to
// prove the new component mounts and paints, and to put a NUMBER on how far the
// two mechanisms land apart instead of asserting it.
import { BarChartLoading } from "@bklitui/ui/charts";

export default function BklitBarLoading() {
  return <BarChartLoading />;
}
