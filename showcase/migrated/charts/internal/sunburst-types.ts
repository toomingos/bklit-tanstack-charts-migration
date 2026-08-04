// Types originally from repos/bklit-ui/packages/ui/src/charts/sunburst.ts
// and repos/bklit-ui/packages/ui/src/charts/sunburst-data.ts.
// Copied here so migrated/charts has zero imports from repos/.

export interface SunburstNode {
  name: string;
  value?: number;
  color?: string;
  /** Optional fill override for patterns/gradients (e.g., "url(#patternId)") */
  fill?: string;
  children?: SunburstNode[];
}

export interface ArcDatum {
  id: string;
  name: string;
  depth: number;
  value: number;
  categoryIndex: number;
  hasChildren: boolean;
  trail: string[];
  parentId: string | null;
  a0: number;
  a1: number;
  /** Stable index for Studio layer wiring. */
  arcIndex: number;
  /** Optional color override from data node. */
  color?: string;
  /** Optional fill override from data node (patterns). */
  fill?: string;
}

export interface Focus {
  id: string;
  name: string;
  depth: number;
  parentId: string | null;
  categoryIndex: number;
  a0: number;
  a1: number;
}

export interface ArcGeometry {
  a0: number;
  a1: number;
  innerR: number;
  outerR: number;
}
