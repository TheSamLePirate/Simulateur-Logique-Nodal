import { describe, expect, it } from "vitest";

import { assemble } from "../assembler";
import { CPU } from "../cpu";
import {
  getBootloaderImage,
  readBootDiskEntries,
  writeProgramToBootDisk,
} from "../bootloader";

function runBootCommand(driveProgramName: string, command: string) {
  const asm = assemble(`
    OUT 'O'
    OUT 'K'
    HLT
  `);
  expect(asm.success).toBe(true);

  const disk = writeProgramToBootDisk(
    new Uint8Array(8192),
    driveProgramName,
    asm.bytes,
  );
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
  it("stores programs on the boot disk directory", () => {
    const disk = writeProgramToBootDisk(
      new Uint8Array(8192),
      "a",
      Uint8Array.from([0xc0, 0x4f, 0x00, 0x0f]),
    );
    const entries = readBootDiskEntries(disk);

    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("a");
    expect(entries[0].pageCount).toBe(1);
    expect(entries[0].bytes[0]).toBe(0xc0);
  });

  it("lists boot disk programs", () => {
    const result = runBootCommand("a", "ls");
    expect(result.output).toContain("BOOT SHELL");
    expect(result.output).toContain("a 1p");
  });

  it("runs a program from disk", () => {
    const result = runBootCommand("a", "run a");
    expect(result.output).toContain("OK");
    expect(result.cpu.state.halted).toBe(true);
  });
});
