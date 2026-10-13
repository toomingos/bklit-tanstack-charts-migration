# bklit-tanstack-charts

TanStack Bklit UI Charts: [bklit-ui](https://github.com/bklit/bklit-ui)'s chart components rebuilt natively on TanStack Charts 1.1. Full documentation is coming.

```bash
pnpm add bklit-tanstack-charts @tanstack/charts@~1.1.0 @tanstack/react-charts@~1.1.0
```

```tsx
import { LineChart, Line, Grid, XAxis, ChartTooltip } from "bklit-tanstack-charts";
import "bklit-tanstack-charts/styles.css";
```

- Import the stylesheet once (`bklit-tanstack-charts/styles.css`); the JS never imports CSS.
- Minimum runtime is ES2023 (the code uses `toSorted` and friends).
- Peers: React 19, `@tanstack/charts` and `@tanstack/react-charts` at `~1.1.0` (the charts rely on TanStack's internal DOM classes).
- The TanStack CLI scaffold needs pnpm 10.

MIT licensed; see `LICENSE` and `NOTICE`.
