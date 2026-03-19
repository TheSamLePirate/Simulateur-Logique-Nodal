import { rmSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, it } from "vitest";

import { LINUX_USERLAND_PROGRAMS } from "../linuxUserland";
import {
  PLOTTER_REPORT_ROOT,
  writeCombinedPlotterHtmlReport,
  writePlotterPng,
  writePlotterSuiteData,
  type PlotterSnapshotInfo,
  type PlotterTestConsoleOutput,
} from "./plotterImage";
import {
  expectLinuxUserlandScenarioCoverage,
  getLinuxUserlandScenario,
  slugify,
} from "../../testUtils/linuxUserlandProgramScenarios";

const LINUX_USERLAND_REPORT_DIR = join(PLOTTER_REPORT_ROOT, "linux-userland-direct-cpu");

const suiteTests: string[] = [];
const suiteConsoleLines: string[] = [];
const suiteSnapshots: Array<PlotterSnapshotInfo & { name: string }> = [];
const testConsoleOutputs: PlotterTestConsoleOutput[] = [];

beforeAll(() => {
  rmSync(LINUX_USERLAND_REPORT_DIR, { recursive: true, force: true });
});

afterAll(() => {
  writePlotterSuiteData({
    suiteName: "Linux Userland Direct CPU Tests",
    suiteKey: "linux-userland-direct-cpu",
    rootDir: PLOTTER_REPORT_ROOT,
    snapshots: suiteSnapshots,
    notes: [
      "Generated during linuxUserlandPrograms.test.ts.",
      "Runs every bootloader-runnable Linux-like userland program directly on the CPU and records console output.",
      "Programs that draw on the plotter also export PNG snapshots.",
    ],
    consoleLines: suiteConsoleLines,
    tests: suiteTests,
    testConsoleOutputs,
  });
  writeCombinedPlotterHtmlReport(PLOTTER_REPORT_ROOT);
});

describe("linux userland direct cpu", () => {
  it("covers every bootloader-runnable Linux userland program", () => {
    expectLinuxUserlandScenarioCoverage();
  });

  for (const program of LINUX_USERLAND_PROGRAMS) {
    const scenario = getLinuxUserlandScenario(program);

    it(`runs "${program.name}" from the bootloader Linux userland`, async () => {
      const cpu = await scenario.run(program);
      const artifactName = `linux-userland-${slugify(program.name)}`;
      const consoleOutput = cpu.consoleOutput.join("").replaceAll("\0", "").trim();

      suiteTests.push(`runs "${program.name}" from the bootloader Linux userland`);
      suiteConsoleLines.push(
        `[program] ${program.name}: halted=${cpu.state.halted} plotter=${cpu.plotterPixels.size} drivePage=${cpu.drivePage} httpStatus=${cpu.httpLastStatus ?? "none"}`,
      );
      testConsoleOutputs.push({
        testName: program.name,
        output: consoleOutput || "(no console output)",
      });

      if (cpu.plotterPixels.size > 0) {
        const snapshot = writePlotterPng(
          cpu.plotterPixels,
          `${LINUX_USERLAND_REPORT_DIR}/${artifactName}.png`,
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
