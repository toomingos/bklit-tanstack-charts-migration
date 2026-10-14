"use client";

import { type ReactNode, useState } from "react";
import { ChartStage } from "@/components/chart-stage";
import { defaultDemoControls, type DemoControls } from "@/components/demo-controls";
import { CodeBlock } from "@/components/docs/code-block";
import type { ChartExample, ComponentDoc } from "@/lib/chart-docs/types";
import { cn } from "@/lib/utils";

const tabClass = (active: boolean) =>
  cn(
    "-mb-px border-b-2 px-1 pb-2 font-medium text-sm transition-colors",
    active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
  );

/** Preview and Code tabs over one chart, as on shadcn/ui's docs. `actions` sits at the right of the tab row. */
export function ChartTabs({ preview, code, actions }: { preview: ReactNode; code: string; actions?: ReactNode }) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-end justify-between gap-3 border-border border-b">
        <div className="flex gap-4" role="tablist">
          {(["preview", "code"] as const).map((t) => (
            <button aria-selected={tab === t} className={tabClass(tab === t)} key={t} onClick={() => setTab(t)} role="tab" type="button">
              {t === "preview" ? "Preview" : "Code"}
            </button>
          ))}
        </div>
        {actions && <div className="pb-1.5">{actions}</div>}
      </div>
      {/* Both panels stay mounted so switching tabs does not replay the entrance. */}
      <div className={cn("overflow-hidden rounded-lg border border-border bg-background p-3", tab !== "preview" && "hidden")}>{preview}</div>
      <CodeBlock className={cn(tab !== "code" && "hidden")} code={code} />
    </div>
  );
}

export function ChartDemo({ route, n, controls }: { route: string; n: number; controls?: Partial<DemoControls> }) {
  return <ChartStage chart={route} controls={{ ...defaultDemoControls, ...controls }} impl="migrated" n={n} />;
}

/** One example. A loading example gets a switch between loading and data, so the reveal can be seen. */
export function ExampleBlock({ route, n, example }: { route: string; n: number; example: ChartExample }) {
  const toggles = example.controls.loading === "status";
  const [loading, setLoading] = useState(true);
  const controls = toggles && !loading ? { ...example.controls, loading: "off" as const } : example.controls;
  return (
    <div className="mb-10">
      <h3 className="font-medium text-base">{example.title}</h3>
      <p className="mt-1 mb-4 max-w-2xl text-muted-foreground text-sm">{example.description}</p>
      <ChartTabs
        actions={
          toggles && (
            <button
              className="rounded-md border border-border px-2.5 py-1 font-medium text-xs hover:bg-muted"
              onClick={() => setLoading((l) => !l)}
              type="button"
            >
              {loading ? "Load data" : "Show loading"}
            </button>
          )
        }
        code={example.code}
        preview={<ChartDemo controls={controls} n={n} route={route} />}
      />
    </div>
  );
}

export function ApiTable({ component }: { component: ComponentDoc }) {
  return (
    <div className="mb-8">
      <h3 className="font-medium font-mono text-base">{component.name}</h3>
      {component.description && <p className="mt-1 text-muted-foreground text-sm">{component.description}</p>}
      <div className="mt-3 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border border-b bg-muted/40 text-left text-muted-foreground text-xs">
              <th className="px-3 py-2 font-medium">Prop</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Default</th>
              <th className="px-3 py-2 font-medium">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {component.props.map((p) => (
              <tr className="align-top" key={p.name}>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-[13px]">{p.name}</td>
                <td className="px-3 py-2 font-mono text-[12px] text-muted-foreground">{p.type}</td>
                <td className="px-3 py-2 font-mono text-[12px] text-muted-foreground">{p.default ?? "—"}</td>
                <td className="min-w-48 px-3 py-2 text-muted-foreground">{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
