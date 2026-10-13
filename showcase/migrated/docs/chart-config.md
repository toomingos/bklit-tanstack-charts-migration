# Chart config and status

> Adapted from the [bklit-ui documentation](https://github.com/bklit/bklit-ui) (MIT, © uixmat) for bklit-tanstack-charts.

`ChartConfigProvider` shares spring settings with the charts below it, and `useChartConfig()` reads them. The `status` prop, `ChartStatus` and `LoadingStyle` control the loading state shared by the cartesian charts.

```tsx
import { ChartConfigProvider, Grid, Line, LineChart, XAxis } from "bklit-tanstack-charts";

const data = Array.from({ length: 20 }, (_, i) => ({
  date: new Date(2024, 0, 1 + i),
  value: 50 + i * 2 + Math.round(8 * Math.sin(i / 2)),
}));

export function Example() {
  return (
    <ChartConfigProvider value={{ tooltipSpring: { stiffness: 400, damping: 35 } }}>
      <LineChart data={data}>
        <Grid horizontal />
        <Line dataKey="value" />
        <XAxis />
      </LineChart>
    </ChartConfigProvider>
  );
}
```

## ChartConfigProvider

Wrap any part of your tree. Values you leave out keep their defaults, and without a provider `useChartConfig()` returns `DEFAULT_CHART_CONFIG`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `Partial<ChartConfigValue>` | - | Springs to override. Anything omitted keeps its default. |
| `children` | `ReactNode` | required | The charts that use these settings. |

### ChartConfigValue

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `tooltipSpring` | `SpringConfig` | `{ stiffness: 300, damping: 30 }` | Spring for the crosshair, tooltip dots and date pill. |
| `tooltipBoxSpring` | `SpringConfig` | `{ stiffness: 100, damping: 20 }` | Spring for the floating tooltip panel. |
| `highlightSpring` | `SpringConfig` | `{ stiffness: 180, damping: 28 }` | Spring for the hover highlight band on line and area charts. |

### SpringConfig

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `stiffness` | `number` | required | Spring stiffness. Higher values snap faster. |
| `damping` | `number` | required | Spring damping. Higher values settle with less overshoot. |

The built-in charts animate with fixed tweens and do not read these springs. They exist for your own custom children, such as a [custom indicator](./custom-indicator.md), so they can match the timing of a bklit-ui app.

### Reading the config in a custom child

```tsx
import { ChartConfigProvider, Line, LineChart, useChartConfig } from "bklit-tanstack-charts";

const data = Array.from({ length: 10 }, (_, i) => ({
  date: new Date(2024, 0, 1 + i),
  value: 10 + i,
}));

function Stiffness() {
  const { tooltipSpring } = useChartConfig();
  return <text x={8} y={16} fontSize={11} fill="var(--chart-foreground)">{`stiffness ${tooltipSpring.stiffness}`}</text>;
}

export function Example() {
  return (
    <ChartConfigProvider value={{ tooltipSpring: { stiffness: 500, damping: 40 } }}>
      <LineChart data={data}>
        <Line dataKey="value" />
        <Stiffness />
      </LineChart>
    </ChartConfigProvider>
  );
}
```

## Status and loading

### ChartStatus

`"loading"` or `"ready"`. Pass it as `status` (default `"ready"`) to `LineChart`, `AreaChart`, `BarChart` and the other cartesian charts. While `"loading"`, the chart shows a skeleton, ignores the pointer, and optionally a centered `loadingLabel`. Switching to `"ready"` reveals the data on the same chart instance. `onPhaseChange` is called with `"loading"` or `"ready"` when the status changes, and once on mount.

### LoadingStyle

`"pulse"` or `"sweep"`. The `loadingStyle` prop of `Line` and `Area` (default `"pulse"`) picks a travelling pulse or a diagonal sweep shimmer across the skeleton line.

```tsx
import { useState } from "react";
import { Grid, Line, LineChart, XAxis } from "bklit-tanstack-charts";

const data = Array.from({ length: 24 }, (_, i) => ({
  date: new Date(2024, 0, 1 + i),
  value: 30 + i * 3 + Math.round(10 * Math.cos(i / 3)),
}));

export function Example() {
  const [loading, setLoading] = useState(true);
  return (
    <div>
      <button type="button" onClick={() => setLoading((v) => !v)}>
        {loading ? "Load data" : "Show loading"}
      </button>
      <LineChart data={data} status={loading ? "loading" : "ready"} loadingLabel="Fetching data">
        <Grid horizontal />
        <Line dataKey="value" loadingStyle="sweep" />
        <XAxis />
      </LineChart>
    </div>
  );
}
```

### ChartPhase

The lifecycle of a chart, as reported by `onPhaseChange`: `"loading"` and `"ready"` are the resting phases, and `"exiting"`, `"gridTweenReady"`, `"revealing"`, `"exitingReady"`, `"gridTweenLoading"` and `"revealingLoading"` are transitions between them. `LineChart` reports only `"loading"` and `"ready"`.

## Notes

- **Server rendering.** The chart server-renders and replays its entrance after hydration.
- **Hover.** A loading chart ignores the pointer.
- **Theming.** Colors come from the `--chart-*` CSS variables, so charts follow light and dark mode.

## Differences from bklit-ui

- The springs are accepted and readable through `useChartConfig()`, but the built-in charts do not use them (tweens drive the animation).
- `LineChart`'s `animationEasing`, `yDomainTweenDuration` and `tweenYDomainOnXDomainChange` are accepted but have no effect.

## Related

- [Line chart](./line-chart.md)
- [Area chart](./area-chart.md)
- [Custom indicator](./custom-indicator.md)
- [Patterns and gradients](./patterns-and-gradients.md)
