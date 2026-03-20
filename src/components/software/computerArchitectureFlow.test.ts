import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createInitialState, Opcode } from "../../cpu/isa";
import {
  PLOTTER_REPORT_ROOT,
  writeCombinedPlotterHtmlReport,
  writePlotterSuiteData,
} from "../../cpu/__tests__/plotterImage";
import {
  DEFAULT_PLOTTER_COLOR,
  encodePlotterCoord,
  packPlotterColor,
} from "../../plotter";
import {
  buildComputerArchitectureFlowGraph,
} from "./computerArchitectureFlowGraph";
import {
  writeComputerArchitectureFlowArtifacts,
  type ComputerArchitectureFlowArtifact,
} from "./computerArchitectureFlowSnapshot";
import type { ComputerPanelData } from "./computerPanelTypes";

const FLOW_REPORT_DIR = join(PLOTTER_REPORT_ROOT, "computer-architecture-flow");

const scenarioArtifacts: ComputerArchitectureFlowArtifact[] = [];

function formatPngPath(pngPath: string | null) {
  return pngPath ?? "(not generated)";
}

function setInstruction(memory: Uint8Array, pc: number, opcode: number, operand = 0) {
  memory[pc] = opcode & 0xff;
  if (opcode >= 0x80) {
    memory[(pc + 1) & 0x1fff] = operand & 0xff;
    memory[(pc + 2) & 0x1fff] = (operand >> 8) & 0xff;
  }
}

function createBaseData(): ComputerPanelData {
  const state = createInitialState();
  state.pc = 0x0040;
  state.sp = 0x1ff0;
  state.a = 0x2a;
  state.b = 0x11;
  state.cycles = 987;
  state.flags = { z: false, c: false, n: false };

  return {
    state,
    consoleOutput: ["boot ok\n", "ready> "],
    consoleInputBuffer: [0x6c, 0x73],
    plotterPixels: new Map<number, number>([
      [encodePlotterCoord(32, 40), packPlotterColor(255, 180, 64)],
      [encodePlotterCoord(33, 40), packPlotterColor(255, 180, 64)],
      [encodePlotterCoord(34, 41), packPlotterColor(96, 220, 255)],
    ]),
    plotterColor: { ...DEFAULT_PLOTTER_COLOR },
    keyState: [1, 0, 0, 1, 0],
    driveData: new Uint8Array(65536),
    drivePage: 0x05,
    driveLastAddr: 0x0240,
    driveLastRead: 0x44,
    driveLastWrite: 0x53,
    networkMethod: "GET",
    networkUrl: "https://meteo.example/api",
    networkBody: "",
    networkStatus: "idle",
    networkPending: false,
    networkResponseBuffer: [],
    networkLastByte: 0x7b,
    networkCompletedMethod: "GET",
    networkCompletedUrl: "https://meteo.example/api",
    networkCompletedBody: "",
    networkCompletedStatus: "200 OK",
    networkCompletedResponseText: "{\"ok\":true}",
    networkHistory: [],
    lastOpcode: -1,
    lastOperand: 0,
    clockBit: 1,
    randSeed: 0xac,
    randCounter: 12,
    sleepCounter: 0,
    assembled: true,
    isRunning: true,
    useBootloader: true,
    memLayout: null,
    codeSize: 2048,
  };
}

function buildScenarioData(name: string): ComputerPanelData {
  const data = createBaseData();

  switch (name) {
    case "memory-read": {
      const operand = 0x1234;
      setInstruction(data.state.memory, data.state.pc, Opcode.LDM, operand);
      data.state.memory[operand] = 0xab;
      data.state.a = 0x34;
      data.state.b = 0x12;
      data.driveLastRead = 0x21;
      data.networkStatus = "cached";
      data.networkResponseBuffer = [0x7b, 0x22, 0x74];
      return data;
    }
    case "plotter-draw": {
      setInstruction(data.state.memory, data.state.pc, Opcode.DRAW);
      data.state.a = 0x58;
      data.state.b = 0x73;
      data.plotterColor = { r: 255, g: 116, b: 94 };
      data.plotterPixels.set(
        encodePlotterCoord(data.state.a, data.state.b),
        packPlotterColor(255, 116, 94),
      );
      data.consoleOutput = ["plotter demo\n"];
      return data;
    }
    case "network-get": {
      const operand = 0x0350;
      setInstruction(data.state.memory, data.state.pc, Opcode.HTTPGET, operand);
      data.state.memory[operand] = "h".charCodeAt(0);
      data.state.memory[operand + 1] = "t".charCodeAt(0);
      data.networkPending = true;
      data.networkStatus = "200 OK";
      data.networkResponseBuffer = Array.from("{\"temp\":11}", (char) => char.charCodeAt(0));
      data.networkLastByte = "}".charCodeAt(0);
      data.consoleInputBuffer = [0x67, 0x65, 0x74];
      return data;
    }
    default:
      throw new Error(`Unknown test scenario: ${name}`);
  }
}

function writeScenarioArtifacts(name: string) {
  const data = buildScenarioData(name);
  const { nodes, edges } = buildComputerArchitectureFlowGraph(data);
  const artifact = writeComputerArchitectureFlowArtifacts({
    reportDir: FLOW_REPORT_DIR,
    name,
    nodes,
    edges,
    metadata: {
      scenario: name,
    },
  });

  scenarioArtifacts.push(artifact);

  expect(nodes.length).toBeGreaterThanOrEqual(12);
  expect(edges.length).toBeGreaterThan(45);
  expect(artifact.activeEdgeCount).toBeGreaterThan(0);
  expect(nodes.some((node) => node.id === "plotter-stage")).toBe(true);
  expect(nodes.some((node) => node.id === "drive-stage")).toBe(true);
  expect(nodes.some((node) => node.id === "network-stage")).toBe(true);
}

beforeAll(() => {
  rmSync(FLOW_REPORT_DIR, { recursive: true, force: true });
});

afterAll(() => {
  mkdirSync(FLOW_REPORT_DIR, { recursive: true });
  writePlotterSuiteData({
    suiteName: "Computer Architecture Flow Tests",
    suiteKey: "computer-architecture-flow",
    rootDir: PLOTTER_REPORT_ROOT,
    snapshots: scenarioArtifacts.map((artifact) => ({
      name: artifact.name,
      outputPath: artifact.imagePath,
      width: artifact.width,
      height: artifact.height,
      scale: 1,
      pixelCount: artifact.activeEdgeCount,
    })),
    notes: [
      "Generated during computerArchitectureFlow.test.ts.",
      "This suite exports JSON and SVG architecture snapshots for structural verification.",
      "Snapshot counts indicate active edges, not lit plotter pixels.",
    ],
    consoleLines: scenarioArtifacts.map((artifact) =>
      `[artifact] ${artifact.name}: ${artifact.jsonPath} | ${artifact.imagePath} | ${formatPngPath(artifact.pngPath)} (${artifact.nodeCount} nodes, ${artifact.edgeCount} edges)`,
    ),
    tests: scenarioArtifacts.map((artifact) => artifact.name),
    testConsoleOutputs: scenarioArtifacts.map((artifact) => ({
      testName: artifact.name,
      output: `JSON: ${artifact.jsonPath}\nSVG: ${artifact.imagePath}\nPNG: ${formatPngPath(artifact.pngPath)}\nActive edges: ${artifact.activeEdgeCount}`,
    })),
  });
  const suiteReportPath = join(FLOW_REPORT_DIR, "suite-report.json");
  writeFileSync(
    suiteReportPath,
    `${JSON.stringify(
      {
        ...JSON.parse(readFileSync(suiteReportPath, "utf8")),
        artifacts: scenarioArtifacts,
      },
      null,
      2,
    )}\n`,
  );
  writeCombinedPlotterHtmlReport(PLOTTER_REPORT_ROOT);
});

describe("computer architecture flow exports", () => {
  it("exports a memory-read flow image and JSON", () => {
    writeScenarioArtifacts("memory-read");
  });

  it("exports a plotter-draw flow image and JSON", () => {
    writeScenarioArtifacts("plotter-draw");
  });

  it("exports a network-get flow image and JSON", () => {
    writeScenarioArtifacts("network-get");
  });
});
