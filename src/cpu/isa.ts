/**
 * ISA (Instruction Set Architecture) for the 8-bit CPU simulator.
 *
 * Variable-length encoding:
 *   - Opcodes 0x00–0x7F → 1-byte instructions (no operand)
 *   - Opcodes 0x80–0xFF → 3-byte instructions (16-bit little-endian operand)
 *
 * Memory: 1024 bytes (10-bit address space, 0x000–0x3FF)
 * Registers: 8-bit A (accumulator), B (secondary)
 * PC, SP: 16-bit (masked to 10 bits)
 */

// ─── Memory constants ───

export const MEMORY_SIZE = 1024;
export const CODE_SIZE = 512; // 0x000..0x1FF — code area (bytes)
export const ADDR_MASK = 0x3ff; // 10-bit address mask

// ─── Opcode constants ───

export const Opcode = {
  // Control
  NOP: 0x00,
  HLT: 0x0f,

  // Register ops (1-byte)
  INC: 0x01,
  DEC: 0x02,
  NOT: 0x03,
  SHL: 0x04,
  SHR: 0x05,
  TAB: 0x06, // B ← A
  TBA: 0x07, // A ← B
  ADDB: 0x08, // A ← A + B
  SUBB: 0x09, // A ← A - B
  INA: 0x0a, // A ← console input (0 if empty, sets Z)

  // Stack (1-byte)
  RET: 0x10,
  PUSH: 0x11,
  POP: 0x12,

  // I/O (1-byte)
  OUTA: 0x20, // console ← A as ASCII
  OUTD: 0x21, // console ← A as decimal string
  DRAW: 0x22, // plotter ← pixel at (A, B)
  CLR: 0x23, // plotter ← clear all pixels

  // Arithmetic/Logic with immediate (3-byte, 16-bit operand, CPU uses low byte)
  LDA: 0x80,
  LDB: 0x81,
  ADD: 0x82,
  SUB: 0x83,
  AND: 0x84,
  OR: 0x85,
  XOR: 0x86,
  CMP: 0x87,

  // Load/Store (3-byte, operand = 16-bit address)
  STA: 0x90,
  LDM: 0x91,
  STB: 0x92,
  LBM: 0x93,

  // Jumps (3-byte, operand = 16-bit target address)
  JMP: 0xa0,
  JZ: 0xa1,
  JNZ: 0xa2,
  JC: 0xa3,
  JNC: 0xa4,
  JN: 0xa5,

  // Call (3-byte, 16-bit address)
  CALL: 0xb0,

  // I/O with immediate (3-byte, CPU uses low byte)
  OUT: 0xc0, // console ← immediate as ASCII
} as const;

export type OpcodeValue = (typeof Opcode)[keyof typeof Opcode];

// ─── Instruction metadata ───

export interface InstructionInfo {
  mnemonic: string;
  size: 1 | 3; // byte count (1 = no operand, 3 = 16-bit operand)
  description: string;
}

/** Map from opcode value → instruction info */
export const INSTRUCTION_INFO: Record<number, InstructionInfo> = {
  [Opcode.NOP]: { mnemonic: "NOP", size: 1, description: "No operation" },
  [Opcode.HLT]: { mnemonic: "HLT", size: 1, description: "Halt execution" },

  [Opcode.INC]: { mnemonic: "INC", size: 1, description: "A ← A + 1" },
  [Opcode.DEC]: { mnemonic: "DEC", size: 1, description: "A ← A - 1" },
  [Opcode.NOT]: { mnemonic: "NOT", size: 1, description: "A ← ~A" },
  [Opcode.SHL]: { mnemonic: "SHL", size: 1, description: "A ← A << 1" },
  [Opcode.SHR]: { mnemonic: "SHR", size: 1, description: "A ← A >> 1" },
  [Opcode.TAB]: { mnemonic: "TAB", size: 1, description: "B ← A" },
  [Opcode.TBA]: { mnemonic: "TBA", size: 1, description: "A ← B" },
  [Opcode.ADDB]: { mnemonic: "ADDB", size: 1, description: "A ← A + B" },
  [Opcode.SUBB]: { mnemonic: "SUBB", size: 1, description: "A ← A - B" },
  [Opcode.INA]: {
    mnemonic: "INA",
    size: 1,
    description: "A ← console input (0 if empty)",
  },

  [Opcode.RET]: { mnemonic: "RET", size: 1, description: "PC ← pop" },
  [Opcode.PUSH]: { mnemonic: "PUSH", size: 1, description: "push A" },
  [Opcode.POP]: { mnemonic: "POP", size: 1, description: "A ← pop" },

  [Opcode.OUTA]: {
    mnemonic: "OUTA",
    size: 1,
    description: "Output A as ASCII char",
  },
  [Opcode.OUTD]: {
    mnemonic: "OUTD",
    size: 1,
    description: "Output A as decimal number",
  },
  [Opcode.DRAW]: {
    mnemonic: "DRAW",
    size: 1,
    description: "Plot pixel at (A, B)",
  },
  [Opcode.CLR]: {
    mnemonic: "CLR",
    size: 1,
    description: "Clear plotter",
  },

  [Opcode.LDA]: { mnemonic: "LDA", size: 3, description: "A ← imm" },
  [Opcode.LDB]: { mnemonic: "LDB", size: 3, description: "B ← imm" },
  [Opcode.ADD]: { mnemonic: "ADD", size: 3, description: "A ← A + imm" },
  [Opcode.SUB]: { mnemonic: "SUB", size: 3, description: "A ← A - imm" },
  [Opcode.AND]: { mnemonic: "AND", size: 3, description: "A ← A & imm" },
  [Opcode.OR]: { mnemonic: "OR", size: 3, description: "A ← A | imm" },
  [Opcode.XOR]: { mnemonic: "XOR", size: 3, description: "A ← A ^ imm" },
  [Opcode.CMP]: {
    mnemonic: "CMP",
    size: 3,
    description: "flags ← A - imm (no store)",
  },

  [Opcode.STA]: { mnemonic: "STA", size: 3, description: "MEM[addr] ← A" },
  [Opcode.LDM]: { mnemonic: "LDM", size: 3, description: "A ← MEM[addr]" },
  [Opcode.STB]: { mnemonic: "STB", size: 3, description: "MEM[addr] ← B" },
  [Opcode.LBM]: { mnemonic: "LBM", size: 3, description: "B ← MEM[addr]" },

  [Opcode.JMP]: { mnemonic: "JMP", size: 3, description: "PC ← addr" },
  [Opcode.JZ]: { mnemonic: "JZ", size: 3, description: "if Z: PC ← addr" },
  [Opcode.JNZ]: {
    mnemonic: "JNZ",
    size: 3,
    description: "if !Z: PC ← addr",
  },
  [Opcode.JC]: { mnemonic: "JC", size: 3, description: "if C: PC ← addr" },
  [Opcode.JNC]: {
    mnemonic: "JNC",
    size: 3,
    description: "if !C: PC ← addr",
  },
  [Opcode.JN]: { mnemonic: "JN", size: 3, description: "if N: PC ← addr" },

  [Opcode.CALL]: {
    mnemonic: "CALL",
    size: 3,
    description: "push PC, PC ← addr",
  },

  [Opcode.OUT]: {
    mnemonic: "OUT",
    size: 3,
    description: "Output imm as ASCII char",
  },
};

/** Reverse map: mnemonic string → opcode value */
export const MNEMONIC_TO_OPCODE: Record<string, number> = {};
for (const [opcodeStr, info] of Object.entries(INSTRUCTION_INFO)) {
  MNEMONIC_TO_OPCODE[info.mnemonic] = Number(opcodeStr);
}

// ─── CPU State ───

export interface CPUFlags {
  z: boolean; // zero
  c: boolean; // carry
  n: boolean; // negative
}

export interface CPUState {
  a: number; // accumulator (0–255)
  b: number; // B register (0–255)
  pc: number; // program counter (0–1023)
  sp: number; // stack pointer (0–1023)
  flags: CPUFlags;
  memory: Uint8Array; // 1024 bytes
  halted: boolean;
  cycles: number;
}

// ─── Helpers ───

/** Returns true if the opcode is a 3-byte instruction (has a 16-bit operand) */
export function isTwoByteOpcode(opcode: number): boolean {
  return opcode >= 0x80;
}

/** Create a fresh CPU state */
export function createInitialState(): CPUState {
  return {
    a: 0,
    b: 0,
    pc: 0,
    sp: MEMORY_SIZE - 1, // stack starts at top of memory (0x3FF)
    flags: { z: false, c: false, n: false },
    memory: new Uint8Array(MEMORY_SIZE),
    halted: false,
    cycles: 0,
  };
}
