import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { EXAMPLES, type Example } from "../../cpu/examples";
import {
  PLOTTER_REPORT_ROOT,
  writeCombinedPlotterHtmlReport,
  writePlotterSuiteData,
} from "../../cpu/__tests__/plotterImage";
import {
  expectAsmExampleScenarioCoverage,
  getAsmExampleScenario,
} from "../../testUtils/asmExampleScenarios";
import { slugify } from "../../testUtils/linuxUserlandProgramScenarios";
import { buildComputerArchitectureFlowGraph } from "./computerArchitectureFlowGraph";
import { cpuToComputerPanelData } from "./computerArchitectureFlowRuntime";
import {
  writeComputerArchitectureFlowArtifacts,
  type ComputerArchitectureFlowArtifact,
} from "./computerArchitectureFlowSnapshot";

const ASM_EXAMPLES_ARCHITECTURE_REPORT_DIR = join(
  PLOTTER_REPORT_ROOT,
  "computer-architecture-flow-examples",
);

const suiteArtifacts: ComputerArchitectureFlowArtifact[] = [];

function formatPngPath(pngPath: string | null) {
  return pngPath ?? "(not generated)";
}

function writeExampleArtifact(example: Example, run: import("../../testUtils/asmExampleScenarios").AsmExampleRunContext) {
  const computerData = cpuToComputerPanelData(run.cpu, {
    codeSize: run.codeSize,
    useBootloader: run.useBootloader,
  });
  const { nodes, edges } = buildComputerArchitectureFlowGraph(computerData);
  const artifact = writeComputerArchitectureFlowArtifacts({
    reportDir: ASM_EXAMPLES_ARCHITECTURE_REPORT_DIR,
    name: slugify(example.name),
    nodes,
    edges,
    metadata: {
      exampleName: example.name,
      halted: run.cpu.state.halted,
      useBootloader: run.useBootloader,
      cycles: run.cpu.state.cycles,
      consoleTail: run.cpu.consoleOutput.join("").slice(-400),
      plotterPixels: run.cpu.plotterPixels.size,
    },
  });

  suiteArtifacts.push(artifact);
  expect(artifact.nodeCount).toBeGreaterThanOrEqual(12);
  expect(artifact.edgeCount).toBeGreaterThan(45);
}

beforeAll(() => {
  rmSync(ASM_EXAMPLES_ARCHITECTURE_REPORT_DIR, { recursive: true, force: true });
});

afterAll(() => {
  mkdirSync(ASM_EXAMPLES_ARCHITECTURE_REPORT_DIR, { recursive: true });
  writePlotterSuiteData({
    suiteName: "ASM Examples Architecture Flow Tests",
    suiteKey: "computer-architecture-flow-examples",
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
      "Generated during computerArchitectureFlow.examples.test.ts.",
      "Exports one architecture flow snapshot for every bundled ASM example.",
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
  const suiteReportPath = join(ASM_EXAMPLES_ARCHITECTURE_REPORT_DIR, "suite-report.json");
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

describe("ASM examples architecture flow", () => {
  it("covers every runnable ASM example", () => {
    expectAsmExampleScenarioCoverage();
  });

  for (const example of EXAMPLES) {
    const scenario = getAsmExampleScenario(example);

    it(`exports "${example.name}" as architecture flow`, async () => {
      const run = await scenario.run(example);
      writeExampleArtifact(example, run);
    }, scenario.timeout ?? 10_000);
  }
});
