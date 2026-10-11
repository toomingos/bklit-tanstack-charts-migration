import type * as BklitCharts from "@showcase/bklit-charts";
import type * as MigratedCharts from "@showcase/migrated-charts";

/** The chart module of the card's implementation, loaded by ChartStage so a card ships only its own library. */
export type ImplCharts = typeof BklitCharts | typeof MigratedCharts;
export type { BklitCharts, MigratedCharts };
