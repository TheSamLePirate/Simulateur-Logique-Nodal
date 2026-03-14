import type { ScenePreset } from "../types";
import { initialNodes, initialEdges } from "./initialScene";

/**
 * Built-in scene presets.
 *
 * "CPU 8-bit" loads the complete von Neumann computer circuit.
 * "Vide" gives an empty canvas to start from scratch.
 */
export const BUILTIN_PRESETS: ScenePreset[] = [
  {
    id: "__builtin_cpu8",
    name: "CPU 8-bit",
    nodes: initialNodes,
    edges: initialEdges,
    builtIn: true,
  },
  {
    id: "__builtin_empty",
    name: "Vide",
    nodes: [],
    edges: [],
    builtIn: true,
  },
];
