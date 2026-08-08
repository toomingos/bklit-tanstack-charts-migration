// bklit chart-formatters.ts — the formatter subset the pilot uses. Single
// source for every migrated module (x-axis labels, tooltip title/values,
// date pill) so all surfaces format identically, like bklit's shared module.
export const shortDateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export const weekdayDateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

// bklit chart-formatters.ts hmsTimeFmt — LiveXAxis's default `formatTime`
// (live-x-axis.tsx `defaultFormatTime`).
export const hmsTimeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export const intFmt = new Intl.NumberFormat("en-US").format;
