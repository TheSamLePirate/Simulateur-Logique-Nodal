import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { assemble } from "../../cpu/assembler";
import {
  getBootloaderImage,
  getLinuxBootDiskImage,
  writeFileToBootDisk,
  writeProgramToBootDisk,
} from "../../cpu/bootloader";
import { compile, type MemoryLayout } from "../../cpu/compiler";
import { C_EXAMPLES, type CExample } from "../../cpu/cexamples";
import { CPU, type HttpFetchHandler } from "../../cpu/cpu";
import { DRIVE_SIZE } from "../../cpu/isa";
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

const CEXAMPLES_ARCHITECTURE_REPORT_DIR = join(
  PLOTTER_REPORT_ROOT,
  "computer-architecture-flow-cexamples",
);

const suiteArtifacts: ComputerArchitectureFlowArtifact[] = [];

function formatPngPath(pngPath: string | null) {
  return pngPath ?? "(not generated)";
}

interface RunArtifactContext {
  cpu: CPU;
  codeSize: number;
  memLayout: MemoryLayout | null;
  useBootloader: boolean;
}

interface ExampleExecutionConfig {
  input?: string;
  keyState?: number[];
  maxCycles?: number;
  timeout?: number;
  driveData?: Uint8Array | (() => Uint8Array);
  httpFetch?: HttpFetchHandler;
  async?: boolean;
  useBootloader?: boolean;
  runner?: (example: CExample) => Promise<RunArtifactContext> | RunArtifactContext;
}

const exampleConfigByName: Record<string, ExampleExecutionConfig> = {
  "Echo (Saisie)": {
    input: "Hi\n",
    maxCycles: 100_000,
  },
  "Compteur de lettres": {
    input: "abc\n",
    maxCycles: 100_000,
  },
  Calculatrice: {
    input: "123+45\n",
    maxCycles: 500_000,
  },
  "Traceur de droite": {
    input: "210",
    maxCycles: 50_000_000,
    timeout: 15_000,
  },
  Clavier: {
    keyState: [0, 1, 0, 0, 1],
    maxCycles: 500_000,
  },
  Pong: {
    keyState: [0, 0, 0, 1, 0],
    maxCycles: 500_000,
  },
  "Démo Ultime": {
    input: "7",
    keyState: [1, 0, 1, 0, 1],
    maxCycles: 5_000_000,
    timeout: 10_000,
  },
  "Calculatrice Graphique": {
    input: "321",
    maxCycles: 5_000_000,
    timeout: 10_000,
  },
  "Mini Shell": {
    input:
      "vars\nset a=42\nset b=7\nset c=9\nadd\nmax\nmin\navg\ntouch f\nhi>f\ncat f\ntouch s\navg>s\ncat s\n",
    maxCycles: 3_000_000,
    timeout: 10_000,
  },
  writeLetters: {
    driveData: () => createDigitsDiskImage(),
    maxCycles: 5_000_000,
    timeout: 10_000,
  },
  "FS Disque Externe": {
    driveData: () => createProgramDiskImage(),
    input: "ls\ntouch notes\nhello>notes\ncat notes\nls\nfree\n",
    maxCycles: 4_000_000,
    timeout: 10_000,
  },
  "Éditeur Texte FS": {
    driveData: () => createProgramDiskImage(),
    input: "hello\nworld\n\n/show\n@\n",
    maxCycles: 5_000_000,
    timeout: 10_000,
  },
  "Éditeur Multi-fichier FS": {
    driveData: () => createProgramDiskImage(),
    input: "o notes\nhello\ns\no todo\nbuy milk\ns\nl\no notes\nv\n@\n",
    maxCycles: 5_000_000,
    timeout: 10_000,
  },
  "Système Solaire 255": {
    maxCycles: 5_000_000,
    timeout: 10_000,
  },
  "HTTP JSONPlaceholder": {
    async: true,
    maxCycles: 4_000_000,
    timeout: 10_000,
    httpFetch: async ({ method, url }) => {
      if (method === "GET" && url === "https://jsonplaceholder.typicode.com/todos/1") {
        return "{\"id\":1,\"title\":\"delectus aut autem\"}";
      }
      if (method === "POST" && url === "https://jsonplaceholder.typicode.com/posts") {
        return "{\"id\":101}";
      }
      throw new Error(`Unexpected HTTP request: ${method} ${url}`);
    },
  },
  "Meteo Ales": {
    async: true,
    driveData: () => getLinuxBootDiskImage(),
    maxCycles: 1_900_000,
    timeout: 10_000,
    httpFetch: async ({ method, url }) => {
      expect(method).toBe("GET");
      expect(url).toContain("api.open-meteo.com");
      return "{\"latitude\":44.12,\"longitude\":4.08,\"generationtime_ms\":0.1,\"utc_offset_seconds\":3600,\"timezone\":\"Europe/Paris\",\"timezone_abbreviation\":\"GMT+1\",\"elevation\":130.0,\"current_units\":{\"time\":\"iso8601\",\"interval\":\"seconds\",\"temperature_2m\":\"°C\",\"is_day\":\"\",\"weather_code\":\"wmo code\"},\"current\":{\"time\":\"2026-03-18T17:00\",\"interval\":900,\"temperature_2m\":11.4,\"is_day\":1,\"weather_code\":61}}";
    },
  },
  "Boot Args - Cat": {
    useBootloader: true,
    timeout: 10_000,
    runner: (example) => runBootloaderCatExample(example),
  },
};

let cachedProgramDiskImage: Uint8Array | null = null;
let cachedDigitsDiskImage: Uint8Array | null = null;

function slugifyExampleName(name: string) {
  return name
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
}

function compileExample(example: CExample) {
  const compiled = compile(example.code);
  if (!compiled.success) {
    throw new Error(
      `Compile failed for ${example.name}:\n${compiled.errors.map((error) => `  [${error.phase}] L${error.line}: ${error.message}`).join("\n")}`,
    );
  }

  const assembled = assemble(compiled.assembly);
  if (!assembled.success) {
    throw new Error(
      `Assemble failed for ${example.name}:\n${assembled.errors.map((error) => `  L${error.line}: ${error.message}`).join("\n")}`,
    );
  }

  return {
    compiled,
    assembled,
  };
}

function pushText(cpu: CPU, input?: string) {
  if (!input) return;
  for (const char of input) {
    cpu.pushInput(char.charCodeAt(0));
  }
}

function createProgramDiskImage() {
  if (cachedProgramDiskImage) {
    return new Uint8Array(cachedProgramDiskImage);
  }

  const program = assemble(`
    OUT 'O'
    OUT 'K'
    HLT
  `);
  if (!program.success) {
    throw new Error("Failed to assemble helper program disk image");
  }

  cachedProgramDiskImage = writeProgramToBootDisk(
    new Uint8Array(DRIVE_SIZE),
    "program",
    program.bytes,
  );
  return new Uint8Array(cachedProgramDiskImage);
}

function createDigitsDiskImage() {
  if (cachedDigitsDiskImage) {
    return new Uint8Array(cachedDigitsDiskImage);
  }

  const example = C_EXAMPLES.find((item) => item.name === "writeDigits");
  if (!example) {
    throw new Error("Missing writeDigits example");
  }

  const { assembled } = compileExample(example);
  const cpu = new CPU();
  cpu.loadDriveData(new Uint8Array(DRIVE_SIZE));
  cpu.loadProgram(assembled.bytes);
  cpu.run(5_000_000);

  cachedDigitsDiskImage = cpu.exportDriveData();
  return new Uint8Array(cachedDigitsDiskImage);
}

function createDriveData(input?: Uint8Array | (() => Uint8Array)) {
  if (!input) return undefined;
  const driveData = typeof input === "function" ? input() : input;
  return new Uint8Array(driveData);
}

async function runCompiledExample(
  example: CExample,
  config: ExampleExecutionConfig,
): Promise<RunArtifactContext> {
  if (config.runner) {
    return await config.runner(example);
  }

  const { compiled, assembled } = compileExample(example);
  const cpu = new CPU();
  if (config.httpFetch) {
    cpu.httpFetch = config.httpFetch;
  }

  const driveData = createDriveData(config.driveData);
  if (driveData) {
    cpu.loadDriveData(driveData);
  }

  cpu.loadProgram(assembled.bytes);
  if (config.keyState) {
    cpu.keyState = [...config.keyState];
  }
  pushText(cpu, config.input);

  if (config.async) {
    await cpu.runAsync(config.maxCycles ?? 5_000_000);
  } else {
    cpu.run(config.maxCycles ?? 5_000_000);
  }

  return {
    cpu,
    codeSize: assembled.bytes.length,
    memLayout: compiled.memoryLayout ?? null,
    useBootloader: config.useBootloader ?? false,
  };
}

function runBootloaderCatExample(example: CExample): RunArtifactContext {
  const { compiled, assembled } = compileExample(example);

  let disk = writeProgramToBootDisk(
    new Uint8Array(DRIVE_SIZE),
    "bootcat",
    assembled.bytes,
  );
  disk = writeFileToBootDisk(
    disk,
    "notes",
    new Uint8Array(Array.from("hello").map((char) => char.charCodeAt(0))),
  );

  const boot = getBootloaderImage();
  const cpu = new CPU();
  cpu.loadDriveData(disk);
  cpu.loadProgram(boot.bytes, boot.startAddr);
  pushText(cpu, "run bootcat notes\n");
  cpu.run(500_000);

  return {
    cpu,
    codeSize: assembled.bytes.length,
    memLayout: compiled.memoryLayout ?? null,
    useBootloader: true,
  };
}

function writeExampleArtifact(example: CExample, run: RunArtifactContext) {
  const computerData = cpuToComputerPanelData(run.cpu, {
    memLayout: run.memLayout,
    codeSize: run.codeSize,
    useBootloader: run.useBootloader,
  });
  const { nodes, edges } = buildComputerArchitectureFlowGraph(computerData);
  const artifact = writeComputerArchitectureFlowArtifacts({
    reportDir: CEXAMPLES_ARCHITECTURE_REPORT_DIR,
    name: slugifyExampleName(example.name),
    nodes,
    edges,
    metadata: {
      exampleName: example.name,
      halted: run.cpu.state.halted,
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
  rmSync(CEXAMPLES_ARCHITECTURE_REPORT_DIR, { recursive: true, force: true });
});

afterAll(() => {
  mkdirSync(CEXAMPLES_ARCHITECTURE_REPORT_DIR, { recursive: true });
  writePlotterSuiteData({
    suiteName: "C Examples Architecture Flow Tests",
    suiteKey: "computer-architecture-flow-cexamples",
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
      "Generated during computerArchitectureFlow.cexamples.test.ts.",
      "Exports one architecture flow snapshot for every bundled C example program.",
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
  const suiteReportPath = join(CEXAMPLES_ARCHITECTURE_REPORT_DIR, "suite-report.json");
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

describe("C examples architecture flow", () => {
  for (const example of C_EXAMPLES) {
    const config = exampleConfigByName[example.name] ?? {};
    it(`exports "${example.name}" as architecture flow`, async () => {
      const run = await runCompiledExample(example, config);
      writeExampleArtifact(example, run);
    }, config.timeout ?? 10_000);
  }
});
