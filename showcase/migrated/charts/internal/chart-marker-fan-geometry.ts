// Pure geometry for the fanned-marker layout: shared by chart-marker-fan.tsx and chart-marker-fan-item.tsx so both agree on the same circle-packing math.

const FAN_RADIUS = 50;
const FAN_ANGLE = 160;
const FAN_UP_ANGLE_DEG = -90;
const DEGREES_PER_HALF_TURN = 180;
const DEG_TO_RAD = Math.PI / DEGREES_PER_HALF_TURN;

interface CirclePosition {
  readonly x: number;
  readonly y: number;
}

const getCirclePosition = (index: number, total: number): CirclePosition => {
  const startAngle = FAN_UP_ANGLE_DEG - FAN_ANGLE / 2;
  const angleStep = total > 1 ? FAN_ANGLE / (total - 1) : 0;
  const angle = startAngle + index * angleStep;
  const radians = angle * DEG_TO_RAD;
  return { x: Math.cos(radians) * FAN_RADIUS, y: Math.sin(radians) * FAN_RADIUS };
};

export { FAN_RADIUS, FAN_ANGLE, getCirclePosition };
export type { CirclePosition };
