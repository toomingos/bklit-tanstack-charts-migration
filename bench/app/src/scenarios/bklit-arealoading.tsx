// P5.7 A10 gate fixture. Renders the legacy `<AreaChartLoading>` PRESET
// COMPONENT directly — not `<AreaChart status="loading">`. The distinction is
// the whole point: the preset is a separate code path from the `state="loading"`
// prop the existing `area` scenario exercises, so a green loading gate over
// there says nothing about this component. Prop-less on purpose (every default
// is part of what is being gated); `n` is ignored because the preset generates
// its own fixed 7-point skeleton and takes no data.
//
// Gate it with `--state loading`: the preset never reaches "ready", and that
// mode is the one that waits on `__benchPaintDone`, captures a single frame
// under `reducedMotion: "reduce"`, and skips the hover captures a loading
// chrome has no contract for.
import { AreaChartLoading } from "@bklitui/ui/charts";

export default function BklitAreaLoading() {
  return <AreaChartLoading />;
}
