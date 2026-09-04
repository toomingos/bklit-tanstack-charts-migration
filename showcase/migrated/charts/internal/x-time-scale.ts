// Sole time→pixel helper for out-of-spec overlays; feed it the timeExtentRaw/timeExtent pair.
export const timeToPixelX = (date: Readonly<Date>, minTime: number, maxTime: number, innerWidth: number): number => {
  const span = maxTime - minTime;
  if (span <= 0) {return 0;}
  return ((date.getTime() - minTime) / span) * innerWidth;
}
