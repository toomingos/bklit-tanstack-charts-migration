import * as React from "react";

function normalizeYAxisId(id?: string | number): string {
  if (id == null || id === "") return "left";
  return String(id);
}

export interface ReferenceAreaConfig {
  yAxisId: string;
  y1?: number;
  y2?: number;
  axisLabelColor?: string;
}

interface ReferenceAreaConfigProps {
  yAxisId?: string | number;
  y1?: number;
  y2?: number;
  axisLabelColor?: string;
}

function isReferenceAreaElement(child: React.ReactElement): boolean {
  const role = (child.type as unknown as Record<symbol, string | undefined>)[Symbol.for("migrated.chartRole")];
  if (role === "referenceArea") return true;
  const t = child.type as unknown as { displayName?: string; name?: string };
  const n = typeof child.type === "function" ? (t.displayName || t.name || "") : "";
  return n === "ReferenceArea";
}

export function extractReferenceAreaConfigs(children: React.ReactNode): ReferenceAreaConfig[] {
  const configs: ReferenceAreaConfig[] = [];
  const visit = (node: React.ReactNode) => {
    for (const child of React.Children.toArray(node)) {
      if (!React.isValidElement(child)) continue;
      if (child.type === React.Fragment) {
        visit((child.props as { children?: React.ReactNode }).children);
        continue;
      }
      if (isReferenceAreaElement(child as React.ReactElement)) {
        const props = child.props as ReferenceAreaConfigProps | undefined;
        if (props) {
          configs.push({
            yAxisId: normalizeYAxisId(props.yAxisId),
            y1: props.y1,
            y2: props.y2,
            axisLabelColor: props.axisLabelColor,
          });
        }
        continue;
      }
      const cp = child.props as { children?: React.ReactNode } | undefined;
      if (cp?.children) visit(cp.children);
    }
  };
  visit(children);
  return configs;
}

export function extractReferenceAreaProps(children: React.ReactNode): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  const visit = (node: React.ReactNode) => {
    for (const child of React.Children.toArray(node)) {
      if (!React.isValidElement(child)) continue;
      if (child.type === React.Fragment) {
        visit((child.props as { children?: React.ReactNode }).children);
        continue;
      }
      const role = (child.type as unknown as Record<symbol, string | undefined>)[Symbol.for("migrated.chartRole")];
      if (role === "referenceArea") {
        out.push(child.props as Record<string, unknown>);
        continue;
      }
      const cp = child.props as { children?: React.ReactNode } | undefined;
      if (cp?.children) visit(cp.children);
    }
  };
  visit(children);
  return out;
}
