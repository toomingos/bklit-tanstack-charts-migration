// Shared formatters (same output as bklit's chart-formatters).
export const shortDateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
export const weekdayDateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});
const intFormat = new Intl.NumberFormat("en-US");
export const intFmt: Intl.NumberFormat["format"] = (value) => intFormat.format(value);
