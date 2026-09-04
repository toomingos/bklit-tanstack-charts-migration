// Analytic damped-spring sampler (framer useSpring behavior) driving rAF style writes.
import { createChartSpring } from '@tanstack/charts/spring';
import type { ChartSpring } from '@tanstack/charts/spring';

interface Spring {
  readonly set: (target: number) => void
  readonly jump: (value: number) => void
  readonly stop: () => void
}

// Flat rest thresholds snap tiny hover-scale springs; granular tier covers amplitudes < 5.
const GRANULAR_SCALE_MAX_DELTA = 5;
const REST_DELTA_GRANULAR = 0.005;
const REST_SPEED_GRANULAR = 0.01;
const REST_DELTA_DEFAULT = 0.5;
const REST_SPEED_DEFAULT = 2;

interface SpringSamplerParams {
  readonly stiffness: number;
  readonly damping: number;
  readonly granular: boolean;
}

const buildSpringSampler = ({ stiffness, damping, granular }: SpringSamplerParams): ChartSpring => granular
    ? createChartSpring({
        damping,
        restDelta: REST_DELTA_GRANULAR,
        restSpeed: REST_SPEED_GRANULAR,
        stiffness,
      })
    : createChartSpring({
        damping,
        restDelta: REST_DELTA_DEFAULT,
        restSpeed: REST_SPEED_DEFAULT,
        stiffness,
      });

interface SpringSampleState {
  readonly from: number;
  readonly to: number;
  velocity: number;
}

interface SpringEngineState {
  current: number;
  velocity: number;
  target: number;
  frame: number | undefined;
  startedAt: number;
  granular: boolean;
  readonly stiffness: number;
  readonly damping: number;
  springInstance: ChartSpring;
  springState: SpringSampleState;
  readonly schedule: (now: number) => void;
  readonly onUpdate: (value: number) => void;
}

interface SpringEngineParams {
  readonly initial: number;
  readonly stiffness: number;
  readonly damping: number;
  readonly onUpdate: (value: number) => void;
}

class SpringEngine {
  private readonly state: SpringEngineState;

  public constructor({ initial, stiffness, damping, onUpdate }: SpringEngineParams) {
    const state: SpringEngineState = {
      current: initial,
      damping,
      frame: undefined,
      granular: true,
      onUpdate,
      schedule: (now: number): void => { this.advance(now); },
      springInstance: buildSpringSampler({ damping, granular: true, stiffness }),
      springState: { from: initial, to: initial, velocity: 0 },
      startedAt: 0,
      stiffness,
      target: initial,
      velocity: 0,
    };
    this.state = state;
  }

  public advance(now: number): void {
    const sample = this.state.springInstance.sample(now - this.state.startedAt, this.state.springState);
    const { done, value, velocity: sampleVelocity } = sample;
    if (done) {
      this.settle();
      return;
    }
    this.state.current = value;
    this.state.velocity = sampleVelocity;
    this.state.onUpdate(this.state.current);
    this.state.frame = requestAnimationFrame(this.state.schedule);
  }

  public jumpTo(value: number): void {
    this.state.target = value;
    this.state.current = value;
    this.state.velocity = 0;
    this.state.springState = { from: value, to: value, velocity: 0 };
    if (this.state.frame !== undefined) {
      cancelAnimationFrame(this.state.frame);
      this.state.frame = undefined;
    }
    this.state.onUpdate(this.state.current);
  }

  public setTarget(next: number): void {
    if (next === this.state.target && this.state.frame === undefined && this.state.current === this.state.target) {return;}
    this.state.target = next;
    this.refreshSampler(Math.abs(this.state.target - this.state.current) < GRANULAR_SCALE_MAX_DELTA);
    this.state.springState = { from: this.state.current, to: this.state.target, velocity: this.state.velocity };
    this.state.startedAt = performance.now();
    this.state.frame ??= requestAnimationFrame(this.state.schedule);
  }

  public stop(): void {
    if (this.state.frame !== undefined) {
      cancelAnimationFrame(this.state.frame);
      this.state.frame = undefined;
    }
  }

  private settle(): void {
    this.state.current = this.state.target;
    this.state.velocity = 0;
    this.state.frame = undefined;
    this.state.onUpdate(this.state.current);
  }

  private refreshSampler(nextGranular: boolean): void {
    if (this.state.frame === undefined || nextGranular !== this.state.granular) {
      this.state.granular = nextGranular;
      this.state.springInstance = buildSpringSampler({ damping: this.state.damping, granular: nextGranular, stiffness: this.state.stiffness });
    }
  }
}

interface CreateSpringOptions {
  readonly damping: number;
  readonly initial: number;
  readonly onUpdate: (value: number) => void;
  readonly stiffness: number;
}

const createSpring = (options: Readonly<CreateSpringOptions>): Spring => {
  const engine = new SpringEngine({ damping: options.damping, initial: options.initial, onUpdate: options.onUpdate, stiffness: options.stiffness });
  return {
    jump(value: number) {
      engine.jumpTo(value);
    },
    set(next: number) {
      engine.setTarget(next);
    },
    stop() {
      engine.stop();
    },
  };
}

export { createSpring };
export type { CreateSpringOptions, Spring };
