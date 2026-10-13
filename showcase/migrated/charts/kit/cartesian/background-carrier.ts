"use client";
// The Background child: importing it is what bundles the pattern rect, its mask CSS and the pattern presets.
import { defineCarrier } from "../role";
import type { BackgroundConfig } from "../types";
import { backgroundCss, backgroundMarks } from "./background";
import { BackgroundResources } from "./background-resources";
import { registerBackground } from "./features";

registerBackground({ marks: backgroundMarks, css: backgroundCss, Resources: BackgroundResources });

export const Background = /* @__PURE__ */ defineCarrier<Readonly<BackgroundConfig>>("background", "Background");
