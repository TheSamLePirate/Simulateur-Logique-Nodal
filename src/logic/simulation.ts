import type { Node, Edge } from "@xyflow/react";
import type { Bit, GroupNodeData } from "../types";
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
  if (sourceNode.type === "group") {
    const outputs = (sourceNode.data as unknown as GroupNodeData).outputs;
    if (edge.sourceHandle && outputs) {
      return (outputs[edge.sourceHandle] || 0) as Bit;
    }
  }
  if (sourceNode.type === "clock") {
    return (sourceNode.data.value as Bit) || 0;
  }
  if (sourceNode.type === "register8") {
    if (edge.sourceHandle?.startsWith("q")) {
      const idx = parseInt(edge.sourceHandle.replace("q", ""));
      return ((sourceNode.data.q as Bit[])?.[idx] || 0) as Bit;
    }
  }
  if (sourceNode.type === "alu8") {
    if (edge.sourceHandle?.startsWith("r")) {
      const idx = parseInt(edge.sourceHandle.replace("r", ""));
      return ((sourceNode.data.r as Bit[])?.[idx] || 0) as Bit;
    }
    if (edge.sourceHandle === "zero") return (sourceNode.data.zero as Bit) || 0;
    if (edge.sourceHandle === "carry")
      return (sourceNode.data.carry as Bit) || 0;
    if (edge.sourceHandle === "neg")
      return (sourceNode.data.negative as Bit) || 0;
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
    } else if (node.type === "group") {
      const groupData = node.data as unknown as GroupNodeData;
      const { circuit, inputHandles, outputHandles } = groupData;

      // Step 1: Clone internal circuit nodes
      let internalNodes: Node[] = circuit.nodes.map((n) => ({
        ...n,
        data: { ...n.data },
      }));
      const internalEdges = circuit.edges;

      // Step 2: Feed external input values into internal I/O nodes
      // Group together handles per internal node for inputNumber bit-combining
      const inputsByNode = new Map<
        string,
        { handleId: string; internalHandleId: string }[]
      >();
      for (const ih of inputHandles) {
        if (!inputsByNode.has(ih.internalNodeId)) {
          inputsByNode.set(ih.internalNodeId, []);
        }
        inputsByNode.get(ih.internalNodeId)!.push({
          handleId: ih.handleId,
          internalHandleId: ih.internalHandleId,
        });
      }

      for (const [internalNodeId, handles] of inputsByNode) {
        const iNode = internalNodes.find((n) => n.id === internalNodeId);
        if (!iNode) continue;

        if (iNode.type === "input") {
          // Single bit input
          const externalValue = getVal(node.id, handles[0].handleId);
          internalNodes = internalNodes.map((n) =>
            n.id === internalNodeId
              ? { ...n, data: { ...n.data, value: externalValue } }
              : n,
          );
        } else if (iNode.type === "inputNumber") {
          // Combine 8 bits into a number
          let numVal = 0;
          for (const h of handles) {
            const bitIndex = parseInt(h.internalHandleId.replace("out", ""));
            const bitVal = getVal(node.id, h.handleId);
            if (bitVal) numVal |= 1 << bitIndex;
          }
          internalNodes = internalNodes.map((n) =>
            n.id === internalNodeId
              ? { ...n, data: { ...n.data, value: numVal } }
              : n,
          );
        }
      }

      // Step 3: Multi-pass internal simulation (converge signals through gate chains)
      const MAX_PASSES = 10;
      for (let pass = 0; pass < MAX_PASSES; pass++) {
        const prev = internalNodes;
        internalNodes = simulateNodes(internalNodes, internalEdges);
        if (internalNodes === prev) break; // No changes, converged
      }

      // Step 4: Read output values from internal output nodes
      const newOutputs: Record<string, Bit> = {};
      for (const oh of outputHandles) {
        const internalNode = internalNodes.find(
          (n) => n.id === oh.internalNodeId,
        );
        if (!internalNode) {
          newOutputs[oh.handleId] = 0;
          continue;
        }

        if (internalNode.type === "output") {
          newOutputs[oh.handleId] = ((internalNode.data.value as number) ||
            0) as Bit;
        } else if (internalNode.type === "outputNumber") {
          const val = (internalNode.data.value as number) || 0;
          const bitIndex = parseInt(oh.internalHandleId.replace("in", ""));
          newOutputs[oh.handleId] = (val & (1 << bitIndex) ? 1 : 0) as Bit;
        }
      }

      // Step 5: Check if anything changed
      const outputsChanged = Object.keys(newOutputs).some(
        (k) => newOutputs[k] !== groupData.outputs[k],
      );

      if (outputsChanged) {
        newNodes[index] = {
          ...node,
          data: {
            ...groupData,
            outputs: newOutputs,
            circuit: { nodes: internalNodes, edges: internalEdges },
          },
        };
        changed = true;
      }
    } else if (node.type === "clock") {
      const freq = (node.data.frequency as number) || 1;
      const threshold = Math.max(1, Math.round(20 / (2 * freq)));
      let counter = ((node.data.tickCounter as number) || 0) + 1;
      let value = (node.data.value as Bit) || 0;

      if (counter >= threshold) {
        value = value ? 0 : 1;
        counter = 0;
      }

      if (counter !== node.data.tickCounter || value !== node.data.value) {
        newNodes[index] = {
          ...node,
          data: { ...node.data, value, tickCounter: counter },
        };
        changed = true;
      }
    } else if (node.type === "register8") {
      const clk = getVal(node.id, "clk");
      const prevClk = (node.data.prevClk as Bit) || 0;
      const rst = getVal(node.id, "rst");
      const load = getVal(node.id, "load");
      let value = (node.data.value as number) || 0;

      // Rising edge detection
      if (prevClk === 0 && clk === 1) {
        if (rst === 1) {
          value = 0;
        } else if (load === 1) {
          value = 0;
          for (let i = 0; i < 8; i++) {
            if (getVal(node.id, `d${i}`)) value |= 1 << i;
          }
        }
      }

      const q: Bit[] = Array(8)
        .fill(0)
        .map((_, i) => (value & (1 << i) ? 1 : 0) as Bit);

      const qChanged =
        (node.data.q as Bit[])?.some((v: Bit, i: number) => v !== q[i]) ||
        !node.data.q;
      const valueChanged = node.data.value !== value;
      const clkChanged = node.data.prevClk !== clk;

      if (qChanged || valueChanged || clkChanged) {
        newNodes[index] = {
          ...node,
          data: { ...node.data, value, q, prevClk: clk },
        };
        changed = true;
      }
    } else if (node.type === "alu8") {
      let a = 0;
      for (let i = 0; i < 8; i++) {
        if (getVal(node.id, `a${i}`)) a |= 1 << i;
      }
      let b = 0;
      for (let i = 0; i < 8; i++) {
        if (getVal(node.id, `b${i}`)) b |= 1 << i;
      }
      let op = 0;
      for (let i = 0; i < 3; i++) {
        if (getVal(node.id, `op${i}`)) op |= 1 << i;
      }

      let result = 0;
      let carry: Bit = 0;
      let opName = "ADD";

      switch (op) {
        case 0b000: {
          opName = "ADD";
          const sum = a + b;
          result = sum & 0xff;
          carry = (sum > 255 ? 1 : 0) as Bit;
          break;
        }
        case 0b001: {
          opName = "SUB";
          const diff = a - b;
          result = diff & 0xff;
          carry = (diff < 0 ? 1 : 0) as Bit;
          break;
        }
        case 0b010:
          opName = "AND";
          result = a & b & 0xff;
          break;
        case 0b011:
          opName = "OR";
          result = (a | b) & 0xff;
          break;
        case 0b100:
          opName = "XOR";
          result = (a ^ b) & 0xff;
          break;
        case 0b101:
          opName = "NOT";
          result = ~a & 0xff;
          break;
        case 0b110:
          opName = "SHL";
          carry = (a & 0x80 ? 1 : 0) as Bit;
          result = (a << 1) & 0xff;
          break;
        case 0b111:
          opName = "SHR";
          carry = (a & 0x01 ? 1 : 0) as Bit;
          result = (a >> 1) & 0xff;
          break;
      }

      const zero: Bit = result === 0 ? 1 : 0;
      const negative: Bit = (result & 0x80 ? 1 : 0) as Bit;
      const r: Bit[] = Array(8)
        .fill(0)
        .map((_, i) => (result & (1 << i) ? 1 : 0) as Bit);

      const rChanged =
        (node.data.r as Bit[])?.some((v: Bit, i: number) => v !== r[i]) ||
        !node.data.r;
      if (
        rChanged ||
        node.data.zero !== zero ||
        node.data.carry !== carry ||
        node.data.negative !== negative ||
        node.data.opName !== opName
      ) {
        newNodes[index] = {
          ...node,
          data: {
            ...node.data,
            a,
            b,
            result,
            r,
            zero,
            carry,
            negative,
            opName,
          },
        };
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
      } else if (sourceNode.type === "group") {
        const outputs = (sourceNode.data as unknown as GroupNodeData).outputs;
        if (edge.sourceHandle && outputs) {
          isActive = outputs[edge.sourceHandle] === 1;
        }
      } else if (sourceNode.type === "clock") {
        isActive = sourceNode.data.value === 1;
      } else if (sourceNode.type === "register8") {
        if (edge.sourceHandle?.startsWith("q")) {
          const idx = parseInt(edge.sourceHandle.replace("q", ""));
          isActive = (sourceNode.data.q as Bit[])?.[idx] === 1;
        }
      } else if (sourceNode.type === "alu8") {
        if (edge.sourceHandle?.startsWith("r")) {
          const idx = parseInt(edge.sourceHandle.replace("r", ""));
          isActive = (sourceNode.data.r as Bit[])?.[idx] === 1;
        } else if (edge.sourceHandle === "zero") {
          isActive = sourceNode.data.zero === 1;
        } else if (edge.sourceHandle === "carry") {
          isActive = sourceNode.data.carry === 1;
        } else if (edge.sourceHandle === "neg") {
          isActive = sourceNode.data.negative === 1;
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
