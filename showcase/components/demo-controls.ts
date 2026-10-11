/** Loading toggle: `status` flips the chart's own `status` prop (loading to data plays the reveal); `component` mounts the turnkey `*ChartLoading` component. */
export type LoadingMode = "off" | "status" | "component";

/** Per-route toggles shared by the bklit and migrated cards; a demo reads only the ones its chart has. */
export interface DemoControls {
  loading: LoadingMode;
  /** `loadingStyle="sweep"` instead of the default pulse. */
  sweep: boolean;
  /** Runs the BarPulse overlay instead of freezing it (`pulsePaused`). */
  pulse: boolean;
}

export const defaultDemoControls: DemoControls = { loading: "off", sweep: false, pulse: false };

/** Width of the two preview cards: `auto` fills the page, `phone` pins both to a 390 px container (URL param `w`). */
export type StageWidth = "auto" | "phone";

export const PHONE_WIDTH = 390;
