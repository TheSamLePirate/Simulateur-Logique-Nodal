/**
 * Software CPU simulator — executes programs assembled from our ISA.
 *
 * Pure TypeScript, no React dependencies.
 * Stack grows downward from 0xFF.
 */

import {
  Opcode,
  INSTRUCTION_INFO,
  createInitialState,
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
  onConsoleOutput?: (text: string) => void;

  constructor() {
    this.state = createInitialState();
    this.consoleOutput = [];
  }

  /** Reset CPU to initial state, clearing memory */
  reset(): void {
    this.state = createInitialState();
    this.consoleOutput = [];
  }

  /** Load a program (byte array) into memory starting at startAddr */
  loadProgram(bytes: number[], startAddr = 0): void {
    for (let i = 0; i < bytes.length && startAddr + i < 256; i++) {
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
    return this.state.memory[addr & 0xff];
  }

  private write(addr: number, value: number): void {
    this.state.memory[addr & 0xff] = value & 0xff;
  }

  private push(value: number): void {
    this.write(this.state.sp, value & 0xff);
    this.state.sp = (this.state.sp - 1) & 0xff;
  }

  private pop(): number {
    this.state.sp = (this.state.sp + 1) & 0xff;
    return this.read(this.state.sp);
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

  // ─── Execution ───

  /**
   * Execute one instruction. Returns true if CPU is still running, false if halted.
   */
  step(): boolean {
    if (this.state.halted) return false;

    const opcode = this.read(this.state.pc);
    const info = INSTRUCTION_INFO[opcode];

    // Fetch operand for 2-byte instructions
    const operand =
      info && info.size === 2 ? this.read((this.state.pc + 1) & 0xff) : 0;

    // Advance PC past this instruction
    const instrSize = info ? info.size : 1;
    let nextPC = (this.state.pc + instrSize) & 0xff;

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

      // ─── Stack (1-byte) ───
      case Opcode.RET:
        nextPC = this.pop();
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

      // ─── Arithmetic/Logic with immediate (2-byte) ───
      case Opcode.LDA:
        this.state.a = operand;
        this.updateFlags(this.state.a);
        break;

      case Opcode.LDB:
        this.state.b = operand;
        break;

      case Opcode.ADD: {
        const r = this.state.a + operand;
        this.state.a = r & 0xff;
        this.updateFlags(this.state.a, r);
        break;
      }
      case Opcode.SUB: {
        const r = this.state.a - operand;
        this.state.a = r & 0xff;
        this.updateFlags(this.state.a, r);
        break;
      }
      case Opcode.AND:
        this.state.a = this.state.a & operand;
        this.updateFlags(this.state.a);
        break;

      case Opcode.OR:
        this.state.a = this.state.a | operand;
        this.updateFlags(this.state.a);
        break;

      case Opcode.XOR:
        this.state.a = this.state.a ^ operand;
        this.updateFlags(this.state.a);
        break;

      case Opcode.CMP: {
        const r = this.state.a - operand;
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

      // ─── Call (2-byte) ───
      case Opcode.CALL:
        this.push(nextPC); // push return address (address after CALL)
        nextPC = operand;
        break;

      // ─── I/O with immediate (2-byte) ───
      case Opcode.OUT:
        this.output(String.fromCharCode(operand));
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
  getDisassembly(startAddr = 0, length = 256): DisassemblyLine[] {
    const lines: DisassemblyLine[] = [];
    let addr = startAddr;

    while (addr < startAddr + length && addr < 256) {
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

      if (info.size === 2 && addr + 1 < 256) {
        const operand = this.read(addr + 1);
        lines.push({
          addr,
          bytes: [opcode, operand],
          mnemonic: `${info.mnemonic} 0x${operand.toString(16).padStart(2, "0")}`,
        });
        addr += 2;
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
