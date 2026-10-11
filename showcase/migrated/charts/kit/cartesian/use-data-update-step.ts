import { useCallback, useRef, useState } from "react";
import type { Row } from "./series";
import { sameRows } from "../use-data-updated";

type YDomains = Readonly<Record<string, readonly [number, number]>>;
type UpdateStep = "snap" | "glide" | "window" | undefined;

interface Sequence {
  readonly data: readonly Row[];
  readonly deps: readonly unknown[];
  readonly step: UpdateStep;
  readonly from: YDomains | undefined;
  readonly xWindow: unknown;
}

const sameDeps = (a: readonly unknown[], b: readonly unknown[]): boolean => a.length === b.length && a.every((value, i) => Object.is(value, b[i]));

const sameDomains = (a: YDomains, b: YDomains): boolean =>
  Object.keys(a).every((id) => {
    const x = a[id];
    const y = b[id] ?? x;
    return x[0] === y[0] && x[1] === y[1];
  });

/** bklit data change: geometry snaps over the old y domain, then the y domain tweens 500ms ("snap" then "glide"; `settle` ends it). A `deps` change resets;
 * a brushed `xWindow` change alone is "window", kept until something else changes. */
interface DataUpdateStep {
  readonly step: UpdateStep;
  readonly from: YDomains | undefined;
  readonly settle: (built: { readonly domains: { readonly y: YDomains }; readonly targetY: YDomains }) => void;
}

export function useDataUpdateStep(data: readonly Row[], deps: readonly unknown[], xWindow?: unknown): DataUpdateStep {
  const [seq, setSeq] = useState<Sequence>({ data, deps, step: undefined, from: undefined, xWindow });
  const applied = useRef<YDomains | undefined>(undefined);
  let current = seq;
  if (!sameDeps(seq.deps, deps)) {
    current = { data, deps, step: undefined, from: undefined, xWindow };
  } else if (seq.data !== data) {
    const changed = !sameRows(seq.data, data);
    current = { data, deps, step: changed && applied.current ? "snap" : undefined, from: changed ? applied.current : undefined, xWindow };
  } else if (!Object.is(seq.xWindow, xWindow)) {
    current = { data, deps, step: "window", from: undefined, xWindow };
  }
  if (current !== seq) {
    setSeq(current);
  }
  const settle = useCallback((built: { readonly domains: { readonly y: YDomains }; readonly targetY: YDomains }) => {
    if (current.step === "snap") {
      applied.current = built.targetY;
      const moved = !sameDomains(built.domains.y, built.targetY);
      setSeq((s) => (s.step === "snap" ? { ...s, step: moved ? "glide" : undefined, from: undefined } : s));
    } else {
      applied.current = built.domains.y;
    }
  }, [current.step]);
  return { step: current.step, from: current.from, settle };
}
