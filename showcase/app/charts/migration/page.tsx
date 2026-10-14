import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock, InstallCommand } from "@/components/docs/code-block";
import { C, DocHeader, DocSection } from "@/components/docs/doc-page";
import { pct } from "@/components/live-perf/headline-cards";
import { summaryHeadlines } from "@/components/live-perf/summary-headlines";
import { allCharts } from "@/lib/chart-data";

export const metadata: Metadata = { title: "Migrating from Bklit UI" };

const imports = `// Before: files copied in by the shadcn registry
import { AreaChart } from "@/components/charts/area-chart";
import { Area } from "@/components/charts/area";
import { Grid } from "@/components/charts/grid";

// After: one package
import { Area, AreaChart, Grid } from "bklit-tanstack-charts";
`;

const ratio = (label: string) => {
  const h = summaryHeadlines.find((x) => x.label === label);
  const r = h?.ratio ?? (h?.bklit && h.migrated ? h.migrated / h.bklit : null);
  return r === null ? "—" : pct(r);
};

export default function MigrationPage() {
  return (
    <div className="max-w-3xl">
      <DocHeader title="Migrating from Bklit UI">
        Same components, same props, same look. Bklit TanStack Charts renders them with TanStack Charts, and you install it as
        a package instead of copying files.
      </DocHeader>

      <DocSection
        intro={
          <>
            Measured on all {allCharts.length} charts in a production build, against Bklit UI rendering the same data:
          </>
        }
        title="What changes"
      >
        <ul className="max-w-2xl list-disc space-y-2 pl-5 text-muted-foreground leading-relaxed">
          <li>
            <span className="text-foreground">First render: {ratio("Time to Render")}.</span> Charts finish their entrance
            sooner.
          </li>
          <li>
            <span className="text-foreground">Hover: {ratio("On hover")}.</span> Less work per pointer move.
          </li>
          <li>
            <span className="text-foreground">Bundle size: {ratio("Bundle Size")}.</span> Per chart, bundles are currently
            larger than Bklit UI&apos;s.
          </li>
          <li>
            <span className="text-foreground">Updates come from npm.</span> No copied files to keep in sync.
          </li>
        </ul>
        <p className="mt-4 text-muted-foreground">
          The{" "}
          <Link className="font-medium text-foreground" href="/charts/benchmarks">
            benchmarks
          </Link>{" "}
          have the numbers for each chart and how they were measured.
        </p>
      </DocSection>

      <DocSection title="1. Install the package">
        <InstallCommand />
      </DocSection>

      <DocSection
        intro={
          <>
            Component names and props are the same, so only the import paths change. Everything comes from one entry point.
          </>
        }
        title="2. Change the imports"
      >
        <CodeBlock code={imports} />
      </DocSection>

      <DocSection
        intro={
          <>
            Delete the chart files the registry added under <C>components/charts/</C>. If nothing else uses them, remove the{" "}
            <C>@visx/*</C> packages as well. Your theme variables stay as they are.
          </>
        }
        title="3. Remove the copied files"
      />

      <DocSection
        intro={
          <>
            The charts use Tailwind classes, so Tailwind needs to scan the package. See{" "}
            <Link className="font-medium text-foreground" href="/charts/installation">
              Installation
            </Link>{" "}
            for the one line to add.
          </>
        }
        title="4. Point Tailwind at the package"
      />
    </div>
  );
}
