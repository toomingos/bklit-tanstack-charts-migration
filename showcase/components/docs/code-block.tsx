"use client";

import { useMemo, useState } from "react";
import { highlight } from "sugar-high";
import { cn } from "@/lib/utils";

export type CodeLang = "typescript" | "shell" | "css";

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      // Shows the check for a moment; showcase UI, not a bklit timing.
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      aria-label={copied ? "Copied" : "Copy code"}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className
      )}
      onClick={copy}
      type="button"
    >
      <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} viewBox="0 0 24 24">
        {copied ? (
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        ) : (
          <>
            <rect height="12" rx="2" width="12" x="8" y="8" />
            <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
          </>
        )}
      </svg>
    </button>
  );
}

export function CodeBlock({ code, lang = "typescript", className }: { code: string; lang?: CodeLang; className?: string }) {
  const source = code.trimEnd();
  const html = useMemo(() => highlight(source, { lang }), [source, lang]);
  return (
    <div className={cn("relative min-w-0 overflow-hidden rounded-lg border border-border bg-muted/30", className)}>
      <pre className="max-h-[32rem] overflow-auto py-4 pr-12 pl-4 font-mono text-[13px] leading-relaxed">
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
      <CopyButton className="absolute top-2 right-2" text={source} />
    </div>
  );
}

const managers = [
  { id: "npm", command: "npm i" },
  { id: "pnpm", command: "pnpm add" },
  { id: "yarn", command: "yarn add" },
  { id: "bun", command: "bun add" },
] as const;

export const PACKAGE_NAME = "bklit-tanstack-charts";

/** The install command with a package-manager switch, as on shadcn/ui's docs. */
export function InstallCommand({ className }: { className?: string }) {
  const [manager, setManager] = useState<(typeof managers)[number]["id"]>("npm");
  const command = `${managers.find((m) => m.id === manager)?.command} ${PACKAGE_NAME}`;
  return (
    <div className={cn("min-w-0 overflow-hidden rounded-lg border border-border bg-muted/30", className)}>
      <div className="flex items-center gap-1 border-border border-b px-2 py-1.5">
        {managers.map((m) => (
          <button
            aria-pressed={manager === m.id}
            className={cn(
              "rounded-md px-2 py-0.5 font-mono text-xs transition-colors",
              manager === m.id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
            key={m.id}
            onClick={() => setManager(m.id)}
            type="button"
          >
            {m.id}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 py-1.5 pr-2 pl-4">
        <code className="overflow-x-auto whitespace-nowrap py-1.5 font-mono text-[13px]">{command}</code>
        <CopyButton text={command} />
      </div>
    </div>
  );
}
