import { describe, expect, it } from "vitest";

import { assemble } from "../assembler";
import {
  formatBootDisk,
  readBootDiskEntries,
  writeFileToBootDisk,
} from "../bootloader";
import { CPU } from "../cpu";
import { EXAMPLES } from "../examples";
import { CODE_SIZE } from "../isa";

function findEntry(cpu: CPU, name: string) {
  for (let base = 16; base < 16 + 64 * 12; base += 12) {
    let matches = true;
    for (let i = 0; i < 8; i++) {
      const code = i < name.length ? name.charCodeAt(i) : 0;
      if (cpu.driveData[base + i] !== code) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return base;
    }
  }

  return -1;
}

describe("ASM examples", () => {
  it('"Éditeur FS ASM" assembles and fits in code memory', () => {
    const example = EXAMPLES.find((e) => e.name === "Éditeur FS ASM");
    expect(example).toBeDefined();

    const ar = assemble(example!.code);
    expect(ar.success).toBe(true);
    expect(ar.errors).toHaveLength(0);
    expect(ar.bytes.length).toBeLessThanOrEqual(CODE_SIZE);
  });

  it('"Éditeur FS ASM" opens /o filename on the real FS and edits that file with arrow movement', () => {
    const example = EXAMPLES.find((e) => e.name === "Éditeur FS ASM");
    expect(example).toBeDefined();

    const ar = assemble(example!.code);
    expect(ar.success).toBe(true);

    const cpu = new CPU();
    let disk = formatBootDisk();
    for (let i = 0; i < 24; i++) {
      disk = writeFileToBootDisk(
        disk,
        `f${i.toString().padStart(2, "0")}`,
        new Uint8Array([65 + i]),
      );
    }
    disk = writeFileToBootDisk(
      disk,
      "todo",
      new Uint8Array([
        "a".charCodeAt(0),
        "b".charCodeAt(0),
      ]),
    );
    cpu.driveData.set(disk);
    cpu.loadProgram(ar.bytes);

    const pushText = (text: string) => {
      for (const ch of text) {
        cpu.pushInput(ch.charCodeAt(0));
      }
    };

    const stepMany = (count: number) => {
      for (let i = 0; i < count && !cpu.state.halted; i++) {
        cpu.step();
      }
    };

    const runUntil = (predicate: () => boolean, limit = 2_000_000) => {
      for (let i = 0; i < limit && !cpu.state.halted; i++) {
        if (predicate()) return;
        cpu.step();
      }
      expect(predicate()).toBe(true);
    };

    const tapKey = (index: number) => {
      cpu.keyState[index] = 1;
      stepMany(400);
      cpu.keyState[index] = 0;
      stepMany(80);
    };

    pushText("/o todo\n");
    runUntil(() => cpu.state.memory[0x1002] === 2 && cpu.state.memory[0x1003] === 2);

    runUntil(() => cpu.state.memory[0x1003] === 2);

    tapKey(0);
    runUntil(() => cpu.state.memory[0x1003] === 1);

    pushText("X\n/s\n@\n");
    runUntil(() => cpu.state.halted);

    const todoBase = findEntry(cpu, "todo");
    expect(todoBase).toBeGreaterThanOrEqual(0);

    const page = cpu.driveData[todoBase + 9];
    const size = cpu.driveData[todoBase + 11];
    expect(size).toBe(3);
    expect(cpu.driveData[(page << 8) + 0]).toBe("a".charCodeAt(0));
    expect(cpu.driveData[(page << 8) + 1]).toBe("X".charCodeAt(0));
    expect(cpu.driveData[(page << 8) + 2]).toBe("b".charCodeAt(0));
  }, 15_000);

  it('"Éditeur FS ASM" creates a new file with /o filename and saves it in bootloader FS format', () => {
    const example = EXAMPLES.find((e) => e.name === "Éditeur FS ASM");
    expect(example).toBeDefined();

    const ar = assemble(example!.code);
    expect(ar.success).toBe(true);

    const cpu = new CPU();
    cpu.driveData.set(formatBootDisk());
    cpu.loadProgram(ar.bytes);

    const pushText = (text: string) => {
      for (const ch of text) {
        cpu.pushInput(ch.charCodeAt(0));
      }
    };

    const runUntil = (predicate: () => boolean, limit = 2_000_000) => {
      for (let i = 0; i < limit && !cpu.state.halted; i++) {
        if (predicate()) return;
        cpu.step();
      }
      expect(predicate()).toBe(true);
    };

    pushText("/o story\n");
    runUntil(() => cpu.state.memory[0x1002] === 0 && cpu.state.memory[0x1003] === 0);

    pushText("Hello\n/s\n@\n");
    runUntil(() => cpu.state.halted);

    const entries = readBootDiskEntries(cpu.driveData);
    const story = entries.find((entry) => entry.name === "story");
    expect(story).toBeDefined();
    expect(story?.type).toBe(1);
    expect(story?.pageCount).toBe(1);
    expect(story?.sizeBytes).toBe(5);
    expect(Array.from(story?.bytes.slice(0, 5) ?? [])).toEqual([
      "H".charCodeAt(0),
      "e".charCodeAt(0),
      "l".charCodeAt(0),
      "l".charCodeAt(0),
      "o".charCodeAt(0),
    ]);
  }, 15_000);
});
