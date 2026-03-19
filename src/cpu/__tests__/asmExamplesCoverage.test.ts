import { rmSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, it } from "vitest";

import { EXAMPLES } from "../examples";
import {
  PLOTTER_REPORT_ROOT,
  writeCombinedPlotterHtmlReport,
  writePlotterPng,
  writePlotterSuiteData,
  type PlotterSnapshotInfo,
  type PlotterTestConsoleOutput,
} from "./plotterImage";
import {
  expectAsmExampleScenarioCoverage,
  getAsmExampleScenario,
} from "../../testUtils/asmExampleScenarios";
import { slugify } from "../../testUtils/linuxUserlandProgramScenarios";

const ASM_EXAMPLES_REPORT_DIR = join(PLOTTER_REPORT_ROOT, "asm-examples-direct-cpu");

const suiteTests: string[] = [];
const suiteConsoleLines: string[] = [];
const suiteSnapshots: Array<PlotterSnapshotInfo & { name: string }> = [];
const testConsoleOutputs: PlotterTestConsoleOutput[] = [];

beforeAll(() => {
  rmSync(ASM_EXAMPLES_REPORT_DIR, { recursive: true, force: true });
});

afterAll(() => {
  writePlotterSuiteData({
    suiteName: "ASM Examples Direct CPU Tests",
    suiteKey: "asm-examples-direct-cpu",
    rootDir: PLOTTER_REPORT_ROOT,
    snapshots: suiteSnapshots,
    notes: [
      "Generated during asmExamplesCoverage.test.ts.",
      "Runs every bundled ASM example through a real runnable workflow and records console and plotter state.",
      "Programs that draw export PNG snapshots for the dashboard.",
    ],
    consoleLines: suiteConsoleLines,
    tests: suiteTests,
    testConsoleOutputs,
  });
  writeCombinedPlotterHtmlReport(PLOTTER_REPORT_ROOT);
});

describe("ASM examples direct cpu coverage", () => {
  it("covers every runnable ASM example", () => {
    expectAsmExampleScenarioCoverage();
  });

  for (const example of EXAMPLES) {
    const scenario = getAsmExampleScenario(example);

    it(`runs "${example.name}" through a real workflow`, async () => {
      const run = await scenario.run(example);
      const artifactName = slugify(example.name);
      const consoleOutput = run.cpu.consoleOutput.join("").replaceAll("\0", "").trim();

      suiteTests.push(`runs "${example.name}" through a real workflow`);
      suiteConsoleLines.push(
        `[example] ${example.name}: halted=${run.cpu.state.halted} plotter=${run.cpu.plotterPixels.size} bootloader=${run.useBootloader} codeSize=${run.codeSize}`,
      );
      testConsoleOutputs.push({
        testName: example.name,
        output: consoleOutput || "(no console output)",
      });

      if (run.cpu.plotterPixels.size > 0) {
        const snapshot = writePlotterPng(
          run.cpu.plotterPixels,
          `${ASM_EXAMPLES_REPORT_DIR}/${artifactName}.png`,
          { scale: 2 },
        );
        suiteSnapshots.push({ name: artifactName, ...snapshot });
        suiteConsoleLines.push(
          `[snapshot] ${artifactName}: ${snapshot.outputPath} (${snapshot.width}x${snapshot.height}, scale ${snapshot.scale}, pixels ${snapshot.pixelCount})`,
        );
      }
    }, scenario.timeout ?? 10_000);
  }
});
