/**
 * ISA (Instruction Set Architecture) for the 8-bit CPU simulator.
 *
 * Variable-length encoding:
 *   - Opcodes 0x00–0x7F → 1-byte instructions (no operand)
 *   - Opcodes 0x80–0xFF → 2-byte instructions (second byte = immediate/address)
 */

// ─── Opcode constants ───

export const Opcode = {
  // Control
  NOP: 0x00,
  HLT: 0xff,

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

  // Stack (1-byte)
  RET: 0x10,
  PUSH: 0x11,
  POP: 0x12,

  // I/O (1-byte)
  OUTA: 0x20, // console ← A as ASCII
  OUTD: 0x21, // console ← A as decimal string

  // Arithmetic/Logic with immediate (2-byte)
  LDA: 0x80,
  LDB: 0x81,
  ADD: 0x82,
  SUB: 0x83,
  AND: 0x84,
  OR: 0x85,
  XOR: 0x86,
  CMP: 0x87,

  // Load/Store (2-byte, operand = address)
  STA: 0x90,
  LDM: 0x91,
  STB: 0x92,
  LBM: 0x93,

  // Jumps (2-byte, operand = target address)
  JMP: 0xa0,
  JZ: 0xa1,
  JNZ: 0xa2,
  JC: 0xa3,
  JNC: 0xa4,
  JN: 0xa5,

  // Call (2-byte)
  CALL: 0xb0,

  // I/O with immediate (2-byte)
  OUT: 0xc0, // console ← immediate as ASCII
} as const;

export type OpcodeValue = (typeof Opcode)[keyof typeof Opcode];

// ─── Instruction metadata ───

export interface InstructionInfo {
  mnemonic: string;
  size: 1 | 2; // byte count
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

  [Opcode.LDA]: { mnemonic: "LDA", size: 2, description: "A ← imm" },
  [Opcode.LDB]: { mnemonic: "LDB", size: 2, description: "B ← imm" },
  [Opcode.ADD]: { mnemonic: "ADD", size: 2, description: "A ← A + imm" },
  [Opcode.SUB]: { mnemonic: "SUB", size: 2, description: "A ← A - imm" },
  [Opcode.AND]: { mnemonic: "AND", size: 2, description: "A ← A & imm" },
  [Opcode.OR]: { mnemonic: "OR", size: 2, description: "A ← A | imm" },
  [Opcode.XOR]: { mnemonic: "XOR", size: 2, description: "A ← A ^ imm" },
  [Opcode.CMP]: {
    mnemonic: "CMP",
    size: 2,
    description: "flags ← A - imm (no store)",
  },

  [Opcode.STA]: { mnemonic: "STA", size: 2, description: "MEM[addr] ← A" },
  [Opcode.LDM]: { mnemonic: "LDM", size: 2, description: "A ← MEM[addr]" },
  [Opcode.STB]: { mnemonic: "STB", size: 2, description: "MEM[addr] ← B" },
  [Opcode.LBM]: { mnemonic: "LBM", size: 2, description: "B ← MEM[addr]" },

  [Opcode.JMP]: { mnemonic: "JMP", size: 2, description: "PC ← addr" },
  [Opcode.JZ]: { mnemonic: "JZ", size: 2, description: "if Z: PC ← addr" },
  [Opcode.JNZ]: {
    mnemonic: "JNZ",
    size: 2,
    description: "if !Z: PC ← addr",
  },
  [Opcode.JC]: { mnemonic: "JC", size: 2, description: "if C: PC ← addr" },
  [Opcode.JNC]: {
    mnemonic: "JNC",
    size: 2,
    description: "if !C: PC ← addr",
  },
  [Opcode.JN]: { mnemonic: "JN", size: 2, description: "if N: PC ← addr" },

  [Opcode.CALL]: {
    mnemonic: "CALL",
    size: 2,
    description: "push PC, PC ← addr",
  },

  [Opcode.OUT]: {
    mnemonic: "OUT",
    size: 2,
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
  pc: number; // program counter (0–255)
  sp: number; // stack pointer (0–255)
  flags: CPUFlags;
  memory: Uint8Array; // 256 bytes
  halted: boolean;
  cycles: number;
}

// ─── Helpers ───

/** Returns true if the opcode is a 2-byte instruction (has an operand) */
export function isTwoByteOpcode(opcode: number): boolean {
  return opcode >= 0x80;
}

/** Create a fresh CPU state */
export function createInitialState(): CPUState {
  return {
    a: 0,
    b: 0,
    pc: 0,
    sp: 0xff, // stack starts at top of memory
    flags: { z: false, c: false, n: false },
    memory: new Uint8Array(256),
    halted: false,
    cycles: 0,
  };
}
