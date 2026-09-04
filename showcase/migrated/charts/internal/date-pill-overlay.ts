import { useCallback, useLayoutEffect, useRef, type RefCallback, type RefObject } from "react";
import { buildPill, type PillBuild } from "./date-pill";
import type { SpringConfig } from "./chart-config-context";

// Date-pill overlay split from hover-geometry; behaviour verbatim.
// Pill layer is app-owned HTML mounted via callback ref.

interface DatePillController {
// Callback ref: the host mounts after the first layout effect.
  overlayHostRef: RefCallback<HTMLDivElement>;
  show: (pixelX: number, opts: { readonly index: number; readonly label: string | null; readonly discrete: boolean; readonly jump: boolean }) => void
  hide: () => void
}

interface DatePillRefs {
  readonly pillRef: RefObject<PillBuild | null>;
  readonly hostRef: RefObject<HTMLDivElement | null>;
  readonly dateLabelsRef: RefObject<readonly string[]>;
  readonly springRef: RefObject<Readonly<SpringConfig>>;
}

// Tears down the previous pill; hoisted so mountDatePill stays short.
const teardownDatePill = (pillRef: RefObject<PillBuild | null>): void => {
  const prev = pillRef.current;
  if (!prev) {return;}
  pillRef.current = null;
  prev.layer.remove();
  prev.spring.stop();
  prev.ticker?.detach();
};

// (Re)mounts the pill into the host element; null unmounts.
const mountDatePill = (refs: Readonly<DatePillRefs>, el: HTMLDivElement | null): void => {
  teardownDatePill(refs.pillRef);
  refs.hostRef.current = el;
  if (!el) {return;}
  const pill = buildPill(el.ownerDocument, refs.springRef.current, () => [...refs.dateLabelsRef.current]);
  el.append(pill.layer);
  refs.pillRef.current = pill;
};

type DatePillShow = DatePillController["show"];

const EMPTY_LABEL_COUNT = 0;

// Builds the show callback; hoisted so the controls hook stays short.
const buildPillShow = (pillRef: RefObject<PillBuild | null>, dateLabelsRef: Readonly<RefObject<readonly string[]>>): DatePillShow =>
  (pixelX: number, opts: { readonly index: number; readonly label: string | null; readonly discrete: boolean; readonly jump: boolean }): void => {
    const pill = pillRef.current;
    if (!pill) {return;}
    pill.layer.style.display = "";
    if (pill.ticker && dateLabelsRef.current.length > EMPTY_LABEL_COUNT) {
      pill.ticker.update(opts.index, opts.discrete);
    } else if (opts.label === null) {
      // No ticker and no label, so the pill keeps its previous text.
    } else {
      pill.label.textContent = opts.label;
    }
    if (opts.jump || opts.discrete) {pill.spring.jump(pixelX);}
    else {pill.spring.set(pixelX);}
  };

type DatePillHide = DatePillController["hide"];

// Builds the hide callback; hoisted so the controls hook stays short.
const buildPillHide = (pillRef: RefObject<PillBuild | null>): DatePillHide =>
  (): void => {
    const pill = pillRef.current;
    if (!pill) {return;}
    pill.layer.style.display = "none";
  };

interface DatePillControls {
  readonly refs: Readonly<DatePillRefs>;
  readonly mountPill: (el: HTMLDivElement | null) => void;
  readonly enabled: boolean;
}

// Callback side of the controller; separate hook so the mount hook stays short.
const useDatePillControls = (controls: Readonly<DatePillControls>): DatePillController => {
  const { enabled, mountPill, refs } = controls;
  const { dateLabelsRef, pillRef } = refs;
  const overlayHostRef = useCallback(
    (el: HTMLDivElement | null) =>{  mountPill(enabled ? el : null); },
    [mountPill, enabled],
  );
  const show = useCallback(
    (pixelX: number, opts: { readonly index: number; readonly label: string | null; readonly discrete: boolean; readonly jump: boolean }): void => {
      buildPillShow(pillRef, dateLabelsRef)(pixelX, opts);
    },
    [pillRef, dateLabelsRef],
  );
  const hide = useCallback(
    (): void => {
      buildPillHide(pillRef)();
    },
    [pillRef],
  );
  return { hide, overlayHostRef, show };
};

interface DatePillOverlayOptions {
  readonly enabled: boolean;
  readonly dateLabels: readonly string[];
  readonly tooltipSpring: Readonly<SpringConfig>;
}

const useDatePillOverlay = (options: Readonly<DatePillOverlayOptions>): DatePillController => {
  const pillRef = useRef<PillBuild | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const dateLabelsRef = useRef(options.dateLabels);
  const springRef = useRef(options.tooltipSpring);
  const mountPill = useCallback((el: HTMLDivElement | null) => {
    mountDatePill({ dateLabelsRef, hostRef, pillRef, springRef }, el);
  }, []);
  useLayoutEffect(() => {
    dateLabelsRef.current = options.dateLabels;
    springRef.current = options.tooltipSpring;
  });
  useLayoutEffect(() => {
    // Re-mirrors the spring tune so the stiffness/damping deps stay honest.
    // Fresh identity is unobservable: buildPill copies the tune into its own spring.
    springRef.current = { damping: options.tooltipSpring.damping, stiffness: options.tooltipSpring.stiffness };
    mountDatePill({ dateLabelsRef, hostRef, pillRef, springRef }, options.enabled ? hostRef.current : null);
  }, [options.enabled, options.tooltipSpring.stiffness, options.tooltipSpring.damping]);
  useLayoutEffect(() => (): void =>{  mountDatePill({ dateLabelsRef, hostRef, pillRef, springRef }, null); }, []);
  return useDatePillControls({ enabled: options.enabled, mountPill, refs: { dateLabelsRef, hostRef, pillRef, springRef } });
};

export type { DatePillController };
export { useDatePillOverlay };
