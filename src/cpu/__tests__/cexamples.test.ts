/**
 * Unit tests for all C example programs.
 *
 * Tests the full pipeline: C source → compile → assemble → CPU execution.
 * Verifies: compilation, code size, memory layout, output, and halting.
 */

import { rmSync } from "node:fs";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { compile } from "../compiler";
import { assemble } from "../assembler";
import { CPU, type HttpFetchHandler } from "../cpu";
import { C_EXAMPLES } from "../cexamples";
import {
  getBootloaderImage,
  getLinuxBootDiskImage,
  readBootDiskEntries,
  writeFileToBootDisk,
  writeProgramToBootDisk,
} from "../bootloader";
import { CODE_SIZE, DRIVE_SIZE, MEMORY_SIZE } from "../isa";
import { encodePlotterCoord, packPlotterColor } from "../../plotter";
import {
  PLOTTER_REPORT_ROOT,
  writeCombinedPlotterHtmlReport,
  writePlotterSuiteData,
  type PlotterTestConsoleOutput,
  writePlotterPng,
  type PlotterSnapshotInfo,
} from "./plotterImage";

// ─── Test helpers ───

interface RunResult {
  output: string;
  halted: boolean;
  cycles: number;
  cpu: CPU;
  codeSize: number;
  memoryLayout: {
    globals: number;
    scratch: number;
    locals: number;
    stackSize: number;
  };
}

const testConsoleOutputMap = new Map<string, string[]>();

function u8(value: number) {
  return value & 0xff;
}

function recordConsoleOutput(output: string, label?: string) {
  const normalized = output.replaceAll("\0", "").trim();
  if (!normalized) return;
  const testName = expect.getState().currentTestName ?? "unknown test";
  const existing = testConsoleOutputMap.get(testName) ?? [];
  existing.push(label ? `[${label}]\n${normalized}` : normalized);
  testConsoleOutputMap.set(testName, existing);
}

function getRecordedConsoleOutputs(testNames: string[]): PlotterTestConsoleOutput[] {
  return testNames
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

/**
 * Compile, assemble, and run a C program.
 * Optionally feed console input characters before running.
 */
function compileAndRun(
  source: string,
  options: {
    maxCycles?: number;
    input?: string;
    keyState?: number[];
    driveData?: ArrayLike<number>;
    httpFetch?: HttpFetchHandler;
  } = {},
): RunResult {
  const { maxCycles = 500_000, input, keyState, driveData, httpFetch } = options;

  // Compile C → ASM
  const cr = compile(source);
  if (!cr.success) {
    throw new Error(
      `Compile failed:\n${cr.errors.map((e) => `  [${e.phase}] L${e.line}: ${e.message}`).join("\n")}`,
    );
  }

  // Assemble ASM → bytes
  const ar = assemble(cr.assembly);
  if (!ar.success) {
    throw new Error(
      `Assemble failed:\n${ar.errors.map((e) => `  L${e.line}: ${e.message}`).join("\n")}`,
    );
  }

  // Run on CPU
  const cpu = new CPU();
  if (httpFetch) {
    cpu.httpFetch = httpFetch;
  }
  if (driveData) {
    cpu.loadDriveData(driveData);
  }
  cpu.loadProgram(ar.bytes);

  // Set keyboard state if provided
  if (keyState) {
    cpu.keyState = [...keyState];
  }

  // Feed input if provided
  if (input) {
    for (const ch of input) {
      cpu.pushInput(ch.charCodeAt(0));
    }
  }

  cpu.run(maxCycles);

  const output = cpu.consoleOutput.join("");
  recordConsoleOutput(output, "compileAndRun");

  return {
    output,
    halted: cpu.state.halted,
    cycles: cpu.state.cycles,
    cpu,
    codeSize: ar.bytes.length,
    memoryLayout: cr.memoryLayout!,
  };
}

async function compileAndRunAsync(
  source: string,
  options: {
    maxCycles?: number;
    input?: string;
    keyState?: number[];
    driveData?: ArrayLike<number>;
    httpFetch?: HttpFetchHandler;
  } = {},
): Promise<RunResult> {
  const { maxCycles = 500_000, input, keyState, driveData, httpFetch } = options;

  const cr = compile(source);
  if (!cr.success) {
    throw new Error(
      `Compile failed:\n${cr.errors.map((e) => `  [${e.phase}] L${e.line}: ${e.message}`).join("\n")}`,
    );
  }

  const ar = assemble(cr.assembly);
  if (!ar.success) {
    throw new Error(
      `Assemble failed:\n${ar.errors.map((e) => `  L${e.line}: ${e.message}`).join("\n")}`,
    );
  }

  const cpu = new CPU();
  if (httpFetch) {
    cpu.httpFetch = httpFetch;
  }
  if (driveData) {
    cpu.loadDriveData(driveData);
  }
  cpu.loadProgram(ar.bytes);

  if (keyState) {
    cpu.keyState = [...keyState];
  }

  if (input) {
    for (const ch of input) {
      cpu.pushInput(ch.charCodeAt(0));
    }
  }

  await cpu.runAsync(maxCycles);

  const output = cpu.consoleOutput.join("");
  recordConsoleOutput(output, "compileAndRunAsync");

  return {
    output,
    halted: cpu.state.halted,
    cycles: cpu.state.cycles,
    cpu,
    codeSize: ar.bytes.length,
    memoryLayout: cr.memoryLayout!,
  };
}

/**
 * Compile a C source and return compile + assemble results without running.
 */
function compileOnly(source: string) {
  const cr = compile(source);
  let asmResult = null;
  if (cr.success) {
    asmResult = assemble(cr.assembly);
  }
  return { compile: cr, asm: asmResult };
}

function hasPixel(cpu: CPU, x: number, y: number): boolean {
  return cpu.plotterPixels.has(encodePlotterCoord(x, y));
}

function pixelColor(cpu: CPU, x: number, y: number): number | undefined {
  return cpu.plotterPixels.get(encodePlotterCoord(x, y));
}

const PLOTTER_SNAPSHOT_DIR = `${PLOTTER_REPORT_ROOT}/cexamples`;
const plotterSnapshots: Array<PlotterSnapshotInfo & { name: string }> = [];
const suiteConsoleLines: string[] = [];
const suiteTests: string[] = [];

beforeAll(() => {
  rmSync(PLOTTER_SNAPSHOT_DIR, { recursive: true, force: true });
});

afterEach(() => {
  const testName = expect.getState().currentTestName ?? "unknown test";
  suiteTests.push(testName);
  suiteConsoleLines.push(`[test] ${testName}`);
});

function savePlotterSnapshot(cpu: CPU, name: string, scale = 2) {
  const snapshot = writePlotterPng(cpu.plotterPixels, `${PLOTTER_SNAPSHOT_DIR}/${name}.png`, {
    scale,
  });
  plotterSnapshots.push({ name, ...snapshot });
  suiteConsoleLines.push(
    `[snapshot] ${name}: ${snapshot.outputPath} (${snapshot.width}x${snapshot.height}, scale ${snapshot.scale}, pixels ${snapshot.pixelCount})`,
  );
}

function waitForVisibleFrame(cpu: CPU, burstCount = 12, stepPerBurst = 20_000) {
  for (let burst = 0; burst < burstCount && !cpu.state.halted; burst++) {
    if (cpu.plotterPixels.size > 0) return;
    cpu.run(stepPerBurst);
  }
}

function savePlotterSequence(cpu: CPU, baseName: string, frameCount: number, stepBetweenFrames: number) {
  for (let frame = 1; frame <= frameCount; frame++) {
    waitForVisibleFrame(cpu);
    savePlotterSnapshot(cpu, `${baseName}-f${frame}`);
    if (frame < frameCount && !cpu.state.halted) {
      cpu.run(stepBetweenFrames);
    }
  }
}

afterAll(() => {
  suiteConsoleLines.push(`[suite] ${suiteTests.length} tests recorded`);
  writePlotterSuiteData({
    suiteName: "C Example Plotter Tests",
    suiteKey: "cexamples",
    rootDir: PLOTTER_REPORT_ROOT,
    snapshots: plotterSnapshots,
    notes: [
      "Generated at the end of cexamples.test.ts during vitest.",
      "Includes visual captures from plotter-oriented bundled C examples and compiler feature checks that draw pixels.",
    ],
    consoleLines: suiteConsoleLines,
    tests: suiteTests,
    testConsoleOutputs: getRecordedConsoleOutputs(suiteTests),
  });
  writeCombinedPlotterHtmlReport(PLOTTER_REPORT_ROOT);
});

// ═══════════════════════════════════════════════════════════
//  Test suite: All C examples compile and run
// ═══════════════════════════════════════════════════════════

describe("C Examples — Compilation", () => {
  for (const example of C_EXAMPLES) {
    it(`"${example.name}" compiles without errors`, () => {
      const { compile: cr, asm: ar } = compileOnly(example.code);

      expect(cr.success).toBe(true);
      expect(cr.errors).toHaveLength(0);
      expect(cr.assembly).toBeTruthy();
      expect(cr.memoryLayout).toBeDefined();

      // Assembly should also succeed
      expect(ar).not.toBeNull();
      expect(ar!.success).toBe(true);
      expect(ar!.errors).toHaveLength(0);
    });

    it(`"${example.name}" code fits in ${CODE_SIZE} bytes`, () => {
      const { asm: ar } = compileOnly(example.code);
      expect(ar!.bytes.length).toBeLessThanOrEqual(CODE_SIZE);
    });
  }
});

describe("C Examples — Memory Layout", () => {
  for (const example of C_EXAMPLES) {
    it(`"${example.name}" memory layout is valid`, () => {
      const { compile: cr } = compileOnly(example.code);
      const ml = cr.memoryLayout!;

      // Globals: 0-16
      expect(ml.globals).toBeGreaterThanOrEqual(0);
      expect(ml.globals).toBeLessThanOrEqual(16);

      // Scratch: always 8
      expect(ml.scratch).toBe(8);

      // Locals: 0-2024
      expect(ml.locals).toBeGreaterThanOrEqual(0);
      expect(ml.locals).toBeLessThanOrEqual(2024);

      // Stack: always 2048
      expect(ml.stackSize).toBe(2048);

      // Data area (globals + scratch + locals) fits in 2048 bytes
      const dataUsed = ml.globals + ml.scratch + ml.locals;
      expect(dataUsed).toBeLessThanOrEqual(2048);
    });
  }
});

// ═══════════════════════════════════════════════════════════
//  Test suite: Specific program outputs
// ═══════════════════════════════════════════════════════════

describe("C Examples — Output Verification", () => {
  it('"Hello World" outputs correct text', () => {
    const r = compileAndRun(C_EXAMPLES[0].code);
    expect(r.output).toBe("Hello World!");
    expect(r.halted).toBe(true);
  });

  it('"Compteur" outputs digits 0-9', () => {
    const r = compileAndRun(C_EXAMPLES[1].code);
    expect(r.output).toBe("0123456789");
    expect(r.halted).toBe(true);
  });

  it('"Fibonacci" outputs first 10 Fibonacci numbers', () => {
    const r = compileAndRun(C_EXAMPLES[2].code);
    // 0 1 1 2 3 5 8 13 21 34
    expect(r.output).toBe("0 1 1 2 3 5 8 13 21 34 ");
    expect(r.halted).toBe(true);
  });

  it('"Factorielle" computes 5! = 120', () => {
    const r = compileAndRun(C_EXAMPLES[3].code);
    expect(r.output).toBe("5! = 120");
    expect(r.halted).toBe(true);
  });

  it('"Calcul" shows correct arithmetic results', () => {
    const r = compileAndRun(C_EXAMPLES[4].code);
    const lines = r.output.split("\n").filter(Boolean);
    expect(lines).toEqual([
      "x = 10",
      "y = 3",
      "x+y = 13",
      "x-y = 7",
      "x*y = 30",
      "x/y = 3",
      "x%y = 1",
    ]);
    expect(r.halted).toBe(true);
  });

  it('"Plotter" draws pixels and halts', () => {
    const r = compileAndRun(C_EXAMPLES[5].code);
    expect(r.halted).toBe(true);
    // Should have drawn diagonal + frame pixels
    expect(r.cpu.plotterPixels.size).toBeGreaterThan(100);
    // Check diagonal: pixel at (0,0) and (79,79)
    expect(hasPixel(r.cpu, 0, 0)).toBe(true); // (0,0)
    expect(hasPixel(r.cpu, 79, 79)).toBe(true); // (79,79)
    // Check frame corners
    expect(hasPixel(r.cpu, 0, 0)).toBe(true); // top-left
    expect(hasPixel(r.cpu, 99, 0)).toBe(true); // top-right
    expect(hasPixel(r.cpu, 0, 99)).toBe(true); // bottom-left
    expect(hasPixel(r.cpu, 99, 99)).toBe(true); // bottom-right
    savePlotterSnapshot(r.cpu, "c-plotter");
  });

  it('"Courbe" draws parabolic wave on plotter', () => {
    const r = compileAndRun(C_EXAMPLES[6].code, { maxCycles: 50_000_000 });
    expect(r.halted).toBe(true);
    // Should have drawn ~255 pixels (one per x)
    expect(r.cpu.plotterPixels.size).toBeGreaterThan(200);
    // Pixel key = (y << 8) | x  (DRAW stores (B << 8) | A, draw(x,y) → A=x, B=y)
    // Endpoints at y=128 (t=0 → h=0 → y=128)
    expect(hasPixel(r.cpu, 0, 128)).toBe(true); // draw(0, 128)
    // Wave should reach above y=128 in first half (x<128)
    // At x=64 (midpoint of first arch), t=64, h=(16*15)=240, y=128-(120)=8
    const hasUpperWave = Array.from(r.cpu.plotterPixels.keys()).some((key) => {
      const x = key & 0xff;
      const y = (key >> 8) & 0xff;
      return x < 128 && y < 100;
    });
    expect(hasUpperWave).toBe(true);
    // Wave should reach below y=128 in second half (x>=128)
    const hasLowerWave = Array.from(r.cpu.plotterPixels.keys()).some((key) => {
      const x = key & 0xff;
      const y = (key >> 8) & 0xff;
      return x >= 128 && y > 156;
    });
    expect(hasLowerWave).toBe(true);
    savePlotterSnapshot(r.cpu, "c-courbe");
  });

  it('"Echo" echoes input back', () => {
    const r = compileAndRun(C_EXAMPLES[7].code, {
      input: "Hi\n",
      maxCycles: 100_000,
    });
    // The output starts with "Tapez: " then echoes "Hi\n"
    expect(r.output).toContain("Tapez: ");
    expect(r.output).toContain("H");
    expect(r.output).toContain("i");
  });

  it('"Compteur de lettres" counts characters', () => {
    const r = compileAndRun(C_EXAMPLES[8].code, {
      input: "abc\n",
      maxCycles: 100_000,
    });
    expect(r.output).toContain("> ");
    expect(r.output).toContain("abc");
    expect(r.output).toContain("Longueur: 3");
  });

  it('"Calculatrice" computes 123+45=168', () => {
    const r = compileAndRun(C_EXAMPLES[9].code, {
      input: "123+45\n",
      maxCycles: 500_000,
    });
    expect(r.output).toContain("123+45");
    expect(r.output).toContain("= 168");
  });

  it('"Calculatrice" computes 25*4=100', () => {
    const r = compileAndRun(C_EXAMPLES[9].code, {
      input: "25*4\n",
      maxCycles: 500_000,
    });
    expect(r.output).toContain("= 100");
  });

  it('"Calculatrice" computes 2.14+3.24=5.38', () => {
    const r = compileAndRun(C_EXAMPLES[9].code, {
      input: "2.14+3.24\n",
      maxCycles: 2_000_000,
    });
    expect(r.output).toContain("2.14+3.24");
    expect(r.output).toContain("= 5.38");
  });

  it('"Calculatrice" computes 2.14*3.24=6.93', () => {
    const r = compileAndRun(C_EXAMPLES[9].code, {
      input: "2.14*3.24\n",
      maxCycles: 2_000_000,
    });
    expect(r.output).toContain("= 6.93");
  });

  it('"Calculatrice" computes 100/4=25', () => {
    const r = compileAndRun(C_EXAMPLES[9].code, {
      input: "100/4\n",
      maxCycles: 500_000,
    });
    expect(r.output).toContain("= 25");
  });

  it('"Calculatrice" computes 10/4=2.50', () => {
    const r = compileAndRun(C_EXAMPLES[9].code, {
      input: "10/4\n",
      maxCycles: 2_000_000,
    });
    expect(r.output).toContain("= 2.50");
  }, 10_000);

  it('"Calculatrice" computes 10%3=1', () => {
    const r = compileAndRun(C_EXAMPLES[9].code, {
      input: "10%3\n",
      maxCycles: 500_000,
    });
    expect(r.output).toContain("= 1");
  });

  it('"Traceur de droite" plots y=2x (a=2, b=1, c=0) with DDA', () => {
    const r = compileAndRun(C_EXAMPLES[10].code, {
      input: "210",
      maxCycles: 50_000_000,
    });
    expect(r.halted).toBe(true);
    // Should have drawn ~255 pixels (one per x)
    expect(r.cpu.plotterPixels.size).toBeGreaterThan(200);
    // Pixel key = (y << 8) | x  (DRAW stores (B << 8) | A, draw(x,y) → A=x, B=y)
    // DDA: y increments by 2 each step (a=2, b=1)
    // x=1: y=2 → draw(1, 2) → key = (2 << 8) | 1
    expect(hasPixel(r.cpu, 1, 2)).toBe(true);
    // x=10: y=20 → draw(10, 20) → key = (20 << 8) | 10
    expect(hasPixel(r.cpu, 10, 20)).toBe(true);
    // x=200: y = (2*200) mod 256 = 144 → draw(200, 144)
    // DDA wraps smoothly through 255→0 (no jump discontinuity at x=128)
    expect(hasPixel(r.cpu, 200, 144)).toBe(true);
    savePlotterSnapshot(r.cpu, "c-traceur-droite");
  });

  it('"Traceur de droite" handles b=0 error', () => {
    const r = compileAndRun(C_EXAMPLES[10].code, {
      input: "10",
      maxCycles: 100_000,
    });
    expect(r.halted).toBe(true);
    expect(r.output).toContain("Err: b=0");
    // Should NOT have drawn any pixels (program exits before clear/draw)
    expect(r.cpu.plotterPixels.size).toBe(0);
    savePlotterSnapshot(r.cpu, "c-traceur-droite-error");
  });

  it('"Cercle" draws a circle ring on plotter', () => {
    const r = compileAndRun(C_EXAMPLES[11].code, { maxCycles: 50_000_000 });
    expect(r.halted).toBe(true);
    // Should have drawn many pixels forming a ring
    expect(r.cpu.plotterPixels.size).toBeGreaterThan(200);
    // Center area (128,128) should NOT be drawn (d ≈ 0, not in 12..20 range)
    expect(hasPixel(r.cpu, 128, 128)).toBe(false);
    savePlotterSnapshot(r.cpu, "c-cercle");
  }, 15_000);

  it('"Clavier" draws triangle + laser with arrow keys', () => {
    // Simulate pressing RIGHT + ENTER — triangle moves, laser fires
    const r = compileAndRun(C_EXAMPLES[12].code, {
      maxCycles: 500_000,
      keyState: [0, 1, 0, 0, 1],
    });
    // while(1) loop — never halts
    expect(r.halted).toBe(false);
    // clear() each frame: triangle (4px) + laser (2px) = 6 max
    expect(r.cpu.plotterPixels.size).toBeLessThanOrEqual(6);
    waitForVisibleFrame(r.cpu);
    savePlotterSnapshot(r.cpu, "c-clavier-f1");
    r.cpu.keyState = [1, 0, 0, 0, 0];
    r.cpu.run(120_000);
    waitForVisibleFrame(r.cpu);
    savePlotterSnapshot(r.cpu, "c-clavier-f2");
    r.cpu.keyState = [0, 0, 1, 0, 1];
    r.cpu.run(120_000);
    waitForVisibleFrame(r.cpu);
    savePlotterSnapshot(r.cpu, "c-clavier-f3");
    r.cpu.keyState = [0, 1, 0, 0, 0];
    r.cpu.run(120_000);
    waitForVisibleFrame(r.cpu);
    savePlotterSnapshot(r.cpu, "c-clavier-f4");
  });

  it('"Horloge" starts at 00:00 and increments', () => {
    const r = compileAndRun(C_EXAMPLES[13].code, { maxCycles: 50_000_000 });
    const lines = r.output.split("\n").filter(Boolean);
    expect(lines[0]).toBe("00:00");
    expect(lines[1]).toBe("00:01");
    expect(lines[59]).toBe("00:59");
    expect(lines[60]).toBe("01:00");
    // Total: 60 minutes × 60 seconds = 3600 lines
    expect(lines).toHaveLength(3600);
    expect(r.halted).toBe(true);
  });

  it('"Spirale" draws spiral pixels and halts', () => {
    const r = compileAndRun(C_EXAMPLES[14].code);
    expect(r.halted).toBe(true);
    // Should have drawn many pixels
    expect(r.cpu.plotterPixels.size).toBeGreaterThan(500);
    // Starting point at (128, 128) should be drawn
    expect(hasPixel(r.cpu, 128, 128)).toBe(true);
    savePlotterSnapshot(r.cpu, "c-spirale");
  });

  it('"Tableau de nombres premiers" finds 25 primes up to 100', () => {
    const r = compileAndRun(C_EXAMPLES[15].code);
    expect(r.output).toContain("Nombres premiers:");
    expect(r.output).toContain("Total: 25");
    // Check a few known primes are present
    expect(r.output).toContain("2 ");
    expect(r.output).toContain("3 ");
    expect(r.output).toContain("97 ");
    expect(r.halted).toBe(true);
  });

  it('"Étoiles" draws random stars with break', () => {
    const r = compileAndRun(C_EXAMPLES[16].code, { maxCycles: 5_000_000 });
    expect(r.halted).toBe(true);
    expect(r.output).toContain("Stars: ");
    // Should have drawn pixels (random positions, some skipped by continue)
    expect(r.cpu.plotterPixels.size).toBeGreaterThan(0);
    expect(r.cpu.plotterPixels.size).toBeLessThanOrEqual(64);
    savePlotterSnapshot(r.cpu, "c-etoiles");
  });

  it('"Test Mémoire" tests memory zones and passes', () => {
    const r = compileAndRun(C_EXAMPLES[17].code);

    // Verify output
    expect(r.output).toContain("=MEM 2K=");
    expect(r.output).toContain("g0=42");
    expect(r.output).toContain("gf=15");
    expect(r.output).toContain("r1=57");
    expect(r.output).toContain("r2=5");
    expect(r.output).toContain("PASS");
    expect(r.output).not.toContain("FAIL");
    expect(r.halted).toBe(true);

    // Verify memory layout
    const ml = r.memoryLayout;
    expect(ml.globals).toBe(16); // all 16 global slots
    expect(ml.locals).toBeLessThan(100); // frames + scoped locals are now heavily reused
    expect(ml.scratch).toBe(8); // scratch always 8
    expect(ml.stackSize).toBe(2048); // stack is 2048 in 8K layout

    // Verify actual memory values after execution
    expect(r.cpu.state.memory[0x1000]).toBe(42); // g0
    expect(r.cpu.state.memory[0x100f]).toBe(15); // gf
    expect(r.cpu.state.sp).toBe(MEMORY_SIZE - 1); // stack restored (0x1FFF)
  });

  it('"Tableau (Tri)" sorts 8 elements correctly', () => {
    const example = C_EXAMPLES.find((e) => e.name === "Tableau (Tri)");
    expect(example).toBeDefined();
    const r = compileAndRun(example!.code, { maxCycles: 5_000_000 });
    expect(r.halted).toBe(true);
    expect(r.output).toContain("Avant: 64 25 12 22 11 90 33 44");
    expect(r.output).toContain("Apres: 11 12 22 25 33 44 64 90");
  });

  it('"Tableau (Nouvelles Fonctionnalites)" demonstrates array params and multi declarations', () => {
    const example = C_EXAMPLES.find(
      (e) => e.name === "Tableau (Nouvelles Fonctionnalites)",
    );
    expect(example).toBeDefined();
    const r = compileAndRun(example!.code, { maxCycles: 5_000_000 });
    expect(r.halted).toBe(true);
    expect(r.output).toContain("Avant: 42 7 19 ");
    expect(r.output).toContain("Trie: 7 19 42 ");
    expect(r.output).toContain("Somme: 68");
  });

  it('"Const et String" demonstrates const data, array initializers, and string declarations', () => {
    const example = C_EXAMPLES.find((e) => e.name === "Const et String");
    expect(example).toBeDefined();
    const r = compileAndRun(example!.code, { maxCycles: 5_000_000 });
    expect(r.halted).toBe(true);
    expect(r.output).toBe(
      "Base: hello 5/6\nPatch: hellA 5/6\nBuf: hi! 3/8\nData: 128 7 10 6\n",
    );
  });

  it('"Pong" runs game loop with plotter output', () => {
    // Simulate pressing DOWN key — player paddle moves
    const example = C_EXAMPLES.find((e) => e.name === "Pong");
    expect(example).toBeDefined();
    const r = compileAndRun(example!.code, {
      maxCycles: 500_000,
      keyState: [0, 0, 0, 1, 0],
    });
    // Game loop runs continuously — does not halt in limited cycles
    expect(r.halted).toBe(false);
    // Should have drawn pixels (paddles + ball)
    expect(r.cpu.plotterPixels.size).toBeGreaterThan(0);
    savePlotterSequence(r.cpu, "c-pong", 4, 180_000);
  });

  it('"Démo Ultime" combines console, keyboard, arrays, recursion and plotter', () => {
    const example = C_EXAMPLES.find((e) => e.name === "Démo Ultime");
    expect(example).toBeDefined();
    const r = compileAndRun(example!.code, {
      input: "7",
      keyState: [1, 0, 1, 0, 1],
      maxCycles: 5_000_000,
    });
    expect(r.halted).toBe(true);
    expect(r.output).toContain("=== DEMO ULTIME ===");
    expect(r.output).toContain("Entrez un chiffre 0-9: 7");
    expect(r.output).toContain("Mode clavier=21");
    expect(r.output).toContain("Somme recursive=28");
    expect(r.output).toContain("Brut: ");
    expect(r.output).toContain("Trie: ");
    expect(r.output).toContain("Checksum=");
    expect(r.output).toContain("FIN");
    expect(r.cpu.plotterPixels.size).toBeGreaterThan(100);
    savePlotterSnapshot(r.cpu, "c-demo-ultime");
  });

  it('"Calculatrice Graphique" draws a full-screen TI-style graph view', () => {
    const example = C_EXAMPLES.find((e) => e.name === "Calculatrice Graphique");
    expect(example).toBeDefined();

    const r = compileAndRun(example!.code, {
      input: "321",
      maxCycles: 5_000_000,
    });

    expect(r.halted).toBe(false);
    expect(r.output).toContain("=== TI GRAPH ===");
    expect(r.output).toContain("Y1 = A*(X/8)^2 + B*X + C");
    expect(r.output).toContain("TRACE L/R  ZOOM U/D  ENTER=STD");
    expect(r.cpu.plotterPixels.size).toBeGreaterThan(900);
    expect(hasPixel(r.cpu, 0, 0)).toBe(true);
    expect(hasPixel(r.cpu, 255, 255)).toBe(true);
    expect(hasPixel(r.cpu, 128, 128)).toBe(true);
    expect(hasPixel(r.cpu, 128, 124)).toBe(true);
    savePlotterSnapshot(r.cpu, "c-calculatrice-graphique");
  }, 10_000);

  it('"Mini Shell" supports vars, aggregates and RAM file redirection', () => {
    const example = C_EXAMPLES.find((e) => e.name === "Mini Shell");
    expect(example).toBeDefined();

    const r = compileAndRun(example!.code, {
      input:
        "vars\nset a=42\nset b=7\nset c=9\nadd\nmax\nmin\navg\ntouch f\nhi>f\ncat f\ntouch s\navg>s\ncat s\n",
      maxCycles: 3_000_000,
    });

    expect(r.halted).toBe(false);
    expect(r.output).toContain("=== MINI SHELL RAM ===");
    expect(r.output).toContain("(no vars)");
    expect(r.output).toContain("a=42");
    expect(r.output).toContain("58");
    expect(r.output).toContain("42");
    expect(r.output).toContain("7");
    expect(r.output).toContain("19.33");
    expect(r.output).toContain("created f");
    expect(r.output).toContain("hi");
    expect(r.output).toContain("created s");
    expect(r.output).toContain("19.33");
  });

  it('"Mini Shell" reports missing files and capacity limits', () => {
    const example = C_EXAMPLES.find((e) => e.name === "Mini Shell");
    expect(example).toBeDefined();

    const r = compileAndRun(example!.code, {
      input:
        "cat z\nx>z\ntouch a\ntouch b\ntouch c\ntouch d\ntouch e\ntouch a\nset a=1\nset b=2\nset c=3\nset d=4\nset e=5\nvars\n",
      maxCycles: 3_000_000,
    });

    expect(r.halted).toBe(false);
    expect(r.output).toContain("no file z");
    expect(r.output).toContain("created a");
    expect(r.output).toContain("created b");
    expect(r.output).toContain("created c");
    expect(r.output).toContain("created d");
    expect(r.output).toContain("file full");
    expect(r.output).toContain("exists a");
    expect(r.output).toContain("var full");
    expect(r.output).toContain("a=1");
    expect(r.output).toContain("b=2");
    expect(r.output).toContain("c=3");
    expect(r.output).toContain("d=4");
  });

  it('"FS Disque Externe" formats, writes and reads files on the drive', () => {
    const example = C_EXAMPLES.find((e) => e.name === "FS Disque Externe");
    expect(example).toBeDefined();

    const prog = assemble(`
      OUT 'O'
      OUT 'K'
      HLT
    `);
    expect(prog.success).toBe(true);
    const disk = writeProgramToBootDisk(new Uint8Array(DRIVE_SIZE), "program", prog.bytes);

    const r = compileAndRun(example!.code, {
      input: "ls\ntouch notes\nhello>notes\ncat notes\nls\nfree\n",
      maxCycles: 4_000_000,
      driveData: disk,
    });

    expect(r.halted).toBe(false);
    expect(r.output).toContain("=== FS DISQUE EXTERNE ===");
    expect(r.output).toContain("created notes");
    expect(r.output).toContain("saved notes");
    expect(r.output).toContain("hello");
    expect(r.output).toContain("p program 1p");
    expect(r.output).toContain("f notes 5b");
    expect(r.output).toContain("253p");
    expect(r.cpu.driveData[0]).toBe(66);
  }, 10_000);

  it('"FS Disque Externe" preserves program entries and handles busy/not-file/disk-full cases', () => {
    const example = C_EXAMPLES.find((e) => e.name === "FS Disque Externe");
    expect(example).toBeDefined();

    const prog = assemble(`
      OUT 'O'
      OUT 'K'
      HLT
    `);
    expect(prog.success).toBe(true);
    const disk = writeProgramToBootDisk(new Uint8Array(DRIVE_SIZE), "program", prog.bytes);

    const r = compileAndRun(example!.code, {
      input:
        "touch program\ncat program\nx>program\ntouch a\ntouch b\ntouch c\ntouch d\ntouch e\ntouch f\ntouch g\ntouch h\nls\nfree\n",
      maxCycles: 6_000_000,
      driveData: disk,
    });

    expect(r.halted).toBe(false);
    expect(r.output).toContain("busy");
    expect(r.output).toContain("not file");
    expect(r.output).toContain("created a");
    expect(r.output).toContain("created g");
    expect(r.output).toContain("disk full");
    expect(r.output).toContain("p program 1p");
    expect(r.output).toContain("f g 0b");
    expect(r.output).toContain("247p");
  }, 10_000);

  it('"Éditeur Texte FS" creates, edits, saves and reloads a disk file', () => {
    const example = C_EXAMPLES.find((e) => e.name === "Éditeur Texte FS");
    expect(example).toBeDefined();

    const prog = assemble(`
      OUT 'O'
      OUT 'K'
      HLT
    `);
    expect(prog.success).toBe(true);
    const disk = writeProgramToBootDisk(
      new Uint8Array(DRIVE_SIZE),
      "program",
      prog.bytes,
    );

    const r = compileAndRun(example!.code, {
      input: "hello\nworld\n\n/show\n@\n",
      maxCycles: 5_000_000,
      driveData: disk,
    });

    expect(r.halted).toBe(true);
    expect(r.output).toContain("=== EDITEUR TEXTE FS ===");
    expect(r.output).toContain("saved notes");
    expect(r.output).toContain("appended");
    expect(r.output).toContain("hello");
    expect(r.output).toContain("world");
    expect(r.cpu.driveData[0]).toBe(66);
  }, 10_000);

  it('"Éditeur Texte FS" reloads existing content, clears it, then saves new text', () => {
    const example = C_EXAMPLES.find((e) => e.name === "Éditeur Texte FS");
    expect(example).toBeDefined();

    const disk = writeFileToBootDisk(
      new Uint8Array(DRIVE_SIZE),
      "notes",
      new Uint8Array(Array.from("old\n").map((ch) => ch.charCodeAt(0))),
    );

    const r = compileAndRun(example!.code, {
      input: "/show\n/clear\n\n/show\nnew\n\n/show\n@\n",
      maxCycles: 5_000_000,
      driveData: disk,
    });

    expect(r.halted).toBe(true);
    expect(r.output).toContain("old");
    expect(r.output).toContain("buffer cleared");
    expect(r.output).toContain("(empty)");
    expect(r.output).toContain("new");

    const notes = readBootDiskEntries(r.cpu.driveData).find((entry) => entry.name === "notes");
    expect(notes?.sizeBytes).toBe(4);
    expect(Array.from(notes?.bytes.slice(0, 4) ?? [])).toEqual([
      "n".charCodeAt(0),
      "e".charCodeAt(0),
      "w".charCodeAt(0),
      10,
    ]);
  }, 10_000);

  it('"Éditeur Multi-fichier FS" opens, creates and saves different files', () => {
    const example = C_EXAMPLES.find((e) => e.name === "Éditeur Multi-fichier FS");
    expect(example).toBeDefined();

    const prog = assemble(`
      OUT 'O'
      OUT 'K'
      HLT
    `);
    expect(prog.success).toBe(true);
    const disk = writeProgramToBootDisk(
      new Uint8Array(DRIVE_SIZE),
      "program",
      prog.bytes,
    );

    const r = compileAndRun(example!.code, {
      input: "o notes\nhello\ns\no todo\nbuy milk\ns\nl\no notes\nv\n@\n",
      maxCycles: 5_000_000,
      driveData: disk,
    });

    expect(r.halted).toBe(true);
    expect(r.output).toContain("created notes");
    expect(r.output).toContain("saved notes");
    expect(r.output).toContain("created todo");
    expect(r.output).toContain("saved todo");
    expect(r.output).toContain("f notes 6b");
    expect(r.output).toContain("f todo 9b");
    expect(r.output).toContain("hello");
    expect(r.cpu.driveData[0]).toBe(66);
  }, 10_000);

  it('"Éditeur Multi-fichier FS" clears one file without touching another', () => {
    const example = C_EXAMPLES.find((e) => e.name === "Éditeur Multi-fichier FS");
    expect(example).toBeDefined();

    const r = compileAndRun(example!.code, {
      input: "o alpha\nAB\ns\no beta\nCD\ns\no alpha\nc\ns\no beta\nv\n@\n",
      maxCycles: 6_000_000,
      driveData: new Uint8Array(DRIVE_SIZE),
    });

    expect(r.halted).toBe(true);
    expect(r.output).toContain("created alpha");
    expect(r.output).toContain("created beta");
    expect(r.output).toContain("cleared alpha");
    expect(r.output).toContain("saved alpha");
    expect(r.output).toContain("[beta]");
    expect(r.output).toContain("CD");

    const entries = readBootDiskEntries(r.cpu.driveData);
    const alpha = entries.find((entry) => entry.name === "alpha");
    const beta = entries.find((entry) => entry.name === "beta");
    expect(alpha?.sizeBytes).toBe(0);
    expect(beta?.sizeBytes).toBe(3);
    expect(Array.from(beta?.bytes.slice(0, 3) ?? [])).toEqual([
      "C".charCodeAt(0),
      "D".charCodeAt(0),
      10,
    ]);
  }, 10_000);

  it('"Éditeur Multi-fichier FS" reports disk full but still reopens existing files', () => {
    const example = C_EXAMPLES.find((e) => e.name === "Éditeur Multi-fichier FS");
    expect(example).toBeDefined();

    let disk = new Uint8Array(DRIVE_SIZE);
    for (let i = 0; i < 8; i++) {
      disk = writeFileToBootDisk(
        disk,
        `f${i}`,
        new Uint8Array([65 + i]),
      );
    }

    const r = compileAndRun(example!.code, {
      input: "o extra\no f3\nv\n@\n",
      maxCycles: 5_000_000,
      driveData: disk,
    });

    expect(r.halted).toBe(true);
    expect(r.output).toContain("disk full");
    expect(r.output).toContain("opened f3");
    expect(r.output).toContain("[f3]");
  }, 10_000);

  it('"Éditeur Multi-fichier FS" moves the cursor with arrow keys before deleting', () => {
    const example = C_EXAMPLES.find((e) => e.name === "Éditeur Multi-fichier FS");
    expect(example).toBeDefined();

    const cr = compile(example!.code);
    expect(cr.success).toBe(true);
    const ar = assemble(cr.assembly);
    expect(ar.success).toBe(true);

    const prog = assemble(`
      OUT 'O'
      OUT 'K'
      HLT
    `);
    expect(prog.success).toBe(true);
    const disk = writeProgramToBootDisk(
      new Uint8Array(DRIVE_SIZE),
      "program",
      prog.bytes,
    );

    const cpu = new CPU();
    cpu.loadDriveData(disk);
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
    const runUntil = (predicate: () => boolean, limit = 1_000_000) => {
      for (let i = 0; i < limit && !cpu.state.halted; i++) {
        if (predicate()) return;
        cpu.step();
      }
      expect(predicate()).toBe(true);
    };
    const tapKey = (index: number) => {
      cpu.keyState[index] = 1;
      stepMany(20);
      cpu.keyState[index] = 0;
      stepMany(20);
    };

    pushText("o notes\nab\n");
    runUntil(() => cpu.consoleOutput.join("").includes("inserted"));

    tapKey(0);
    pushText("d\ns\n@\n");
    runUntil(() => cpu.state.halted);

    let notesBase = -1;
    for (let base = 16; base < 16 + 64 * 12; base += 12) {
      if (
        cpu.driveData[base + 0] === "n".charCodeAt(0) &&
        cpu.driveData[base + 1] === "o".charCodeAt(0) &&
        cpu.driveData[base + 2] === "t".charCodeAt(0) &&
        cpu.driveData[base + 3] === "e".charCodeAt(0) &&
        cpu.driveData[base + 4] === "s".charCodeAt(0)
      ) {
        notesBase = base;
        break;
      }
    }

    expect(notesBase).toBeGreaterThanOrEqual(0);
    recordConsoleOutput(cpu.consoleOutput.join(""), "interactive multi-file editor");
    const page = cpu.driveData[notesBase + 9];
    const size = cpu.driveData[notesBase + 11];
    expect(size).toBe(2);
    expect(cpu.driveData[(page << 8) + 0]).toBe("a".charCodeAt(0));
    expect(cpu.driveData[(page << 8) + 1]).toBe(10);
  }, 10_000);

  it('"Système Solaire 255" draws a sun and one orbiting planet', () => {
    const example = C_EXAMPLES.find((e) => e.name === "Système Solaire 255");
    expect(example).toBeDefined();

    const r = compileAndRun(example!.code, {
      maxCycles: 5_000_000,
    });

    expect(r.halted).toBe(false);
    expect(r.output).toContain("=== SOLAR 255 ===");
    expect(r.output).toContain("sun + orbiting planet");
    expect(r.output).toContain("@ quit");
    expect(r.cpu.plotterPixels.size).toBeGreaterThan(10);
    expect(hasPixel(r.cpu, 128, 128)).toBe(true);
    expect(hasPixel(r.cpu, 212, 128)).toBe(true);
    savePlotterSequence(r.cpu, "c-systeme-solaire-255", 5, 220_000);
  }, 10_000);
});

// ═══════════════════════════════════════════════════════════
//  Test suite: Compiler edge cases
// ═══════════════════════════════════════════════════════════

describe("Compiler — Edge Cases", () => {
  it("empty main halts immediately", () => {
    const r = compileAndRun(`int main() { return 0; }`);
    expect(r.output).toBe("");
    expect(r.halted).toBe(true);
  });

  it("global variable initialization", () => {
    const r = compileAndRun(`
      int x = 42;
      int main() {
        print_num(x);
        return 0;
      }
    `);
    expect(r.output).toBe("42");
    expect(r.halted).toBe(true);
  });

  it("function with multiple return paths", () => {
    const r = compileAndRun(`
      int abs(int x) {
        if (x < 128) { return x; }
        return 0 - x;
      }
      int main() {
        print_num(abs(5));
        putchar(32);
        print_num(abs(250));
        return 0;
      }
    `);
    expect(r.output).toBe("5 6");
    expect(r.halted).toBe(true);
  });

  it("nested function calls", () => {
    const r = compileAndRun(`
      int double(int x) { return x + x; }
      int quad(int x) { return double(double(x)); }
      int main() {
        print_num(quad(3));
        return 0;
      }
    `);
    expect(r.output).toBe("12");
    expect(r.halted).toBe(true);
  });

  it("recursion works correctly", () => {
    const r = compileAndRun(`
      int sum(int n) {
        if (n <= 0) { return 0; }
        return n + sum(n - 1);
      }
      int main() {
        print_num(sum(10));
        return 0;
      }
    `);
    // 1+2+...+10 = 55
    expect(r.output).toBe("55");
    expect(r.halted).toBe(true);
  });

  it("mutual recursion is detected and preserves correct results", () => {
    const ping = (n: number): number => (n === 0 ? 1 : u8(1 + pong(n - 1)));
    const pong = (n: number): number => {
      const b = u8(n + 1);
      return n === 0 ? b : u8(b + ping(n - 1));
    };
    const r = compileAndRun(`
      int pong(int n) {
        int b;
        b = n + 1;
        if (n == 0) { return b; }
        return b + ping(n - 1);
      }
      int ping(int n) {
        int a;
        a = n;
        if (n == 0) { return 1; }
        return 1 + pong(n - 1);
      }
      int main() {
        print_num(ping(40));
        return 0;
      }
    `);
    expect(r.output).toBe(String(ping(40)));
    expect(r.halted).toBe(true);
    expect(r.cpu.state.sp).toBe(MEMORY_SIZE - 1);
  });

  it("while loop with break condition", () => {
    const r = compileAndRun(`
      int main() {
        int x = 1;
        while (x < 100) {
          x = x + x;
        }
        print_num(x);
        return 0;
      }
    `);
    // 1→2→4→8→16→32→64→128 (128 >= 100, exits loop)
    expect(r.output).toBe("128");
    expect(r.halted).toBe(true);
  });

  it("for loop counts correctly", () => {
    const r = compileAndRun(`
      int main() {
        int i;
        int sum = 0;
        for (i = 1; i <= 5; i++) {
          sum = sum + i;
        }
        print_num(sum);
        return 0;
      }
    `);
    // 1+2+3+4+5 = 15
    expect(r.output).toBe("15");
    expect(r.halted).toBe(true);
  });

  it("compound assignment operators", () => {
    const r = compileAndRun(`
      int main() {
        int x = 10;
        x += 5;
        print_num(x);
        putchar(32);
        x -= 3;
        print_num(x);
        return 0;
      }
    `);
    expect(r.output).toBe("15 12");
    expect(r.halted).toBe(true);
  });

  it("postfix increment/decrement", () => {
    const r = compileAndRun(`
      int main() {
        int x = 5;
        print_num(x++);
        putchar(32);
        print_num(x);
        putchar(32);
        print_num(x--);
        putchar(32);
        print_num(x);
        return 0;
      }
    `);
    expect(r.output).toBe("5 6 6 5");
    expect(r.halted).toBe(true);
  });

  it("logical short-circuit skips side effects", () => {
    const r = compileAndRun(`
      int hit = 0;
      int bump() {
        hit = hit + 1;
        return 1;
      }
      int main() {
        print_num(0 && bump());
        putchar(32);
        print_num(hit);
        putchar(32);
        print_num(1 || bump());
        putchar(32);
        print_num(hit);
        return 0;
      }
    `);
    expect(r.output).toBe("0 0 1 0");
    expect(r.halted).toBe(true);
  });

  it("logical AND/OR operators", () => {
    const r = compileAndRun(`
      int main() {
        int a = 1;
        int b = 0;
        if (a && b) { putchar('Y'); } else { putchar('N'); }
        if (a || b) { putchar('Y'); } else { putchar('N'); }
        if (!a)     { putchar('Y'); } else { putchar('N'); }
        if (!b)     { putchar('Y'); } else { putchar('N'); }
        return 0;
      }
    `);
    expect(r.output).toBe("NYNY");
    expect(r.halted).toBe(true);
  });

  it(">= and > comparison operators", () => {
    const r = compileAndRun(`
      int main() {
        int x = 5;
        if (x >= 5)  { putchar('Y'); } else { putchar('N'); }
        if (x >= 3)  { putchar('Y'); } else { putchar('N'); }
        if (x >= 10) { putchar('Y'); } else { putchar('N'); }
        if (x > 3)   { putchar('Y'); } else { putchar('N'); }
        if (x > 5)   { putchar('Y'); } else { putchar('N'); }
        if (x > 10)  { putchar('Y'); } else { putchar('N'); }
        return 0;
      }
    `);
    // >= : 5>=5=Y, 5>=3=Y, 5>=10=N | > : 5>3=Y, 5>5=N, 5>10=N
    expect(r.output).toBe("YYNYNN");
    expect(r.halted).toBe(true);
  });

  it("<= and < comparison operators", () => {
    const r = compileAndRun(`
      int main() {
        int x = 5;
        if (x <= 5)  { putchar('Y'); } else { putchar('N'); }
        if (x <= 10) { putchar('Y'); } else { putchar('N'); }
        if (x <= 3)  { putchar('Y'); } else { putchar('N'); }
        if (x < 10)  { putchar('Y'); } else { putchar('N'); }
        if (x < 5)   { putchar('Y'); } else { putchar('N'); }
        return 0;
      }
    `);
    // <= : Y, Y, N | < : Y, N
    expect(r.output).toBe("YYNYN");
    expect(r.halted).toBe(true);
  });

  it("multiply and divide", () => {
    const r = compileAndRun(`
      int main() {
        print_num(7 * 8);
        putchar(32);
        print_num(100 / 7);
        putchar(32);
        print_num(100 % 7);
        return 0;
      }
    `);
    expect(r.output).toBe("56 14 2");
    expect(r.halted).toBe(true);
  });

  it("unsigned division with large dividends (>= 128)", () => {
    // Bug fix: JN→JC in emitDivMod — JN treated results >= 128 as negative
    const r = compileAndRun(`
      int main() {
        print_num(130 / 2);   // 65: was returning 0 (130-2=128, bit7 set → JN fired)
        putchar(32);
        print_num(200 / 4);   // 50
        putchar(32);
        print_num(255 / 5);   // 51
        putchar(32);
        print_num(128 / 1);   // 128
        putchar(32);
        print_num(200 % 3);   // 2 (200 = 66*3 + 2)
        return 0;
      }
    `);
    expect(r.output).toBe("65 50 51 128 2");
    expect(r.halted).toBe(true);
  });

  it("#define preprocessor works", () => {
    const r = compileAndRun(`
      #define VAL 42
      #define MSG "hello"
      int main() {
        print_num(VAL);
        putchar(32);
        print(MSG);
        return 0;
      }
    `);
    expect(r.output).toBe("42 hello");
    expect(r.halted).toBe(true);
  });

  it("char literals work", () => {
    const r = compileAndRun(`
      int main() {
        putchar('A');
        putchar('B');
        putchar('C');
        return 0;
      }
    `);
    expect(r.output).toBe("ABC");
    expect(r.halted).toBe(true);
  });

  it("getchar reads input correctly", () => {
    const r = compileAndRun(
      `
      int main() {
        int c;
        c = getchar();
        putchar(c);
        c = getchar();
        putchar(c);
        return 0;
      }
    `,
      { input: "XY" },
    );
    expect(r.output).toBe("XY");
    expect(r.halted).toBe(true);
  });

  it("HTTP GET streams response bytes through gethttpchar()", async () => {
    const r = await compileAndRunAsync(
      `
      int main() {
        int c;
        get("https://example.com/todos/1");
        while ((c = gethttpchar()) != 0) {
          putchar(c);
        }
        return 0;
      }
    `,
      {
        httpFetch: async ({ method, url }) => {
          expect(method).toBe("GET");
          expect(url).toBe("https://example.com/todos/1");
          return "OK";
        },
      },
    );

    expect(r.output).toBe("OK");
    expect(r.halted).toBe(true);
  });

  it('"Meteo Ales" fetches weather and draws on the plotter', async () => {
    const weatherExample = C_EXAMPLES.find((example) => example.name === "Meteo Ales");
    expect(weatherExample).toBeDefined();

    const r = await compileAndRunAsync(weatherExample!.code, {
      maxCycles: 1_900_000,
      driveData: getLinuxBootDiskImage(),
      httpFetch: async ({ method, url }) => {
        expect(method).toBe("GET");
        expect(url).toContain("api.open-meteo.com");
        return '{"latitude":44.12,"longitude":4.08,"generationtime_ms":0.1,"utc_offset_seconds":3600,"timezone":"Europe/Paris","timezone_abbreviation":"GMT+1","elevation":130.0,"current_units":{"time":"iso8601","interval":"seconds","temperature_2m":"°C","is_day":"","weather_code":"wmo code"},"current":{"time":"2026-03-18T17:00","interval":900,"temperature_2m":11.4,"is_day":1,"weather_code":61}}';
      },
    });

    expect(r.output).toBe(">T+11 61\n");
    expect(r.halted).toBe(true);
    expect(r.cpu.plotterPixels.size).toBeGreaterThan(500);
    expect(pixelColor(r.cpu, 36, 126)).toBe(packPlotterColor(248, 248, 252));
    expect(pixelColor(r.cpu, 44, 126)).toBe(packPlotterColor(248, 248, 252));
    savePlotterSnapshot(r.cpu, "c-meteo-ales");
  });

  it("getKey returns 0 when no key pressed", () => {
    const r = compileAndRun(`
      int main() {
        int k;
        k = getKey(0);
        print_num(k);
        putchar(32);
        k = getKey(4);
        print_num(k);
        return 0;
      }
    `);
    expect(r.output).toBe("0 0");
    expect(r.halted).toBe(true);
  });

  it("getKey returns 1 when key is pressed", () => {
    const r = compileAndRun(
      `
      int main() {
        int k;
        k = getKey(0);
        print_num(k);
        putchar(32);
        k = getKey(2);
        print_num(k);
        return 0;
      }
    `,
      { keyState: [1, 0, 1, 0, 0] },
    );
    expect(r.output).toBe("1 1");
    expect(r.halted).toBe(true);
  });

  it("color built-in latches RGB values for subsequent draw calls", () => {
    const r = compileAndRun(`
      int main() {
        color(0, 128, 255);
        draw(10, 20);
        color(255, 64, 0);
        draw(11, 20);
        draw(12, 20);
        return 0;
      }
    `);
    expect(r.halted).toBe(true);
    expect(pixelColor(r.cpu, 10, 20)).toBe(packPlotterColor(0, 128, 255));
    expect(pixelColor(r.cpu, 11, 20)).toBe(packPlotterColor(255, 64, 0));
    expect(pixelColor(r.cpu, 12, 20)).toBe(packPlotterColor(255, 64, 0));
    savePlotterSnapshot(r.cpu, "c-color-built-in");
  });

  it("stack pointer is restored after function calls", () => {
    const r = compileAndRun(`
      int add(int a, int b) { return a + b; }
      int main() {
        int x;
        x = add(1, 2);
        x = add(3, 4);
        x = add(5, 6);
        print_num(x);
        return 0;
      }
    `);
    expect(r.output).toBe("11");
    expect(r.halted).toBe(true);
    // SP should be back to 0x1FFF (empty stack)
    expect(r.cpu.state.sp).toBe(MEMORY_SIZE - 1);
  });

  it("max-depth simple recursion reaches 256 calls and restores the stack", () => {
    const r = compileAndRun(`
      int hit = 0;
      int wraps = 0;
      int dive(int n) {
        hit = hit + 1;
        if (hit == 0) {
          wraps = wraps + 1;
        }
        if (n == 0) {
          return 0;
        }
        return dive(n - 1);
      }
      int main() {
        dive(255);
        print_num(hit);
        putchar(32);
        print_num(wraps);
        return 0;
      }
    `, { maxCycles: 5_000_000 });
    expect(r.output).toBe("0 1");
    expect(r.halted).toBe(true);
    expect(r.cpu.state.sp).toBe(MEMORY_SIZE - 1);
  });

  it("deep recursion with a large local frame still computes the wrapped result correctly", () => {
    const r = compileAndRun(`
      int hit = 0;
      int wraps = 0;
      int dive(int n) {
        int buf[6];
        buf[0] = n;
        buf[1] = n + 1;
        buf[2] = n + 2;
        buf[3] = n + 3;
        buf[4] = n + 4;
        buf[5] = n + 5;
        hit = hit + 1;
        if (hit == 0) {
          wraps = wraps + 1;
        }
        if (n == 0) {
          return buf[0];
        }
        return buf[1] + dive(n - 1);
      }
      int main() {
        print_num(dive(255));
        putchar(32);
        print_num(hit);
        putchar(32);
        print_num(wraps);
        return 0;
      }
    `, { maxCycles: 10_000_000 });
    expect(r.output).toBe("127 0 1");
    expect(r.halted).toBe(true);
    expect(r.cpu.state.sp).toBe(MEMORY_SIZE - 1);
  });

  it("very deep recursion with a huge local frame has no runtime stack-overflow protection yet", () => {
    const r = compileAndRun(`
      int hit = 0;
      int wraps = 0;
      int dive(int n) {
        int buf[48];
        int i;
        for (i = 0; i < 48; i++) {
          buf[i] = n + i;
        }
        hit = hit + 1;
        if (hit == 0) {
          wraps = wraps + 1;
        }
        if (n == 0) {
          return buf[0];
        }
        return buf[1] + dive(n - 1);
      }
      int main() {
        print_num(dive(255));
        putchar(32);
        print_num(hit);
        putchar(32);
        print_num(wraps);
        return 0;
      }
    `, { maxCycles: 50_000_000 });
    expect(r.halted).toBe(true);
    expect(r.cpu.state.sp).not.toBe(MEMORY_SIZE - 1);
    expect(/^[0-9 ]*$/u.test(r.output)).toBe(false);
  });

  it("recursive array copy-back still works across many recursive calls", () => {
    const r = compileAndRun(`
      int walk(int n, int values[2]) {
        values[0] = values[0] + 1;
        values[1] = values[1] + 2;
        if (n == 0) {
          return values[0] + values[1];
        }
        return walk(n - 1, values);
      }
      int main() {
        int data[2];
        data[0] = 0;
        data[1] = 0;
        print_num(walk(60, data));
        putchar(32);
        print_num(data[0]);
        putchar(32);
        print_num(data[1]);
        return 0;
      }
    `, { maxCycles: 10_000_000 });
    expect(r.output).toBe("183 61 122");
    expect(r.halted).toBe(true);
    expect(r.cpu.state.sp).toBe(MEMORY_SIZE - 1);
  });

  it("supports multiple local declarations in one statement", () => {
    const r = compileAndRun(`
      int main() {
        int a = 2, b = 3, c;
        c = a + b;
        print_num(c);
        return 0;
      }
    `);
    expect(r.output).toBe("5");
    expect(r.halted).toBe(true);
  });

  it("supports multiple global declarations in one statement", () => {
    const r = compileAndRun(`
      int g0 = 4, g1 = 7;
      int main() {
        print_num(g0 + g1);
        return 0;
      }
    `);
    expect(r.output).toBe("11");
    expect(r.halted).toBe(true);
  });

  it("supports multiple declarations in for-loop init", () => {
    const r = compileAndRun(`
      int main() {
        int total;
        total = 0;
        for (int i = 0, j = 3; i < 3; i++) {
          total = total + i + j;
          j = j - 1;
        }
        print_num(total);
        return 0;
      }
    `);
    expect(r.output).toBe("9");
    expect(r.halted).toBe(true);
  });

  it("reuses frame memory across unrelated functions", () => {
    const cr = compile(`
      int f() {
        int a;
        a = 1;
        return a;
      }
      int g() {
        int b;
        b = 2;
        return b;
      }
      int main() {
        print_num(f() + g());
        return 0;
      }
    `);
    expect(cr.success).toBe(true);
    expect(cr.memoryLayout!.locals).toBeLessThanOrEqual(2);
  });

  it("reuses block-local slots across branches", () => {
    const cr = compile(`
      int main() {
        if (1) {
          int a;
          a = 7;
          print_num(a);
        } else {
          int b;
          b = 9;
          print_num(b);
        }
        return 0;
      }
    `);
    expect(cr.success).toBe(true);
    expect(cr.memoryLayout!.locals).toBe(1);
  });

  it("bitwise expressions still work with shared lowering", () => {
    const r = compileAndRun(`
      int main() {
        print_num((13 & 10) | 1);
        putchar(32);
        print_num(13 ^ 10);
        return 0;
      }
    `);
    expect(r.output).toBe("9 7");
    expect(r.halted).toBe(true);
  });

  it("division and modulo by zero follow the CPU semantics and return 0", () => {
    const r = compileAndRun(`
      int main() {
        print_num(7 / 0);
        putchar(32);
        print_num(7 % 0);
        return 0;
      }
    `);
    expect(r.output).toBe("0 0");
    expect(r.halted).toBe(true);
  });

  it("large wrapped arithmetic expressions stay correct", () => {
    const expectedLeft = u8(u8(200 * 200) + u8(250 - 10));
    const expectedMid = Math.floor(u8(200 * 200) / 7) & 0xff;
    const expectedRight = u8(u8(200 + 200) + 200);
    const r = compileAndRun(`
      int main() {
        print_num((200 * 200) + (250 - 10));
        putchar(32);
        print_num((200 * 200) / 7);
        putchar(32);
        print_num(200 + 200 + 200);
        return 0;
      }
    `);
    expect(r.output).toBe(`${expectedLeft} ${expectedMid} ${expectedRight}`);
    expect(r.halted).toBe(true);
  });

  it("large arithmetic checksums stay correct across multiply divide modulo and shifts", () => {
    let mul = 0;
    let div = 0;
    let mod = 0;
    let shl = 0;
    let shr = 0;
    for (let i = 0; i < 16; i++) {
      for (let j = 1; j < 16; j++) {
        mul = u8(mul + u8(i * j));
        div = u8(div + (Math.floor(u8(i * 17 + j) / j) & 0xff));
        mod = u8(mod + (u8(i * 17 + j) % j));
      }
    }
    for (let i = 0; i < 8; i++) {
      shl = u8(shl + u8(13 << i));
      shr = u8(shr + ((240 >> i) & 0xff));
    }

    const r = compileAndRun(`
      int main() {
        int i;
        int j;
        int mul = 0;
        int div = 0;
        int mod = 0;
        int shl = 0;
        int shr = 0;
        for (i = 0; i < 16; i++) {
          for (j = 1; j < 16; j++) {
            mul = mul + (i * j);
            div = div + ((i * 17 + j) / j);
            mod = mod + ((i * 17 + j) % j);
          }
        }
        for (i = 0; i < 8; i++) {
          shl = shl + (13 << i);
          shr = shr + (240 >> i);
        }
        print_num(mul);
        putchar(32);
        print_num(div);
        putchar(32);
        print_num(mod);
        putchar(32);
        print_num(shl);
        putchar(32);
        print_num(shr);
        return 0;
      }
    `, { maxCycles: 10_000_000 });
    expect(r.output).toBe(`${mul} ${div} ${mod} ${shl} ${shr}`);
    expect(r.halted).toBe(true);
  });

  it("16 globals are allowed", () => {
    const source = `
      int a;int b;int c;int d;int e;int f;int g;int h;
      int i;int j;int k;int l;int m;int n;int o;int p;
      int main() {
        a=1;b=2;c=3;d=4;e=5;f=6;g=7;h=8;
        i=9;j=10;k=11;l=12;m=13;n=14;o=15;p=16;
        print_num(a+p);
        return 0;
      }
    `;
    const r = compileAndRun(source);
    expect(r.output).toBe("17");
    expect(r.halted).toBe(true);
    expect(r.memoryLayout.globals).toBe(16);
  });

  it("17th global produces an error", () => {
    const source = `
      int a;int b;int c;int d;int e;int f;int g;int h;
      int i;int j;int k;int l;int m;int n;int o;int p;
      int q;
      int main() { return 0; }
    `;
    const cr = compile(source);
    expect(cr.success).toBe(false);
    expect(cr.errors.some((e) => e.message.includes("max 16"))).toBe(true);
  });

  it("break exits while loop early", () => {
    const r = compileAndRun(`
      int main() {
        int i = 0;
        while (1) {
          if (i >= 5) { break; }
          i = i + 1;
        }
        print_num(i);
        return 0;
      }
    `);
    expect(r.output).toBe("5");
    expect(r.halted).toBe(true);
  });

  it("break exits for loop early", () => {
    const r = compileAndRun(`
      int main() {
        int i;
        int sum = 0;
        for (i = 0; i < 100; i++) {
          if (i >= 5) { break; }
          sum = sum + i;
        }
        print_num(sum);
        putchar(32);
        print_num(i);
        return 0;
      }
    `);
    // sum = 0+1+2+3+4 = 10, i = 5 when break fires
    expect(r.output).toBe("10 5");
    expect(r.halted).toBe(true);
  });

  it("continue skips to next iteration in while loop", () => {
    const r = compileAndRun(`
      int main() {
        int i = 0;
        int sum = 0;
        while (i < 10) {
          i = i + 1;
          if (i == 3) { continue; }
          if (i == 7) { continue; }
          sum = sum + i;
        }
        print_num(sum);
        return 0;
      }
    `);
    // 1+2+4+5+6+8+9+10 = 45 (skipped 3 and 7)
    expect(r.output).toBe("45");
    expect(r.halted).toBe(true);
  });

  it("continue in for loop jumps to update", () => {
    const r = compileAndRun(`
      int main() {
        int i;
        int sum = 0;
        for (i = 0; i < 10; i++) {
          if (i == 3) { continue; }
          if (i == 7) { continue; }
          sum = sum + i;
        }
        print_num(sum);
        return 0;
      }
    `);
    // 0+1+2+4+5+6+8+9 = 35 (skipped 3 and 7)
    expect(r.output).toBe("35");
    expect(r.halted).toBe(true);
  });

  it("nested break only exits inner loop", () => {
    const r = compileAndRun(`
      int main() {
        int i = 0;
        int j;
        int count = 0;
        while (i < 3) {
          j = 0;
          while (1) {
            if (j >= 2) { break; }
            count = count + 1;
            j = j + 1;
          }
          i = i + 1;
        }
        print_num(count);
        return 0;
      }
    `);
    // 3 outer iterations × 2 inner iterations = 6
    expect(r.output).toBe("6");
    expect(r.halted).toBe(true);
  });

  it("break outside loop produces error", () => {
    const cr = compile(`
      int main() {
        break;
        return 0;
      }
    `);
    expect(cr.success).toBe(false);
    expect(cr.errors.some((e) => e.message.includes("boucle"))).toBe(true);
  });

  it("continue outside loop produces error", () => {
    const cr = compile(`
      int main() {
        continue;
        return 0;
      }
    `);
    expect(cr.success).toBe(false);
    expect(cr.errors.some((e) => e.message.includes("boucle"))).toBe(true);
  });

  it("rand() returns pseudo-random values", () => {
    const r = compileAndRun(`
      int main() {
        int a;
        int b;
        int c;
        a = rand();
        b = rand();
        c = rand();
        // All three should be different (LFSR sequence)
        if (a != b) { putchar('Y'); } else { putchar('N'); }
        if (b != c) { putchar('Y'); } else { putchar('N'); }
        if (a != c) { putchar('Y'); } else { putchar('N'); }
        return 0;
      }
    `);
    expect(r.output).toBe("YYY");
    expect(r.halted).toBe(true);
  });

  it("rand() values are in 0-255 range", () => {
    const r = compileAndRun(`
      int main() {
        int i;
        int v;
        int ok = 1;
        for (i = 0; i < 20; i++) {
          v = rand();
          if (v > 255) { ok = 0; }
        }
        if (ok) { putchar('Y'); } else { putchar('N'); }
        return 0;
      }
    `);
    expect(r.output).toBe("Y");
    expect(r.halted).toBe(true);
  });

  it("sleep() delays execution by N cycles", () => {
    // Run two programs: one with sleep, one without, compare cycle counts
    const r1 = compileAndRun(`
      int main() {
        return 0;
      }
    `);
    const r2 = compileAndRun(`
      int main() {
        sleep(100);
        return 0;
      }
    `);
    // sleep(100) should add ~100 cycles
    expect(r2.cycles - r1.cycles).toBeGreaterThanOrEqual(100);
    expect(r2.halted).toBe(true);
  });

  it("external drive builtins read, write and clear bytes", () => {
    const r = compileAndRun(`
      int main() {
        drive_clear();
        drive_write(10, 65);
        drive_write(11, 66);
        putchar(drive_read(10));
        putchar(drive_read(11));
        drive_clear();
        print_num(drive_read(10));
        return 0;
      }
    `);
    expect(r.output).toBe("AB0");
    expect(r.halted).toBe(true);
    expect(r.cpu.driveData[10]).toBe(0);
    expect(r.cpu.driveData[11]).toBe(0);
  });

  it("console_clear() clears prior console output", () => {
    const r = compileAndRun(`
      int main() {
        print("abc");
        console_clear();
        print("Z");
        return 0;
      }
    `);
    expect(r.output).toBe("Z");
    expect(r.halted).toBe(true);
  });

  it("external drive page builtins can access the full 64K disk", () => {
    const r = compileAndRun(`
      int main() {
        drive_clear();
        drive_write(10, 65);
        drive_set_page(1);
        drive_write(10, 66);
        putchar(drive_read(10));
        drive_set_page(0);
        putchar(drive_read(10));
        putchar(drive_read_at(1, 10));
        drive_write_at(255, 255, 90);
        drive_set_page(255);
        putchar(drive_read(255));
        return 0;
      }
    `);
    expect(r.output).toBe("BABZ");
    expect(r.halted).toBe(true);
    expect(r.cpu.driveData[10]).toBe(65);
    expect(r.cpu.driveData[256 + 10]).toBe(66);
    expect(r.cpu.driveData[65535]).toBe(90);
  });

  it("code size overflow is detected", () => {
    // Generate a program that's way too big (lots of print statements)
    // Each print("AAAAAAAAAA") = 10 × OUT (3 bytes) = 30 bytes
    // 200 × 30 = 6000 bytes > 4096 CODE_SIZE
    let code = "int main() {\n";
    for (let i = 0; i < 200; i++) {
      code += `  print("AAAAAAAAAA");\n`;
    }
    code += "  return 0;\n}";

    const cr = compile(code);
    expect(cr.success).toBe(true); // compile succeeds

    const ar = assemble(cr.assembly);
    expect(ar.success).toBe(false); // but assembly catches overflow
    expect(ar.errors.some((e) => e.message.includes("trop grand"))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
//  Test suite: Arrays
// ═══════════════════════════════════════════════════════════

describe("Compiler — Arrays", () => {
  it("basic array write and read", () => {
    const r = compileAndRun(`
      int main() {
        int a[3];
        a[0] = 10;
        a[1] = 20;
        a[2] = 30;
        print_num(a[0]);
        putchar(32);
        print_num(a[1]);
        putchar(32);
        print_num(a[2]);
        return 0;
      }
    `);
    expect(r.output).toBe("10 20 30");
    expect(r.halted).toBe(true);
  });

  it("array fill and read in loop", () => {
    const r = compileAndRun(`
      int main() {
        int arr[5];
        int i;
        for (i = 0; i < 5; i++) {
          arr[i] = i * 3;
        }
        for (i = 0; i < 5; i++) {
          print_num(arr[i]);
          putchar(32);
        }
        return 0;
      }
    `);
    expect(r.output).toBe("0 3 6 9 12 ");
    expect(r.halted).toBe(true);
  });

  it("complex index expression arr[j+1]", () => {
    const r = compileAndRun(`
      int main() {
        int a[4];
        int j;
        a[0] = 10;
        a[1] = 20;
        a[2] = 30;
        a[3] = 40;
        for (j = 0; j < 3; j++) {
          print_num(a[j + 1]);
          putchar(32);
        }
        return 0;
      }
    `);
    expect(r.output).toBe("20 30 40 ");
    expect(r.halted).toBe(true);
  });

  it("global array", () => {
    const r = compileAndRun(`
      int g[3];
      int main() {
        g[0] = 100;
        g[1] = 200;
        g[2] = 50;
        print_num(g[0]);
        putchar(32);
        print_num(g[1]);
        putchar(32);
        print_num(g[2]);
        return 0;
      }
    `);
    expect(r.output).toBe("100 200 50");
    expect(r.halted).toBe(true);
  });

  it("local array in function", () => {
    const r = compileAndRun(`
      int sum3(int x, int y, int z) {
        int buf[3];
        buf[0] = x;
        buf[1] = y;
        buf[2] = z;
        return buf[0] + buf[1] + buf[2];
      }
      int main() {
        print_num(sum3(10, 20, 30));
        return 0;
      }
    `);
    expect(r.output).toBe("60");
    expect(r.halted).toBe(true);
  });

  it("global array accessed from function", () => {
    const r = compileAndRun(`
      int data[3];
      void fill() {
        data[0] = 5;
        data[1] = 10;
        data[2] = 15;
      }
      int main() {
        fill();
        print_num(data[0] + data[1] + data[2]);
        return 0;
      }
    `);
    expect(r.output).toBe("30");
    expect(r.halted).toBe(true);
  });

  it("array parameter can be read inside a function", () => {
    const r = compileAndRun(`
      int sum2(int values[2]) {
        return values[0] + values[1];
      }
      int main() {
        int data[2];
        data[0] = 7;
        data[1] = 9;
        print_num(sum2(data));
        return 0;
      }
    `);
    expect(r.output).toBe("16");
    expect(r.halted).toBe(true);
  });

  it("array parameter writes are copied back to the caller array", () => {
    const r = compileAndRun(`
      void bump(int values[3]) {
        values[1] = values[1] + 5;
      }
      int main() {
        int data[3];
        data[0] = 10;
        data[1] = 20;
        data[2] = 30;
        bump(data);
        print_num(data[0]);
        putchar(32);
        print_num(data[1]);
        putchar(32);
        print_num(data[2]);
        return 0;
      }
    `);
    expect(r.output).toBe("10 25 30");
    expect(r.halted).toBe(true);
  });

  it("passing the same array to two array parameters follows copy-in copy-back semantics, not C pointer aliasing", () => {
    const r = compileAndRun(`
      void touch(int a[2], int b[2]) {
        a[0] = 11;
        b[1] = 22;
      }
      int main() {
        int data[2];
        data[0] = 1;
        data[1] = 2;
        touch(data, data);
        print_num(data[0]);
        putchar(32);
        print_num(data[1]);
        return 0;
      }
    `);
    expect(r.output).toBe("1 22");
    expect(r.halted).toBe(true);
  });

  it("copy-back order for aliased array parameters can overwrite an earlier parameter update", () => {
    const r = compileAndRun(`
      void mix(int a[2], int b[2]) {
        a[0] = 7;
        b[0] = 9;
      }
      int main() {
        int data[2];
        data[0] = 1;
        data[1] = 2;
        mix(data, data);
        print_num(data[0]);
        putchar(32);
        print_num(data[1]);
        return 0;
      }
    `);
    expect(r.output).toBe("9 2");
    expect(r.halted).toBe(true);
  });

  it("array parameters reject pointer-like expressions such as data + 1", () => {
    const cr = compile(`
      void bad(int a[2], int b[2]) {}
      int main() {
        int data[2];
        bad(data + 1, data);
        return 0;
      }
    `);
    expect(cr.success).toBe(false);
    expect(
      cr.errors.some((error) =>
        error.message.includes("Un argument de tableau doit être le nom d'un tableau déclaré"),
      ),
    ).toBe(true);
  });

  it("postfix increment in an array index keeps the old index and updates the variable", () => {
    const r = compileAndRun(`
      int main() {
        int values[3];
        int i = 0;
        values[i++] = 7;
        values[i] = 9;
        print_num(i);
        putchar(32);
        print_num(values[0]);
        putchar(32);
        print_num(values[1]);
        return 0;
      }
    `);
    expect(r.output).toBe("1 7 9");
    expect(r.halted).toBe(true);
  });

  it("array parameter works from a recursive caller frame", () => {
    const r = compileAndRun(`
      void bump(int values[2]) {
        values[0] = values[0] + 1;
      }
      int recur(int n) {
        int local[2];
        local[0] = n;
        local[1] = 0;
        bump(local);
        if (n == 0) {
          return local[0];
        }
        return local[0] + recur(n - 1);
      }
      int main() {
        print_num(recur(2));
        return 0;
      }
    `);
    expect(r.output).toBe("6");
    expect(r.halted).toBe(true);
  });

  it("swap via array (bubble sort pattern)", () => {
    const r = compileAndRun(`
      int main() {
        int a[2];
        int tmp;
        a[0] = 99;
        a[1] = 11;
        if (a[0] > a[1]) {
          tmp = a[0];
          a[0] = a[1];
          a[1] = tmp;
        }
        print_num(a[0]);
        putchar(32);
        print_num(a[1]);
        return 0;
      }
    `);
    expect(r.output).toBe("11 99");
    expect(r.halted).toBe(true);
  });

  // ─── Error cases ───

  it("array size 0 is rejected", () => {
    const cr = compile(`
      int main() {
        int a[0];
        return 0;
      }
    `);
    expect(cr.success).toBe(false);
    expect(cr.errors.some((e) => e.message.includes("taille"))).toBe(true);
  });

  it("global array too large is rejected", () => {
    const cr = compile(`
      int big[17];
      int main() { return 0; }
    `);
    expect(cr.success).toBe(false);
    expect(cr.errors.some((e) => e.message.includes("globale"))).toBe(true);
  });

  it("array name without index is rejected", () => {
    const cr = compile(`
      int main() {
        int a[3];
        int x;
        x = a;
        return 0;
      }
    `);
    expect(cr.success).toBe(false);
    expect(cr.errors.some((e) => e.message.includes("tableau"))).toBe(true);
  });

  it("index on non-array variable is rejected", () => {
    const cr = compile(`
      int main() {
        int x;
        x = 5;
        print_num(x[0]);
        return 0;
      }
    `);
    expect(cr.success).toBe(false);
    expect(
      cr.errors.some(
        (e) => e.message.includes("tableau") || e.message.includes("Tableau"),
      ),
    ).toBe(true);
  });

  it("postfix increment on an array element is rejected instead of silently miscompiling", () => {
    const cr = compile(`
      int main() {
        int values[2];
        values[0] = 5;
        print_num(values[0]++);
        return 0;
      }
    `);
    expect(cr.success).toBe(false);
    expect(cr.errors.some((e) => e.message.includes("variable simple"))).toBe(true);
  });

  it("prefix increment on an array element is rejected instead of silently miscompiling", () => {
    const cr = compile(`
      int main() {
        int values[2];
        values[0] = 5;
        print_num(++values[0]);
        return 0;
      }
    `);
    expect(cr.success).toBe(false);
    expect(cr.errors.some((e) => e.message.includes("variable simple"))).toBe(true);
  });

  it("prefix increment on a function call is rejected", () => {
    const cr = compile(`
      int one() { return 1; }
      int main() {
        print_num(++one());
        return 0;
      }
    `);
    expect(cr.success).toBe(false);
    expect(cr.errors.some((e) => e.message.includes("variable simple"))).toBe(true);
  });

  it("array initializer works for local arrays", () => {
    const r = compileAndRun(`
      int main() {
        int a[4] = {1, 2, 3};
        print_num(a[0]);
        putchar(32);
        print_num(a[1]);
        putchar(32);
        print_num(a[2]);
        putchar(32);
        print_num(a[3]);
        return 0;
      }
    `);
    expect(r.output).toBe("1 2 3 0");
    expect(r.halted).toBe(true);
  });

  it("const global data and arrays initialize correctly", () => {
    const r = compileAndRun(`
      const int digits[10] = {48,49,50,51,52,53,54,55,56,57};
      const int palette[3] = {0, 128, 255};
      const int msg_len = 5;

      int main() {
        print_num(digits[0]);
        putchar(32);
        print_num(digits[9]);
        putchar(32);
        print_num(palette[1]);
        putchar(32);
        print_num(msg_len);
        return 0;
      }
    `);
    expect(r.output).toBe("48 57 128 5");
    expect(r.halted).toBe(true);
  });

  it("global array initializer works", () => {
    const r = compileAndRun(`
      int values[4] = {9, 8, 7, 6};
      int main() {
        print_num(values[0]);
        putchar(32);
        print_num(values[3]);
        return 0;
      }
    `);
    expect(r.output).toBe("9 6");
    expect(r.halted).toBe(true);
  });

  it("string declaration stores a zero-terminated character array", () => {
    const r = compileAndRun(`
      int main() {
        string msg = "hello";
        int i;
        i = 0;
        while (msg[i] != 0) {
          putchar(msg[i]);
          i = i + 1;
        }
        return 0;
      }
    `);
    expect(r.output).toBe("hello");
    expect(r.halted).toBe(true);
  });

  it("global string declaration stores a zero-terminated character array", () => {
    const r = compileAndRun(`
      string msg = "abc";
      int main() {
        int i;
        i = 0;
        while (msg[i] != 0) {
          putchar(msg[i]);
          i = i + 1;
        }
        return 0;
      }
    `);
    expect(r.output).toBe("abc");
    expect(r.halted).toBe(true);
  });

  it("array_len returns the declared array capacity", () => {
    const r = compileAndRun(`
      int main() {
        int values[6] = {1, 2, 3};
        string msg = "hello";
        print_num(array_len(values));
        putchar(32);
        print_num(array_len(msg));
        return 0;
      }
    `);
    expect(r.output).toBe("6 6");
    expect(r.halted).toBe(true);
  });

  it("string_len returns the current zero-terminated string length", () => {
    const r = compileAndRun(`
      int main() {
        string msg = "hello";
        msg[4] = 'a';
        print_num(string_len(msg));
        return 0;
      }
    `);
    expect(r.output).toBe("5");
    expect(r.halted).toBe(true);
  });

  it("print accepts a string variable", () => {
    const r = compileAndRun(`
      int main() {
        string msg = "hello";
        print(msg);
        return 0;
      }
    `);
    expect(r.output).toBe("hello");
    expect(r.halted).toBe(true);
  });

  it("print accepts a zero-terminated buffer", () => {
    const r = compileAndRun(`
      int main() {
        int buf[8] = "hi";
        buf[2] = '!';
        buf[3] = 0;
        print(buf);
        return 0;
      }
    `);
    expect(r.output).toBe("hi!");
    expect(r.halted).toBe(true);
  });

  it("string_len reflects manual append inside a larger buffer", () => {
    const r = compileAndRun(`
      int main() {
        int buf[8] = "hi";
        buf[2] = '!';
        buf[3] = 0;
        print_num(string_len(buf));
        return 0;
      }
    `);
    expect(r.output).toBe("3");
    expect(r.halted).toBe(true);
  });

  it("string_len stops at the first embedded zero byte", () => {
    const r = compileAndRun(`
      int main() {
        int buf[8] = "hello";
        buf[1] = 0;
        print_num(string_len(buf));
        putchar(32);
        print(buf);
        return 0;
      }
    `);
    expect(r.output).toBe("1 h");
    expect(r.halted).toBe(true);
  });

  it("unterminated buffers keep scanning into adjacent storage until a zero is found", () => {
    const r = compileAndRun(`
      int buf[3] = {65, 66, 67};
      int after = 90;
      int main() {
        print_num(string_len(buf));
        putchar(32);
        print(buf);
        return 0;
      }
    `);
    expect(r.output).toBe("4 ABCZ");
    expect(r.halted).toBe(true);
  });

  it("string can be modified by index when it is not const", () => {
    const r = compileAndRun(`
      int main() {
        string msg = "hello";
        int i;
        msg[0] = 'H';
        msg[4] = 'O';
        i = 0;
        while (msg[i] != 0) {
          putchar(msg[i]);
          i = i + 1;
        }
        return 0;
      }
    `);
    expect(r.output).toBe("HellO");
    expect(r.halted).toBe(true);
  });

  it("string buffers can be manually appended when extra capacity exists", () => {
    const r = compileAndRun(`
      int main() {
        int buf[8] = "hi";
        int i;
        buf[2] = '!';
        buf[3] = 0;
        i = 0;
        while (buf[i] != 0) {
          putchar(buf[i]);
          i = i + 1;
        }
        return 0;
      }
    `);
    expect(r.output).toBe("hi!");
    expect(r.halted).toBe(true);
  });

  it("const string cannot be modified by index", () => {
    const cr = compile(`
      int main() {
        const string msg = "hello";
        msg[0] = 'H';
        return 0;
      }
    `);
    expect(cr.success).toBe(false);
    expect(cr.errors.some((e) => e.message.includes("const"))).toBe(true);
  });

  it("writing to a const scalar is rejected", () => {
    const cr = compile(`
      int main() {
        const int x = 5;
        x = 6;
        return 0;
      }
    `);
    expect(cr.success).toBe(false);
    expect(cr.errors.some((e) => e.message.includes("const"))).toBe(true);
  });

  it("const declaration without initializer is rejected", () => {
    const cr = compile(`
      int main() {
        const int x;
        return 0;
      }
    `);
    expect(cr.success).toBe(false);
    expect(cr.errors.some((e) => e.message.includes("initialiseur"))).toBe(true);
  });

  it("string declaration without literal initializer is rejected", () => {
    const cr = compile(`
      int main() {
        string msg;
        return 0;
      }
    `);
    expect(cr.success).toBe(false);
    expect(cr.errors.some((e) => e.message.includes("string"))).toBe(true);
  });

  it("string literal initializer must fit including the trailing zero", () => {
    const cr = compile(`
      int main() {
        int buf[5] = "hello";
        return 0;
      }
    `);
    expect(cr.success).toBe(false);
    expect(cr.errors.some((e) => e.message.includes("initialiseur"))).toBe(true);
  });

  it("string concatenation with + is not supported", () => {
    const cr = compile(`
      int main() {
        string a = "he";
        string b = "llo";
        string c = a + b;
        return 0;
      }
    `);
    expect(cr.success).toBe(false);
    expect(cr.errors.some((e) => e.message.includes("chaine") || e.message.includes("tableau"))).toBe(true);
  });

  it("assigning a string literal to one array element is rejected", () => {
    const cr = compile(`
      int main() {
        string msg = "hello";
        msg[4] = "a";
        return 0;
      }
    `);
    expect(cr.success).toBe(false);
    expect(cr.errors.some((e) => e.message.includes("chaine littérale"))).toBe(true);
  });

  it("reassigning a string variable is not supported", () => {
    const cr = compile(`
      int main() {
        string msg = "hello";
        msg = "bye";
        return 0;
      }
    `);
    expect(cr.success).toBe(false);
    expect(cr.errors.some((e) => e.message.includes("tableau"))).toBe(true);
  });

  it("out-of-bounds array access is not rejected by the compiler", () => {
    const cr = compile(`
      int main() {
        int a[2] = {1, 2};
        a[9] = 7;
        return 0;
      }
    `);
    expect(cr.success).toBe(true);
  });

  it("out-of-bounds global array writes can corrupt the next global variable", () => {
    const r = compileAndRun(`
      int a[2] = {1, 2};
      int x = 9;
      int main() {
        a[2] = 7;
        print_num(x);
        putchar(32);
        print_num(a[0]);
        putchar(32);
        print_num(a[1]);
        return 0;
      }
    `);
    expect(r.output).toBe("7 1 2");
    expect(r.halted).toBe(true);
  });

  it("out-of-bounds local array writes can corrupt a later local variable", () => {
    const r = compileAndRun(`
      int main() {
        int a[2] = {1, 2};
        int x = 9;
        int y = 10;
        int z = 11;
        a[4] = 88;
        print_num(x);
        putchar(32);
        print_num(y);
        putchar(32);
        print_num(z);
        return 0;
      }
    `);
    expect(r.output).toBe("9 10 88");
    expect(r.halted).toBe(true);
  });

  it("local out-of-bounds writes inside recursion can silently corrupt nearby local state", () => {
    const r = compileAndRun(`
      int f(int n) {
        int a[2] = {1, 2};
        int x = n;
        a[3] = 77;
        if (n == 0) {
          return x;
        }
        return f(n - 1);
      }
      int main() {
        print_num(f(5));
        return 0;
      }
    `);
    expect(r.output).toBe("0");
    expect(r.halted).toBe(true);
    expect(r.cpu.state.sp).toBe(MEMORY_SIZE - 1);
  });

  it("array_len returns capacity even when string_len has been shortened by an embedded zero", () => {
    const r = compileAndRun(`
      int main() {
        int buf[8] = "hello";
        buf[2] = 0;
        print_num(string_len(buf));
        putchar(32);
        print_num(array_len(buf));
        return 0;
      }
    `);
    expect(r.output).toBe("2 8");
    expect(r.halted).toBe(true);
  });

  it("array_len rejects non-identifier expressions", () => {
    const cr = compile(`
      int main() {
        int buf[4] = {1, 2, 3, 4};
        print_num(array_len(buf + 1));
        return 0;
      }
    `);
    expect(cr.success).toBe(false);
    expect(cr.errors.some((e) => e.message.includes("array_len"))).toBe(true);
  });

  it("string_len rejects non-identifier expressions", () => {
    const cr = compile(`
      int main() {
        string msg = "hello";
        print_num(string_len(msg[0]));
        return 0;
      }
    `);
    expect(cr.success).toBe(false);
    expect(cr.errors.some((e) => e.message.includes("string_len"))).toBe(true);
  });

  it("writing to a const array is rejected", () => {
    const cr = compile(`
      int main() {
        const int a[2] = {1, 2};
        a[0] = 9;
        return 0;
      }
    `);
    expect(cr.success).toBe(false);
    expect(cr.errors.some((e) => e.message.includes("const"))).toBe(true);
  });

  it("passing a scalar to an array parameter is rejected", () => {
    const cr = compile(`
      void fill(int values[2]) {
        values[0] = 1;
      }
      int main() {
        int x;
        x = 0;
        fill(x);
        return 0;
      }
    `);
    expect(cr.success).toBe(false);
    expect(cr.errors.some((e) => e.message.includes("tableau"))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
//  Test suite: CPU execution properties
// ═══════════════════════════════════════════════════════════

describe("C Examples — Execution Properties", () => {
  // Programs that should halt (not input-dependent)
  const haltingExamples = [
    "Hello World",
    "Compteur",
    "Fibonacci",
    "Factorielle",
    "Calcul",
    "Plotter",
    "Courbe",
    "Cercle",
    "Horloge",
    "Spirale",
    "Tableau de nombres premiers",
    "Étoiles",
    "Test Mémoire",
    "Tableau (Tri)",
  ];

  for (const name of haltingExamples) {
    const example = C_EXAMPLES.find((e) => e.name === name)!;

    it(`"${name}" halts within reasonable cycles`, () => {
      const r = compileAndRun(example.code, { maxCycles: 50_000_000 });
      expect(r.halted).toBe(true);
    }, 15_000);
  }

  // Programs that need input (won't halt without it)
  const inputExamples = [
    "Echo (Saisie)",
    "Compteur de lettres",
    "Calculatrice",
    "Traceur de droite",
    "Démo Ultime",
    "Calculatrice Graphique",
    "Mini Shell",
    "FS Disque Externe",
    "Éditeur Texte FS",
    "Éditeur Multi-fichier FS",
    "Système Solaire 255",
  ];

  for (const name of inputExamples) {
    const example = C_EXAMPLES.find((e) => e.name === name)!;

    it(`"${name}" waits for input (does not halt without it)`, () => {
      const r = compileAndRun(example.code, { maxCycles: 10_000 });
      // These programs loop waiting for input, should not halt
      expect(r.halted).toBe(false);
    });
  }
});

describe("C Examples — Interactive Halt", () => {
  const haltableExamples: Array<{
    name: string;
    input?: string;
    maxCycles?: number;
  }> = [
    { name: "Echo (Saisie)", input: "@", maxCycles: 100_000 },
    { name: "Compteur de lettres", input: "@", maxCycles: 100_000 },
    { name: "Calculatrice", input: "@", maxCycles: 200_000 },
    { name: "Traceur de droite", input: "@", maxCycles: 100_000 },
    { name: "Clavier", input: "@", maxCycles: 200_000 },
    { name: "Pong", input: "@", maxCycles: 200_000 },
    { name: "Démo Ultime", input: "@", maxCycles: 200_000 },
    { name: "Calculatrice Graphique", input: "@", maxCycles: 200_000 },
    { name: "Mini Shell", input: "@", maxCycles: 200_000 },
    { name: "FS Disque Externe", input: "@", maxCycles: 200_000 },
    { name: "Éditeur Texte FS", input: "@", maxCycles: 200_000 },
    { name: "Éditeur Multi-fichier FS", input: "@", maxCycles: 200_000 },
    { name: "Système Solaire 255", input: "@", maxCycles: 200_000 },
  ];

  for (const exampleConfig of haltableExamples) {
    const example = C_EXAMPLES.find((e) => e.name === exampleConfig.name)!;

    it(`"${exampleConfig.name}" halts when @ is entered`, () => {
      const r = compileAndRun(example.code, {
        input: exampleConfig.input,
        maxCycles: exampleConfig.maxCycles,
      });
      expect(r.halted).toBe(true);
    });
  }
});

describe("C Examples — Bootloader Args", () => {
  it('"Boot Args - Cat" reads the file passed by the bootloader', () => {
    const example = C_EXAMPLES.find((e) => e.name === "Boot Args - Cat");
    expect(example).toBeDefined();

    const compiled = compile(example!.code);
    expect(compiled.success).toBe(true);

    const program = assemble(compiled.assembly);
    expect(program.success).toBe(true);

    let disk = writeProgramToBootDisk(
      new Uint8Array(DRIVE_SIZE),
      "bootcat",
      program.bytes,
    );
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
