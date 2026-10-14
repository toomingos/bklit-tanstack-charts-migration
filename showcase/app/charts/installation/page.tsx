import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock, InstallCommand } from "@/components/docs/code-block";
import { C, DocHeader, DocSection } from "@/components/docs/doc-page";
import { doc as area } from "@/lib/chart-docs/area";

export const metadata: Metadata = { title: "Installation" };

/** The chart tokens of the showcase's own theme (light and dark), read from globals.css so the snippet cannot drift. */
function themeSnippet() {
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
  const block = (selector: string) => {
    const start = css.indexOf(`\n${selector} {`);
    const body = css.slice(start, css.indexOf("\n}", start));
    const tokens = body.split("\n").filter((line) => /^\s+--(chart|legend)[\w-]*:/.test(line));
    return `${selector} {\n${tokens.join("\n")}\n}`;
  };
  return `${block(":root")}\n\n${block(".dark")}\n`;
}

const tailwind = `@import "tailwindcss";

/* Let Tailwind see the classes the charts use. The path is relative to this file. */
@source "../node_modules/bklit-tanstack-charts";
`;

export default function InstallationPage() {
  return (
    <div className="max-w-3xl">
      <DocHeader title="Installation">
        One package of React components. It needs React 19 and Tailwind CSS v4, and fits projects that use shadcn/ui.
      </DocHeader>

      <DocSection title="1. Install the package">
        <InstallCommand />
      </DocSection>

      <DocSection
        intro={
          <>
            The charts are styled with Tailwind classes. Add the package to your Tailwind sources in your global CSS file. The
            charts load their own CSS, so there is nothing else to import.
          </>
        }
        title="2. Point Tailwind at the package"
      >
        <CodeBlock code={tailwind} lang="css" />
      </DocSection>

      <DocSection
        intro={
          <>
            Chart colors are CSS variables, so the charts follow your theme. Paste these into your global CSS and adjust them.
            The charts also read shadcn/ui&apos;s <C>--background</C>, <C>--foreground</C>, <C>--border</C>, <C>--popover</C>{" "}
            and <C>--muted-foreground</C>; with shadcn/ui set up, those are already there. Dark mode follows a{" "}
            <C>.dark</C> class on a parent.
          </>
        }
        title="3. Add the theme"
      >
        <CodeBlock code={themeSnippet()} lang="css" />
      </DocSection>

      <DocSection intro="Import a chart and give it data. Every chart page has a complete example to copy." title="4. Add a chart">
        <CodeBlock code={area.usage} />
      </DocSection>

      <p className="text-muted-foreground">
        Next:{" "}
        <Link className="font-medium text-foreground" href="/charts/area">
          browse the charts
        </Link>
        , or read{" "}
        <Link className="font-medium text-foreground" href="/charts/migration">
          Migrating from Bklit UI
        </Link>{" "}
        if you already use it.
      </p>
    </div>
  );
}
