// Scatter date-pill chrome extracted from scatter-chart.tsx. The pill follows the
// Focused point's x via a spring; the label fade drives the x-axis tick fade.
import type { ChartPoint } from "@tanstack/charts";
import type { SpringConfig } from "./chart-config-context";
import { buildPill } from "./date-pill";
import type { PillBuild } from "./date-pill";
import { DISCRETE_INTERACTION_THRESHOLD } from "./design-tokens";
import { shortDateFmt } from "./formatters";
import type { ChartDatum } from "./types";

interface ScatterPillChromeState {
  readonly xDataKey: string;
  readonly pointCount: number;
  readonly showDatePill: boolean;
  /** Date-pill fade radius (bklit XAxis.tickerHalfWidth). */
  readonly tickerHalfWidth?: number;
  readonly dateLabels: string[];
}

interface ScatterLabelFade {
  readonly primaryX: number;
  readonly hoveredLabel: string | null;
}

interface ScatterPillChrome {
  readonly update: (points: readonly Readonly<ChartPoint<ChartDatum, Date, number>>[]) => void;
  readonly detach: () => void;
}

interface HidePillChromeParams {
  readonly onLabelFadeChange: (fade: ScatterLabelFade | null) => void;
  readonly pill: Readonly<PillBuild>;
  readonly visible: boolean;
}

const hidePillChrome = ({ onLabelFadeChange, pill, visible }: Readonly<HidePillChromeParams>): void => {
  if (!visible) {return;}
  pill.layer.style.display = "none";
  pill.spring.stop();
  pill.label.textContent = "";
  onLabelFadeChange(null);
};

interface UpdatePillLabelParams {
  readonly date: Date;
  readonly datumIndex: number;
  readonly discrete: boolean;
  readonly pill: Readonly<PillBuild>;
  readonly state: Readonly<ScatterPillChromeState>;
}

const updatePillLabel = ({ date, datumIndex, discrete, pill, state }: Readonly<UpdatePillLabelParams>): void => {
  if (pill.ticker && state.dateLabels.length > 0) {
    pill.ticker.update(datumIndex, discrete);
    return;
  }
  pill.label.textContent = shortDateFmt.format(date);
};

interface PositionPillForPrimaryParams {
  readonly discrete: boolean;
  readonly pill: Readonly<PillBuild>;
  readonly primary: Readonly<ChartPoint<ChartDatum, Date, number>>;
  readonly showing: boolean;
  readonly state: Readonly<ScatterPillChromeState>;
}

const positionPillForPrimary = ({
  discrete,
  pill,
  primary,
  showing,
  state,
}: Readonly<PositionPillForPrimaryParams>): void => {
  const date = primary.datum[state.xDataKey];
  if (!state.showDatePill || !(date instanceof Date)) {
    pill.layer.style.display = "none";
    return;
  }
  pill.layer.style.display = "";
  updatePillLabel({ date, datumIndex: primary.datumIndex, discrete, pill, state });
  if (showing || discrete) {pill.spring.jump(primary.x);}
  else {pill.spring.set(primary.x);}
};

interface ShowPillForPointsParams {
  readonly onLabelFadeChange: (fade: ScatterLabelFade | null) => void;
  readonly pill: Readonly<PillBuild>;
  readonly primary: Readonly<ChartPoint<ChartDatum, Date, number>>;
  readonly state: Readonly<ScatterPillChromeState>;
  readonly visible: boolean;
}

const showPillForPoints = ({
  onLabelFadeChange,
  pill,
  primary,
  state,
  visible,
}: Readonly<ShowPillForPointsParams>): boolean => {
  const discrete = state.pointCount > DISCRETE_INTERACTION_THRESHOLD;
  positionPillForPrimary({ discrete, pill, primary, showing: !visible, state });
  const date = primary.datum[state.xDataKey];
  const hoveredLabel = date instanceof Date ? shortDateFmt.format(date) : null;
  onLabelFadeChange({ hoveredLabel, primaryX: primary.x });
  return true;
};

interface UpdatePillChromeParams {
  readonly onLabelFadeChange: (fade: ScatterLabelFade | null) => void;
  readonly pill: Readonly<PillBuild>;
  readonly points: readonly Readonly<ChartPoint<ChartDatum, Date, number>>[];
  readonly state: Readonly<ScatterPillChromeState>;
  readonly visible: boolean;
}

const updatePillChrome = ({
  onLabelFadeChange,
  pill,
  points,
  state,
  visible,
}: Readonly<UpdatePillChromeParams>): boolean => {
  if (points.length === 0) {
    hidePillChrome({ onLabelFadeChange, pill, visible });
    return visible;
  }
  const [primary] = points;
  return showPillForPoints({ onLabelFadeChange, pill, primary, state, visible });
};

interface AttachScatterPillChromeParams {
  readonly getState: () => ScatterPillChromeState;
  readonly host: HTMLElement;
  readonly onLabelFadeChange: (fade: ScatterLabelFade | null) => void;
  readonly tooltipSpring: Readonly<SpringConfig>;
}

const attachScatterPillChrome = ({
  getState,
  host,
  onLabelFadeChange,
  tooltipSpring,
}: Readonly<AttachScatterPillChromeParams>): ScatterPillChrome => {
  const doc = host.ownerDocument;
  const pill = buildPill(doc, tooltipSpring, () => getState().dateLabels);
  host.append(pill.layer);
  let visible = false;
  const hide = (): void => {
    hidePillChrome({ onLabelFadeChange, pill, visible });
    visible = false;
  };
  const update = (points: readonly Readonly<ChartPoint<ChartDatum, Date, number>>[]): void => {
    visible = updatePillChrome({ onLabelFadeChange, pill, points, state: getState(), visible });
  };
  const detach = (): void => {
    hide();
    pill.layer.remove();
    pill.ticker?.detach();
  };
  return { detach, update };
};

export { attachScatterPillChrome, hidePillChrome, positionPillForPrimary, showPillForPoints, updatePillChrome, updatePillLabel };
export type {
  AttachScatterPillChromeParams,
  HidePillChromeParams,
  PositionPillForPrimaryParams,
  ScatterLabelFade,
  ScatterPillChrome,
  ScatterPillChromeState,
  ShowPillForPointsParams,
  UpdatePillChromeParams,
  UpdatePillLabelParams,
};
