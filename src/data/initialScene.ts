import type { Node, Edge } from "@xyflow/react";

/**
 * Initial scene: A basic 8-bit computer
 *
 * Architecture:
 *   DATA (input) ──┐
 *                   ├──▶ ALU ──▶ Accumulator (REG) ──▶ Display
 *   ACC feedback ──┘       ▲
 *                          │
 *   OP (switches) ─────────┘
 *
 *   Clock ──▶ REG.CLK
 *   LOAD  ──▶ REG.LOAD
 *   RST   ──▶ REG.RST
 *
 *   ACC ──▶ SRAM.DATA_IN
 *   ADDR ──▶ SRAM.ADDR
 *   WE   ──▶ SRAM.WE
 *   SRAM.Q ──▶ MEM_OUT
 */

export const initialNodes: Node[] = [
  // ─── CLOCK ───
  {
    id: "clk",
    type: "clock",
    position: { x: 50, y: 80 },
    data: { label: "CLK", value: 0, frequency: 2, tickCounter: 0 },
  },

  // ─── DATA INPUT ───
  {
    id: "dataIn",
    type: "inputNumber",
    position: { x: 50, y: 200 },
    data: { label: "DATA", value: 7 },
  },

  // ─── OPERATION SELECT (3 switches for ALU opcode) ───
  {
    id: "op0",
    type: "input",
    position: { x: 50, y: 440 },
    data: { label: "OP0", value: 0 },
  },
  {
    id: "op1",
    type: "input",
    position: { x: 50, y: 510 },
    data: { label: "OP1", value: 0 },
  },
  {
    id: "op2",
    type: "input",
    position: { x: 50, y: 580 },
    data: { label: "OP2", value: 0 },
  },

  // ─── ALU ───
  {
    id: "alu",
    type: "alu8",
    position: { x: 300, y: 120 },
    data: {
      a: 0,
      b: 0,
      result: 0,
      r: Array(8).fill(0),
      zero: 0,
      carry: 0,
      negative: 0,
      opName: "ADD",
    },
  },

  // ─── ACCUMULATOR REGISTER ───
  {
    id: "acc",
    type: "register8",
    position: { x: 620, y: 120 },
    data: { label: "ACC", value: 0, q: Array(8).fill(0), prevClk: 0 },
  },

  // ─── REGISTER CONTROLS ───
  {
    id: "load",
    type: "input",
    position: { x: 520, y: 440 },
    data: { label: "LOAD", value: 1 },
  },
  {
    id: "rst",
    type: "input",
    position: { x: 520, y: 510 },
    data: { label: "RST", value: 0 },
  },

  // ─── ACCUMULATOR OUTPUT DISPLAY ───
  {
    id: "accOut",
    type: "outputNumber",
    position: { x: 880, y: 140 },
    data: { label: "ACC", value: 0 },
  },

  // ─── ALU FLAGS OUTPUT ───
  {
    id: "flagZ",
    type: "output",
    position: { x: 550, y: 10 },
    data: { label: "ZERO", value: 0 },
  },
  {
    id: "flagC",
    type: "output",
    position: { x: 650, y: 10 },
    data: { label: "CARRY", value: 0 },
  },
  {
    id: "flagN",
    type: "output",
    position: { x: 750, y: 10 },
    data: { label: "NEG", value: 0 },
  },

  // ─── MEMORY SECTION ───
  {
    id: "memAddr",
    type: "inputNumber",
    position: { x: 880, y: 380 },
    data: { label: "ADDR", value: 0 },
  },
  {
    id: "memWE",
    type: "input",
    position: { x: 980, y: 580 },
    data: { label: "MEM_WE", value: 0 },
  },
  {
    id: "sram",
    type: "sram8",
    position: { x: 1100, y: 120 },
    data: {
      memory: Array(256).fill(0),
      q: Array(8).fill(0),
      currentAddress: 0,
    },
  },
  {
    id: "memOut",
    type: "outputNumber",
    position: { x: 1350, y: 180 },
    data: { label: "MEM_OUT", value: 0 },
  },
];

export const initialEdges: Edge[] = [
  // ─── DATA INPUT → ALU.B (operand B) ───
  ...Array.from({ length: 8 }).map((_, i) => ({
    id: `e-data-alu-b${i}`,
    source: "dataIn",
    target: "alu",
    sourceHandle: `out${i}`,
    targetHandle: `b${i}`,
    animated: false,
  })),

  // ─── OP SWITCHES → ALU.OP ───
  {
    id: "e-op0",
    source: "op0",
    target: "alu",
    sourceHandle: "out",
    targetHandle: "op0",
    animated: false,
  },
  {
    id: "e-op1",
    source: "op1",
    target: "alu",
    sourceHandle: "out",
    targetHandle: "op1",
    animated: false,
  },
  {
    id: "e-op2",
    source: "op2",
    target: "alu",
    sourceHandle: "out",
    targetHandle: "op2",
    animated: false,
  },

  // ─── ALU.R → REGISTER.D (ALU result feeds into accumulator) ───
  ...Array.from({ length: 8 }).map((_, i) => ({
    id: `e-alu-acc-d${i}`,
    source: "alu",
    target: "acc",
    sourceHandle: `r${i}`,
    targetHandle: `d${i}`,
    animated: false,
  })),

  // ─── CLOCK → REGISTER.CLK ───
  {
    id: "e-clk-acc",
    source: "clk",
    target: "acc",
    sourceHandle: "out",
    targetHandle: "clk",
    animated: false,
  },

  // ─── LOAD → REGISTER.LOAD ───
  {
    id: "e-load-acc",
    source: "load",
    target: "acc",
    sourceHandle: "out",
    targetHandle: "load",
    animated: false,
  },

  // ─── RST → REGISTER.RST ───
  {
    id: "e-rst-acc",
    source: "rst",
    target: "acc",
    sourceHandle: "out",
    targetHandle: "rst",
    animated: false,
  },

  // ─── REGISTER.Q → ALU.A (feedback: accumulator → ALU operand A) ───
  ...Array.from({ length: 8 }).map((_, i) => ({
    id: `e-acc-alu-a${i}`,
    source: "acc",
    target: "alu",
    sourceHandle: `q${i}`,
    targetHandle: `a${i}`,
    animated: false,
  })),

  // ─── REGISTER.Q → ACC OUTPUT DISPLAY ───
  ...Array.from({ length: 8 }).map((_, i) => ({
    id: `e-acc-out${i}`,
    source: "acc",
    target: "accOut",
    sourceHandle: `q${i}`,
    targetHandle: `in${i}`,
    animated: false,
  })),

  // ─── ALU FLAGS → FLAG LEDs ───
  {
    id: "e-flag-z",
    source: "alu",
    target: "flagZ",
    sourceHandle: "zero",
    targetHandle: "in",
    animated: false,
  },
  {
    id: "e-flag-c",
    source: "alu",
    target: "flagC",
    sourceHandle: "carry",
    targetHandle: "in",
    animated: false,
  },
  {
    id: "e-flag-n",
    source: "alu",
    target: "flagN",
    sourceHandle: "neg",
    targetHandle: "in",
    animated: false,
  },

  // ─── REGISTER.Q → SRAM.D (store accumulator to memory) ───
  ...Array.from({ length: 8 }).map((_, i) => ({
    id: `e-acc-sram-d${i}`,
    source: "acc",
    target: "sram",
    sourceHandle: `q${i}`,
    targetHandle: `d${i}`,
    animated: false,
  })),

  // ─── MEM ADDR → SRAM.A ───
  ...Array.from({ length: 8 }).map((_, i) => ({
    id: `e-addr-sram${i}`,
    source: "memAddr",
    target: "sram",
    sourceHandle: `out${i}`,
    targetHandle: `a${i}`,
    animated: false,
  })),

  // ─── MEM WE → SRAM.WE ───
  {
    id: "e-we-sram",
    source: "memWE",
    target: "sram",
    sourceHandle: "out",
    targetHandle: "we",
    animated: false,
  },

  // ─── SRAM.Q → MEM OUTPUT DISPLAY ───
  ...Array.from({ length: 8 }).map((_, i) => ({
    id: `e-sram-out${i}`,
    source: "sram",
    target: "memOut",
    sourceHandle: `q${i}`,
    targetHandle: `in${i}`,
    animated: false,
  })),
];
