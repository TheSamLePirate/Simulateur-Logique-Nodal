import type { Node, Edge } from "@xyflow/react";
import type { Bit } from "../types";
import { logicGates } from "./gates";
import { add8 } from "./adder";

/**
 * Resolve the value of a specific input handle on a target node
 * by tracing the edge back to its source.
 */
export const getInputValue = (
  targetNodeId: string,
  targetHandleId: string,
  nodes: Node[],
  edges: Edge[],
): Bit => {
  const edge = edges.find(
    (e) => e.target === targetNodeId && e.targetHandle === targetHandleId,
  );
  if (!edge) return 0;

  const sourceNode = nodes.find((n) => n.id === edge.source);
  if (!sourceNode) return 0;

  if (sourceNode.type === "input") return sourceNode.data.value as Bit;
  if (sourceNode.type === "gate") return sourceNode.data.value as Bit;
  if (sourceNode.type === "adder8") {
    if (edge.sourceHandle === "cout") return sourceNode.data.cout as Bit;
    if (edge.sourceHandle?.startsWith("s")) {
      const idx = parseInt(edge.sourceHandle.replace("s", ""));
      return ((sourceNode.data.sum as Bit[])?.[idx] || 0) as Bit;
    }
  }
  if (sourceNode.type === "sram8") {
    if (edge.sourceHandle?.startsWith("q")) {
      const idx = parseInt(edge.sourceHandle.replace("q", ""));
      return ((sourceNode.data.q as Bit[])?.[idx] || 0) as Bit;
    }
  }
  if (sourceNode.type === "bus8") {
    if (edge.sourceHandle?.startsWith("out")) {
      const idx = parseInt(edge.sourceHandle.replace("out", ""));
      return ((sourceNode.data.val as Bit[])?.[idx] || 0) as Bit;
    }
  }
  if (sourceNode.type === "inputNumber") {
    if (edge.sourceHandle?.startsWith("out")) {
      const idx = parseInt(edge.sourceHandle.replace("out", ""));
      return ((sourceNode.data.value as number) || 0) & (1 << idx) ? 1 : 0;
    }
  }
  return 0;
};

/**
 * Run one tick of simulation: update all node values based on their inputs.
 * Returns the new nodes array (or the same reference if nothing changed).
 */
export const simulateNodes = (nodes: Node[], edges: Edge[]): Node[] => {
  const newNodes = [...nodes];
  let changed = false;

  const getVal = (targetId: string, handleId: string): Bit =>
    getInputValue(targetId, handleId, newNodes, edges);

  newNodes.forEach((node, index) => {
    if (node.type === "output") {
      const val = getVal(node.id, "in");
      if (node.data.value !== val) {
        newNodes[index] = { ...node, data: { ...node.data, value: val } };
        changed = true;
      }
    } else if (node.type === "gate") {
      const type = node.data.type as keyof typeof logicGates;
      let val: Bit = 0;
      if (type === "NOT") {
        val = logicGates.NOT(getVal(node.id, "in"));
      } else {
        val = logicGates[type](getVal(node.id, "a"), getVal(node.id, "b"));
      }
      if (node.data.value !== val) {
        newNodes[index] = { ...node, data: { ...node.data, value: val } };
        changed = true;
      }
    } else if (node.type === "adder8") {
      const a: Bit[] = Array(8)
        .fill(0)
        .map((_, i) => getVal(node.id, `a${i}`));
      const b: Bit[] = Array(8)
        .fill(0)
        .map((_, i) => getVal(node.id, `b${i}`));
      const cin = getVal(node.id, "cin");

      const { sum, cout } = add8(a, b, cin);

      const sumChanged = sum.some(
        (s, i) => s !== (node.data.sum as Bit[])?.[i],
      );
      if (sumChanged || cout !== node.data.cout) {
        newNodes[index] = { ...node, data: { ...node.data, sum, cout } };
        changed = true;
      }
    } else if (node.type === "sram8") {
      let addr = 0;
      for (let i = 0; i < 8; i++) {
        if (getVal(node.id, `a${i}`)) addr |= 1 << i;
      }

      let dataIn = 0;
      for (let i = 0; i < 8; i++) {
        if (getVal(node.id, `d${i}`)) dataIn |= 1 << i;
      }

      const we = getVal(node.id, "we");

      const memory = node.data.memory
        ? [...(node.data.memory as number[])]
        : Array(256).fill(0);
      let memChanged = false;

      if (we === 1) {
        if (memory[addr] !== dataIn) {
          memory[addr] = dataIn;
          memChanged = true;
        }
      }

      const currentQ = memory[addr];
      const qArr = Array(8)
        .fill(0)
        .map((_, i) => (currentQ & (1 << i) ? 1 : 0));

      const qChanged =
        (node.data.q as number[])?.some(
          (v: number, i: number) => v !== qArr[i],
        ) || !node.data.q;
      const addrChanged = node.data.currentAddress !== addr;

      if (memChanged || qChanged || addrChanged) {
        newNodes[index] = {
          ...node,
          data: { ...node.data, memory, q: qArr, currentAddress: addr },
        };
        changed = true;
      }
    } else if (node.type === "bus8") {
      const val: Bit[] = Array(8)
        .fill(0)
        .map((_, i) => getVal(node.id, `in${i}`));
      const valChanged = val.some(
        (v, i) => v !== (node.data.val as Bit[])?.[i],
      );
      if (valChanged) {
        newNodes[index] = { ...node, data: { ...node.data, val } };
        changed = true;
      }
    } else if (node.type === "outputNumber") {
      let val = 0;
      for (let i = 0; i < 8; i++) {
        if (getVal(node.id, `in${i}`)) {
          val |= 1 << i;
        }
      }
      if (node.data.value !== val) {
        newNodes[index] = { ...node, data: { ...node.data, value: val } };
        changed = true;
      }
    }
  });

  return changed ? newNodes : nodes;
};

/**
 * Update edge styles based on signal activity.
 * Returns a new edges array (or same reference if nothing changed).
 */
export const updateEdgeStyles = (nodes: Node[], edges: Edge[]): Edge[] => {
  let changed = false;

  const newEdges = edges.map((edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    let isActive = false;

    if (sourceNode) {
      if (sourceNode.type === "input" || sourceNode.type === "gate") {
        isActive = sourceNode.data.value === 1;
      } else if (sourceNode.type === "adder8") {
        if (edge.sourceHandle === "cout") isActive = sourceNode.data.cout === 1;
        if (edge.sourceHandle?.startsWith("s")) {
          const idx = parseInt(edge.sourceHandle.replace("s", ""));
          isActive = (sourceNode.data.sum as Bit[])?.[idx] === 1;
        }
      } else if (sourceNode.type === "sram8") {
        if (edge.sourceHandle?.startsWith("q")) {
          const idx = parseInt(edge.sourceHandle.replace("q", ""));
          isActive = (sourceNode.data.q as Bit[])?.[idx] === 1;
        }
      } else if (sourceNode.type === "bus8") {
        if (edge.sourceHandle?.startsWith("out")) {
          const idx = parseInt(edge.sourceHandle.replace("out", ""));
          isActive = (sourceNode.data.val as Bit[])?.[idx] === 1;
        }
      } else if (sourceNode.type === "inputNumber") {
        if (edge.sourceHandle?.startsWith("out")) {
          const idx = parseInt(edge.sourceHandle.replace("out", ""));
          const val = Number(sourceNode.data.value) || 0;
          isActive = (val & (1 << idx)) !== 0;
        }
      }
    }

    const strokeColor = isActive ? "#60a5fa" : "#475569";

    if (edge.animated !== isActive || edge.style?.stroke !== strokeColor) {
      changed = true;
      return {
        ...edge,
        animated: isActive,
        style: {
          ...edge.style,
          stroke: strokeColor,
          strokeWidth: isActive ? 3 : 2,
        },
      };
    }
    return edge;
  });

  return changed ? newEdges : edges;
};
