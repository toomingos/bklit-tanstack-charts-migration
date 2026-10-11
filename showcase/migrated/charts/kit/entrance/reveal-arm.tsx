import { clearAttribute, raiseAttribute } from "../host-write";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { RefObject } from "react";
import { alignEntranceStart } from "./entrance-origin";

/** CSS entrances that start with the release, aligned from the effect that releases it (see entrance-origin.ts).
 * The series markers' fade (SeriesPointMarker) is WAAPI, mounted by the reveal (frame origin). */
const READY_ATTR = "data-bkm-ready";

const REVEAL_ORIGINS = { "bkm-mk-in": "frame" } as const;

/** Entrances that start at the reveal timer's flip (bklit isLoaded): the background fade, the terminal marker's opacity (WAAPI) and scale (JS). */
const READY_ORIGINS = { "bkm-bg-in": "frame", "bkm-terminal-fade": "frame", "bkm-terminal-grow": "motion" } as const;

const EVT_ORIGINS = { "bkm-evt-in": "motion", "bkm-evt-fade": "frame" } as const;

/** Arms the reveal (`onArm`) after two effect-driven commits, so the shell never re-renders: bklit's mount effect moves "ready" to "revealing", which mounts the ChartRevealClip
 * motion.rect whose effect starts the tween. `onArm` opens the native wipe (and starts the composed bar grow) on that trigger. */
export const RevealArm = ({ hostRef, onArm }: { readonly hostRef: RefObject<HTMLElement | null>; readonly onArm?: () => void }): null => {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (stage < 2) {
      // bklit's MarkerGroup entrance is created by the mount effect (the first commit), not by the reveal.
      if (stage === 0 && hostRef.current) { alignEntranceStart(hostRef.current, EVT_ORIGINS); }
      setStage(stage + 1);
      return;
    }
    const host = hostRef.current;
    onArm?.();
    // Not cancelled by a deps change of `onArm`: the two frames it waits for must run once.
    if (host) { alignEntranceStart(host, REVEAL_ORIGINS); }
  }, [stage, hostRef, onArm]);
  return null;
};

/** The gate's ready flag as an external store: subscribers re-render at the flip without the gate's owner doing so. */
export interface ReadyStore {
  readonly get: () => boolean;
  readonly subscribe: (listener: () => void) => () => void;
  readonly set: (next: boolean) => void;
}

function createReadyStore(): ReadyStore {
  let value = false;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    subscribe: (listener) => {
      listeners.add(listener);
      return (): void => { listeners.delete(listener); };
    },
    set: (next) => {
      if (value === next) { return; }
      value = next;
      for (const listener of listeners) { listener(); }
    },
  };
}

/** Reads a gate's ready flag: false until the gate flips, false again while it re-arms. */
export const useGateReady = (store: ReadyStore): boolean => useSyncExternalStore(store.subscribe, store.get, () => false);

/** `arm` starts the timer; `ready` is the `viaState` flag (always false otherwise); `store` mirrors the flip for any gate. */
export interface ReadyGate {
  readonly arm: () => void;
  readonly ready: boolean;
  readonly store: ReadyStore;
}

/** bklit `canInteract = isLoaded` flips when chartPhase becomes "revealing" (use-chart-phase-orchestrator.ts:155-170): at once when animationDuration <= 0 (:158-162), else after setTimeout (:164-169).
 * The timer starts at `arm`, sets `data-bkm-ready` (`readyGateCss`: pointer-events none until then), restarts on a new animationDuration or `resetKey` (`revealSignature`). `viaState` lands `ready` and the attribute in one commit. */
export function useReadyGate(
  hostRef: RefObject<HTMLElement | null>,
  animationDuration: number,
  options: { readonly onReady?: () => void; readonly resetKey?: string; readonly viaState?: boolean } = {},
): ReadyGate {
  const { onReady, resetKey = "", viaState = false } = options;
  const timer = useRef<number | undefined>(undefined);
  const armed = useRef(false);
  const [store] = useState(createReadyStore);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const start = useCallback(() => {
    const host = hostRef.current;
    window.clearTimeout(timer.current);
    clearAttribute(host, READY_ATTR);
    store.set(false);
    if (viaState) {
      setReadyKey(null);
    }
    const flip = (): void => {
      if (viaState) {
        setReadyKey(resetKey);
      } else {
        raiseAttribute(host, READY_ATTR);
      }
      store.set(true);
      onReadyRef.current?.();
    };
    if (animationDuration <= 0) {
      flip();
      return;
    }
    // Reproduces bklit's reveal timer, setTimeout(animationDuration): use-chart-phase-orchestrator.ts:164-169.
    timer.current = window.setTimeout(() => {
      flip();
      // The Background fade (background.tsx:119-125,208) and the terminal marker start with isLoaded, the same moment.
      if (host && !viaState) { alignEntranceStart(host, READY_ORIGINS); }
    }, animationDuration);
  }, [hostRef, animationDuration, resetKey, viaState, store]);
  const startRef = useRef(start);
  startRef.current = start;
  useEffect(() => {
    if (armed.current) {
      start();
    }
  }, [start]);
  const ready = viaState && readyKey === resetKey;
  useLayoutEffect(() => {
    if (!viaState) { return; }
    const host = hostRef.current;
    if (ready) { raiseAttribute(host, READY_ATTR); } else { clearAttribute(host, READY_ATTR); }
  }, [hostRef, ready, viaState]);
  useEffect(
    () => (): void => {
      window.clearTimeout(timer.current);
      clearAttribute(hostRef.current, READY_ATTR);
      store.set(false);
    },
    [hostRef, store],
  );
  const arm = useCallback(() => {
    armed.current = true;
    startRef.current();
  }, []);
  return { arm, ready, store };
}
