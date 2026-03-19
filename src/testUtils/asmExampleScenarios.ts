import { expect } from "vitest";

import { assemble } from "../cpu/assembler";
import {
  BOOTLOADER_PROMPT,
  formatBootDisk,
  readBootDiskEntries,
  writeFileToBootDisk,
} from "../cpu/bootloader";
import { CPU } from "../cpu/cpu";
import { EXAMPLES, type Example } from "../cpu/examples";
import { LINUX_USERLAND_PROGRAMS } from "../cpu/linuxUserland";
import { encodePlotterCoord } from "../plotter";
import { getLinuxUserlandScenario } from "./linuxUserlandProgramScenarios";

export interface AsmExampleRunContext {
  cpu: CPU;
  codeSize: number;
  useBootloader: boolean;
}

export interface AsmExampleScenario {
  timeout?: number;
  run: (example: Example) => Promise<AsmExampleRunContext> | AsmExampleRunContext;
}

function assembleExample(example: Example) {
  const assembled = assemble(example.code);
  if (!assembled.success) {
    throw new Error(
      `Assemble failed for ${example.name}:\n${assembled.errors.map((error) => `  L${error.line}: ${error.message}`).join("\n")}`,
    );
  }
  return assembled;
}

function pushText(cpu: CPU, input?: string) {
  if (!input) return;
  for (const char of input) {
    cpu.pushInput(char.charCodeAt(0));
  }
}

function runUntil(cpu: CPU, predicate: () => boolean, maxSteps = 2_000_000) {
  for (let step = 0; step < maxSteps && !cpu.state.halted; step++) {
    if (predicate()) return true;
    cpu.step();
  }
  return predicate();
}

function findDiskEntry(cpu: CPU, name: string) {
  return readBootDiskEntries(cpu.driveData).find((entry) => entry.name === name);
}

const nativeAsmExampleScenarios: Record<string, AsmExampleScenario> = {
  "Hello World": {
    run: (example) => {
      const assembled = assembleExample(example);
      const cpu = new CPU();
      cpu.loadProgram(assembled.bytes);
      cpu.run(5_000);
      expect(cpu.consoleOutput.join("")).toBe("HELLO");
      expect(cpu.state.halted).toBe(true);
      return { cpu, codeSize: assembled.bytes.length, useBootloader: false };
    },
  },
  "Compteur 0-9": {
    run: (example) => {
      const assembled = assembleExample(example);
      const cpu = new CPU();
      cpu.loadProgram(assembled.bytes);
      cpu.run(50_000);
      expect(cpu.consoleOutput.join("")).toBe("0123456789");
      expect(cpu.state.halted).toBe(true);
      return { cpu, codeSize: assembled.bytes.length, useBootloader: false };
    },
  },
  Fibonacci: {
    run: (example) => {
      const assembled = assembleExample(example);
      const cpu = new CPU();
      cpu.loadProgram(assembled.bytes);
      cpu.run(500_000);
      expect(cpu.consoleOutput.join("")).toBe("1 2 3 5 8 13 21 34 55 89 144 233 ");
      expect(cpu.state.halted).toBe(true);
      return { cpu, codeSize: assembled.bytes.length, useBootloader: false };
    },
  },
  Addition: {
    run: (example) => {
      const assembled = assembleExample(example);
      const cpu = new CPU();
      cpu.loadProgram(assembled.bytes);
      cpu.run(5_000);
      expect(cpu.consoleOutput.join("")).toBe("42");
      expect(cpu.state.halted).toBe(true);
      return { cpu, codeSize: assembled.bytes.length, useBootloader: false };
    },
  },
  Factorielle: {
    run: (example) => {
      const assembled = assembleExample(example);
      const cpu = new CPU();
      cpu.loadProgram(assembled.bytes);
      cpu.run(500_000);
      expect(cpu.consoleOutput.join("")).toBe("120");
      expect(cpu.state.halted).toBe(true);
      return { cpu, codeSize: assembled.bytes.length, useBootloader: false };
    },
  },
  "Plotter - Carré": {
    run: (example) => {
      const assembled = assembleExample(example);
      const cpu = new CPU();
      cpu.loadProgram(assembled.bytes);
      cpu.run(200_000);
      expect(cpu.state.halted).toBe(true);
      expect(cpu.plotterPixels.has(encodePlotterCoord(20, 20))).toBe(true);
      expect(cpu.plotterPixels.has(encodePlotterCoord(70, 20))).toBe(true);
      expect(cpu.plotterPixels.has(encodePlotterCoord(20, 70))).toBe(true);
      expect(cpu.plotterPixels.has(encodePlotterCoord(70, 70))).toBe(true);
      return { cpu, codeSize: assembled.bytes.length, useBootloader: false };
    },
  },
  "Echo (Saisie)": {
    run: (example) => {
      const assembled = assembleExample(example);
      const cpu = new CPU();
      cpu.loadProgram(assembled.bytes);
      pushText(cpu, "ab\n");
      cpu.run(500_000);
      expect(cpu.consoleOutput.join("")).toContain("Tapez: ab\n");
      expect(cpu.state.halted).toBe(false);
      return { cpu, codeSize: assembled.bytes.length, useBootloader: false };
    },
  },
  "Nodal Linux Bootloader": {
    run: (example) => {
      const assembled = assembleExample(example);
      const cpu = new CPU();
      cpu.loadDriveData(formatBootDisk());
      cpu.loadProgram(assembled.bytes);
      expect(
        runUntil(cpu, () => cpu.consoleOutput.join("").endsWith(BOOTLOADER_PROMPT), 400_000),
      ).toBe(true);
      expect(cpu.consoleOutput.join("")).toContain("NodalLinux");
      expect(cpu.state.halted).toBe(false);
      return { cpu, codeSize: assembled.bytes.length, useBootloader: false };
    },
  },
  "Éditeur FS ASM": {
    timeout: 15_000,
    run: (example) => {
      const assembled = assembleExample(example);
      const cpu = new CPU();
      cpu.loadDriveData(formatBootDisk());
      cpu.loadProgram(assembled.bytes);
      pushText(cpu, "/o story\nHello\n/s\n@\n");
      expect(runUntil(cpu, () => cpu.state.halted, 2_000_000)).toBe(true);
      const story = findDiskEntry(cpu, "story");
      expect(story).toBeDefined();
      expect(story?.sizeBytes).toBe(5);
      expect(Array.from(story?.bytes.slice(0, 5) ?? [])).toEqual(
        Array.from("Hello").map((char) => char.charCodeAt(0)),
      );
      return { cpu, codeSize: assembled.bytes.length, useBootloader: false };
    },
  },
  "Super Unix Shell Plotter": {
    timeout: 15_000,
    run: (example) => {
      const assembled = assembleExample(example);
      let disk = formatBootDisk();
      disk = writeFileToBootDisk(disk, "LETTERS", new Uint8Array(130).fill(7));
      disk = writeFileToBootDisk(disk, "DIGITS", new Uint8Array(50).fill(7));
      disk = writeFileToBootDisk(
        disk,
        "notes",
        new Uint8Array(Array.from("hello\nworld").map((char) => char.charCodeAt(0))),
      );

      const cpu = new CPU();
      cpu.loadDriveData(disk);
      cpu.loadProgram(assembled.bytes);
      cpu.run(50_000);
      pushText(cpu, "cat notes\n");
      cpu.run(500_000);

      expect(cpu.state.halted).toBe(false);
      expect(cpu.plotterPixels.size).toBeGreaterThan(0);
      expect(cpu.consoleOutput.join("")).toBe("");
      return { cpu, codeSize: assembled.bytes.length, useBootloader: false };
    },
  },
  "Majuscules (Saisie)": {
    run: (example) => {
      const assembled = assembleExample(example);
      const cpu = new CPU();
      cpu.loadProgram(assembled.bytes);
      pushText(cpu, "ab!\n");
      cpu.run(500_000);
      expect(cpu.consoleOutput.join("")).toBe("> AB!\n> ");
      expect(cpu.state.halted).toBe(false);
      return { cpu, codeSize: assembled.bytes.length, useBootloader: false };
    },
  },
  "Plotter RGB - Paysage": {
    timeout: 15_000,
    run: (example) => {
      const assembled = assembleExample(example);
      const cpu = new CPU();
      cpu.loadProgram(assembled.bytes);
      cpu.run(2_000_000);
      expect(cpu.state.halted).toBe(true);
      expect(cpu.plotterPixels.size).toBeGreaterThan(400);
      return { cpu, codeSize: assembled.bytes.length, useBootloader: false };
    },
  },
};

const linuxAsmExampleScenarios = Object.fromEntries(
  LINUX_USERLAND_PROGRAMS
    .filter((program) => program.language !== "c")
    .map((program) => [
      program.exampleName,
      {
        timeout: getLinuxUserlandScenario(program).timeout,
        run: async (example: Example) => {
          const assembled = assembleExample(example);
          const run = getLinuxUserlandScenario(program);
          const cpu = await run.run(program);
          return { cpu, codeSize: assembled.bytes.length, useBootloader: true };
        },
      } satisfies AsmExampleScenario,
    ]),
);

export const ASM_EXAMPLE_SCENARIOS: Record<string, AsmExampleScenario> = {
  ...nativeAsmExampleScenarios,
  ...linuxAsmExampleScenarios,
};

export function getAsmExampleScenario(example: Example) {
  const scenario = ASM_EXAMPLE_SCENARIOS[example.name];
  expect(scenario, `Missing ASM example test scenario for "${example.name}"`).toBeDefined();
  return scenario!;
}

export function expectAsmExampleScenarioCoverage() {
  const expected = new Set(EXAMPLES.map((example) => example.name));
  const actual = new Set(Object.keys(ASM_EXAMPLE_SCENARIOS));

  expect([...expected].filter((name) => !actual.has(name))).toEqual([]);
  expect([...actual].filter((name) => !expected.has(name))).toEqual([]);
}
