# Initiative 4 Audit

Status: open, not ready for gating.

Evidence: `ChartTooltipConfig` in `migrated/charts/internal/types.ts` is a pilot subset and `children.tsx` renders only a null carrier. Seven chart consumers retain separate hover-chrome modules. Bklit tooltip props and islands are cataloged in `research/phase-3/inventory/05-consolidated-internals.md`; Pie also retains `pie-center.tsx` instead of the shared center-stat island. Required plan: one `focus:'group-x'`/`renderTooltipBody` implementation, full prop parity, and propagation to all named consumers.
