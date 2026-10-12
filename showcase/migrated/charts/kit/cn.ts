import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { createTailwindMerge, fromTheme, validators } from "tailwind-merge";

// tailwind-merge's own engine with the default config cut down to the class groups bklit's legend, stat and brush markup uses (copied from
// tailwind-merge 2.6 getDefaultConfig, same group ids and conflict table); the full default config costs ~3 KB gz and is only reachable
// through `twMerge`, so building the merger here keeps it out of the bundle. A class outside these groups is never merged away.
// Everything sits inside `buildMerge` so routes that only import `joinClasses` bundle none of tailwind-merge.
const buildMerge = () => {
  const { isAny, isArbitraryLength, isArbitraryNumber, isArbitraryValue, isLength, isNumber, isTshirtSize } = validators;

  const spacing = fromTheme("spacing");
  const margin = fromTheme("margin");
  const radius = fromTheme("borderRadius");
  const opacity = fromTheme("opacity");
  const colors = fromTheme("colors");
  const align = ["start", "end", "center", "between", "around", "evenly", "stretch"];
  const overflow = ["auto", "hidden", "clip", "visible", "scroll"];
  const zeroAndEmpty = ["", "0", isArbitraryValue];
  const numberAndArbitrary = [isNumber, isArbitraryValue];
  const roundedSides = ["s", "e", "t", "r", "b", "l", "ss", "se", "ee", "es", "tl", "tr", "br", "bl"];

  return createTailwindMerge(() => ({
    cacheSize: 500,
    separator: ":",
    theme: {
      colors: [isAny],
      spacing: [isLength, isArbitraryLength],
      borderRadius: ["none", "", "full", isTshirtSize, isArbitraryValue],
      gap: [isArbitraryValue, spacing],
      margin: ["auto", isArbitraryValue, spacing],
      opacity: numberAndArbitrary,
      padding: [isArbitraryValue, spacing],
    },
    classGroups: {
      display: ["block", "inline-block", "inline", "flex", "inline-flex", "table", "inline-table", "table-caption", "table-cell", "table-column", "table-column-group", "table-footer-group", "table-header-group", "table-row-group", "table-row", "flow-root", "grid", "inline-grid", "contents", "list-item", "hidden"],
      overflow: [{ overflow }],
      "overflow-x": [{ "overflow-x": overflow }],
      "overflow-y": [{ "overflow-y": overflow }],
      "flex-direction": [{ flex: ["row", "row-reverse", "col", "col-reverse"] }],
      "flex-wrap": [{ flex: ["wrap", "wrap-reverse", "nowrap"] }],
      flex: [{ flex: ["1", "auto", "initial", "none", isArbitraryValue] }],
      basis: [{ basis: ["auto", isArbitraryValue, spacing] }],
      grow: [{ grow: zeroAndEmpty }],
      shrink: [{ shrink: zeroAndEmpty }],
      gap: [{ gap: [fromTheme("gap")] }],
      "gap-x": [{ "gap-x": [fromTheme("gap")] }],
      "gap-y": [{ "gap-y": [fromTheme("gap")] }],
      "justify-content": [{ justify: ["normal", ...align] }],
      "align-items": [{ items: ["start", "end", "center", "baseline", "stretch"] }],
      p: [{ p: [fromTheme("padding")] }],
      px: [{ px: [fromTheme("padding")] }],
      py: [{ py: [fromTheme("padding")] }],
      pt: [{ pt: [fromTheme("padding")] }],
      pr: [{ pr: [fromTheme("padding")] }],
      pb: [{ pb: [fromTheme("padding")] }],
      pl: [{ pl: [fromTheme("padding")] }],
      m: [{ m: [margin] }],
      mx: [{ mx: [margin] }],
      my: [{ my: [margin] }],
      mt: [{ mt: [margin] }],
      mr: [{ mr: [margin] }],
      mb: [{ mb: [margin] }],
      ml: [{ ml: [margin] }],
      w: [{ w: ["auto", "min", "max", "fit", "svw", "lvw", "dvw", isArbitraryValue, spacing] }],
      "min-w": [{ "min-w": [isArbitraryValue, spacing, "min", "max", "fit"] }],
      h: [{ h: [isArbitraryValue, spacing, "auto", "min", "max", "fit", "svh", "lvh", "dvh"] }],
      "min-h": [{ "min-h": [isArbitraryValue, spacing, "min", "max", "fit", "svh", "lvh", "dvh"] }],
      size: [{ size: [isArbitraryValue, spacing, "auto", "min", "max", "fit"] }],
      "font-size": [{ text: ["base", isTshirtSize, isArbitraryLength] }],
      "font-weight": [{ font: ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black", isArbitraryNumber] }],
      "fvn-spacing": ["proportional-nums", "tabular-nums"],
      leading: [{ leading: ["none", "tight", "snug", "normal", "relaxed", "loose", isLength, isArbitraryValue] }],
      "text-alignment": [{ text: ["left", "center", "right", "justify", "start", "end"] }],
      "text-color": [{ text: [colors] }],
      "bg-color": [{ bg: [colors] }],
      rounded: [{ rounded: [radius] }],
      ...Object.fromEntries(roundedSides.map((side) => [`rounded-${side}`, [{ [`rounded-${side}`]: [radius] }]])),
      opacity: [{ opacity: [opacity] }],
      transition: [{ transition: ["none", "all", "", "colors", "opacity", "shadow", "transform", isArbitraryValue] }],
      duration: [{ duration: numberAndArbitrary }],
      ease: [{ ease: ["linear", "in", "out", "in-out", isArbitraryValue] }],
      cursor: [{ cursor: ["auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed", "none", isArbitraryValue] }],
    },
    conflictingClassGroups: {
      overflow: ["overflow-x", "overflow-y"],
      flex: ["basis", "grow", "shrink"],
      gap: ["gap-x", "gap-y"],
      p: ["px", "py", "pt", "pr", "pb", "pl"],
      px: ["pr", "pl"],
      py: ["pt", "pb"],
      m: ["mx", "my", "mt", "mr", "mb", "ml"],
      mx: ["mr", "ml"],
      my: ["mt", "mb"],
      size: ["w", "h"],
      "font-size": ["leading"],
      rounded: roundedSides.map((side) => `rounded-${side}`),
      "rounded-s": ["rounded-ss", "rounded-es"],
      "rounded-e": ["rounded-se", "rounded-ee"],
      "rounded-t": ["rounded-tl", "rounded-tr"],
      "rounded-r": ["rounded-tr", "rounded-br"],
      "rounded-b": ["rounded-br", "rounded-bl"],
      "rounded-l": ["rounded-tl", "rounded-bl"],
    },
    conflictingClassGroupModifiers: { "font-size": ["leading"] },
  }));
};

let merge: ((classes: string) => string) | undefined;

export const cn = (...inputs: ClassValue[]): string => (merge ??= buildMerge())(clsx(inputs));

export const joinClasses = (...parts: readonly (string | false | undefined)[]): string => parts.filter((part) => part !== undefined && part !== false && part !== "").join(" ");
