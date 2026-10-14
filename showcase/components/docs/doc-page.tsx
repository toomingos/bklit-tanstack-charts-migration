import type { ReactNode } from "react";

/** Title and lead paragraph of a docs page. */
export function DocHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="mb-10">
      <h1 className="font-semibold text-3xl tracking-tight">{title}</h1>
      {children && <p className="mt-3 max-w-2xl text-pretty text-lg text-muted-foreground">{children}</p>}
    </header>
  );
}

/** A docs section: heading, optional intro, then content. */
export function DocSection({ title, id, intro, children }: { title: string; id?: string; intro?: ReactNode; children?: ReactNode }) {
  return (
    <section className="mb-12 scroll-mt-20" id={id}>
      <h2 className="font-semibold text-xl tracking-tight">{title}</h2>
      {intro && <div className="mt-2 max-w-2xl text-pretty text-muted-foreground leading-relaxed">{intro}</div>}
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

/** Inline code in prose. */
export function C({ children }: { children: ReactNode }) {
  return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">{children}</code>;
}
