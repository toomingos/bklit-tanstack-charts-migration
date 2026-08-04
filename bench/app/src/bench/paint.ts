// M1a instrumentation: mount-to-paint.
//
// Contract (research/04-metrics-and-baselines.md M1a): mark immediately
// before React `root.render()`, then mark "paint" at the first
// double-requestAnimationFrame after the chart's SVG has actually been
// committed to the DOM (not just after the React root's first commit --
// `ParentSize`/`useMeasure`-driven bklit charts render a 0x0 placeholder
// commit before the real, measured SVG shows up).
//
// This is impl-agnostic: it watches the DOM for the first <svg> under the
// scenario host rather than hooking into either impl's internals, so the
// exact same code paths are exercised for both `bklit` and `tanstack`.

const RENDER_START = "bench:render-start";
const PAINT = "bench:paint";
const MEASURE = "bench:mount-to-paint";

export function markRenderStart(): void {
  performance.mark(RENDER_START);
}

function waitForChartSvg(container: Element): Promise<void> {
  const existing = container.querySelector("svg");
  if (existing) return Promise.resolve();

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (container.querySelector("svg")) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(container, { childList: true, subtree: true });
  });
}

function doubleRaf(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/**
 * Call once, right after `root.render(...)`. Resolves (and records the
 * `bench:mount-to-paint` performance measure) once the chart's SVG has
 * committed and two animation frames have elapsed (paint settled).
 */
export async function markMountPaint(container: Element): Promise<void> {
  await waitForChartSvg(container);
  await doubleRaf();
  performance.mark(PAINT);
  performance.measure(MEASURE, RENDER_START, PAINT);
  window.__benchPaintDone = true;
}

/**
 * M3a instrumentation helper: applies a data-swap update, waits for it to
 * commit + paint (double-rAF, same "real paint" heuristic as mount), and
 * returns the elapsed update->paint time in ms. Used by each scenario's
 * `window.__benchUpdate()`.
 */
export async function measureUpdatePaint(
  applyUpdate: () => void,
): Promise<number> {
  const start = performance.now();
  applyUpdate();
  await doubleRaf();
  return performance.now() - start;
}

declare global {
  interface Window {
    __benchPaintDone?: boolean;
  }
}
