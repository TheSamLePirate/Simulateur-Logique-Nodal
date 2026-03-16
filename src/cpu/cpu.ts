/**
 * Software CPU simulator — executes programs assembled from our ISA.
 *
 * Pure TypeScript, no React dependencies.
 * Stack grows downward from 0x1FFF.
 * Memory: 8192 bytes, 16-bit addresses.
 */

import {
  Opcode,
  INSTRUCTION_INFO,
  createInitialState,
  MEMORY_SIZE,
  ADDR_MASK,
  type CPUState,
} from "./isa";

export interface DisassemblyLine {
  addr: number;
  bytes: number[];
  mnemonic: string;
}

export class CPU {
  state: CPUState;
  consoleOutput: string[];
  plotterPixels: Set<number>;
  consoleInputBuffer: number[];
  keyState: number[]; // [left, right, up, down, enter] — 0 or 1
  onConsoleOutput?: (text: string) => void;

  /** Last executed opcode (for hardware visualization) */
  lastOpcode = -1;
  /** Last operand (for hardware visualization) */
  lastOperand = 0;
  /** Clock toggle bit (flips each step) */
  clockBit = 0;
  /** LFSR seed for RAND instruction (non-zero) */
  randSeed = 0xac;
  /** Additive counter mixed with LFSR to break serial correlation */
  randCounter = 0;
  /** Sleep counter (decrements each step, CPU idles while > 0) */
  sleepCounter = 0;

  constructor() {
    this.state = createInitialState();
    this.consoleOutput = [];
    this.plotterPixels = new Set();
    this.consoleInputBuffer = [];
    this.keyState = [0, 0, 0, 0, 0];
  }

  /** Reset CPU to initial state, clearing memory */
  reset(): void {
    this.state = createInitialState();
    this.consoleOutput = [];
    this.plotterPixels = new Set();
    this.consoleInputBuffer = [];
    this.keyState = [0, 0, 0, 0, 0];
    this.lastOpcode = -1;
    this.lastOperand = 0;
    this.clockBit = 0;
    this.randSeed = 0xac;
    this.randCounter = 0;
    this.sleepCounter = 0;
  }

  /** Load a program (byte array) into memory starting at startAddr */
  loadProgram(bytes: number[], startAddr = 0): void {
    for (let i = 0; i < bytes.length && startAddr + i < MEMORY_SIZE; i++) {
      this.state.memory[startAddr + i] = bytes[i] & 0xff;
    }
    this.state.pc = startAddr;
  }

  /** Get a snapshot of current state (deep copy for React rendering) */
  snapshot(): CPUState {
    return {
      ...this.state,
      flags: { ...this.state.flags },
      memory: new Uint8Array(this.state.memory),
    };
  }

  // ─── Helpers ───

  private read(addr: number): number {
    return this.state.memory[addr & ADDR_MASK];
  }

  private write(addr: number, value: number): void {
    this.state.memory[addr & ADDR_MASK] = value & 0xff;
  }

  private push(value: number): void {
    this.write(this.state.sp, value & 0xff);
    this.state.sp = (this.state.sp - 1) & ADDR_MASK;
  }

  private pop(): number {
    this.state.sp = (this.state.sp + 1) & ADDR_MASK;
    return this.read(this.state.sp);
  }

  /** Push a 16-bit value (for CALL return addresses) */
  private push16(value: number): void {
    this.push(value & 0xff); // low byte first
    this.push((value >> 8) & 0xff); // high byte on top
  }

  /** Pop a 16-bit value (for RET return addresses) */
  private pop16(): number {
    const high = this.pop();
    const low = this.pop();
    return (high << 8) | low;
  }

  private updateFlags(result: number, fullResult?: number): void {
    const val = result & 0xff;
    this.state.flags.z = val === 0;
    this.state.flags.n = (val & 0x80) !== 0;
    if (fullResult !== undefined) {
      this.state.flags.c = fullResult > 255 || fullResult < 0;
    }
  }

  private output(text: string): void {
    this.consoleOutput.push(text);
    this.onConsoleOutput?.(text);
  }

  /** Push a character into the console input buffer */
  pushInput(char: number): void {
    this.consoleInputBuffer.push(char & 0xff);
  }

  // ─── Execution ───

  /**
   * Execute one instruction. Returns true if CPU is still running, false if halted.
   */
  step(): boolean {
    if (this.state.halted) return false;

    // Sleep: idle for remaining cycles
    if (this.sleepCounter > 0) {
      this.sleepCounter--;
      this.state.cycles++;
      return true;
    }

    const opcode = this.read(this.state.pc);
    const info = INSTRUCTION_INFO[opcode];

    // Fetch 16-bit operand for 3-byte instructions (little-endian)
    let operand = 0;
    if (info && info.size === 3) {
      const lo = this.read((this.state.pc + 1) & ADDR_MASK);
      const hi = this.read((this.state.pc + 2) & ADDR_MASK);
      operand = (hi << 8) | lo;
    }

    // Track for hardware visualization
    this.lastOpcode = opcode;
    this.lastOperand = operand;
    this.clockBit ^= 1;

    // Advance PC past this instruction
    const instrSize = info ? info.size : 1;
    let nextPC = (this.state.pc + instrSize) & ADDR_MASK;

    switch (opcode) {
      // ─── Control ───
      case Opcode.NOP:
        break;

      case Opcode.HLT:
        this.state.halted = true;
        this.state.pc = nextPC;
        this.state.cycles++;
        return false;

      // ─── Register ops (1-byte) ───
      case Opcode.INC: {
        const r = this.state.a + 1;
        this.state.a = r & 0xff;
        this.updateFlags(this.state.a, r);
        break;
      }
      case Opcode.DEC: {
        const r = this.state.a - 1;
        this.state.a = r & 0xff;
        this.updateFlags(this.state.a, r);
        break;
      }
      case Opcode.NOT:
        this.state.a = ~this.state.a & 0xff;
        this.updateFlags(this.state.a);
        break;

      case Opcode.SHL: {
        this.state.flags.c = (this.state.a & 0x80) !== 0;
        this.state.a = (this.state.a << 1) & 0xff;
        this.updateFlags(this.state.a);
        break;
      }
      case Opcode.SHR: {
        this.state.flags.c = (this.state.a & 0x01) !== 0;
        this.state.a = (this.state.a >> 1) & 0xff;
        this.updateFlags(this.state.a);
        break;
      }
      case Opcode.TAB:
        this.state.b = this.state.a;
        break;

      case Opcode.TBA:
        this.state.a = this.state.b;
        this.updateFlags(this.state.a);
        break;

      case Opcode.ADDB: {
        const r = this.state.a + this.state.b;
        this.state.a = r & 0xff;
        this.updateFlags(this.state.a, r);
        break;
      }
      case Opcode.SUBB: {
        const r = this.state.a - this.state.b;
        this.state.a = r & 0xff;
        this.updateFlags(this.state.a, r);
        break;
      }
      case Opcode.ANDB:
        this.state.a = this.state.a & this.state.b;
        this.updateFlags(this.state.a);
        break;

      case Opcode.ORB:
        this.state.a = this.state.a | this.state.b;
        this.updateFlags(this.state.a);
        break;

      case Opcode.XORB:
        this.state.a = this.state.a ^ this.state.b;
        this.updateFlags(this.state.a);
        break;

      case Opcode.CMPB: {
        const r = this.state.a - this.state.b;
        this.updateFlags(r & 0xff, r);
        break;
      }

      case Opcode.MULB: {
        const r = this.state.a * this.state.b;
        this.state.a = r & 0xff;
        this.updateFlags(this.state.a, r);
        break;
      }

      case Opcode.DIVB:
        if (this.state.b === 0) {
          this.state.a = 0;
          this.updateFlags(this.state.a);
        } else {
          this.state.a = Math.floor(this.state.a / this.state.b) & 0xff;
          this.updateFlags(this.state.a);
        }
        break;

      case Opcode.MODB:
        if (this.state.b === 0) {
          this.state.a = 0;
          this.updateFlags(this.state.a);
        } else {
          this.state.a = this.state.a % this.state.b;
          this.updateFlags(this.state.a);
        }
        break;

      // ─── Stack (1-byte) ───
      case Opcode.RET:
        nextPC = this.pop16(); // pop 16-bit return address
        break;

      case Opcode.PUSH:
        this.push(this.state.a);
        break;

      case Opcode.POP:
        this.state.a = this.pop();
        this.updateFlags(this.state.a);
        break;

      // ─── I/O (1-byte) ───
      case Opcode.OUTA:
        this.output(String.fromCharCode(this.state.a));
        break;

      case Opcode.OUTD:
        this.output(this.state.a.toString());
        break;

      case Opcode.DRAW:
        this.plotterPixels.add((this.state.b << 8) | this.state.a);
        break;

      case Opcode.CLR:
        this.plotterPixels = new Set();
        break;

      case Opcode.INA:
        if (this.consoleInputBuffer.length > 0) {
          this.state.a = this.consoleInputBuffer.shift()!;
        } else {
          this.state.a = 0;
        }
        this.updateFlags(this.state.a);
        break;

      case Opcode.GETKEY:
        this.state.a = this.keyState[this.state.a] || 0;
        this.updateFlags(this.state.a);
        break;

      case Opcode.RAND: {
        // Combined LFSR + additive counter for good visual distribution.
        // The LFSR alone has strong serial correlation (visible lattice
        // patterns when consecutive values are used as x,y coordinates).
        // XOR-ing with a golden-ratio counter breaks the correlation.

        // Step 1: Galois LFSR (polynomial x^8+x^6+x^5+x^4+1, taps 0xB8)
        let s = this.randSeed;
        const bit = s & 1;
        s >>= 1;
        if (bit) s ^= 0xb8;
        this.randSeed = s;

        // Step 2: additive counter (≈ 256 × golden ratio ≈ 0x6D)
        this.randCounter = (this.randCounter + 0x6d) & 0xff;

        // Step 3: XOR to break serial correlation
        this.state.a = (s ^ this.randCounter) & 0xff;
        this.updateFlags(this.state.a);
        break;
      }

      case Opcode.SLEEP:
        this.sleepCounter = this.state.a;
        break;

      // ─── Arithmetic/Logic with immediate (3-byte, uses low byte only) ───
      case Opcode.LDA:
        this.state.a = operand & 0xff;
        this.updateFlags(this.state.a);
        break;

      case Opcode.LDB:
        this.state.b = operand & 0xff;
        break;

      case Opcode.ADD: {
        const imm = operand & 0xff;
        const r = this.state.a + imm;
        this.state.a = r & 0xff;
        this.updateFlags(this.state.a, r);
        break;
      }
      case Opcode.SUB: {
        const imm = operand & 0xff;
        const r = this.state.a - imm;
        this.state.a = r & 0xff;
        this.updateFlags(this.state.a, r);
        break;
      }
      case Opcode.AND:
        this.state.a = this.state.a & (operand & 0xff);
        this.updateFlags(this.state.a);
        break;

      case Opcode.OR:
        this.state.a = this.state.a | (operand & 0xff);
        this.updateFlags(this.state.a);
        break;

      case Opcode.XOR:
        this.state.a = this.state.a ^ (operand & 0xff);
        this.updateFlags(this.state.a);
        break;

      case Opcode.CMP: {
        const imm = operand & 0xff;
        const r = this.state.a - imm;
        this.updateFlags(r & 0xff, r);
        break;
      }

      // ─── Load/Store (2-byte) ───
      case Opcode.STA:
        this.write(operand, this.state.a);
        break;

      case Opcode.LDM:
        this.state.a = this.read(operand);
        this.updateFlags(this.state.a);
        break;

      case Opcode.STB:
        this.write(operand, this.state.b);
        break;

      case Opcode.LBM:
        this.state.b = this.read(operand);
        break;

      case Opcode.LDAI: {
        // Indexed load: A ← MEM[operand + A]
        const addr = (operand + this.state.a) & ADDR_MASK;
        this.state.a = this.read(addr);
        this.updateFlags(this.state.a);
        break;
      }

      case Opcode.STAI: {
        // Indexed store: MEM[operand + B] ← A
        const addr = (operand + this.state.b) & ADDR_MASK;
        this.write(addr, this.state.a);
        break;
      }

      // ─── Jumps (2-byte) ───
      case Opcode.JMP:
        nextPC = operand;
        break;

      case Opcode.JZ:
        if (this.state.flags.z) nextPC = operand;
        break;

      case Opcode.JNZ:
        if (!this.state.flags.z) nextPC = operand;
        break;

      case Opcode.JC:
        if (this.state.flags.c) nextPC = operand;
        break;

      case Opcode.JNC:
        if (!this.state.flags.c) nextPC = operand;
        break;

      case Opcode.JN:
        if (this.state.flags.n) nextPC = operand;
        break;

      // ─── Call (3-byte) ───
      case Opcode.CALL:
        this.push16(nextPC); // push 16-bit return address
        nextPC = operand;
        break;

      // ─── I/O with immediate (3-byte, uses low byte) ───
      case Opcode.OUT:
        this.output(String.fromCharCode(operand & 0xff));
        break;

      default:
        // Unknown opcode → treat as NOP
        break;
    }

    this.state.pc = nextPC;
    this.state.cycles++;
    return true;
  }

  /**
   * Run until HLT or maxCycles reached. Returns number of cycles executed.
   */
  run(maxCycles = 10000): number {
    const startCycles = this.state.cycles;
    while (this.state.cycles - startCycles < maxCycles) {
      if (!this.step()) break;
    }
    return this.state.cycles - startCycles;
  }

  /**
   * Disassemble memory contents into human-readable lines.
   */
  getDisassembly(startAddr = 0, length = MEMORY_SIZE): DisassemblyLine[] {
    const lines: DisassemblyLine[] = [];
    let addr = startAddr;

    while (addr < startAddr + length && addr < MEMORY_SIZE) {
      const opcode = this.read(addr);
      const info = INSTRUCTION_INFO[opcode];

      if (!info) {
        lines.push({
          addr,
          bytes: [opcode],
          mnemonic: `.db 0x${opcode.toString(16).padStart(2, "0")}`,
        });
        addr++;
        continue;
      }

      if (info.size === 3 && addr + 2 < MEMORY_SIZE) {
        const lo = this.read(addr + 1);
        const hi = this.read(addr + 2);
        const operand = (hi << 8) | lo;
        lines.push({
          addr,
          bytes: [opcode, lo, hi],
          mnemonic: `${info.mnemonic} 0x${operand.toString(16).padStart(3, "0")}`,
        });
        addr += 3;
      } else {
        lines.push({
          addr,
          bytes: [opcode],
          mnemonic: info.mnemonic,
        });
        addr++;
      }

      // Stop disassembly after HLT
      if (opcode === Opcode.HLT) break;
    }

    return lines;
  }
}
