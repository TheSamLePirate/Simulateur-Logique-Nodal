import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import { compile as compileCurrent } from "../src/cpu/compiler";
import { assemble as assembleCurrent } from "../src/cpu/assembler";
import { C_EXAMPLES as currentExamples } from "../src/cpu/cexamples";

const execFile = promisify(execFileCallback);

type CompileFn = (source: string) => { success: boolean; assembly: string };
type AssembleFn = (assembly: string) => { success: boolean; bytes: number[] };
type Example = { name: string; code: string };

interface SizeRow {
  name: string;
  oldSize: number | null;
  newSize: number | null;
  delta: number | null;
  percent: number | null;
}

interface ComparisonReport {
  baselineCommit: string;
  currentRef: string;
  commonExampleCount: number;
  oldTotal: number;
  newTotal: number;
  totalDelta: number;
  percent: number;
  rows: SizeRow[];
}

function usage() {
  return [
    "Usage:",
    "  npm run compare:c-sizes -- <baseline-commit> [--md <path>] [--json <path>]",
    "",
    "Examples:",
    "  npm run compare:c-sizes -- 56f938c0df8094c15b2e4046e0e4a57c38a701f2",
    "  npm run compare:c-sizes -- 56f938c0df8094c15b2e4046e0e4a57c38a701f2 --md docs/c-program-size-comparison-56f938c0-to-now.md",
    "  npm run compare:c-sizes -- HEAD~10 --json /tmp/c-size-report.json",
  ].join("\n");
}

async function gitShow(commit: string, filePath: string): Promise<string> {
  const { stdout } = await execFile("git", ["show", `${commit}:${filePath}`], {
    cwd: process.cwd(),
    maxBuffer: 8 * 1024 * 1024,
  });
  return stdout;
}

async function gitRevParse(ref: string): Promise<string> {
  const { stdout } = await execFile("git", ["rev-parse", ref], {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

async function prepareBaselineTree(commit: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "c-size-compare-"));
  const files = [
    "src/cpu/compiler/index.ts",
    "src/cpu/compiler/lexer.ts",
    "src/cpu/compiler/parser.ts",
    "src/cpu/compiler/codegen.ts",
    "src/cpu/assembler.ts",
    "src/cpu/cexamples.ts",
    "src/cpu/isa.ts",
    "src/cpu/bootArgs.ts",
  ];

  for (const file of files) {
    const dest = path.join(root, file);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, await gitShow(commit, file));
  }

  return root;
}

function getCompile(mod: unknown): CompileFn {
  if (typeof (mod as { compile?: unknown }).compile === "function") {
    return (mod as { compile: CompileFn }).compile;
  }
  if (
    typeof (mod as { default?: { compile?: unknown } }).default?.compile === "function"
  ) {
    return (mod as { default: { compile: CompileFn } }).default.compile;
  }
  throw new Error("Could not find compile() export in baseline compiler module");
}

function getAssemble(mod: unknown): AssembleFn {
  if (typeof (mod as { assemble?: unknown }).assemble === "function") {
    return (mod as { assemble: AssembleFn }).assemble;
  }
  if (
    typeof (mod as { default?: { assemble?: unknown } }).default?.assemble === "function"
  ) {
    return (mod as { default: { assemble: AssembleFn } }).default.assemble;
  }
  throw new Error("Could not find assemble() export in baseline assembler module");
}

function getExamples(mod: unknown): Example[] {
  if (Array.isArray((mod as { C_EXAMPLES?: unknown }).C_EXAMPLES)) {
    return (mod as { C_EXAMPLES: Example[] }).C_EXAMPLES;
  }
  if (Array.isArray((mod as { default?: { C_EXAMPLES?: unknown } }).default?.C_EXAMPLES)) {
    return (mod as { default: { C_EXAMPLES: Example[] } }).default.C_EXAMPLES;
  }
  throw new Error("Could not find C_EXAMPLES export in baseline cexamples module");
}

function measureSize(
  compileFn: CompileFn,
  assembleFn: AssembleFn,
  source: string,
): number | null {
  const compiled = compileFn(source);
  if (!compiled.success) return null;
  const assembled = assembleFn(compiled.assembly);
  return assembled.success ? assembled.bytes.length : null;
}

function toMarkdown(report: ComparisonReport): string {
  const lines: string[] = [];
  lines.push("# C Program Size Comparison");
  lines.push("");
  lines.push("This document compares the assembled size of every bundled C example between:");
  lines.push("");
  lines.push(`- baseline commit: \`${report.baselineCommit}\``);
  lines.push(`- current ref: \`${report.currentRef}\``);
  lines.push("");
  lines.push("Method:");
  lines.push("");
  lines.push("- use the compiler and assembler from each revision");
  lines.push("- compile the bundled `C_EXAMPLES` from each revision");
  lines.push("- match programs by example name");
  lines.push("- compare final assembled byte size");
  lines.push("");
  lines.push("Summary:");
  lines.push("");
  lines.push(`- common programs compared: \`${report.commonExampleCount}\``);
  lines.push(`- total size at \`${report.baselineCommit}\`: \`${report.oldTotal}\` bytes`);
  lines.push(`- total size now: \`${report.newTotal}\` bytes`);
  lines.push(`- total gain: \`${report.totalDelta}\` bytes`);
  lines.push(`- relative gain: \`${report.percent}%\``);
  lines.push(
    `- programs smaller now: \`${report.rows.filter((row) => (row.delta ?? 0) < 0).length}\``,
  );
  lines.push(
    `- programs larger now: \`${report.rows.filter((row) => (row.delta ?? 0) > 0).length}\``,
  );
  lines.push("");
  lines.push("## Full Table");
  lines.push("");
  lines.push("| Program | Old Size | New Size | Delta | Delta % |");
  lines.push("|---|---:|---:|---:|---:|");
  for (const row of report.rows) {
    lines.push(
      `| ${row.name} | ${row.oldSize ?? "n/a"} | ${row.newSize ?? "n/a"} | ${row.delta ?? "n/a"} | ${
        row.percent !== null ? `${row.percent}%` : "n/a"
      } |`,
    );
  }
  lines.push("");
  lines.push("## Biggest Wins");
  lines.push("");
  lines.push("| Program | Delta |");
  lines.push("|---|---:|");
  for (const row of [...report.rows]
    .filter((entry) => entry.delta !== null)
    .sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0))
    .slice(0, 10)) {
    lines.push(`| ${row.name} | ${row.delta} |`);
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const baselineRef = args[0];
  if (!baselineRef || baselineRef === "--help" || baselineRef === "-h") {
    console.log(usage());
    process.exit(baselineRef ? 0 : 1);
  }

  let markdownPath: string | null = null;
  let jsonPath: string | null = null;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--md") {
      markdownPath = args[++i] ?? null;
    } else if (args[i] === "--json") {
      jsonPath = args[++i] ?? null;
    } else {
      throw new Error(`Unknown argument: ${args[i]}`);
    }
  }

  const baselineCommit = await gitRevParse(baselineRef);
  const currentRef = await gitRevParse("HEAD");
  const baselineRoot = await prepareBaselineTree(baselineCommit);

  try {
    const baselineCompilerMod = await import(
      pathToFileURL(path.join(baselineRoot, "src/cpu/compiler/index.ts")).href
    );
    const baselineAssemblerMod = await import(
      pathToFileURL(path.join(baselineRoot, "src/cpu/assembler.ts")).href
    );
    const baselineExamplesMod = await import(
      pathToFileURL(path.join(baselineRoot, "src/cpu/cexamples.ts")).href
    );

    const compileBaseline = getCompile(baselineCompilerMod);
    const assembleBaseline = getAssemble(baselineAssemblerMod);
    const baselineExamples = getExamples(baselineExamplesMod);

    const currentByName = new Map(currentExamples.map((example) => [example.name, example]));
    const baselineByName = new Map(baselineExamples.map((example) => [example.name, example]));
    const commonNames = [...baselineByName.keys()]
      .filter((name) => currentByName.has(name))
      .sort((a, b) => a.localeCompare(b));

    const rows: SizeRow[] = commonNames.map((name) => {
      const oldSize = measureSize(
        compileBaseline,
        assembleBaseline,
        baselineByName.get(name)!.code,
      );
      const newSize = measureSize(
        compileCurrent,
        assembleCurrent,
        currentByName.get(name)!.code,
      );
      const delta = oldSize !== null && newSize !== null ? newSize - oldSize : null;
      const percent =
        oldSize !== null && newSize !== null
          ? Number((((newSize - oldSize) / oldSize) * 100).toFixed(1))
          : null;
      return { name, oldSize, newSize, delta, percent };
    });

    const oldTotal = rows.reduce((sum, row) => sum + (row.oldSize ?? 0), 0);
    const newTotal = rows.reduce((sum, row) => sum + (row.newSize ?? 0), 0);
    const report: ComparisonReport = {
      baselineCommit,
      currentRef,
      commonExampleCount: rows.length,
      oldTotal,
      newTotal,
      totalDelta: newTotal - oldTotal,
      percent: Number((((newTotal - oldTotal) / oldTotal) * 100).toFixed(1)),
      rows,
    };

    if (jsonPath) {
      await mkdir(path.dirname(jsonPath), { recursive: true });
      await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
    }
    if (markdownPath) {
      await mkdir(path.dirname(markdownPath), { recursive: true });
      await writeFile(markdownPath, toMarkdown(report));
    }

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await rm(baselineRoot, { recursive: true, force: true });
  }
}

await main();
