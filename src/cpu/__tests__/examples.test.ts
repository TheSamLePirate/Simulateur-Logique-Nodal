import { rmSync } from "node:fs";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { assemble } from "../assembler";
import {
  formatBootDisk,
  getBootloaderImage,
  readBootDiskEntries,
  writeFileToBootDisk,
  writeProgramToBootDisk,
} from "../bootloader";
import { CPU } from "../cpu";
import { EXAMPLES } from "../examples";
import { CODE_SIZE } from "../isa";
import { encodePlotterCoord } from "../../plotter";
import {
  PLOTTER_REPORT_ROOT,
  writeCombinedPlotterHtmlReport,
  writePlotterSuiteData,
  type PlotterTestConsoleOutput,
  writePlotterPng,
  type PlotterSnapshotInfo,
} from "./plotterImage";

function findEntry(cpu: CPU, name: string) {
  for (let base = 16; base < 16 + 64 * 12; base += 12) {
    let matches = true;
    for (let i = 0; i < 8; i++) {
      const code = i < name.length ? name.charCodeAt(i) : 0;
      if (cpu.driveData[base + i] !== code) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return base;
    }
  }

  return -1;
}

function countPixelsInRect(
  cpu: CPU,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  let count = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (cpu.plotterPixels.has(encodePlotterCoord(x, y))) {
        count++;
      }
    }
  }
  return count;
}

function runUntil(cpu: CPU, predicate: () => boolean, limit = 2_000_000) {
  for (let i = 0; i < limit && !cpu.state.halted; i++) {
    if (predicate()) return;
    cpu.step();
  }
  expect(predicate()).toBe(true);
}

const PLOTTER_SNAPSHOT_DIR = `${PLOTTER_REPORT_ROOT}/examples`;
const plotterSnapshots: Array<PlotterSnapshotInfo & { name: string }> = [];
const suiteConsoleLines: string[] = [];
const suiteTests: string[] = [];
const testConsoleOutputMap = new Map<string, string[]>();

beforeAll(() => {
  rmSync(PLOTTER_SNAPSHOT_DIR, { recursive: true, force: true });
});

afterEach(() => {
  const testName = expect.getState().currentTestName ?? "unknown test";
  suiteTests.push(testName);
  suiteConsoleLines.push(`[test] ${testName}`);
});

function recordConsoleOutput(output: string, label?: string) {
  const normalized = output.replaceAll("\0", "").trim();
  if (!normalized) return;
  const testName = expect.getState().currentTestName ?? "unknown test";
  const existing = testConsoleOutputMap.get(testName) ?? [];
  existing.push(label ? `[${label}]\n${normalized}` : normalized);
  testConsoleOutputMap.set(testName, existing);
}

function getRecordedConsoleOutputs(): PlotterTestConsoleOutput[] {
  return suiteTests
    .filter((testName, index, list) => list.indexOf(testName) === index)
    .flatMap((testName) => {
      const outputs = testConsoleOutputMap.get(testName);
      if (!outputs || outputs.length === 0) return [];
      return [{
        testName,
        output: outputs.join("\n\n---\n\n"),
      }];
    });
}

function savePlotterSnapshot(cpu: CPU, name: string, scale = 2) {
  const snapshot = writePlotterPng(cpu.plotterPixels, `${PLOTTER_SNAPSHOT_DIR}/${name}.png`, {
    scale,
  });
  plotterSnapshots.push({ name, ...snapshot });
  suiteConsoleLines.push(
    `[snapshot] ${name}: ${snapshot.outputPath} (${snapshot.width}x${snapshot.height}, scale ${snapshot.scale}, pixels ${snapshot.pixelCount})`,
  );
}

afterAll(() => {
  suiteConsoleLines.push(`[suite] ${suiteTests.length} tests recorded`);
  writePlotterSuiteData({
    suiteName: "ASM Example Plotter Tests",
    suiteKey: "examples",
    rootDir: PLOTTER_REPORT_ROOT,
    snapshots: plotterSnapshots,
    notes: [
      "Generated at the end of examples.test.ts during vitest.",
      "Covers Super Unix Shell Plotter visual states captured from the ASM example suite.",
    ],
    consoleLines: suiteConsoleLines,
    tests: suiteTests,
    testConsoleOutputs: getRecordedConsoleOutputs(),
  });
  writeCombinedPlotterHtmlReport(PLOTTER_REPORT_ROOT);
});

describe("ASM examples", () => {
  it('"Éditeur FS ASM" assembles and fits in code memory', () => {
    const example = EXAMPLES.find((e) => e.name === "Éditeur FS ASM");
    expect(example).toBeDefined();

    const ar = assemble(example!.code);
    expect(ar.success).toBe(true);
    expect(ar.errors).toHaveLength(0);
    expect(ar.bytes.length).toBeLessThanOrEqual(CODE_SIZE);
  });

  it('"Super Unix Shell Plotter" assembles and fits in code memory', () => {
    const example = EXAMPLES.find((e) => e.name === "Super Unix Shell Plotter");
    expect(example).toBeDefined();

    const ar = assemble(example!.code);
    expect(ar.success).toBe(true);
    expect(ar.errors).toHaveLength(0);
    expect(ar.bytes.length).toBeLessThanOrEqual(CODE_SIZE);
  });

  it('"Super Unix Shell Plotter" boots from the shared FS fonts and draws on the plotter', () => {
    const example = EXAMPLES.find((e) => e.name === "Super Unix Shell Plotter");
    expect(example).toBeDefined();

    const ar = assemble(example!.code);
    expect(ar.success).toBe(true);

    let disk = formatBootDisk();
    disk = writeFileToBootDisk(disk, "LETTERS", new Uint8Array(130).fill(7));
    disk = writeFileToBootDisk(disk, "DIGITS", new Uint8Array(50).fill(7));
    disk = writeFileToBootDisk(
      disk,
      "notes",
      new Uint8Array(Array.from("hello\nworld").map((ch) => ch.charCodeAt(0))),
    );

    const cpu = new CPU();
    cpu.driveData.set(disk);
    cpu.loadProgram(ar.bytes);
    cpu.run(200_000);

    expect(cpu.state.halted).toBe(false);
    expect(cpu.plotterPixels.size).toBeGreaterThan(0);
    expect(cpu.consoleOutput.join("")).toBe("");
    savePlotterSnapshot(cpu, "super-unix-shell-plotter-boot");
  });

  it('"Super Unix Shell Plotter" draws one typed command character once on the last line', () => {
    const example = EXAMPLES.find((e) => e.name === "Super Unix Shell Plotter");
    expect(example).toBeDefined();

    const ar = assemble(example!.code);
    expect(ar.success).toBe(true);

    let disk = formatBootDisk();
    disk = writeFileToBootDisk(disk, "LETTERS", new Uint8Array(130).fill(7));
    disk = writeFileToBootDisk(disk, "DIGITS", new Uint8Array(50).fill(7));

    const cpu = new CPU();
    cpu.driveData.set(disk);
    cpu.loadProgram(ar.bytes);
    cpu.run(50_000);

    const before = countPixelsInRect(cpu, 20, 244, 255, 248);

    cpu.pushInput("a".charCodeAt(0));
    cpu.run(10_000);

    const after = countPixelsInRect(cpu, 20, 244, 255, 248);
    expect(cpu.state.memory[0x1006]).toBe(1);
    expect(cpu.state.memory[0x1040]).toBe("A".charCodeAt(0));
    expect(after - before).toBeLessThanOrEqual(15);
    savePlotterSnapshot(cpu, "super-unix-shell-plotter-typed");
  });

  it('"Super Unix Shell Plotter" CAT updates the plotter preview for the selected file', () => {
    const example = EXAMPLES.find((e) => e.name === "Super Unix Shell Plotter");
    expect(example).toBeDefined();

    const ar = assemble(example!.code);
    expect(ar.success).toBe(true);

    let disk = formatBootDisk();
    disk = writeFileToBootDisk(disk, "empty", new Uint8Array([]));
    disk = writeFileToBootDisk(disk, "LETTERS", new Uint8Array(130).fill(7));
    disk = writeFileToBootDisk(disk, "DIGITS", new Uint8Array(50).fill(7));
    disk = writeFileToBootDisk(
      disk,
      "notes",
      new Uint8Array(Array.from("hello\nworld").map((ch) => ch.charCodeAt(0))),
    );

    const cpu = new CPU();
    cpu.driveData.set(disk);
    cpu.loadProgram(ar.bytes);
    cpu.run(50_000);
    const before = countPixelsInRect(cpu, 120, 40, 255, 220);

    for (const ch of "cat notes\n") {
      cpu.pushInput(ch.charCodeAt(0));
    }
    cpu.run(500_000);

    const after = countPixelsInRect(cpu, 120, 40, 255, 220);
    expect(cpu.consoleOutput.join("")).toBe("");
    expect(cpu.state.memory[0x1002]).toBe(3);
    expect(after).toBeGreaterThan(before);
    savePlotterSnapshot(cpu, "super-unix-shell-plotter-cat-preview");
  });

  it('"Super Unix Shell Plotter" finds late files in a long directory and switches between help/preview', () => {
    const example = EXAMPLES.find((e) => e.name === "Super Unix Shell Plotter");
    expect(example).toBeDefined();

    const ar = assemble(example!.code);
    expect(ar.success).toBe(true);

    let disk = formatBootDisk();
    disk = writeFileToBootDisk(disk, "LETTERS", new Uint8Array(130).fill(7));
    disk = writeFileToBootDisk(disk, "DIGITS", new Uint8Array(50).fill(7));
    for (let i = 0; i < 12; i++) {
      disk = writeFileToBootDisk(
        disk,
        `f${i.toString().padStart(2, "0")}`,
        new Uint8Array([65 + i]),
      );
    }

    const cpu = new CPU();
    cpu.driveData.set(disk);
    cpu.loadProgram(ar.bytes);
    cpu.run(50_000);

    expect(cpu.state.memory[0x1003]).toBeGreaterThanOrEqual(14);
    const before = countPixelsInRect(cpu, 120, 40, 255, 220);

    for (const ch of "cat f11\n") {
      cpu.pushInput(ch.charCodeAt(0));
    }
    cpu.run(500_000);

    const after = countPixelsInRect(cpu, 120, 40, 255, 220);
    expect(cpu.state.memory[0x1002]).toBeGreaterThanOrEqual(13);
    expect(cpu.state.memory[0x1007]).not.toBe(0);
    expect(cpu.state.memory[0x100C]).toBe(1);
    expect(after).toBeGreaterThan(before);

    for (const ch of "help\n") {
      cpu.pushInput(ch.charCodeAt(0));
    }
    cpu.run(200_000);
    expect(cpu.state.memory[0x1016]).toBe(1);
    savePlotterSnapshot(cpu, "super-unix-shell-plotter-help");
  });

  it('"Éditeur FS ASM" opens /o filename on the real FS and edits that file with arrow movement', () => {
    const example = EXAMPLES.find((e) => e.name === "Éditeur FS ASM");
    expect(example).toBeDefined();

    const ar = assemble(example!.code);
    expect(ar.success).toBe(true);

    const cpu = new CPU();
    let disk = formatBootDisk();
    for (let i = 0; i < 24; i++) {
      disk = writeFileToBootDisk(
        disk,
        `f${i.toString().padStart(2, "0")}`,
        new Uint8Array([65 + i]),
      );
    }
    disk = writeFileToBootDisk(
      disk,
      "todo",
      new Uint8Array([
        "a".charCodeAt(0),
        "b".charCodeAt(0),
      ]),
    );
    cpu.driveData.set(disk);
    cpu.loadProgram(ar.bytes);

    const pushText = (text: string) => {
      for (const ch of text) {
        cpu.pushInput(ch.charCodeAt(0));
      }
    };

    const stepMany = (count: number) => {
      for (let i = 0; i < count && !cpu.state.halted; i++) {
        cpu.step();
      }
    };

    const runUntil = (predicate: () => boolean, limit = 2_000_000) => {
      for (let i = 0; i < limit && !cpu.state.halted; i++) {
        if (predicate()) return;
        cpu.step();
      }
      expect(predicate()).toBe(true);
    };

    const tapKey = (index: number) => {
      cpu.keyState[index] = 1;
      stepMany(400);
      cpu.keyState[index] = 0;
      stepMany(80);
    };

    pushText("/o todo\n");
    runUntil(() => cpu.state.memory[0x1002] === 2 && cpu.state.memory[0x1003] === 2);

    runUntil(() => cpu.state.memory[0x1003] === 2);

    tapKey(0);
    runUntil(() => cpu.state.memory[0x1003] === 1);

    pushText("X\n/s\n@\n");
    runUntil(() => cpu.state.halted);

    const todoBase = findEntry(cpu, "todo");
    expect(todoBase).toBeGreaterThanOrEqual(0);

    const page = cpu.driveData[todoBase + 9];
    const size = cpu.driveData[todoBase + 11];
    expect(size).toBe(3);
    expect(cpu.driveData[(page << 8) + 0]).toBe("a".charCodeAt(0));
    expect(cpu.driveData[(page << 8) + 1]).toBe("X".charCodeAt(0));
    expect(cpu.driveData[(page << 8) + 2]).toBe("b".charCodeAt(0));
  }, 15_000);

  it('"Éditeur FS ASM" creates a new file with /o filename and saves it in bootloader FS format', () => {
    const example = EXAMPLES.find((e) => e.name === "Éditeur FS ASM");
    expect(example).toBeDefined();

    const ar = assemble(example!.code);
    expect(ar.success).toBe(true);

    const cpu = new CPU();
    cpu.driveData.set(formatBootDisk());
    cpu.loadProgram(ar.bytes);

    const pushText = (text: string) => {
      for (const ch of text) {
        cpu.pushInput(ch.charCodeAt(0));
      }
    };

    const runUntil = (predicate: () => boolean, limit = 2_000_000) => {
      for (let i = 0; i < limit && !cpu.state.halted; i++) {
        if (predicate()) return;
        cpu.step();
      }
      expect(predicate()).toBe(true);
    };

    pushText("/o story\n");
    runUntil(() => cpu.state.memory[0x1002] === 0 && cpu.state.memory[0x1003] === 0);

    pushText("Hello\n/s\n@\n");
    runUntil(() => cpu.state.halted);

    const entries = readBootDiskEntries(cpu.driveData);
    const story = entries.find((entry) => entry.name === "story");
    expect(story).toBeDefined();
    expect(story?.type).toBe(1);
    expect(story?.pageCount).toBe(1);
    expect(story?.sizeBytes).toBe(5);
    expect(Array.from(story?.bytes.slice(0, 5) ?? [])).toEqual([
      "H".charCodeAt(0),
      "e".charCodeAt(0),
      "l".charCodeAt(0),
      "l".charCodeAt(0),
      "o".charCodeAt(0),
    ]);
  }, 15_000);

  it('"Éditeur FS ASM" switches between several files and preserves each one', () => {
    const example = EXAMPLES.find((e) => e.name === "Éditeur FS ASM");
    expect(example).toBeDefined();

    const ar = assemble(example!.code);
    expect(ar.success).toBe(true);

    const cpu = new CPU();
    cpu.driveData.set(formatBootDisk());
    cpu.loadProgram(ar.bytes);

    const pushText = (text: string) => {
      for (const ch of text) {
        cpu.pushInput(ch.charCodeAt(0));
      }
    };

    pushText("/o one\nA\n/s\n/o two\nBC\n/s\n/o one\nD\n/s\n@\n");
    runUntil(cpu, () => cpu.state.halted);

    const entries = readBootDiskEntries(cpu.driveData);
    const one = entries.find((entry) => entry.name === "one");
    const two = entries.find((entry) => entry.name === "two");

    expect(one).toBeDefined();
    expect(two).toBeDefined();
    expect(Array.from(one?.bytes.slice(0, 2) ?? [])).toEqual([
      "A".charCodeAt(0),
      "D".charCodeAt(0),
    ]);
    expect(one?.sizeBytes).toBe(2);
    expect(Array.from(two?.bytes.slice(0, 2) ?? [])).toEqual([
      "B".charCodeAt(0),
      "C".charCodeAt(0),
    ]);
    expect(two?.sizeBytes).toBe(2);
  }, 15_000);

  it('"Boot Args - Cat" reads the file chosen by the bootloader', () => {
    const example = EXAMPLES.find((e) => e.name === "Boot Args - Cat");
    expect(example).toBeDefined();

    const ar = assemble(example!.code);
    expect(ar.success).toBe(true);

    let disk = writeProgramToBootDisk(new Uint8Array(8192), "bootcat", ar.bytes);
    disk = writeFileToBootDisk(
      disk,
      "notes",
      new Uint8Array(Array.from("hello").map((ch) => ch.charCodeAt(0))),
    );

    const boot = getBootloaderImage();
    const cpu = new CPU();
    cpu.loadDriveData(disk);
    cpu.loadProgram(boot.bytes, boot.startAddr);

    for (const ch of "run bootcat notes\n") {
      cpu.pushInput(ch.charCodeAt(0));
    }

    cpu.run(500_000);

    recordConsoleOutput(cpu.consoleOutput.join(""), "run bootcat notes");
    expect(cpu.consoleOutput.join("")).toContain("hello");
    expect(cpu.state.halted).toBe(true);
  });
});
