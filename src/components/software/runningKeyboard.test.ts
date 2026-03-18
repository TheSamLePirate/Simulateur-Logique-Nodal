import { describe, expect, it } from "vitest";

import { CPU } from "../../cpu/cpu";
import {
  handleRunningKeyboardDown,
  handleRunningKeyboardUp,
} from "./runningKeyboard";

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

  it("queues printable keys and backspace immediately", () => {
    const cpu = new CPU();

    expect(handleRunningKeyboardDown(cpu, { key: "a" })).toBe(true);
    expect(handleRunningKeyboardDown(cpu, { key: "Backspace" })).toBe(true);
    expect(handleRunningKeyboardDown(cpu, { key: "Tab" })).toBe(true);
    expect(handleRunningKeyboardDown(cpu, { key: "!" })).toBe(true);

    expect(cpu.consoleInputBuffer).toEqual([
      "a".charCodeAt(0),
      8,
      9,
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
