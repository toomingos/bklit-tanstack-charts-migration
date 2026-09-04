interface SunburstNode {
  name: string;
  value?: number;
  color?: string;
  fill?: string;
  children?: SunburstNode[];
}

interface ArcDatum {
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
  arcIndex: number;
  color?: string;
  fill?: string;
}

interface Focus {
  id: string;
  name: string;
  depth: number;
  parentId: string | null;
  categoryIndex: number;
  a0: number;
  a1: number;
}

interface ArcGeometry {
  a0: number;
  a1: number;
  innerR: number;
  outerR: number;
}

export type { SunburstNode, ArcDatum, Focus, ArcGeometry };
