import type { CSSProperties } from "react";
import { settleMs } from "./live-css";
import type { Frame } from "./live-frame";

interface LiveHostVarsArgs {
  readonly frame: Frame | null;
  readonly pad: number;
  readonly bklitWidth: number;
  readonly plotRight: number;
  readonly plotLeft: number;
  readonly clipExt: number;
  readonly lerpSpeed: number;
  readonly introEaseCss: string;
  readonly dotSize: number;
  readonly fillRamp: { readonly top: number; readonly bottom: number };
}

/** The roll, tail and dot parameters the host hands liveline.css and live-css.ts as custom properties (rounded to what the eye can tell). */
// SAFETY: CSS custom properties are not in CSSProperties; the keys are plain custom-property names.
export const liveHostVars = ({ frame, pad, bklitWidth, plotRight, plotLeft, clipExt, lerpSpeed, introEaseCss, dotSize, fillRamp }: LiveHostVarsArgs): CSSProperties => ({ "--bkm-live-roll": `${frame?.rollMs ?? 600}ms`, "--bkm-live-pad": `${pad}px`, "--bkm-live-ax": `${Math.round((frame?.roll.x ?? 0) * 100) / 100}px`, "--bkm-live-ak": Math.round((frame?.roll.ak ?? 1) * 1e4) / 1e4, "--bkm-live-xa": `${Math.round((frame?.roll.xa ?? 0) * 100) / 100}px`, "--bkm-live-b0": Math.round((frame?.roll.b0 ?? 0) * 1e4) / 1e4, "--bkm-live-ry-s": Math.round((frame?.roll.s ?? 1) * 1e5) / 1e5, "--bkm-live-ry-t": `${Math.round((frame?.roll.t ?? 0) * 100) / 100}px`, "--bkm-live-ry-d": `${Math.round((frame?.roll.d ?? 0) * 100) / 100}px`, "--bkm-live-roll-ease": frame?.intro === true ? introEaseCss : "linear", "--bkm-live-ext": `${Math.round(clipExt * 100) / 100}px`, "--bkm-live-settle": `${settleMs(lerpSpeed)}ms`, "--bkm-live-k": frame && !frame.intro && !frame.seed ? Math.round(frame.k * 1000) / 1000 : 1, "--bkm-live-dy": frame && !frame.intro && !frame.seed ? `${Math.round(frame.dy * 100) / 100}px` : "0px", "--bkm-live-r0": `${dotSize}px`, "--bkm-live-r1": `${(dotSize) * 3.5}px`, "--bkm-live-fade-x0": `${plotLeft}px`, "--bkm-live-fade": `${Math.round(bklitWidth * 0.04 * 10) / 10}px`, "--bkm-live-fill-top": `${fillRamp.top}px`, "--bkm-live-fill-bottom": `${fillRamp.bottom}px`, "--bkm-live-cut": `${Math.floor(frame?.roll.xa ?? plotRight)}px`, "--bkm-live-shift": Math.round((frame?.roll.x ?? 0) * 100) / 100 }) as CSSProperties;
