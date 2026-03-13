import type { Node, Edge } from "@xyflow/react";

export const initialNodes: Node[] = [
  // Input A (Value 5)
  {
    id: "inA",
    type: "inputNumber",
    position: { x: 50, y: 150 },
    data: { label: "A", value: 5 },
  },
  // Input B (Value 3)
  {
    id: "inB",
    type: "inputNumber",
    position: { x: 50, y: 350 },
    data: { label: "B", value: 3 },
  },
  // Address Input
  {
    id: "inAddr",
    type: "inputNumber",
    position: { x: 350, y: 350 },
    data: { label: "ADDR", value: 0 },
  },
  // Adder
  {
    id: "adder1",
    type: "adder8",
    position: { x: 350, y: 150 },
    data: { sum: Array(8).fill(0), cout: 0 },
  },
  // WE
  {
    id: "we1",
    type: "input",
    position: { x: 450, y: 500 },
    data: { label: "WE", value: 0 },
  },
  // SRAM
  {
    id: "sram1",
    type: "sram8",
    position: { x: 600, y: 150 },
    data: {
      memory: Array(256).fill(0),
      q: Array(8).fill(0),
      currentAddress: 0,
    },
  },
  // Output Q
  {
    id: "outQ",
    type: "outputNumber",
    position: { x: 850, y: 150 },
    data: { label: "Q", value: 0 },
  },
];

export const initialEdges: Edge[] = [
  // A to Adder
  ...Array.from({ length: 8 }).map((_, i) => ({
    id: `e-a${i}`,
    source: "inA",
    target: "adder1",
    sourceHandle: `out${i}`,
    targetHandle: `a${i}`,
    animated: false,
  })),
  // B to Adder
  ...Array.from({ length: 8 }).map((_, i) => ({
    id: `e-b${i}`,
    source: "inB",
    target: "adder1",
    sourceHandle: `out${i}`,
    targetHandle: `b${i}`,
    animated: false,
  })),
  // Addr to SRAM
  ...Array.from({ length: 8 }).map((_, i) => ({
    id: `e-addr${i}`,
    source: "inAddr",
    target: "sram1",
    sourceHandle: `out${i}`,
    targetHandle: `a${i}`,
    animated: false,
  })),
  // Adder to SRAM
  ...Array.from({ length: 8 }).map((_, i) => ({
    id: `e-sum${i}`,
    source: "adder1",
    target: "sram1",
    sourceHandle: `s${i}`,
    targetHandle: `d${i}`,
    animated: false,
  })),
  // WE to SRAM
  {
    id: "e-we",
    source: "we1",
    target: "sram1",
    sourceHandle: "out",
    targetHandle: "we",
    animated: false,
  },
  // SRAM to Output
  ...Array.from({ length: 8 }).map((_, i) => ({
    id: `e-out${i}`,
    source: "sram1",
    target: "outQ",
    sourceHandle: `q${i}`,
    targetHandle: `in${i}`,
    animated: false,
  })),
];
