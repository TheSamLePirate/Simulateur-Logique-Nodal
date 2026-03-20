import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { CPU } from "../../cpu/cpu";
import { LINUX_USERLAND_PROGRAMS, type LinuxUserlandProgram } from "../../cpu/linuxUserland";
import {
  PLOTTER_REPORT_ROOT,
  writeCombinedPlotterHtmlReport,
  writePlotterSuiteData,
} from "../../cpu/__tests__/plotterImage";
import { buildComputerArchitectureFlowGraph } from "./computerArchitectureFlowGraph";
import { cpuToComputerPanelData } from "./computerArchitectureFlowRuntime";
import {
  writeComputerArchitectureFlowArtifacts,
  type ComputerArchitectureFlowArtifact,
} from "./computerArchitectureFlowSnapshot";
import {
  expectLinuxUserlandScenarioCoverage,
  getLinuxUserlandScenario,
  slugify,
} from "../../testUtils/linuxUserlandProgramScenarios";

const LINUX_USERLAND_REPORT_DIR = join(
  PLOTTER_REPORT_ROOT,
  "computer-architecture-flow-linux-userland",
);

const suiteArtifacts: ComputerArchitectureFlowArtifact[] = [];

function formatPngPath(pngPath: string | null) {
  return pngPath ?? "(not generated)";
}

function writeProgramArtifact(
  program: LinuxUserlandProgram,
  cpu: CPU,
  extra: Record<string, unknown> = {},
) {
  const computerData = cpuToComputerPanelData(cpu, { useBootloader: true });
  const { nodes, edges } = buildComputerArchitectureFlowGraph(computerData);
  const artifact = writeComputerArchitectureFlowArtifacts({
    reportDir: LINUX_USERLAND_REPORT_DIR,
    name: `linux-userland-${slugify(program.name)}`,
    nodes,
    edges,
    metadata: {
      programName: program.name,
      exampleName: program.exampleName,
      consoleTail: cpu.consoleOutput.join("").slice(-400),
      halted: cpu.state.halted,
      plotterPixels: cpu.plotterPixels.size,
      drivePage: cpu.drivePage,
      httpStatus: cpu.httpLastStatus,
      ...extra,
    },
  });
  suiteArtifacts.push(artifact);
  expect(artifact.nodeCount).toBeGreaterThanOrEqual(12);
  expect(artifact.edgeCount).toBeGreaterThan(45);
}

beforeAll(() => {
  rmSync(LINUX_USERLAND_REPORT_DIR, { recursive: true, force: true });
});

afterAll(() => {
  mkdirSync(LINUX_USERLAND_REPORT_DIR, { recursive: true });
  writePlotterSuiteData({
    suiteName: "Linux Userland Architecture Flow Tests",
    suiteKey: "computer-architecture-flow-linux-userland",
    rootDir: PLOTTER_REPORT_ROOT,
    snapshots: suiteArtifacts.map((artifact) => ({
      name: artifact.name,
      outputPath: artifact.imagePath,
      width: artifact.width,
      height: artifact.height,
      scale: 1,
      pixelCount: artifact.activeEdgeCount,
    })),
    notes: [
      "Generated during computerArchitectureFlow.linuxUserland.test.ts.",
      "Boots the real Linux-like disk through the bootloader and exports one architecture snapshot for every bundled userland program.",
      "PNG copies are generated alongside the SVG snapshots when a local SVG rasterizer is available.",
    ],
    consoleLines: suiteArtifacts.map((artifact) =>
      `[artifact] ${artifact.name}: ${artifact.jsonPath} | ${artifact.imagePath} | ${formatPngPath(artifact.pngPath)} (${artifact.nodeCount} nodes, ${artifact.edgeCount} edges)`,
    ),
    tests: suiteArtifacts.map((artifact) => artifact.name),
    testConsoleOutputs: suiteArtifacts.map((artifact) => ({
      testName: artifact.name,
      output: `JSON: ${artifact.jsonPath}\nSVG: ${artifact.imagePath}\nPNG: ${formatPngPath(artifact.pngPath)}\nActive edges: ${artifact.activeEdgeCount}`,
    })),
  });
  const suiteReportPath = join(LINUX_USERLAND_REPORT_DIR, "suite-report.json");
  writeFileSync(
    suiteReportPath,
    `${JSON.stringify(
      {
        ...JSON.parse(readFileSync(suiteReportPath, "utf8")),
        artifacts: suiteArtifacts,
      },
      null,
      2,
    )}\n`,
  );
  writeCombinedPlotterHtmlReport(PLOTTER_REPORT_ROOT);
});

describe("linux userland architecture flow", () => {
  it("covers every bootloader-runnable Linux userland program", () => {
    expectLinuxUserlandScenarioCoverage();
  });

  for (const program of LINUX_USERLAND_PROGRAMS) {
    const scenario = getLinuxUserlandScenario(program);

    it(`exports "${program.name}" from the bootloader Linux userland`, async () => {
      const cpu = await scenario.run(program);
      writeProgramArtifact(program, cpu, {
        scenario: program.name,
      });
    }, scenario.timeout ?? 10_000);
  }
});
