import type { DemoControls } from "@/components/demo-controls";

/** One row of a props table. `default` omitted means required (or no default). */
export interface PropDoc {
  name: string;
  type: string;
  default?: string;
  description: string;
}

export interface ComponentDoc {
  name: string;
  description?: string;
  props: PropDoc[];
}

/** A variation of the page's demo: rendered with `controls`, shown with `code`. */
export interface ChartExample {
  title: string;
  description: string;
  controls: Partial<DemoControls>;
  code: string;
}

/**
 * Docs for one chart page. Every code string imports from "bklit-tanstack-charts" and type-checks against the package
 * (scripts/check-doc-snippets.mjs).
 */
export interface ChartDoc {
  /** One sentence: what the chart is for. */
  description: string;
  /** Source equivalent to the preview demo, shown in the Code tab. */
  code: string;
  /** The smallest complete example. */
  usage: string;
  examples?: ChartExample[];
  api: ComponentDoc[];
}
