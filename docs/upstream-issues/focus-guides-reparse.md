# Focus guide marks re-serialize and reparse their whole layer on every pointer move

Draft, not posted. TanStack Charts 1.1.0, SVG renderer.

## Problem
A chart with focus-driven guide marks (a crosshair rule, one dot per series, a date pill with rolling digit rows) pays for the whole guide layer on every pointer move. The layer is rebuilt as a fragment: serialized to markup, then reparsed. Cost grows with the number of guide nodes (pill rows, series), not with what changed.

## Measurement
Time-x line chart, two series, 60 synthetic pointer moves 17 ms apart, whole-thread busy time per move, Chrome. Native guides: median 7.07 ms (8 rounds, range 6.70 to 8.31). With the guide layer removed and drawn by an owned sibling element: about 2.1 to 3.2 ms. Removing only the pill, or only the crosshair and dots, saved nothing measurable.

## Workaround
We draw the indicator in our own `aria-hidden` element next to the chart and move it from the public focus callback. It works but duplicates focus layout, hit logic and a11y ordering that the library already has.

## Proposal
Update guide marks in place (keyed attribute or transform patches, no fragment reparse), or provide a persistent guide layer whose marks only change `transform`/`opacity`.
