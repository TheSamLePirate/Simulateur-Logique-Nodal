import type { Node, Edge } from "@xyflow/react";

/**
 * Initial scene: A complete 8-bit von Neumann computer
 *
 * Architecture (data flow left → right):
 *
 *   ┌──────┐   ┌──────────┐   ┌──────┐   ┌──────┐
 *   │  PC  │──→│ ADDR MUX │──→│ SRAM │──→│  IR  │
 *   └──────┘   └──────────┘   │256×8 │   └──────┘
 *       ↑           ↑         └──────┘
 *   [PC+1]    [OPERAND]          │ ↑
 *                                │ │
 *                                ↓ │
 *                ┌──────────┐  ┌───┴──┐     ┌─────┐
 *                │ DATA MUX │  │  A   │────→│     │
 *                └──────────┘→→│(ACC) │     │ ALU │──→ FLAGS
 *                    ↑         └──────┘     │     │
 *                 ALU.R        ┌──────┐────→│     │
 *                              │  B   │     └─────┘
 *                              └──────┘
 *
 *   CLOCK ──→ all registers (CLK)
 *   Control switches: LOAD enables, MUX selects, MEM_WE, ALU_OP, RST
 *
 *   I/O Peripherals:
 *   ┌──────────┐     ┌──────────┐
 *   │ CONSOLE  │     │ PLOTTER  │
 *   │ (text)   │     │ (256×256)│
 *   └──────────┘     └──────────┘
 *     A → DATA         A → X, B → Y
 *     WR strobe        DRAW strobe
 */

// ── Helper: generate 8 edges for an 8-bit bus connection ──
const bus8 = (
  idPrefix: string,
  src: string,
  tgt: string,
  srcPrefix: string,
  tgtPrefix: string,
): Edge[] =>
  Array.from({ length: 8 }, (_, i) => ({
    id: `${idPrefix}${i}`,
    source: src,
    target: tgt,
    sourceHandle: `${srcPrefix}${i}`,
    targetHandle: `${tgtPrefix}${i}`,
    animated: false,
    style: { stroke: "#475569", strokeWidth: 2 },
  }));

// ── Helper: single-bit edge ──
const wire = (
  id: string,
  src: string,
  tgt: string,
  srcH: string,
  tgtH: string,
): Edge => ({
  id,
  source: src,
  target: tgt,
  sourceHandle: srcH,
  targetHandle: tgtH,
  animated: false,
  style: { stroke: "#475569", strokeWidth: 2 },
});

// ═══════════════════════════════════════════
//  NODES — Complete CPU architecture
// ═══════════════════════════════════════════

export const initialNodes: Node[] = [
  // ─── SYSTEM CLOCK ───
  {
    id: "clk",
    type: "clock",
    position: { x: 680, y: -180 },
    data: { label: "CLK", value: 0, frequency: 2, tickCounter: 0 },
  },

  // ═════════════════════════════════
  //  FETCH UNIT (left section)
  // ═════════════════════════════════

  // Program Counter register
  {
    id: "pc",
    type: "register8",
    position: { x: 0, y: 120 },
    data: { label: "PC", value: 0, q: Array(8).fill(0), prevClk: 0 },
  },
  // PC value display
  {
    id: "pcDisp",
    type: "outputNumber",
    position: { x: 0, y: -60 },
    data: { label: "PC", value: 0 },
  },
  // PC load enable (for jumps)
  {
    id: "pcLoad",
    type: "input",
    position: { x: -120, y: 460 },
    data: { label: "PC_LOAD", value: 1 },
  },

  // ─── PC INCREMENTER ───
  // Adder adds 1 to current PC value
  {
    id: "pcInc",
    type: "adder8",
    position: { x: -200, y: 620 },
    data: { sum: Array(8).fill(0), cout: 0 },
  },
  // Constant 1 for PC increment
  {
    id: "pcOne",
    type: "inputNumber",
    position: { x: -450, y: 700 },
    data: { label: "CONST_1", value: 1 },
  },

  // ═════════════════════════════════
  //  ADDRESS SELECTION
  // ═════════════════════════════════

  // Address MUX: sel=0 → PC (fetch), sel=1 → OPERAND (data access)
  {
    id: "addrMux",
    type: "mux8",
    position: { x: 300, y: 80 },
    data: { label: "ADDR MUX", sel: 0, outVal: 0, out: Array(8).fill(0) },
  },
  // Address source select switch
  {
    id: "addrSel",
    type: "input",
    position: { x: 200, y: -20 },
    data: { label: "ADDR_SEL", value: 0 },
  },
  // Manual operand address input (for LDM/STA addresses)
  {
    id: "operand",
    type: "inputNumber",
    position: { x: 200, y: 640 },
    data: { label: "OPERAND", value: 0 },
  },

  // ═════════════════════════════════
  //  MEMORY (SRAM 1024×8)
  // ═════════════════════════════════

  {
    id: "sram",
    type: "sram8",
    position: { x: 600, y: 80 },
    data: {
      memory: Array(1024).fill(0),
      q: Array(8).fill(0),
      currentAddress: 0,
    },
  },
  // Memory write enable
  {
    id: "memWE",
    type: "input",
    position: { x: 580, y: 560 },
    data: { label: "MEM_WE", value: 0 },
  },
  // Memory read display
  {
    id: "memDisp",
    type: "outputNumber",
    position: { x: 600, y: -60 },
    data: { label: "MEM_OUT", value: 0 },
  },

  // ═════════════════════════════════
  //  DECODE (Instruction Register)
  // ═════════════════════════════════

  // IR captures the opcode fetched from memory
  {
    id: "ir",
    type: "register8",
    position: { x: 900, y: 120 },
    data: { label: "IR", value: 0, q: Array(8).fill(0), prevClk: 0 },
  },
  // IR load enable
  {
    id: "irLoad",
    type: "input",
    position: { x: 800, y: 460 },
    data: { label: "IR_LOAD", value: 1 },
  },
  // IR value display
  {
    id: "irDisp",
    type: "outputNumber",
    position: { x: 900, y: -60 },
    data: { label: "IR", value: 0 },
  },

  // ═════════════════════════════════
  //  DATA PATH MUX
  // ═════════════════════════════════

  // Data MUX: sel=0 → ALU result, sel=1 → Memory data
  {
    id: "dataMux",
    type: "mux8",
    position: { x: 1200, y: 80 },
    data: { label: "DATA MUX", sel: 0, outVal: 0, out: Array(8).fill(0) },
  },
  // Data source select switch
  {
    id: "dataSel",
    type: "input",
    position: { x: 1100, y: -20 },
    data: { label: "DATA_SEL", value: 0 },
  },

  // ═════════════════════════════════
  //  REGISTERS
  // ═════════════════════════════════

  // Accumulator — the main register
  {
    id: "aReg",
    type: "register8",
    position: { x: 1500, y: 20 },
    data: { label: "A (ACC)", value: 0, q: Array(8).fill(0), prevClk: 0 },
  },
  // A load enable
  {
    id: "aLoad",
    type: "input",
    position: { x: 1400, y: 380 },
    data: { label: "A_LOAD", value: 1 },
  },
  // A value display
  {
    id: "aDisp",
    type: "outputNumber",
    position: { x: 1500, y: -100 },
    data: { label: "A (ACC)", value: 0 },
  },

  // B register — secondary for ALU operations
  {
    id: "bReg",
    type: "register8",
    position: { x: 1500, y: 500 },
    data: { label: "B", value: 0, q: Array(8).fill(0), prevClk: 0 },
  },
  // B load enable
  {
    id: "bLoad",
    type: "input",
    position: { x: 1400, y: 850 },
    data: { label: "B_LOAD", value: 0 },
  },
  // B value display
  {
    id: "bDisp",
    type: "outputNumber",
    position: { x: 1750, y: 820 },
    data: { label: "B", value: 0 },
  },

  // ═════════════════════════════════
  //  ALU — Arithmetic Logic Unit
  // ═════════════════════════════════

  {
    id: "alu",
    type: "alu8",
    position: { x: 1850, y: 50 },
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
  // ALU operation select (3 switches)
  {
    id: "op0",
    type: "input",
    position: { x: 1750, y: 620 },
    data: { label: "ALU_OP0", value: 0 },
  },
  {
    id: "op1",
    type: "input",
    position: { x: 1750, y: 690 },
    data: { label: "ALU_OP1", value: 0 },
  },
  {
    id: "op2",
    type: "input",
    position: { x: 1750, y: 760 },
    data: { label: "ALU_OP2", value: 0 },
  },

  // ═════════════════════════════════
  //  FLAGS — ALU Status Outputs
  // ═════════════════════════════════

  {
    id: "flagZ",
    type: "output",
    position: { x: 2150, y: 200 },
    data: { label: "ZERO", value: 0 },
  },
  {
    id: "flagC",
    type: "output",
    position: { x: 2150, y: 270 },
    data: { label: "CARRY", value: 0 },
  },
  {
    id: "flagN",
    type: "output",
    position: { x: 2150, y: 340 },
    data: { label: "NEG", value: 0 },
  },

  // ═════════════════════════════════
  //  STACK POINTER
  // ═════════════════════════════════

  {
    id: "sp",
    type: "register8",
    position: { x: 0, y: 800 },
    data: {
      label: "SP",
      value: 255,
      q: [1, 1, 1, 1, 1, 1, 1, 1],
      prevClk: 0,
    },
  },
  // SP load enable
  {
    id: "spLoad",
    type: "input",
    position: { x: -120, y: 1140 },
    data: { label: "SP_LOAD", value: 0 },
  },
  // SP value display
  {
    id: "spDisp",
    type: "outputNumber",
    position: { x: 220, y: 1000 },
    data: { label: "SP", value: 255 },
  },

  // ═════════════════════════════════
  //  PC SOURCE MUX
  // ═════════════════════════════════
  // sel=0 → PC+1 (sequential), sel=1 → OPERAND (jump/call target)
  {
    id: "pcSrcMux",
    type: "mux8",
    position: { x: -100, y: 350 },
    data: { label: "PC SRC MUX", sel: 0, outVal: 0, out: Array(8).fill(0) },
  },
  // PC jump select control
  {
    id: "pcJmp",
    type: "input",
    position: { x: -220, y: 260 },
    data: { label: "PC_JMP", value: 0 },
  },

  // ═════════════════════════════════
  //  ALU B SOURCE MUX
  // ═════════════════════════════════
  // sel=0 → B register, sel=1 → OPERAND (immediate value)
  {
    id: "aluBMux",
    type: "mux8",
    position: { x: 1680, y: 320 },
    data: { label: "ALU B MUX", sel: 0, outVal: 0, out: Array(8).fill(0) },
  },
  // ALU immediate select control
  {
    id: "aluImm",
    type: "input",
    position: { x: 1580, y: 230 },
    data: { label: "ALU_IMM", value: 0 },
  },

  // ═════════════════════════════════
  //  SP/OPERAND MUX (Address B source)
  // ═════════════════════════════════
  // sel=0 → OPERAND (data address), sel=1 → SP (stack address)
  {
    id: "spOpMux",
    type: "mux8",
    position: { x: 300, y: 400 },
    data: { label: "ADDR B MUX", sel: 0, outVal: 0, out: Array(8).fill(0) },
  },
  // SP/Operand select control
  {
    id: "spSel",
    type: "input",
    position: { x: 200, y: 340 },
    data: { label: "SP_SEL", value: 0 },
  },

  // ═════════════════════════════════
  //  I/O PERIPHERALS
  // ═════════════════════════════════

  // Console output — displays characters from A register
  {
    id: "console",
    type: "console",
    position: { x: 2150, y: -200 },
    data: { label: "CONSOLE", text: "", lastChar: 0, prevWr: 0 },
  },
  // Console write strobe
  {
    id: "consoleWr",
    type: "input",
    position: { x: 2050, y: -60 },
    data: { label: "CON_WR", value: 0 },
  },
  // Console mode (0=ASCII, 1=decimal)
  {
    id: "consoleMode",
    type: "input",
    position: { x: 2050, y: 10 },
    data: { label: "CON_MODE", value: 0 },
  },
  // Console clear
  {
    id: "consoleClear",
    type: "input",
    position: { x: 2050, y: 80 },
    data: { label: "CON_CLR", value: 0 },
  },
  // Console read strobe (for INA instruction)
  {
    id: "consoleRd",
    type: "input",
    position: { x: 2350, y: -60 },
    data: { label: "CON_RD", value: 0 },
  },

  // Plotter output — plots pixels at (A, B) coordinates
  {
    id: "plotter",
    type: "plotter",
    position: { x: 2150, y: 500 },
    data: { label: "PLOTTER", pixels: [], prevDraw: 0 },
  },
  // Plotter draw strobe
  {
    id: "plotDraw",
    type: "input",
    position: { x: 2050, y: 760 },
    data: { label: "DRAW", value: 0 },
  },
  // Plotter clear
  {
    id: "plotClear",
    type: "input",
    position: { x: 2050, y: 830 },
    data: { label: "PLOT_CLR", value: 0 },
  },

  // ═════════════════════════════════
  //  GLOBAL CONTROLS
  // ═════════════════════════════════

  // Global reset — connected to RST on all registers
  {
    id: "rst",
    type: "input",
    position: { x: 680, y: 600 },
    data: { label: "RST", value: 0 },
  },
];

// ═══════════════════════════════════════════
//  EDGES — All data paths and control signals
// ═══════════════════════════════════════════

export const initialEdges: Edge[] = [
  // ══════════════════════════════════════
  //  FETCH: PC → ADDR_MUX → SRAM → IR
  // ══════════════════════════════════════

  // PC output → Address MUX input A (fetch mode)
  ...bus8("e-pc-amux-a", "pc", "addrMux", "q", "a"),

  // Operand → SP/OP MUX input A (data address)
  ...bus8("e-op-spopmux-a", "operand", "spOpMux", "out", "a"),

  // SP → SP/OP MUX input B (stack address)
  ...bus8("e-sp-spopmux-b", "sp", "spOpMux", "q", "b"),

  // SP/OP MUX output → Address MUX input B
  ...bus8("e-spopmux-amux-b", "spOpMux", "addrMux", "out", "b"),

  // SP select → SP/OP MUX sel
  wire("e-spsel", "spSel", "spOpMux", "out", "sel"),

  // Address MUX output → SRAM address
  ...bus8("e-amux-sram-a", "addrMux", "sram", "out", "a"),

  // SRAM data output → IR register input
  ...bus8("e-sram-ir-d", "sram", "ir", "q", "d"),

  // Address select → MUX sel
  wire("e-asel", "addrSel", "addrMux", "out", "sel"),

  // ══════════════════════════════════════
  //  PC INCREMENTER: PC → Adder(+1) → PC
  // ══════════════════════════════════════

  // PC output → Adder input A
  ...bus8("e-pc-inc-a", "pc", "pcInc", "q", "a"),

  // Constant 1 → Adder input B
  ...bus8("e-one-inc-b", "pcOne", "pcInc", "out", "b"),

  // Adder sum → PC Source MUX input A (sequential: PC+1)
  ...bus8("e-inc-pcmux-a", "pcInc", "pcSrcMux", "s", "a"),

  // Operand → PC Source MUX input B (jump/call target)
  ...bus8("e-op-pcmux-b", "operand", "pcSrcMux", "out", "b"),

  // PC Source MUX output → PC data input
  ...bus8("e-pcmux-pc-d", "pcSrcMux", "pc", "out", "d"),

  // Jump select → PC Source MUX sel
  wire("e-pcjmp", "pcJmp", "pcSrcMux", "out", "sel"),

  // ══════════════════════════════════════
  //  DATA PATH: SRAM/ALU → DATA_MUX → A
  // ══════════════════════════════════════

  // ALU result → Data MUX input A (ALU result path)
  ...bus8("e-alu-dmux-a", "alu", "dataMux", "r", "a"),

  // SRAM data output → Data MUX input B (memory load path)
  ...bus8("e-sram-dmux-b", "sram", "dataMux", "q", "b"),

  // Data MUX output → A register input
  ...bus8("e-dmux-a-d", "dataMux", "aReg", "out", "d"),

  // Data select → MUX sel
  wire("e-dsel", "dataSel", "dataMux", "out", "sel"),

  // ══════════════════════════════════════
  //  ALU CONNECTIONS: A, B → ALU
  // ══════════════════════════════════════

  // A register → ALU operand A
  ...bus8("e-a-alu-a", "aReg", "alu", "q", "a"),

  // B register → ALU B MUX input A (register mode)
  ...bus8("e-b-alubmux-a", "bReg", "aluBMux", "q", "a"),

  // Operand → ALU B MUX input B (immediate mode)
  ...bus8("e-op-alubmux-b", "operand", "aluBMux", "out", "b"),

  // ALU B MUX output → ALU operand B
  ...bus8("e-alubmux-alu-b", "aluBMux", "alu", "out", "b"),

  // Immediate select → ALU B MUX sel
  wire("e-aluimm", "aluImm", "aluBMux", "out", "sel"),

  // ALU operation select switches
  wire("e-op0", "op0", "alu", "out", "op0"),
  wire("e-op1", "op1", "alu", "out", "op1"),
  wire("e-op2", "op2", "alu", "out", "op2"),

  // ══════════════════════════════════════
  //  STORE: A → SRAM data input
  // ══════════════════════════════════════

  // A register output → SRAM data input (for STA operations)
  ...bus8("e-a-sram-d", "aReg", "sram", "q", "d"),

  // Memory write enable
  wire("e-memwe", "memWE", "sram", "out", "we"),

  // ══════════════════════════════════════
  //  B REGISTER: SRAM → B (for LBM)
  // ══════════════════════════════════════

  // SRAM data output → B register input (for LDB/LBM)
  ...bus8("e-sram-b-d", "sram", "bReg", "q", "d"),

  // ══════════════════════════════════════
  //  ALU FLAGS → LED OUTPUTS
  // ══════════════════════════════════════

  wire("e-fz", "alu", "flagZ", "zero", "in"),
  wire("e-fc", "alu", "flagC", "carry", "in"),
  wire("e-fn", "alu", "flagN", "neg", "in"),

  // ══════════════════════════════════════
  //  CLOCK → ALL REGISTERS
  // ══════════════════════════════════════

  wire("e-clk-pc", "clk", "pc", "out", "clk"),
  wire("e-clk-ir", "clk", "ir", "out", "clk"),
  wire("e-clk-a", "clk", "aReg", "out", "clk"),
  wire("e-clk-b", "clk", "bReg", "out", "clk"),
  wire("e-clk-sp", "clk", "sp", "out", "clk"),

  // ══════════════════════════════════════
  //  REGISTER LOAD ENABLES
  // ══════════════════════════════════════

  wire("e-ld-pc", "pcLoad", "pc", "out", "load"),
  wire("e-ld-ir", "irLoad", "ir", "out", "load"),
  wire("e-ld-a", "aLoad", "aReg", "out", "load"),
  wire("e-ld-b", "bLoad", "bReg", "out", "load"),
  wire("e-ld-sp", "spLoad", "sp", "out", "load"),

  // ══════════════════════════════════════
  //  GLOBAL RESET → ALL REGISTERS
  // ══════════════════════════════════════

  wire("e-rst-pc", "rst", "pc", "out", "rst"),
  wire("e-rst-ir", "rst", "ir", "out", "rst"),
  wire("e-rst-a", "rst", "aReg", "out", "rst"),
  wire("e-rst-b", "rst", "bReg", "out", "rst"),
  wire("e-rst-sp", "rst", "sp", "out", "rst"),

  // ══════════════════════════════════════
  //  DISPLAY OUTPUTS (register values)
  // ══════════════════════════════════════

  // PC → PC display
  ...bus8("e-pc-disp-", "pc", "pcDisp", "q", "in"),

  // IR → IR display
  ...bus8("e-ir-disp-", "ir", "irDisp", "q", "in"),

  // A → A display
  ...bus8("e-a-disp-", "aReg", "aDisp", "q", "in"),

  // B → B display
  ...bus8("e-b-disp-", "bReg", "bDisp", "q", "in"),

  // SP → SP display
  ...bus8("e-sp-disp-", "sp", "spDisp", "q", "in"),

  // SRAM → memory read display
  ...bus8("e-mem-disp-", "sram", "memDisp", "q", "in"),

  // ══════════════════════════════════════
  //  CONSOLE: A → data, control wires
  // ══════════════════════════════════════

  // A register output → Console data input
  ...bus8("e-a-con-d", "aReg", "console", "q", "d"),

  // Console control signals
  wire("e-con-wr", "consoleWr", "console", "out", "wr"),
  wire("e-con-mode", "consoleMode", "console", "out", "mode"),
  wire("e-con-clr", "consoleClear", "console", "out", "clr"),
  wire("e-con-rd", "consoleRd", "console", "out", "rd"),

  // ══════════════════════════════════════
  //  PLOTTER: A → X, B → Y, control wires
  // ══════════════════════════════════════

  // A register output → Plotter X coordinate
  ...bus8("e-a-plot-x", "aReg", "plotter", "q", "x"),

  // B register output → Plotter Y coordinate
  ...bus8("e-b-plot-y", "bReg", "plotter", "q", "y"),

  // Plotter control signals
  wire("e-plot-draw", "plotDraw", "plotter", "out", "draw"),
  wire("e-plot-clr", "plotClear", "plotter", "out", "clr"),
];
