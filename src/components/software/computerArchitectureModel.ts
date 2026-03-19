import { Opcode, type OpcodeValue } from "../../cpu/isa";
import type { ComputerPanelData } from "./computerPanelTypes";

export interface ArchitectureInstructionInfo {
  opcode: number;
  operand: number;
  mnemonic: string;
}

export interface ArchitectureAluState {
  opName: string;
  a: number;
  b: number;
  result: number;
  zero: boolean;
  carry: boolean;
  negative: boolean;
  immediate: boolean;
}

export interface ArchitectureMemoryState {
  fetchAddress: number;
  fetchByte: number;
  operandAddress: number;
  operandAddressLabel: string;
  operandData: number;
  fetchActive: boolean;
  readActive: boolean;
  writeActive: boolean;
  writeValue: number;
}

export interface ArchitectureConsoleState {
  writeActive: boolean;
  readActive: boolean;
  latestChar: string;
  outputLength: number;
  inputDepth: number;
  outputPreview: string;
  inputPreview: string;
}

export interface ArchitecturePlotterState {
  drawActive: boolean;
  clearActive: boolean;
  colorActive: boolean;
  pixels: number;
  colorText: string;
  x: number;
  y: number;
  colorR: number;
  colorG: number;
  colorB: number;
}

export interface ArchitectureKeyboardState {
  readActive: boolean;
  activeKeys: string[];
}

export interface ArchitectureDriveState {
  readActive: boolean;
  writeActive: boolean;
  clearActive: boolean;
  page: number;
  address: number;
  lastRead: number;
  lastWrite: number;
  dataOut: number;
}

export interface ArchitectureNetworkState {
  getActive: boolean;
  postActive: boolean;
  readActive: boolean;
  requestActive: boolean;
  pending: boolean;
  status: string;
  lastByte: number;
  responseBytes: number;
  requestAddress: number;
  requestAddressLabel: string;
  urlPreview: string;
  bodyPreview: string;
  responsePreview: string;
}

export interface ComputerArchitectureModel {
  pulseOn: boolean;
  instruction: ArchitectureInstructionInfo;
  memory: ArchitectureMemoryState;
  alu: ArchitectureAluState;
  console: ArchitectureConsoleState;
  plotter: ArchitecturePlotterState;
  keyboard: ArchitectureKeyboardState;
  drive: ArchitectureDriveState;
  network: ArchitectureNetworkState;
}

function opcodeIn(opcode: number, list: readonly OpcodeValue[]): boolean {
  return list.includes(opcode as OpcodeValue);
}

function byteToAscii(value: number): string {
  if (value === 10) return "\\n";
  if (value === 9) return "\\t";
  if (value === 0) return "NUL";
  if (value < 32 || value > 126) return ".";
  return String.fromCharCode(value);
}

function readOpcodeOperand(memory: Uint8Array, pc: number): number {
  const lo = memory[(pc + 1) & 0x1fff] ?? 0;
  const hi = memory[(pc + 2) & 0x1fff] ?? 0;
  return ((hi << 8) | lo) & 0x1fff;
}

function truncateText(value: string, max = 20): string {
  if (!value) return "idle";
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function mnemonicFor(opcode: number): string {
  for (const [name, value] of Object.entries(Opcode)) {
    if (value === opcode) return name;
  }
  return "NOP";
}

function computeOperandAddress(
  opcode: number,
  operand: number,
  a: number,
  b: number,
  sp: number,
): { address: number; label: string } {
  if (opcode === Opcode.PUSH || opcode === Opcode.POP || opcode === Opcode.CALL || opcode === Opcode.RET) {
    return { address: sp & 0x1fff, label: "STACK" };
  }
  if (opcode === Opcode.LDAI) {
    return { address: (operand + a) & 0x1fff, label: "A+IMM" };
  }
  if (opcode === Opcode.STAI) {
    return { address: (operand + b) & 0x1fff, label: "B+IMM" };
  }
  return { address: operand & 0x1fff, label: "IMM" };
}

function computeAluState(opcode: number, operand: number, a: number, b: number): ArchitectureAluState {
  const immediate = opcodeIn(opcode, [
    Opcode.ADD,
    Opcode.SUB,
    Opcode.AND,
    Opcode.OR,
    Opcode.XOR,
    Opcode.CMP,
  ]);
  const aluA = a & 0xff;
  const aluB = immediate ? operand & 0xff : b & 0xff;
  let result = aluA;
  let carry = false;
  let opName = "PASS";

  if (opcodeIn(opcode, [Opcode.ADD, Opcode.ADDB, Opcode.INC])) {
    const rhs = opcode === Opcode.INC ? 1 : aluB;
    const sum = aluA + rhs;
    result = sum & 0xff;
    carry = sum > 0xff;
    opName = "ADD";
  } else if (opcodeIn(opcode, [Opcode.SUB, Opcode.SUBB, Opcode.CMP, Opcode.CMPB, Opcode.DEC])) {
    const rhs = opcode === Opcode.DEC ? 1 : aluB;
    const diff = aluA - rhs;
    result = diff & 0xff;
    carry = diff < 0;
    opName = "SUB";
  } else if (opcodeIn(opcode, [Opcode.AND, Opcode.ANDB])) {
    result = aluA & aluB;
    opName = "AND";
  } else if (opcodeIn(opcode, [Opcode.OR, Opcode.ORB])) {
    result = aluA | aluB;
    opName = "OR";
  } else if (opcodeIn(opcode, [Opcode.XOR, Opcode.XORB])) {
    result = aluA ^ aluB;
    opName = "XOR";
  } else if (opcode === Opcode.NOT) {
    result = (~aluA) & 0xff;
    opName = "NOT";
  } else if (opcode === Opcode.SHL) {
    carry = (aluA & 0x80) !== 0;
    result = (aluA << 1) & 0xff;
    opName = "SHL";
  } else if (opcode === Opcode.SHR) {
    carry = (aluA & 0x01) !== 0;
    result = (aluA >> 1) & 0xff;
    opName = "SHR";
  } else if (opcode === Opcode.TBA) {
    result = aluB;
    opName = "MOV";
  } else if (opcode === Opcode.TAB) {
    result = aluA;
    opName = "MOV";
  }

  return {
    opName,
    a: aluA,
    b: aluB,
    result,
    zero: result === 0,
    carry,
    negative: (result & 0x80) !== 0,
    immediate,
  };
}

export function buildComputerArchitectureModel(
  data: ComputerPanelData,
): ComputerArchitectureModel {
  const opcode = data.state.memory[data.state.pc] ?? 0;
  const operand = readOpcodeOperand(data.state.memory, data.state.pc);
  const pulseOn = data.clockBit === 1;

  const memoryFetchAddress = data.state.pc & 0x1fff;
  const memoryFetchByte = data.state.memory[memoryFetchAddress] ?? 0;
  const operandAddress = computeOperandAddress(
    opcode,
    operand,
    data.state.a,
    data.state.b,
    data.state.sp,
  );

  const memoryReadActive = opcodeIn(opcode, [
    Opcode.LDM,
    Opcode.LBM,
    Opcode.LDAI,
    Opcode.POP,
    Opcode.RET,
  ]);
  const memoryWriteActive = opcodeIn(opcode, [
    Opcode.STA,
    Opcode.STB,
    Opcode.STAI,
    Opcode.PUSH,
    Opcode.CALL,
  ]);

  const latestCharCode =
    data.consoleOutput.length > 0
      ? data.consoleOutput.join("").charCodeAt(data.consoleOutput.join("").length - 1) || 0
      : 0;
  const consoleText = data.consoleOutput.join("");

  const activeKeys = ["LEFT", "RIGHT", "UP", "DOWN", "ENTER"].filter(
    (_label, index) => data.keyState[index] === 1,
  );

  return {
    pulseOn,
    instruction: {
      opcode,
      operand,
      mnemonic: mnemonicFor(opcode),
    },
    memory: {
      fetchAddress: memoryFetchAddress,
      fetchByte: memoryFetchByte,
      operandAddress: operandAddress.address,
      operandAddressLabel: operandAddress.label,
      operandData: data.state.memory[operandAddress.address] ?? 0,
      fetchActive: true,
      readActive: memoryReadActive,
      writeActive: memoryWriteActive,
      writeValue:
        opcode === Opcode.STB ? data.state.b : data.state.a,
    },
    alu: computeAluState(opcode, operand, data.state.a, data.state.b),
    console: {
      writeActive: opcodeIn(opcode, [Opcode.OUTA, Opcode.OUTD, Opcode.OUT]),
      readActive: opcode === Opcode.INA,
      latestChar: byteToAscii(latestCharCode),
      outputLength: consoleText.length,
      inputDepth: data.consoleInputBuffer.length,
      outputPreview: truncateText(consoleText.slice(-20) || ""),
      inputPreview: truncateText(
        Array.from(data.consoleInputBuffer.slice(0, 8), (value) => byteToAscii(value)).join(""),
      ),
    },
    plotter: {
      drawActive: opcode === Opcode.DRAW,
      clearActive: opcode === Opcode.CLR,
      colorActive: opcodeIn(opcode, [Opcode.COLR, Opcode.COLG, Opcode.COLB]),
      pixels: data.plotterPixels.size,
      colorText: `${data.plotterColor.r}/${data.plotterColor.g}/${data.plotterColor.b}`,
      x: data.state.a,
      y: data.state.b,
      colorR: data.plotterColor.r,
      colorG: data.plotterColor.g,
      colorB: data.plotterColor.b,
    },
    keyboard: {
      readActive: opcode === Opcode.GETKEY,
      activeKeys,
    },
    drive: {
      readActive: opcode === Opcode.DRVRD,
      writeActive: opcode === Opcode.DRVWR,
      clearActive: opcode === Opcode.DRVCLR,
      page: data.drivePage,
      address: data.driveLastAddr,
      lastRead: data.driveLastRead,
      lastWrite: data.driveLastWrite,
      dataOut: data.state.b,
    },
    network: {
      getActive: opcode === Opcode.HTTPGET,
      postActive: opcode === Opcode.HTTPPOST,
      readActive: opcode === Opcode.HTTPIN,
      requestActive: opcode === Opcode.HTTPGET || opcode === Opcode.HTTPPOST,
      pending: data.networkPending,
      status: data.networkStatus,
      lastByte: data.networkLastByte,
      responseBytes: data.networkResponseBuffer.length,
      requestAddress: operandAddress.address,
      requestAddressLabel: operandAddress.label,
      urlPreview: truncateText(data.networkUrl || data.networkCompletedUrl || ""),
      bodyPreview: truncateText(data.networkBody || data.networkCompletedBody || "", 18),
      responsePreview: truncateText(
        data.networkCompletedResponseText
          || String.fromCharCode(...data.networkResponseBuffer.slice(0, 12)),
        18,
      ),
    },
  };
}
