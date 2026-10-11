"use client";

import { Profiler, useEffect, useRef, type ReactNode } from "react";
import { Collector, type Impl } from "./collector";

/** Wraps a chart stage and measures it live. Adds one plain block div (no layout change). */
export function PerfProbe({ impl, chart, children }: { impl: Impl; chart: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const col = useRef<Collector | null>(null);
  if (!col.current) col.current = new Collector(chart, impl);

  useEffect(() => {
    const c = col.current!;
    c.start(ref.current!);
    return () => {
      c.stop();
    };
  }, [chart, impl]);

  return (
    <div ref={ref} className="w-full" data-perf-key={`${chart}:${impl}`}>
      <Profiler id={`${chart}:${impl}`} onRender={(id, phase, actual) => col.current?.onRender(id, phase, actual)}>
        {children}
      </Profiler>
    </div>
  );
}
