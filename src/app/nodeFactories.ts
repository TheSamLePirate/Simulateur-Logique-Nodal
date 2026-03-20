import type { Node } from "@xyflow/react";
import { v4 as uuidv4 } from "uuid";

import { DEFAULT_PLOTTER_COLOR } from "../plotter";
import { DRIVE_SIZE } from "../cpu/isa";
import type { Bit, SavedModule } from "../types";

export type AppNodeType =
  | "input"
  | "output"
  | "gate"
  | "transistor"
  | "adder8"
  | "sram8"
  | "bus8"
  | "inputNumber"
  | "outputNumber"
  | "clock"
  | "register8"
  | "alu8"
  | "mux8"
  | "console"
  | "plotter"
  | "keyboard"
  | "drive"
  | "network";

export const createRandomCanvasPosition = () => ({
  x: Math.random() * 200 + 100,
  y: Math.random() * 200 + 100,
});

export const createNode = (
  type: AppNodeType,
  specificType?: string,
): Node | null => {
  const id = uuidv4();
  const position = createRandomCanvasPosition();

  switch (type) {
    case "input":
      return {
        id,
        type,
        position,
        data: { label: `IN_${id.slice(0, 4)}`, value: 0 },
      };
    case "output":
      return {
        id,
        type,
        position,
        data: { label: `OUT_${id.slice(0, 4)}`, value: 0 },
      };
    case "gate":
      return {
        id,
        type,
        position,
        data: { type: specificType, value: 0 },
      };
    case "transistor":
      return {
        id,
        type,
        position,
        data: {
          label: (specificType || "nmos").toUpperCase(),
          mode: specificType === "pmos" ? "pmos" : "nmos",
          value: 0 as Bit,
          inputValue: 0 as Bit,
          conducting: 0 as Bit,
        },
      };
    case "adder8":
      return {
        id,
        type,
        position,
        data: { sum: Array(8).fill(0), cout: 0 },
      };
    case "sram8":
      return {
        id,
        type,
        position,
        data: {
          memory: Array(256).fill(0),
          q: Array(8).fill(0),
          currentAddress: 0,
        },
      };
    case "bus8":
      return {
        id,
        type,
        position,
        data: { val: Array(8).fill(0) },
      };
    case "inputNumber":
      return {
        id,
        type,
        position,
        data: { label: "NUM_IN", value: 0 },
      };
    case "outputNumber":
      return {
        id,
        type,
        position,
        data: { label: "NUM_OUT", value: 0 },
      };
    case "clock":
      return {
        id,
        type,
        position,
        data: {
          label: "CLK",
          value: 0 as Bit,
          frequency: 1,
          tickCounter: 0,
        },
      };
    case "register8":
      return {
        id,
        type,
        position,
        data: {
          label: "REG",
          value: 0,
          q: Array(8).fill(0),
          prevClk: 0 as Bit,
        },
      };
    case "alu8":
      return {
        id,
        type,
        position,
        data: {
          a: 0,
          b: 0,
          result: 0,
          r: Array(8).fill(0),
          zero: 0 as Bit,
          carry: 0 as Bit,
          negative: 0 as Bit,
          opName: "ADD",
        },
      };
    case "mux8":
      return {
        id,
        type,
        position,
        data: {
          label: "MUX",
          sel: 0 as Bit,
          outVal: 0,
          out: Array(8).fill(0),
        },
      };
    case "console":
      return {
        id,
        type,
        position,
        data: {
          label: "CONSOLE",
          text: "",
          lastChar: 0,
          prevWr: 0 as Bit,
        },
      };
    case "plotter":
      return {
        id,
        type,
        position,
        data: {
          label: "PLOTTER",
          pixels: [],
          prevDraw: 0 as Bit,
          colorSource: "wires",
          currentColor: DEFAULT_PLOTTER_COLOR,
        },
      };
    case "keyboard":
      return {
        id,
        type,
        position,
        data: {
          label: "KEYBOARD",
          keys: [0, 0, 0, 0, 0],
        },
      };
    case "drive":
      return {
        id,
        type,
        position,
        data: {
          label: "EXT DRIVE",
          bytes: Array(DRIVE_SIZE).fill(0),
          q: Array(8).fill(0),
          currentAddress: 0,
          lastRead: 0,
          lastWrite: 0,
          prevRd: 0 as Bit,
          prevWr: 0 as Bit,
        },
      };
    case "network":
      return {
        id,
        type,
        position,
        data: {
          label: "NETWORK",
          method: "GET",
          url: "",
          body: "",
          q: Array(8).fill(0),
          avail: 0 as Bit,
          pending: 0 as Bit,
          responseBuffer: [],
          requestSerial: 0,
          responseSize: 0,
          lastByte: 0,
          prevGet: 0 as Bit,
          prevPost: 0 as Bit,
          prevRd: 0 as Bit,
        },
      };
    default:
      return null;
  }
};

export const instantiateSavedModuleNode = (mod: SavedModule): Node => {
  const idMap = new Map<string, string>();
  const remapId = (oldId: string) => {
    if (!idMap.has(oldId)) idMap.set(oldId, uuidv4());
    return idMap.get(oldId)!;
  };

  const newCircuitNodes = mod.circuit.nodes.map((node) => ({
    ...node,
    id: remapId(node.id),
    data: { ...node.data },
  }));
  const newCircuitEdges = mod.circuit.edges.map((edge) => ({
    ...edge,
    id: uuidv4(),
    source: remapId(edge.source),
    target: remapId(edge.target),
  }));

  const newInputHandles = mod.inputHandles.map((handle, index) => ({
    ...handle,
    handleId: `grp_in_${index}`,
    internalNodeId: remapId(handle.internalNodeId),
  }));
  const newOutputHandles = mod.outputHandles.map((handle, index) => ({
    ...handle,
    handleId: `grp_out_${index}`,
    internalNodeId: remapId(handle.internalNodeId),
  }));

  const groupId = uuidv4();
  const nodeOffsets: Record<string, { x: number; y: number }> = {};
  for (const node of newCircuitNodes) {
    nodeOffsets[node.id] = { x: 0, y: 0 };
  }

  return {
    id: groupId,
    type: "group",
    position: createRandomCanvasPosition(),
    data: {
      label: mod.label,
      circuit: { nodes: newCircuitNodes, edges: newCircuitEdges },
      inputHandles: newInputHandles,
      outputHandles: newOutputHandles,
      outputs: Object.fromEntries(
        newOutputHandles.map((handle) => [handle.handleId, 0 as Bit]),
      ),
      ungroupInfo: {
        nodeOffsets,
        groupPosition: { x: 0, y: 0 },
        rewiredEdges: [],
        proxyNodeIds: [],
        proxyEdgeIds: [],
      },
    },
  };
};
