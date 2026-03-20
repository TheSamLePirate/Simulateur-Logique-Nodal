import type { Node } from "@xyflow/react";

import { Opcode } from "../cpu/isa";
import { CPU } from "../cpu/cpu";
import { DEFAULT_PLOTTER_COLOR, serializePlotterPixels } from "../plotter";
import type { HardwareSyncData } from "../components/software/hardwareSyncTypes";

const toBits = (value: number, bits = 8) =>
  Array.from({ length: bits }, (_, index) => (value & (1 << index) ? 1 : 0));

export const applyHardwareSyncToNodes = (
  nodes: Node[],
  data: HardwareSyncData,
) =>
  nodes.map((node) => {
    switch (node.id) {
      case "pc":
        return {
          ...node,
          data: { ...node.data, value: data.pc, q: toBits(data.pc) },
        };
      case "ir":
        return {
          ...node,
          data: {
            ...node.data,
            value: data.memory[data.pc] || 0,
            q: toBits(data.memory[data.pc] || 0),
          },
        };
      case "aReg":
        return {
          ...node,
          data: { ...node.data, value: data.a, q: toBits(data.a) },
        };
      case "bReg":
        return {
          ...node,
          data: { ...node.data, value: data.b, q: toBits(data.b) },
        };
      case "sp":
        return {
          ...node,
          data: { ...node.data, value: data.sp, q: toBits(data.sp) },
        };
      case "sram":
        return {
          ...node,
          data: {
            ...node.data,
            memory: Array.from(data.memory),
          },
        };
      case "flagZ":
        return {
          ...node,
          data: { ...node.data, value: data.flags.z ? 1 : 0 },
        };
      case "flagC":
        return {
          ...node,
          data: { ...node.data, value: data.flags.c ? 1 : 0 },
        };
      case "flagN":
        return {
          ...node,
          data: { ...node.data, value: data.flags.n ? 1 : 0 },
        };
      case "console":
        return {
          ...node,
          data: { ...node.data, text: data.consoleText },
        };
      case "plotter":
        return {
          ...node,
          data: {
            ...node.data,
            pixels: data.plotterPixels,
            colorSource: "cpu",
            currentColor: data.plotterColor,
          },
        };
      case "drive":
        return {
          ...node,
          data: {
            ...node.data,
            bytes: Array.from(data.driveData),
            q: toBits(data.driveLastRead || 0),
            currentAddress: data.driveLastAddr || 0,
            lastRead: data.driveLastRead || 0,
            lastWrite: data.driveLastWrite || 0,
            prevRd: 0,
            prevWr: 0,
          },
        };
      case "network":
        return {
          ...node,
          data: {
            ...node.data,
            method: data.networkMethod,
            url: data.networkUrl,
            body: data.networkBody,
            q: toBits(data.networkLastByte || 0),
            avail: data.networkResponseBuffer.length > 0 ? 1 : 0,
            pending: data.networkPending ? 1 : 0,
            responseBuffer: [...data.networkResponseBuffer],
            responseSize: data.networkResponseBuffer.length,
            lastByte: data.networkLastByte || 0,
          },
        };
      default:
        return node;
    }
  });

const opcodeIn = (opcode: number, list: readonly number[]) => list.includes(opcode);

export const syncHardwareCpuStateToNodes = (nodes: Node[], cpu: CPU) => {
  const state = cpu.state;
  const opcode = cpu.lastOpcode;

  const aLoad = opcodeIn(opcode, [
    Opcode.LDA,
    Opcode.ADD,
    Opcode.SUB,
    Opcode.AND,
    Opcode.OR,
    Opcode.XOR,
    Opcode.INC,
    Opcode.DEC,
    Opcode.NOT,
    Opcode.SHL,
    Opcode.SHR,
    Opcode.TBA,
    Opcode.ADDB,
    Opcode.SUBB,
    Opcode.ANDB,
    Opcode.ORB,
    Opcode.XORB,
    Opcode.MULB,
    Opcode.DIVB,
    Opcode.MODB,
    Opcode.POP,
    Opcode.LDM,
    Opcode.INA,
    Opcode.GETKEY,
    Opcode.DRVRD,
  ])
    ? 1
    : 0;

  const keyRd = opcode === Opcode.GETKEY ? 1 : 0;
  const bLoad = opcodeIn(opcode, [Opcode.LDB, Opcode.TAB, Opcode.LBM]) ? 1 : 0;
  const spLoad = opcodeIn(opcode, [
    Opcode.PUSH,
    Opcode.POP,
    Opcode.CALL,
    Opcode.RET,
  ])
    ? 1
    : 0;
  const memWE = opcodeIn(opcode, [Opcode.STA, Opcode.STB]) ? 1 : 0;
  const addrSel = opcodeIn(opcode, [
    Opcode.STA,
    Opcode.STB,
    Opcode.LDM,
    Opcode.LBM,
  ])
    ? 1
    : 0;
  const dataSel = opcodeIn(opcode, [Opcode.LDM, Opcode.LBM]) ? 1 : 0;
  const conWr = opcodeIn(opcode, [Opcode.OUTA, Opcode.OUTD, Opcode.OUT]) ? 1 : 0;
  const conMode = opcode === Opcode.OUTD ? 1 : 0;
  const plotDraw = opcode === Opcode.DRAW ? 1 : 0;
  const plotClr = opcode === Opcode.CLR ? 1 : 0;
  const conRd = opcode === Opcode.INA ? 1 : 0;
  const driveRd = opcode === Opcode.DRVRD ? 1 : 0;
  const driveWr = opcode === Opcode.DRVWR ? 1 : 0;
  const driveClr = opcode === Opcode.DRVCLR ? 1 : 0;
  const netGet = opcode === Opcode.HTTPGET ? 1 : 0;
  const netPost = opcode === Opcode.HTTPPOST ? 1 : 0;
  const netRd = opcode === Opcode.HTTPIN ? 1 : 0;

  let pcJmpSig = 0;
  if (opcode === Opcode.JMP || opcode === Opcode.CALL) pcJmpSig = 1;
  else if (opcode === Opcode.JZ && state.flags.z) pcJmpSig = 1;
  else if (opcode === Opcode.JNZ && !state.flags.z) pcJmpSig = 1;
  else if (opcode === Opcode.JC && state.flags.c) pcJmpSig = 1;
  else if (opcode === Opcode.JNC && !state.flags.c) pcJmpSig = 1;
  else if (opcode === Opcode.JN && state.flags.n) pcJmpSig = 1;
  else if (opcode === Opcode.RET) pcJmpSig = 1;

  const aluImmSig = opcodeIn(opcode, [
    Opcode.ADD,
    Opcode.SUB,
    Opcode.AND,
    Opcode.OR,
    Opcode.XOR,
    Opcode.CMP,
  ])
    ? 1
    : 0;

  const spSelSig = opcodeIn(opcode, [
    Opcode.PUSH,
    Opcode.POP,
    Opcode.CALL,
    Opcode.RET,
  ])
    ? 1
    : 0;

  let aluOp = 0b000;
  if (
    opcodeIn(opcode, [Opcode.SUB, Opcode.SUBB, Opcode.CMP, Opcode.CMPB, Opcode.DEC])
  )
    aluOp = 0b001;
  else if (opcode === Opcode.AND || opcode === Opcode.ANDB) aluOp = 0b010;
  else if (opcode === Opcode.OR || opcode === Opcode.ORB) aluOp = 0b011;
  else if (opcode === Opcode.XOR || opcode === Opcode.XORB) aluOp = 0b100;
  else if (opcode === Opcode.NOT) aluOp = 0b101;
  else if (opcode === Opcode.SHL) aluOp = 0b110;
  else if (opcode === Opcode.SHR) aluOp = 0b111;

  return nodes.map((node) => {
    switch (node.id) {
      case "pc":
        return {
          ...node,
          data: { ...node.data, value: state.pc, q: toBits(state.pc) },
        };
      case "ir":
        return {
          ...node,
          data: {
            ...node.data,
            value: state.memory[state.pc] || 0,
            q: toBits(state.memory[state.pc] || 0),
          },
        };
      case "aReg":
        return {
          ...node,
          data: { ...node.data, value: state.a, q: toBits(state.a) },
        };
      case "bReg":
        return {
          ...node,
          data: { ...node.data, value: state.b, q: toBits(state.b) },
        };
      case "sp":
        return {
          ...node,
          data: { ...node.data, value: state.sp, q: toBits(state.sp) },
        };
      case "sram":
        return {
          ...node,
          data: { ...node.data, memory: Array.from(state.memory) },
        };
      case "flagZ":
        return {
          ...node,
          data: { ...node.data, value: state.flags.z ? 1 : 0 },
        };
      case "flagC":
        return {
          ...node,
          data: { ...node.data, value: state.flags.c ? 1 : 0 },
        };
      case "flagN":
        return {
          ...node,
          data: { ...node.data, value: state.flags.n ? 1 : 0 },
        };
      case "console":
        return {
          ...node,
          data: {
            ...node.data,
            text: cpu.consoleOutput.join(""),
            prevWr: conWr,
            inputBufferSize: cpu.consoleInputBuffer.length,
          },
        };
      case "plotter":
        return {
          ...node,
          data: {
            ...node.data,
            pixels: serializePlotterPixels(cpu.plotterPixels),
            colorSource: "cpu",
            currentColor: cpu.plotterColor,
            prevDraw: plotDraw,
          },
        };
      case "drive":
        return {
          ...node,
          data: {
            ...node.data,
            bytes: Array.from(cpu.driveData),
            q: toBits(cpu.driveLastRead || 0),
            currentAddress: cpu.driveLastAddr || 0,
            lastRead: cpu.driveLastRead || 0,
            lastWrite: cpu.driveLastWrite || 0,
            prevRd: driveRd,
            prevWr: driveWr,
          },
        };
      case "network":
        return {
          ...node,
          data: {
            ...node.data,
            method: cpu.httpLastMethod,
            url: cpu.httpLastUrl,
            body: cpu.httpLastBody,
            q: toBits(cpu.httpLastByte || 0),
            avail: cpu.httpResponseBuffer.length > 0 ? 1 : 0,
            pending: cpu.httpPending ? 1 : 0,
            responseBuffer: [...cpu.httpResponseBuffer],
            responseSize: cpu.httpResponseBuffer.length,
            lastByte: cpu.httpLastByte || 0,
            prevGet: netGet,
            prevPost: netPost,
            prevRd: netRd,
          },
        };
      case "clk":
        return { ...node, data: { ...node.data, value: cpu.clockBit } };
      case "pcLoad":
        return { ...node, data: { ...node.data, value: 1 } };
      case "irLoad":
        return { ...node, data: { ...node.data, value: 1 } };
      case "aLoad":
        return { ...node, data: { ...node.data, value: aLoad } };
      case "bLoad":
        return { ...node, data: { ...node.data, value: bLoad } };
      case "spLoad":
        return { ...node, data: { ...node.data, value: spLoad } };
      case "addrSel":
        return { ...node, data: { ...node.data, value: addrSel } };
      case "dataSel":
        return { ...node, data: { ...node.data, value: dataSel } };
      case "memWE":
        return { ...node, data: { ...node.data, value: memWE } };
      case "op0":
        return { ...node, data: { ...node.data, value: (aluOp >> 0) & 1 } };
      case "op1":
        return { ...node, data: { ...node.data, value: (aluOp >> 1) & 1 } };
      case "op2":
        return { ...node, data: { ...node.data, value: (aluOp >> 2) & 1 } };
      case "consoleWr":
        return { ...node, data: { ...node.data, value: conWr } };
      case "consoleMode":
        return { ...node, data: { ...node.data, value: conMode } };
      case "consoleClear":
        return { ...node, data: { ...node.data, value: 0 } };
      case "plotDraw":
        return { ...node, data: { ...node.data, value: plotDraw } };
      case "plotClear":
        return { ...node, data: { ...node.data, value: plotClr } };
      case "driveRd":
        return { ...node, data: { ...node.data, value: driveRd } };
      case "driveWr":
        return { ...node, data: { ...node.data, value: driveWr } };
      case "driveClear":
        return { ...node, data: { ...node.data, value: driveClr } };
      case "netGet":
        return { ...node, data: { ...node.data, value: netGet } };
      case "netPost":
        return { ...node, data: { ...node.data, value: netPost } };
      case "netRd":
        return { ...node, data: { ...node.data, value: netRd } };
      case "netClear":
        return { ...node, data: { ...node.data, value: 0 } };
      case "consoleRd":
        return { ...node, data: { ...node.data, value: conRd } };
      case "keyboard":
        return { ...node, data: { ...node.data, keys: [...cpu.keyState] } };
      case "keyRd":
        return { ...node, data: { ...node.data, value: keyRd } };
      case "operand":
        return {
          ...node,
          data: { ...node.data, value: cpu.lastOperand & 0xff },
        };
      case "rst":
        return { ...node, data: { ...node.data, value: 0 } };
      case "pcSrcMux": {
        const pcMuxOut = state.pc & 0xff;
        return {
          ...node,
          data: {
            ...node.data,
            sel: pcJmpSig,
            outVal: pcMuxOut,
            out: toBits(pcMuxOut),
          },
        };
      }
      case "aluBMux": {
        const aluBOut = aluImmSig ? cpu.lastOperand & 0xff : state.b;
        return {
          ...node,
          data: {
            ...node.data,
            sel: aluImmSig,
            outVal: aluBOut,
            out: toBits(aluBOut),
          },
        };
      }
      case "spOpMux": {
        const spOpOut = spSelSig ? state.sp & 0xff : cpu.lastOperand & 0xff;
        return {
          ...node,
          data: {
            ...node.data,
            sel: spSelSig,
            outVal: spOpOut,
            out: toBits(spOpOut),
          },
        };
      }
      case "pcJmp":
        return { ...node, data: { ...node.data, value: pcJmpSig } };
      case "aluImm":
        return { ...node, data: { ...node.data, value: aluImmSig } };
      case "spSel":
        return { ...node, data: { ...node.data, value: spSelSig } };
      case "pcDisp":
        return { ...node, data: { ...node.data, value: state.pc & 0xff } };
      case "irDisp":
        return {
          ...node,
          data: { ...node.data, value: state.memory[state.pc] || 0 },
        };
      case "aDisp":
        return { ...node, data: { ...node.data, value: state.a } };
      case "bDisp":
        return { ...node, data: { ...node.data, value: state.b } };
      case "spDisp":
        return { ...node, data: { ...node.data, value: state.sp & 0xff } };
      case "memDisp": {
        const addr = addrSel
          ? spSelSig
            ? state.sp & 0xff
            : cpu.lastOperand & 0xff
          : state.pc & 0xff;
        return {
          ...node,
          data: { ...node.data, value: state.memory[addr] || 0 },
        };
      }
      case "alu": {
        const aluA = state.a;
        const aluB = aluImmSig ? cpu.lastOperand & 0xff : state.b;
        let aluResult = 0;
        let aluCarry = 0;
        const opNames = ["ADD", "SUB", "AND", "OR", "XOR", "NOT", "SHL", "SHR"];
        switch (aluOp) {
          case 0b000: {
            const sum = aluA + aluB;
            aluResult = sum & 0xff;
            aluCarry = sum > 255 ? 1 : 0;
            break;
          }
          case 0b001: {
            const diff = aluA - aluB;
            aluResult = diff & 0xff;
            aluCarry = diff < 0 ? 1 : 0;
            break;
          }
          case 0b010:
            aluResult = aluA & aluB & 0xff;
            break;
          case 0b011:
            aluResult = (aluA | aluB) & 0xff;
            break;
          case 0b100:
            aluResult = (aluA ^ aluB) & 0xff;
            break;
          case 0b101:
            aluResult = ~aluA & 0xff;
            break;
          case 0b110:
            aluCarry = aluA & 0x80 ? 1 : 0;
            aluResult = (aluA << 1) & 0xff;
            break;
          case 0b111:
            aluCarry = aluA & 0x01 ? 1 : 0;
            aluResult = (aluA >> 1) & 0xff;
            break;
        }
        return {
          ...node,
          data: {
            ...node.data,
            a: aluA,
            b: aluB,
            result: aluResult,
            r: toBits(aluResult),
            zero: aluResult === 0 ? 1 : 0,
            carry: aluCarry,
            negative: aluResult & 0x80 ? 1 : 0,
            opName: opNames[aluOp] || "ADD",
          },
        };
      }
      case "addrMux": {
        const addrOut = addrSel
          ? spSelSig
            ? state.sp & 0xff
            : cpu.lastOperand & 0xff
          : state.pc & 0xff;
        return {
          ...node,
          data: {
            ...node.data,
            sel: addrSel,
            outVal: addrOut,
            out: toBits(addrOut),
          },
        };
      }
      case "dataMux": {
        const memAddr = addrSel
          ? spSelSig
            ? state.sp & 0xff
            : cpu.lastOperand & 0xff
          : state.pc & 0xff;
        const dataOut = dataSel ? state.memory[memAddr] || 0 : state.a;
        return {
          ...node,
          data: {
            ...node.data,
            sel: dataSel,
            outVal: dataOut,
            out: toBits(dataOut),
          },
        };
      }
      case "pcInc": {
        const nextPc = (state.pc + 1) & 0xff;
        return {
          ...node,
          data: { ...node.data, sum: toBits(nextPc), cout: 0 },
        };
      }
      case "pcOne":
        return { ...node, data: { ...node.data, value: 1 } };
      default:
        return node;
    }
  });
};

export const resetHardwarePlotterNodes = (nodes: Node[]) =>
  nodes.map((node) =>
    node.type === "plotter"
      ? {
          ...node,
          data: {
            ...node.data,
            colorSource: "wires",
            currentColor: DEFAULT_PLOTTER_COLOR,
          },
        }
      : node,
  );
