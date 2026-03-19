import { rmSync } from "node:fs";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { CPU } from "../../cpu/cpu";
import {
  PLOTTER_REPORT_ROOT,
  writeCombinedPlotterHtmlReport,
  writePlotterSuiteData,
} from "../../cpu/__tests__/plotterImage";
import {
  handleRunningKeyboardDown,
  handleRunningKeyboardUp,
} from "./runningKeyboard";

const KEYBOARD_REPORT_DIR = `${PLOTTER_REPORT_ROOT}/running-keyboard`;
const suiteConsoleLines: string[] = [];
const suiteTests: string[] = [];

beforeAll(() => {
  rmSync(KEYBOARD_REPORT_DIR, { recursive: true, force: true });
});

afterEach(() => {
  const testName = expect.getState().currentTestName ?? "unknown test";
  suiteTests.push(testName);
  suiteConsoleLines.push(`[test] ${testName}`);
});

afterAll(() => {
  suiteConsoleLines.push(`[suite] ${suiteTests.length} tests recorded`);
  writePlotterSuiteData({
    suiteName: "Running Keyboard Tests",
    suiteKey: "running-keyboard",
    rootDir: PLOTTER_REPORT_ROOT,
    snapshots: [],
    notes: [
      "Generated at the end of runningKeyboard.test.ts during vitest.",
      "This suite validates immediate key routing and intentionally has no plotter image snapshots.",
    ],
    consoleLines: suiteConsoleLines,
    tests: suiteTests,
  });
  writeCombinedPlotterHtmlReport(PLOTTER_REPORT_ROOT);
});

describe("running keyboard handler", () => {
  it("applies arrow keys immediately through keyState", () => {
    const cpu = new CPU();

    expect(handleRunningKeyboardDown(cpu, { key: "ArrowLeft" })).toBe(true);
    expect(cpu.keyState[0]).toBe(1);
    expect(handleRunningKeyboardUp(cpu, { key: "ArrowLeft" })).toBe(true);
    expect(cpu.keyState[0]).toBe(0);
  });

  it("queues Enter immediately and also updates enter key state", () => {
    const cpu = new CPU();

    expect(handleRunningKeyboardDown(cpu, { key: "Enter" })).toBe(true);
    expect(cpu.keyState[4]).toBe(1);
    expect(cpu.consoleInputBuffer).toEqual([10]);

    expect(handleRunningKeyboardUp(cpu, { key: "Enter" })).toBe(true);
    expect(cpu.keyState[4]).toBe(0);
  });

  it("queues printable and control keys immediately", () => {
    const cpu = new CPU();

    expect(handleRunningKeyboardDown(cpu, { key: "a" })).toBe(true);
    expect(handleRunningKeyboardDown(cpu, { key: "Backspace" })).toBe(true);
    expect(handleRunningKeyboardDown(cpu, { key: "Tab" })).toBe(true);
    expect(handleRunningKeyboardDown(cpu, { key: "Escape" })).toBe(true);
    expect(handleRunningKeyboardDown(cpu, { key: "Delete" })).toBe(true);
    expect(handleRunningKeyboardDown(cpu, { key: "!" })).toBe(true);

    expect(cpu.consoleInputBuffer).toEqual([
      "a".charCodeAt(0),
      8,
      9,
      27,
      127,
      "!".charCodeAt(0),
    ]);
  });

  it("ignores modified shortcuts so browser/app shortcuts keep working", () => {
    const cpu = new CPU();

    expect(handleRunningKeyboardDown(cpu, { key: "r", ctrlKey: true })).toBe(false);
    expect(handleRunningKeyboardDown(cpu, { key: "k", metaKey: true })).toBe(false);
    expect(cpu.consoleInputBuffer).toEqual([]);
  });

  it("does not hijack typing inside editable DOM targets", () => {
    const cpu = new CPU();

    expect(
      handleRunningKeyboardDown(cpu, {
        key: "a",
        target: { tagName: "input" },
      }),
    ).toBe(false);
    expect(
      handleRunningKeyboardDown(cpu, {
        key: "Enter",
        target: { tagName: "textarea" },
      }),
    ).toBe(false);
    expect(cpu.consoleInputBuffer).toEqual([]);
    expect(cpu.keyState[4]).toBe(0);
  });
});
