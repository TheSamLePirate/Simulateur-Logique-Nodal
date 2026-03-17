import type { Edge, Node } from "@xyflow/react";
import type { Bit, GroupNodeData } from "../types";

export const getSourceSignal = (
  sourceNode: Node | undefined,
  sourceHandle?: string | null,
): Bit => {
  if (!sourceNode) return 0;

  if (
    sourceNode.type === "input" ||
    sourceNode.type === "gate" ||
    sourceNode.type === "clock" ||
    sourceNode.type === "transistor"
  ) {
    return ((sourceNode.data.value as number) || 0) as Bit;
  }

  if (sourceNode.type === "adder8") {
    if (sourceHandle === "cout") return (sourceNode.data.cout as Bit) || 0;
    if (sourceHandle?.startsWith("s")) {
      const idx = parseInt(sourceHandle.replace("s", ""), 10);
      return ((sourceNode.data.sum as Bit[])?.[idx] || 0) as Bit;
    }
  }

  if (sourceNode.type === "sram8" || sourceNode.type === "console") {
    if (sourceHandle?.startsWith("q")) {
      const idx = parseInt(sourceHandle.replace("q", ""), 10);
      return ((sourceNode.data.q as Bit[])?.[idx] || 0) as Bit;
    }
    if (sourceNode.type === "console" && sourceHandle === "avail") {
      return (sourceNode.data.avail as Bit) || 0;
    }
  }

  if (sourceNode.type === "bus8") {
    if (sourceHandle?.startsWith("out")) {
      const idx = parseInt(sourceHandle.replace("out", ""), 10);
      return ((sourceNode.data.val as Bit[])?.[idx] || 0) as Bit;
    }
  }

  if (sourceNode.type === "inputNumber") {
    if (sourceHandle?.startsWith("out")) {
      const idx = parseInt(sourceHandle.replace("out", ""), 10);
      return (((sourceNode.data.value as number) || 0) & (1 << idx) ? 1 : 0) as Bit;
    }
  }

  if (sourceNode.type === "group") {
    const outputs = (sourceNode.data as unknown as GroupNodeData).outputs;
    if (sourceHandle && outputs) {
      return (outputs[sourceHandle] || 0) as Bit;
    }
  }

  if (sourceNode.type === "register8" || sourceNode.type === "drive") {
    if (sourceHandle?.startsWith("q")) {
      const idx = parseInt(sourceHandle.replace("q", ""), 10);
      return ((sourceNode.data.q as Bit[])?.[idx] || 0) as Bit;
    }
  }

  if (sourceNode.type === "alu8") {
    if (sourceHandle?.startsWith("r")) {
      const idx = parseInt(sourceHandle.replace("r", ""), 10);
      return ((sourceNode.data.r as Bit[])?.[idx] || 0) as Bit;
    }
    if (sourceHandle === "zero") return (sourceNode.data.zero as Bit) || 0;
    if (sourceHandle === "carry") return (sourceNode.data.carry as Bit) || 0;
    if (sourceHandle === "neg") return (sourceNode.data.negative as Bit) || 0;
  }

  if (sourceNode.type === "mux8") {
    if (sourceHandle?.startsWith("out")) {
      const idx = parseInt(sourceHandle.replace("out", ""), 10);
      return ((sourceNode.data.out as Bit[])?.[idx] || 0) as Bit;
    }
  }

  if (sourceNode.type === "keyboard") {
    if (sourceHandle?.startsWith("k")) {
      const idx = parseInt(sourceHandle.replace("k", ""), 10);
      return ((sourceNode.data.keys as number[])?.[idx] || 0) as Bit;
    }
  }

  if (sourceNode.type === "network") {
    if (sourceHandle?.startsWith("q")) {
      const idx = parseInt(sourceHandle.replace("q", ""), 10);
      return ((sourceNode.data.q as Bit[])?.[idx] || 0) as Bit;
    }
    if (sourceHandle === "avail") return (sourceNode.data.avail as Bit) || 0;
    if (sourceHandle === "pending")
      return (sourceNode.data.pending as Bit) || 0;
  }

  return 0;
};

export const getEdgeSignal = (edge: Edge, nodes: Node[]): Bit => {
  const sourceNode = nodes.find((n) => n.id === edge.source);
  return getSourceSignal(sourceNode, edge.sourceHandle);
};
