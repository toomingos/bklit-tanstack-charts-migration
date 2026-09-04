// Linear-gauge value/label stack, split from gauge-center so each file owns one component.
import type { ReactElement } from "react";
import { CenterStat, centerStatContainerClassName } from './center-stat';
import type { CenterStatFormat } from './center-stat';
import type { GaugeLabelAlign } from './gauge-center';

interface GaugeLabelStatProps {
  centerValue: number;
  defaultLabel: string;
  prefix?: string;
  suffix?: string;
  formatOptions?: CenterStatFormat;
  align?: GaugeLabelAlign;
}

const LABEL_STAT_STYLE_BY_ALIGN = {
  center: {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    textAlign: "center",
  },
  end: {
    alignItems: "flex-end",
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    textAlign: "right",
  },
  start: {
    alignItems: "flex-start",
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    textAlign: "left",
  },
} as const;

const GaugeLabelStat = ({
  centerValue,
  defaultLabel,
  prefix,
  suffix,
  formatOptions,
  align = "center",
}: Readonly<GaugeLabelStatProps>): ReactElement => (
    <div
      className={centerStatContainerClassName}
      style={LABEL_STAT_STYLE_BY_ALIGN[align]}
    >
      {/* Not the default center-stat clamp() classes — this uses plain
          inherited 16px/1.5 typography instead (see styles.css's
          `.ts-bkm-gauge-linear-stat-*` rule). */}
      <CenterStat
        formatOptions={formatOptions}
        label={defaultLabel}
        labelClassName="ts-bkm-gauge-linear-stat-label"
        prefix={prefix}
        suffix={suffix}
        value={centerValue}
        valueClassName="ts-bkm-gauge-linear-stat-value"
      />
    </div>
  );

export { GaugeLabelStat };
export type { GaugeLabelStatProps };
