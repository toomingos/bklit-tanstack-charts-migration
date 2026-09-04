import type { ReactElement } from "react";
import { WavesImpl } from "./pattern-waves";
import type { PatternWavesProps } from "./pattern-waves";

// Public wave-pattern component; thin wrapper so the impl stays replaceable.
const PatternWaves = (props: Readonly<PatternWavesProps>): ReactElement => <WavesImpl {...props} />;

PatternWaves.displayName = "PatternWaves";

export { PatternWaves };
