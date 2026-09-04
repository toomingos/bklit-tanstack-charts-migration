// Formatter subset shared by every migrated module so all surfaces match.
const shortDateFmt = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
});

const weekdayDateFmt = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  weekday: "short",
});

// Default formatTime for LiveXAxis.
const hmsTimeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  second: "2-digit",
});

const intNumberFormat = new Intl.NumberFormat("en-US");

const intFmt = (value: number): string => intNumberFormat.format(value);

export { shortDateFmt, weekdayDateFmt, hmsTimeFmt, intFmt };
