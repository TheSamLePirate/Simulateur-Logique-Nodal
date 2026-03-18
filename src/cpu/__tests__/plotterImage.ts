import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { deflateSync } from "node:zlib";

import { DEFAULT_PLOTTER_COLOR, type PlotterPixels, unpackPlotterColor } from "../../plotter";

export const PLOTTER_REPORT_ROOT = join(process.cwd(), "report");

// Small test/debug helper for visual plotter regressions.
// It writes the current framebuffer as a PNG image so a test or
// one-off debug script can inspect a real frame outside the simulator UI.
interface PlotterImageOptions {
  background?: { r: number; g: number; b: number };
  scale?: number;
  width?: number;
  height?: number;
}

export interface PlotterSnapshotInfo {
  outputPath: string;
  width: number;
  height: number;
  scale: number;
  pixelCount: number;
}

export interface PlotterReportEntry extends PlotterSnapshotInfo {
  name: string;
}

export interface PlotterTestConsoleOutput {
  testName: string;
  output: string;
}

interface PlotterSuiteReportData {
  suiteName: string;
  suiteKey: string;
  generatedAt: string;
  notes: string[];
  consoleLines: string[];
  tests: string[];
  testConsoleOutputs: PlotterTestConsoleOutput[];
  snapshots: Array<PlotterReportEntry & { href: string }>;
}

interface ProgramGroup {
  name: string;
  tests: string[];
  consoleOutputs: PlotterTestConsoleOutput[];
  snapshots: Array<PlotterReportEntry & { href: string }>;
}

const PNG_SIGNATURE = Buffer.from([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
]);

let crcTable: Uint32Array | null = null;

function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c >>> 0;
  }
  return crcTable;
}

function crc32(buffers: Buffer[]) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (const buffer of buffers) {
    for (const byte of buffer) {
      crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makePngChunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32([typeBuffer, data]), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function extractQuotedName(value: string) {
  const match = value.match(/"([^"]+)"/);
  return match?.[1] ?? null;
}

function getSnapshotFrameOrder(snapshotName: string) {
  const match = snapshotName.match(/-f(\d+)$/);
  return match ? Number.parseInt(match[1] ?? "0", 10) : 0;
}

function inferBootloaderProgram(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes("glxnano")) return "glxnano";
  if (lower.includes("glxsh")) return "glxsh";
  if (lower.includes("wget")) return "wget";
  if (lower.includes("bootcat")) return "bootcat";
  if (lower.includes("bundled cp")) return "cp";
  if (lower.includes("bundled mv")) return "mv";
  if (lower.includes("bundled grep")) return "grep";
  if (lower.includes("bundled jsonp")) return "jsonp";
  if (lower.includes("draw")) return "draw";
  if (lower.includes("calc")) return "calc";
  if (lower.includes("bootarg")) return "bootarg";
  if (lower.includes("spaced")) return "spaced";
  return "Bootloader Shell";
}

function inferSnapshotProgram(suiteName: string, snapshotName: string) {
  if (suiteName === "Bootloader Plotter Tests") {
    if (snapshotName.startsWith("glxnano")) return "glxnano";
    if (snapshotName.startsWith("glxsh")) return "glxsh";
    if (snapshotName.startsWith("bootloader-draw")) return "draw";
  }
  if (suiteName === "ASM Example Plotter Tests") {
    if (snapshotName.startsWith("super-unix-shell-plotter")) return "Super Unix Shell Plotter";
    if (snapshotName.startsWith("editeur-fs")) return "Éditeur FS ASM";
  }
  if (suiteName === "C Example Plotter Tests") {
    const snapshotPrefixes: Array<[string, string]> = [
      ["c-plotter", "Plotter"],
      ["c-courbe", "Courbe"],
      ["c-cercle", "Cercle"],
      ["c-clavier", "Clavier"],
      ["c-spirale", "Spirale"],
      ["c-etoiles", "Étoiles"],
      ["c-pong", "Pong"],
      ["c-demo-ultime", "Démo Ultime"],
      ["c-calculatrice-graphique", "Calculatrice Graphique"],
      ["c-systeme-solaire-255", "Système Solaire 255"],
      ["c-meteo-ales", "Meteo Ales"],
      ["c-traceur-droite", "Traceur de droite"],
      ["c-color-built-in", "Compiler Built-ins"],
    ];
    for (const [prefix, program] of snapshotPrefixes) {
      if (snapshotName === prefix || snapshotName.startsWith(`${prefix}-`)) {
        return program;
      }
    }
    return "C Examples";
  }
  return suiteName;
}

function inferProgramName(suiteName: string, value: string, kind: "test" | "console" | "snapshot") {
  if (kind === "snapshot") {
    return inferSnapshotProgram(suiteName, value);
  }

  const quoted = extractQuotedName(value);
  if (quoted) return quoted;

  if (suiteName === "Bootloader Plotter Tests") {
    return inferBootloaderProgram(value);
  }
  if (suiteName === "Running Keyboard Tests") {
    return "Running Keyboard";
  }
  const parts = value.split(">");
  return parts[0]?.trim() || suiteName;
}

function groupSuiteByProgram(suite: PlotterSuiteReportData) {
  const groups = new Map<string, ProgramGroup>();

  const ensureGroup = (name: string) => {
    if (!groups.has(name)) {
      groups.set(name, { name, tests: [], consoleOutputs: [], snapshots: [] });
    }
    return groups.get(name)!;
  };

  for (const testName of suite.tests) {
    ensureGroup(inferProgramName(suite.suiteName, testName, "test")).tests.push(testName);
  }
  for (const entry of suite.testConsoleOutputs) {
    ensureGroup(inferProgramName(suite.suiteName, entry.testName, "console")).consoleOutputs.push(entry);
  }
  for (const snapshot of suite.snapshots) {
    ensureGroup(inferProgramName(suite.suiteName, snapshot.name, "snapshot")).snapshots.push(snapshot);
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    snapshots: [...group.snapshots].sort((a, b) => {
      const frameDelta = getSnapshotFrameOrder(a.name) - getSnapshotFrameOrder(b.name);
      if (frameDelta !== 0) return frameDelta;
      return a.name.localeCompare(b.name);
    }),
  })).sort((a, b) => {
    const scoreA = a.snapshots.length * 100 + a.consoleOutputs.length * 10 + a.tests.length;
    const scoreB = b.snapshots.length * 100 + b.consoleOutputs.length * 10 + b.tests.length;
    if (scoreA !== scoreB) return scoreB - scoreA;
    return a.name.localeCompare(b.name);
  });
}

function getColorBytes(
  pixels: PlotterPixels,
  x: number,
  y: number,
  background: { r: number; g: number; b: number },
): [number, number, number] {
  const packed = pixels.get(((y & 0xff) << 8) | (x & 0xff));
  if (packed === undefined) {
    return [background.r, background.g, background.b];
  }
  const color = unpackPlotterColor(packed);
  return [color.r, color.g, color.b];
}

export function writePlotterPng(
  pixels: PlotterPixels,
  outputPath: string,
  options: PlotterImageOptions = {},
): PlotterSnapshotInfo {
  const width = options.width ?? 256;
  const height = options.height ?? 256;
  const scale = Math.max(1, options.scale ?? 1);
  const background = options.background ?? { ...DEFAULT_PLOTTER_COLOR, r: 0, g: 0, b: 0 };

  const outWidth = width * scale;
  const outHeight = height * scale;
  const raw = Buffer.alloc((outWidth * 3 + 1) * outHeight);

  let offset = 0;
  for (let y = 0; y < height; y++) {
    for (let sy = 0; sy < scale; sy++) {
      raw[offset++] = 0; // PNG filter: None
      for (let x = 0; x < width; x++) {
        const [r, g, b] = getColorBytes(pixels, x, y, background);
        for (let sx = 0; sx < scale; sx++) {
          raw[offset++] = r;
          raw[offset++] = g;
          raw[offset++] = b;
        }
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(outWidth, 0);
  ihdr.writeUInt32BE(outHeight, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const png = Buffer.concat([
    PNG_SIGNATURE,
    makePngChunk("IHDR", ihdr),
    makePngChunk("IDAT", deflateSync(raw)),
    makePngChunk("IEND", Buffer.alloc(0)),
  ]);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, png);
  const displayPath = relative(process.cwd(), outputPath) || basename(outputPath);

  return {
    outputPath: displayPath,
    width,
    height,
    scale,
    pixelCount: pixels.size,
  };
}

export function writePlotterSuiteData(options: {
  suiteName: string;
  suiteKey: string;
  rootDir: string;
  snapshots: PlotterReportEntry[];
  notes?: string[];
  consoleLines?: string[];
  tests?: string[];
  testConsoleOutputs?: PlotterTestConsoleOutput[];
}) {
  const {
    suiteName,
    suiteKey,
    rootDir,
    snapshots,
    notes = [],
    consoleLines = [],
    tests = [],
    testConsoleOutputs = [],
  } = options;
  const generatedAt = new Date().toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const suiteDir = join(rootDir, suiteKey);
  const outputPath = join(suiteDir, "suite-report.json");
  const payload: PlotterSuiteReportData = {
    suiteName,
    suiteKey,
    generatedAt,
    notes,
    consoleLines,
    tests,
    testConsoleOutputs,
    snapshots: snapshots.map((snapshot) => ({
      ...snapshot,
      href: `${suiteKey}/${basename(snapshot.outputPath)}`,
    })),
  };

  mkdirSync(suiteDir, { recursive: true });
  writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf8");
}

export function writeCombinedPlotterHtmlReport(rootDir: string) {
  const suites = readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dataPath = join(rootDir, entry.name, "suite-report.json");
      try {
        if (!statSync(dataPath).isFile()) return null;
        return JSON.parse(readFileSync(dataPath, "utf8")) as PlotterSuiteReportData;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is PlotterSuiteReportData => entry !== null)
    .sort((a, b) => a.suiteName.localeCompare(b.suiteName));

  const generatedAt = new Date().toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const totalTests = suites.reduce((total, suite) => total + suite.tests.length, 0);
  const totalSnapshots = suites.reduce((total, suite) => total + suite.snapshots.length, 0);

  const suiteSections = suites.map((suite, index) => {
    const notesHtml = suite.notes.length === 0
      ? ""
      : `
        <section class="notes">
          <h3>Notes</h3>
          <ul>
            ${suite.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}
          </ul>
        </section>
      `;

    const suiteSummaryText = suite.consoleLines.length === 0
      ? "No suite console lines were recorded."
      : suite.consoleLines.join("\n");
    const groupedPrograms = groupSuiteByProgram(suite);
    const programCards = groupedPrograms.length === 0
      ? `
        <section class="empty">
          <h3>No Program Groups</h3>
          <p>This suite did not produce grouped program data.</p>
        </section>
      `
      : `
        <section class="program-grid">
          ${groupedPrograms.map((group) => {
            const groupConsole = group.consoleOutputs.length === 0
              ? ""
              : `
                <section class="console-outputs">
                  <h4>Console Output</h4>
                  ${group.consoleOutputs.map((entry) => `
                    <details class="console-test" open>
                      <summary>${escapeHtml(entry.testName)}</summary>
                      <pre>${escapeHtml(entry.output)}</pre>
                    </details>
                  `).join("")}
                </section>
              `;
            const groupSnapshots = group.snapshots.length === 0
              ? ""
              : `
                <section class="snapshot-grid">
                  ${group.snapshots.length > 1 ? `
                    <section class="animation-viewer" data-animation-viewer>
                      <div class="animation-stage">
                        <a class="image-link animation-link" href="${encodeURI(group.snapshots[0]!.href)}" target="_blank" rel="noreferrer">
                          <img
                            class="animation-main"
                            src="${encodeURI(group.snapshots[0]!.href)}"
                            alt="${escapeHtml(group.snapshots[0]!.name)}"
                          />
                        </a>
                        <div class="animation-toolbar">
                          <div class="animation-copy">
                            <p class="animation-title">Animation Preview</p>
                            <p class="animation-caption">Frame 1 / ${group.snapshots.length}</p>
                          </div>
                          <div class="animation-controls">
                            <button type="button" data-action="prev">Prev</button>
                            <button type="button" data-action="toggle">Pause</button>
                            <button type="button" data-action="next">Next</button>
                          </div>
                        </div>
                        <p class="animation-meta">${group.snapshots[0]!.width}x${group.snapshots[0]!.height} px • scale ${group.snapshots[0]!.scale} • ${group.snapshots[0]!.pixelCount} lit pixels</p>
                      </div>
                      <div class="animation-strip">
                        ${group.snapshots.map((snapshot, index) => `
                          <button
                            type="button"
                            class="frame-chip${index === 0 ? " is-active" : ""}"
                            data-frame-index="${index}"
                            data-frame-name="${escapeHtml(snapshot.name)}"
                            data-frame-href="${encodeURI(snapshot.href)}"
                            data-frame-meta="${escapeHtml(`${snapshot.width}x${snapshot.height} px • scale ${snapshot.scale} • ${snapshot.pixelCount} lit pixels`)}"
                          >
                            <img src="${encodeURI(snapshot.href)}" alt="${escapeHtml(snapshot.name)}" />
                            <span>${escapeHtml(snapshot.name)}</span>
                          </button>
                        `).join("")}
                      </div>
                    </section>
                  ` : ""}
                  ${group.snapshots.length === 1 ? `
                    <div class="snapshot-card-grid">
                      ${group.snapshots.map((snapshot) => `
                        <article class="card">
                          <a class="image-link" href="${encodeURI(snapshot.href)}" target="_blank" rel="noreferrer">
                            <img src="${encodeURI(snapshot.href)}" alt="${escapeHtml(snapshot.name)}" />
                          </a>
                          <div class="card-body">
                            <h4>${escapeHtml(snapshot.name)}</h4>
                            <p class="meta">${snapshot.width}x${snapshot.height} px • scale ${snapshot.scale} • ${snapshot.pixelCount} lit pixels</p>
                          </div>
                        </article>
                      `).join("")}
                    </div>
                  ` : ""}
                </section>
              `;
            const groupTests = group.tests.length === 0
              ? ""
              : `
                <details class="tests-done">
                  <summary>Tests Done (${group.tests.length})</summary>
                  <ul>
                    ${group.tests.map((test) => `<li>${escapeHtml(test)}</li>`).join("")}
                  </ul>
                </details>
              `;

            return `
              <article class="program-card">
                <div class="program-head">
                  <h3>${escapeHtml(group.name)}</h3>
                  <p class="program-meta">${group.tests.length} tests • ${group.consoleOutputs.length} console outputs • ${group.snapshots.length} images</p>
                </div>
                ${groupConsole}
                ${groupSnapshots}
                ${groupTests}
              </article>
            `;
          }).join("")}
        </section>
      `;

    return `
      <details class="suite" ${index === 0 ? "open" : ""}>
        <summary>
          <span class="suite-title">${escapeHtml(suite.suiteName)}</span>
          <span class="suite-meta">${suite.snapshots.length} image${suite.snapshots.length === 1 ? "" : "s"} • ${escapeHtml(suite.generatedAt)}</span>
        </summary>
        <div class="suite-body">
          ${notesHtml}
          <details class="console">
            <summary>Suite Summary</summary>
            <pre>${escapeHtml(suiteSummaryText)}</pre>
          </details>
          ${programCards}
        </div>
      </details>
    `;
  }).join("");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Test Report Dashboard</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #071018;
        --panel: #0c1722;
        --panel-2: #112233;
        --text: #dbf7ff;
        --muted: #8cb8c7;
        --accent: #29d3ff;
        --accent-2: #a7ffcf;
        --border: rgba(41, 211, 255, 0.22);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(41, 211, 255, 0.14), transparent 34%),
          linear-gradient(180deg, #071018 0%, #06111a 100%);
        color: var(--text);
      }
      .wrap {
        width: min(1480px, calc(100% - 32px));
        margin: 0 auto;
        padding: 32px 0 48px;
      }
      .hero {
        background: linear-gradient(180deg, rgba(14, 30, 44, 0.92), rgba(8, 20, 31, 0.92));
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: 24px;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
      }
      .eyebrow {
        color: var(--accent-2);
        font-size: 12px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        margin: 0 0 10px;
      }
      h1 {
        margin: 0;
        font-size: clamp(28px, 4vw, 44px);
        line-height: 1.05;
      }
      .hero-copy {
        margin: 14px 0 0;
        color: var(--muted);
        max-width: 780px;
        line-height: 1.55;
      }
      .summary {
        display: flex;
        gap: 14px;
        flex-wrap: wrap;
        margin-top: 18px;
      }
      .pill {
        padding: 10px 14px;
        border-radius: 999px;
        background: rgba(41, 211, 255, 0.08);
        border: 1px solid var(--border);
        color: var(--muted);
        font-size: 14px;
      }
      .suite-list {
        display: grid;
        gap: 16px;
        margin-top: 24px;
      }
      .suite {
        border-radius: 20px;
        border: 1px solid var(--border);
        background: linear-gradient(180deg, rgba(12, 23, 34, 0.95), rgba(8, 18, 28, 0.96));
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.25);
        overflow: hidden;
      }
      .suite summary {
        list-style: none;
        cursor: pointer;
        padding: 18px 22px;
        display: flex;
        gap: 12px;
        justify-content: space-between;
        align-items: baseline;
      }
      .suite summary::-webkit-details-marker {
        display: none;
      }
      .suite-title {
        font-size: 20px;
        font-weight: 700;
      }
      .suite-meta {
        color: var(--muted);
        font-size: 14px;
        text-align: right;
      }
      .suite-body {
        padding: 0 22px 22px;
      }
      .notes {
        margin-top: 4px;
        padding: 18px 20px;
        border-radius: 18px;
        background: rgba(10, 22, 34, 0.88);
        border: 1px solid var(--border);
      }
      .notes h3 {
        margin: 0 0 10px;
        font-size: 16px;
      }
      .notes ul {
        margin: 0;
        padding-left: 18px;
        color: var(--muted);
      }
      .muted {
        color: var(--muted);
      }
      .console {
        margin-top: 18px;
        border-radius: 18px;
        background: rgba(3, 9, 14, 0.92);
        border: 1px solid rgba(167, 255, 207, 0.16);
        overflow: hidden;
      }
      .console summary {
        cursor: pointer;
        padding: 16px 20px;
        font-size: 16px;
        font-weight: 600;
        list-style: none;
      }
      .console summary::-webkit-details-marker {
        display: none;
      }
      .console pre {
        margin: 0;
        padding: 0 20px 18px;
        white-space: pre-wrap;
        word-break: break-word;
        color: #b9e9ff;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px;
        line-height: 1.5;
      }
      .program-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
        gap: 18px;
        margin-top: 18px;
      }
      .program-card {
        padding: 18px;
        border-radius: 20px;
        border: 1px solid var(--border);
        background: linear-gradient(180deg, rgba(12, 23, 34, 0.95), rgba(8, 18, 28, 0.96));
      }
      .program-head h3 {
        margin: 0;
        font-size: 20px;
      }
      .program-meta {
        margin: 6px 0 0;
        color: var(--muted);
        font-size: 14px;
      }
      .console-outputs {
        margin-top: 18px;
      }
      .console-outputs h4 {
        margin: 0 0 12px;
        font-size: 15px;
      }
      .console-test {
        border-radius: 14px;
        border: 1px solid rgba(41, 211, 255, 0.12);
        background: rgba(4, 10, 16, 0.85);
        overflow: hidden;
      }
      .console-test + .console-test {
        margin-top: 10px;
      }
      .console-test summary {
        cursor: pointer;
        padding: 12px 14px;
        color: var(--text);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px;
      }
      .console-test pre {
        margin: 0;
        padding: 0 14px 14px;
        white-space: pre-wrap;
        word-break: break-word;
        color: #b9e9ff;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px;
        line-height: 1.5;
      }
      .snapshot-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
        margin-top: 18px;
      }
      .snapshot-card-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 12px;
      }
      .animation-viewer {
        padding: 14px;
        border-radius: 18px;
        background: linear-gradient(180deg, rgba(9, 16, 24, 0.95), rgba(5, 12, 18, 0.98));
        border: 1px solid rgba(167, 255, 207, 0.14);
      }
      .animation-stage {
        overflow: hidden;
        border-radius: 16px;
        background: #02070b;
        border: 1px solid rgba(255,255,255,0.06);
      }
      .animation-stage .image-link {
        padding: 14px;
      }
      .animation-toolbar {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 12px;
        align-items: center;
        padding: 0 14px 14px;
        min-height: 56px;
      }
      .animation-copy {
        min-width: 0;
      }
      .animation-title {
        margin: 0;
        font-size: 15px;
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .animation-caption {
        margin: 6px 0 0;
        color: var(--muted);
        font-size: 13px;
        font-variant-numeric: tabular-nums;
        min-height: 1.2em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .animation-controls {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        flex: 0 0 auto;
      }
      .animation-controls button,
      .frame-chip {
        appearance: none;
        border: 1px solid var(--border);
        background: rgba(12, 23, 34, 0.92);
        color: var(--text);
        cursor: pointer;
      }
      .animation-controls button {
        border-radius: 999px;
        padding: 8px 12px;
        font-size: 12px;
        font-weight: 600;
      }
      .animation-controls button:hover,
      .frame-chip:hover,
      .frame-chip.is-active {
        border-color: rgba(167, 255, 207, 0.4);
        background: rgba(24, 49, 70, 0.96);
      }
      .animation-meta {
        margin: 0;
        padding: 0 14px;
        color: var(--muted);
        font-size: 13px;
        min-height: 1.2em;
      }
      .animation-strip {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 10px;
        margin-top: 12px;
      }
      .frame-chip {
        padding: 8px;
        border-radius: 14px;
        text-align: left;
      }
      .frame-chip img {
        border-radius: 10px;
      }
      .frame-chip span {
        display: block;
        margin-top: 8px;
        font-size: 12px;
        line-height: 1.35;
      }
      .tests-done {
        margin-top: 18px;
        border-radius: 14px;
        border: 1px solid rgba(41, 211, 255, 0.12);
        background: rgba(4, 10, 16, 0.85);
        overflow: hidden;
      }
      .tests-done summary {
        cursor: pointer;
        padding: 12px 14px;
        color: var(--text);
        font-size: 14px;
      }
      .tests-done ul {
        margin: 0;
        padding: 0 14px 14px 30px;
        color: var(--muted);
      }
      .card, .empty {
        overflow: hidden;
        border-radius: 20px;
        background: linear-gradient(180deg, rgba(12, 23, 34, 0.95), rgba(8, 18, 28, 0.96));
        border: 1px solid var(--border);
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.25);
      }
      .image-link {
        display: block;
        background: #02070b;
        padding: 12px;
      }
      img {
        display: block;
        width: 100%;
        height: auto;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.06);
        image-rendering: pixelated;
      }
      .card-body {
        padding: 16px 18px 18px;
      }
      .card h4, .empty h3 {
        margin: 0 0 8px;
        font-size: 16px;
      }
      .meta, .empty p {
        margin: 0;
        color: var(--muted);
      }
      .empty {
        padding: 24px;
      }
      @media (max-width: 900px) {
        .animation-toolbar {
          align-items: flex-start;
          flex-direction: column;
        }
        .program-grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class="wrap">
      <section class="hero">
        <p class="eyebrow">Unified Test Report</p>
        <h1>Nodal Test Dashboard</h1>
        <p class="hero-copy">One report for the full <code>npm test</code> run, with one dropdown per suite, animated plotter previews for multi-frame programs, and concise console output for quick debugging.</p>
        <div class="summary">
          <span class="pill">${suites.length} suite${suites.length === 1 ? "" : "s"}</span>
          <span class="pill">${totalTests} test${totalTests === 1 ? "" : "s"}</span>
          <span class="pill">${totalSnapshots} image${totalSnapshots === 1 ? "" : "s"} captured</span>
          <span class="pill">Generated ${escapeHtml(generatedAt)}</span>
          <span class="pill">report/index.html</span>
        </div>
      </section>
      <section class="suite-list">
        ${suiteSections}
      </section>
    </main>
    <script>
      (() => {
        const viewers = Array.from(document.querySelectorAll("[data-animation-viewer]"));
        for (const viewer of viewers) {
          const chips = Array.from(viewer.querySelectorAll(".frame-chip"));
          const mainImage = viewer.querySelector(".animation-main");
          const mainLink = viewer.querySelector(".animation-link");
          const caption = viewer.querySelector(".animation-caption");
          const meta = viewer.querySelector(".animation-meta");
          const toggle = viewer.querySelector('[data-action="toggle"]');
          const prev = viewer.querySelector('[data-action="prev"]');
          const next = viewer.querySelector('[data-action="next"]');
          if (!chips.length || !mainImage || !mainLink || !caption || !meta || !toggle || !prev || !next) {
            continue;
          }

          let currentIndex = 0;
          let playing = true;
          let timer = null;

          const render = (index) => {
            currentIndex = (index + chips.length) % chips.length;
            const chip = chips[currentIndex];
            if (!chip) return;
            const href = chip.dataset.frameHref || "";
            const name = chip.dataset.frameName || "";
            const frameMeta = chip.dataset.frameMeta || "";
            mainImage.src = href;
            mainImage.alt = name;
            mainLink.href = href;
            const captionText = "Frame " + (currentIndex + 1) + " / " + chips.length;
            caption.textContent = captionText;
            caption.title = captionText;
            meta.textContent = frameMeta;
            for (const [chipIndex, item] of chips.entries()) {
              item.classList.toggle("is-active", chipIndex === currentIndex);
            }
          };

          const stop = () => {
            if (timer !== null) {
              window.clearInterval(timer);
              timer = null;
            }
          };

          const start = () => {
            stop();
            timer = window.setInterval(() => render(currentIndex + 1), 900);
          };

          toggle.addEventListener("click", () => {
            playing = !playing;
            toggle.textContent = playing ? "Pause" : "Play";
            if (playing) start();
            else stop();
          });
          prev.addEventListener("click", () => {
            render(currentIndex - 1);
          });
          next.addEventListener("click", () => {
            render(currentIndex + 1);
          });
          chips.forEach((chip, index) => {
            chip.addEventListener("click", () => {
              render(index);
            });
          });

          render(0);
          start();
        }
      })();
    </script>
  </body>
</html>`;

  mkdirSync(rootDir, { recursive: true });
  rmSync(join(rootDir, "report.html"), { force: true });
  writeFileSync(join(rootDir, "index.html"), html, "utf8");
}
