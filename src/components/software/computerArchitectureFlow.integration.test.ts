import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CPU } from "../../cpu/cpu";
import {
  BOOTLOADER_PROMPT,
  getBootloaderImage,
  getLinuxBootDiskImage,
} from "../../cpu/bootloader";
import {
  PLOTTER_REPORT_ROOT,
  writeCombinedPlotterHtmlReport,
  writePlotterSuiteData,
} from "../../cpu/__tests__/plotterImage";
import { buildComputerArchitectureFlowGraph } from "./computerArchitectureFlowGraph";
import {
  writeComputerArchitectureFlowArtifacts,
  type ComputerArchitectureFlowArtifact,
} from "./computerArchitectureFlowSnapshot";
import { cpuToComputerPanelData } from "./computerArchitectureFlowRuntime";

const FULL_COMPUTER_REPORT_DIR = join(
  PLOTTER_REPORT_ROOT,
  "computer-architecture-flow-full-computer",
);

const suiteArtifacts: ComputerArchitectureFlowArtifact[] = [];

function runCpuUntil(
  cpu: CPU,
  predicate: () => boolean,
  maxSteps = 400_000,
) {
  for (let step = 0; step < maxSteps && !cpu.state.halted; step++) {
    if (predicate()) return true;
    cpu.step();
  }
  return predicate();
}

function bootToPrompt(disk: Uint8Array) {
  const boot = getBootloaderImage();
  const cpu = new CPU();

  cpu.loadDriveData(disk);
  cpu.loadProgram(boot.bytes, boot.startAddr);

  expect(
    runCpuUntil(cpu, () => cpu.consoleOutput.join("").endsWith(BOOTLOADER_PROMPT)),
  ).toBe(true);

  return cpu;
}

function pushText(cpu: CPU, text: string) {
  for (const char of text) {
    cpu.pushInput(char.charCodeAt(0));
  }
}

function writeCpuArtifact(name: string, cpu: CPU, extra: Record<string, unknown> = {}) {
  const computerData = cpuToComputerPanelData(cpu, { useBootloader: true });
  const { nodes, edges } = buildComputerArchitectureFlowGraph(computerData);
  const artifact = writeComputerArchitectureFlowArtifacts({
    reportDir: FULL_COMPUTER_REPORT_DIR,
    name,
    nodes,
    edges,
    metadata: {
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
  rmSync(FULL_COMPUTER_REPORT_DIR, { recursive: true, force: true });
});

afterAll(() => {
  mkdirSync(FULL_COMPUTER_REPORT_DIR, { recursive: true });
  writePlotterSuiteData({
    suiteName: "Full Computer Architecture Flow Tests",
    suiteKey: "computer-architecture-flow-full-computer",
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
      "Generated during computerArchitectureFlow.integration.test.ts.",
      "This suite boots the real bootloader with the Linux-like disk and exports JSON/SVG computer snapshots.",
      "Snapshot counts indicate active edges, not lit plotter pixels.",
    ],
    consoleLines: suiteArtifacts.map((artifact) =>
      `[artifact] ${artifact.name}: ${artifact.jsonPath} | ${artifact.imagePath} | ${artifact.pngPath} (${artifact.nodeCount} nodes, ${artifact.edgeCount} edges)`,
    ),
    tests: suiteArtifacts.map((artifact) => artifact.name),
    testConsoleOutputs: suiteArtifacts.map((artifact) => ({
      testName: artifact.name,
      output: `JSON: ${artifact.jsonPath}\nSVG: ${artifact.imagePath}\nPNG: ${artifact.pngPath}\nActive edges: ${artifact.activeEdgeCount}`,
    })),
  });
  const suiteReportPath = join(FULL_COMPUTER_REPORT_DIR, "suite-report.json");
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

describe("full computer architecture flow", () => {
  it("boots the Linux-like disk to the bootloader prompt and exports the full computer state", () => {
    const cpu = bootToPrompt(getLinuxBootDiskImage());

    expect(cpu.consoleOutput.join("")).toContain("NodalLinux");
    expect(cpu.consoleOutput.join("")).toContain(BOOTLOADER_PROMPT);

    writeCpuArtifact("linux-boot-prompt", cpu, { scenario: "boot-prompt" });
  });

  it("runs a bundled Linux grep command and exports the resulting computer state", () => {
    const cpu = new CPU();
    const boot = getBootloaderImage();

    cpu.loadDriveData(getLinuxBootDiskImage());
    cpu.loadProgram(boot.bytes, boot.startAddr);
    pushText(cpu, "run grep story\ndreams\n");
    cpu.run(500_000);

    expect(cpu.state.halted).toBe(true);
    expect(cpu.consoleOutput.join("")).toContain("match");

    writeCpuArtifact("linux-grep-story", cpu, { scenario: "grep-command" });
  });

  it("runs bundled wget against the Linux-like disk and exports the networked computer state", async () => {
    const cpu = new CPU();
    const boot = getBootloaderImage();

    cpu.httpFetch = async ({ method, url }) => {
      expect(method).toBe("GET");
      expect(url).toBe("https://jsonplaceholder.typicode.com/todos/1");
      return "{\"ok\":1}";
    };

    cpu.loadDriveData(getLinuxBootDiskImage());
    cpu.loadProgram(boot.bytes, boot.startAddr);
    pushText(cpu, "run wget url\n");

    await cpu.runAsync(500_000);

    expect(cpu.consoleOutput.join("")).toContain("{\"ok\":1}");
    expect(cpu.state.halted).toBe(true);

    writeCpuArtifact("linux-wget-url", cpu, { scenario: "wget-command" });
  });

  it("runs a full computer bootloader + Linux disk example and exports the graphical architecture flow", () => {
    const cpu = new CPU();
    const boot = getBootloaderImage();

    cpu.loadDriveData(getLinuxBootDiskImage());
    cpu.loadProgram(boot.bytes, boot.startAddr);
    pushText(cpu, "run glxsh\n");
    cpu.run(600_000);

    expect(cpu.state.halted).toBe(false);
    expect(cpu.plotterPixels.size).toBeGreaterThan(0);
    expect(cpu.consoleOutput.join("")).not.toContain("NEED LETTERS DIGITS");

    writeCpuArtifact("linux-running-example-glxsh", cpu, { scenario: "glxsh-running" });
  });
});
