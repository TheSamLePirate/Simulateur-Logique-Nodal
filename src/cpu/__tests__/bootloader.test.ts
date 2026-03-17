import { describe, expect, it } from "vitest";

import { assemble } from "../assembler";
import { CPU } from "../cpu";
import { DRIVE_SIZE } from "../isa";
import { DEFAULT_PLOTTER_COLOR, encodePlotterCoord } from "../../plotter";
import {
  BOOT_DISK_MAX_ENTRIES,
  bootCpuToShell,
  getBootloaderImage,
  readBootDiskEntries,
  writeFileToBootDisk,
  writeProgramToBootDisk,
} from "../bootloader";

function runBootCommand(disk: Uint8Array, command: string) {
  const boot = getBootloaderImage();
  const cpu = new CPU();

  cpu.loadDriveData(disk);
  cpu.loadProgram(boot.bytes, boot.startAddr);
  for (const ch of command) {
    cpu.pushInput(ch.charCodeAt(0));
  }
  cpu.pushInput(10);

  for (let i = 0; i < 200000 && !cpu.state.halted; i++) {
    cpu.step();
  }

  return {
    output: cpu.consoleOutput.join(""),
    cpu,
  };
}

describe("bootloader shell", () => {
  const asm = assemble(`
    OUT 'O'
    OUT 'K'
    HLT
  `);
  expect(asm.success).toBe(true);

  it("stores programs on the boot disk directory", () => {
    const disk = writeProgramToBootDisk(
      new Uint8Array(DRIVE_SIZE),
      "calc",
      Uint8Array.from([0xc0, 0x4f, 0x00, 0x0f]),
    );
    const entries = readBootDiskEntries(disk);

    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("calc");
    expect(entries[0].type).toBe(2);
    expect(entries[0].pageCount).toBe(1);
    expect(entries[0].bytes[0]).toBe(0xc0);
  });

  it("lists boot disk files and programs", () => {
    const disk0 = writeProgramToBootDisk(new Uint8Array(DRIVE_SIZE), "calc", asm.bytes);
    const disk1 = writeFileToBootDisk(
      disk0,
      "notes",
      Uint8Array.from("hello".split("").map((ch) => ch.charCodeAt(0))),
    );
    const result = runBootCommand(disk1, "ls");
    expect(result.output).toContain("UNIX BOOT");
    expect(result.output).toContain("p calc 1p");
    expect(result.output).toContain("f notes 5b");
  });

  it("supports 64 directory entries across multiple directory pages", () => {
    let disk = new Uint8Array(DRIVE_SIZE);

    for (let i = 0; i < BOOT_DISK_MAX_ENTRIES; i++) {
      disk = writeFileToBootDisk(
        disk,
        `f${i.toString(16).padStart(2, "0")}`,
        Uint8Array.from([65 + (i & 0x0f)]),
      );
    }
    disk = writeFileToBootDisk(disk, "f3f", Uint8Array.from([90]));

    const entries = readBootDiskEntries(disk);
    expect(entries).toHaveLength(BOOT_DISK_MAX_ENTRIES);
    expect(entries.at(-1)?.name).toBe("f3f");

    const result = runBootCommand(disk, "cat f3f");
    expect(result.output).toContain("Z");
    expect(() =>
      writeFileToBootDisk(disk, "extra", Uint8Array.from([88])),
    ).toThrow(`Disk directory full (max ${BOOT_DISK_MAX_ENTRIES} entries).`);
  });

  it("runs a program from disk", () => {
    const disk = writeProgramToBootDisk(new Uint8Array(DRIVE_SIZE), "calc", asm.bytes);
    const result = runBootCommand(disk, "run calc");
    expect(result.output).toContain("OK");
    expect(result.cpu.state.halted).toBe(true);
  });

  it("can return to the shell prompt after a program halts", () => {
    const disk = writeProgramToBootDisk(new Uint8Array(DRIVE_SIZE), "calc", asm.bytes);
    const result = runBootCommand(disk, "run calc");
    const resumed = bootCpuToShell(result.cpu, { preserveConsole: true });
    const output = result.cpu.consoleOutput.join("");

    expect(resumed).toBe(true);
    expect(result.cpu.state.halted).toBe(false);
    expect(output).toContain("OK\nUNIX BOOT");
    expect(output).toContain("unix$ ");
  });

  it("can return to the shell prompt without clearing the plotter", () => {
    const drawAsm = assemble(`
      LDA 120
      COLR
      LDA 34
      COLG
      LDA 200
      COLB
      LDA 45
      TAB
      LDA 23
      DRAW
      HLT
    `);
    expect(drawAsm.success).toBe(true);

    const disk = writeProgramToBootDisk(new Uint8Array(DRIVE_SIZE), "draw", drawAsm.bytes);
    const result = runBootCommand(disk, "run draw");

    const beforePixels = new Map(result.cpu.plotterPixels);
    const beforeColor = { ...result.cpu.plotterColor };
    expect(beforePixels.has(encodePlotterCoord(23, 45))).toBe(true);
    expect(beforeColor).not.toEqual(DEFAULT_PLOTTER_COLOR);

    const resumed = bootCpuToShell(result.cpu, {
      preserveConsole: true,
      preservePlotter: true,
    });

    expect(resumed).toBe(true);
    expect(result.cpu.plotterPixels).toEqual(beforePixels);
    expect(result.cpu.plotterColor).toEqual(beforeColor);
  });

  it("cats a text file from disk", () => {
    const disk = writeFileToBootDisk(
      new Uint8Array(DRIVE_SIZE),
      "notes",
      Uint8Array.from("hello".split("").map((ch) => ch.charCodeAt(0))),
    );
    const result = runBootCommand(disk, "cat notes");
    expect(result.output).toContain("hello");
  });
});
