import type { MemoryLayout } from "../../cpu/compiler";
import { CPU } from "../../cpu/cpu";
import { CODE_SIZE } from "../../cpu/isa";
import type { ComputerPanelData } from "./computerPanelTypes";

function detectCodeSize(memory: Uint8Array) {
  for (let index = CODE_SIZE - 1; index >= 0; index--) {
    if (memory[index] !== 0) {
      return index + 1;
    }
  }
  return 0;
}

export function cpuToComputerPanelData(
  cpu: CPU,
  options: {
    memLayout?: MemoryLayout | null;
    codeSize?: number;
    useBootloader?: boolean;
    assembled?: boolean;
    isRunning?: boolean;
  } = {},
): ComputerPanelData {
  const state = cpu.snapshot();

  return {
    state,
    consoleOutput: [...cpu.consoleOutput],
    consoleInputBuffer: [...cpu.consoleInputBuffer],
    plotterPixels: new Map(cpu.plotterPixels),
    plotterColor: { ...cpu.plotterColor },
    keyState: [...cpu.keyState],
    driveData: cpu.exportDriveData(),
    drivePage: cpu.drivePage,
    driveLastAddr: cpu.driveLastAddr,
    driveLastRead: cpu.driveLastRead,
    driveLastWrite: cpu.driveLastWrite,
    networkMethod: cpu.httpLastMethod,
    networkUrl: cpu.httpLastUrl,
    networkBody: cpu.httpLastBody,
    networkStatus: cpu.httpLastStatus,
    networkPending: cpu.httpPending,
    networkResponseBuffer: [...cpu.httpResponseBuffer],
    networkLastByte: cpu.httpLastByte,
    networkCompletedMethod: cpu.httpCompletedMethod,
    networkCompletedUrl: cpu.httpCompletedUrl,
    networkCompletedBody: cpu.httpCompletedBody,
    networkCompletedStatus: cpu.httpCompletedStatus,
    networkCompletedResponseText: cpu.httpCompletedResponseText,
    networkHistory: [...cpu.httpHistory],
    lastOpcode: cpu.lastOpcode,
    lastOperand: cpu.lastOperand,
    clockBit: cpu.clockBit,
    randSeed: cpu.randSeed,
    randCounter: cpu.randCounter,
    sleepCounter: cpu.sleepCounter,
    assembled: options.assembled ?? true,
    isRunning: options.isRunning ?? !cpu.state.halted,
    useBootloader: options.useBootloader ?? false,
    memLayout: options.memLayout ?? null,
    codeSize: options.codeSize ?? detectCodeSize(state.memory),
  };
}
