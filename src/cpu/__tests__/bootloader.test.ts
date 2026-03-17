import { describe, expect, it } from "vitest";

import { assemble } from "../assembler";
import { readBootArgumentBlock } from "../bootArgs";
import { compile } from "../compiler";
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

function runCpuUntil(
  cpu: CPU,
  predicate: () => boolean,
  maxSteps = 200000,
): boolean {
  for (let i = 0; i < maxSteps && !cpu.state.halted; i++) {
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
    runCpuUntil(cpu, () => cpu.consoleOutput.join("").endsWith("unix$ ")),
  ).toBe(true);
  return cpu;
}

function sendShellCommand(cpu: CPU, command: string) {
  const before = cpu.consoleOutput.join("");
  for (const ch of command) {
    cpu.pushInput(ch.charCodeAt(0));
  }
  cpu.pushInput(10);
  return before;
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

  it("clr clears both the shell console and the plotter", () => {
    const boot = getBootloaderImage();
    const cpu = new CPU();

    cpu.plotterPixels.set(encodePlotterCoord(12, 34), 0x123456);
    cpu.loadProgram(boot.bytes, boot.startAddr);
    for (const ch of "clr") {
      cpu.pushInput(ch.charCodeAt(0));
    }
    cpu.pushInput(10);

    for (let i = 0; i < 200000 && !cpu.state.halted; i++) {
      cpu.step();
      if (cpu.consoleOutput.join("") === "unix$ ") {
        break;
      }
    }

    expect(cpu.consoleOutput.join("")).toBe("unix$ ");
    expect(cpu.plotterPixels.size).toBe(0);
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

  it("passes a resolved file entry to ASM programs", () => {
    const bootArgAsm = assemble(`
      LDM 0x1018
      CMP 1
      JZ have_file
      OUT '?'
      HLT

    have_file:
      LDM 0x101c
      DRVPG
      LDA 0
      STA 0x1100

    loop:
      LDM 0x1100
      TAB
      LDM 0x101e
      CMPB
      JZ done
      TBA
      DRVRD
      OUTA
      LDM 0x1100
      INC
      STA 0x1100
      JMP loop

    done:
      HLT
    `);
    expect(bootArgAsm.success).toBe(true);

    let disk = writeProgramToBootDisk(
      new Uint8Array(DRIVE_SIZE),
      "bootcat",
      bootArgAsm.bytes,
    );
    disk = writeFileToBootDisk(
      disk,
      "notes",
      Uint8Array.from("hello".split("").map((ch) => ch.charCodeAt(0))),
    );

    const result = runBootCommand(disk, "run bootcat notes");
    const args = readBootArgumentBlock(result.cpu.state.memory);

    expect(result.output).toContain("hello");
    expect(args.count).toBe(1);
    expect(args.file).toMatchObject({
      type: 1,
      sizeBytes: 5,
    });
  });

  it("passes a resolved file entry to C programs", () => {
    const compiled = compile(`
      int main() {
        int i;

        if (boot_argc() == 0) {
          print("NO ARG");
          return 0;
        }

        for (i = 0; i < boot_arg_size(); i++) {
          putchar(boot_file_read(i));
        }

        return 0;
      }
    `);
    expect(compiled.success).toBe(true);

    const program = assemble(compiled.assembly);
    expect(program.success).toBe(true);

    let disk = writeProgramToBootDisk(
      new Uint8Array(DRIVE_SIZE),
      "bootcat",
      program.bytes,
    );
    disk = writeFileToBootDisk(
      disk,
      "story",
      Uint8Array.from("abc".split("").map((ch) => ch.charCodeAt(0))),
    );

    const result = runBootCommand(disk, "run bootcat story");
    const args = readBootArgumentBlock(result.cpu.state.memory);

    expect(result.output).toContain("abc");
    expect(args.file?.sizeBytes).toBe(3);
    expect(args.file?.startPage).toBeGreaterThan(0);
  });

  it("accepts extra spaces around bootloader command arguments", () => {
    const spacedAsm = assemble(`
      LDM 0x1018
      ADD 48
      OUTA
      OUT ':'
      LDM 0x101e
      OUTD
      HLT
    `);
    expect(spacedAsm.success).toBe(true);

    let disk = writeProgramToBootDisk(
      new Uint8Array(DRIVE_SIZE),
      "spaced",
      spacedAsm.bytes,
    );
    disk = writeFileToBootDisk(
      disk,
      "notes",
      Uint8Array.from("hello".split("").map((ch) => ch.charCodeAt(0))),
    );

    const result = runBootCommand(disk, "run   spaced   notes");
    expect(result.output).toContain("1:5");
  });

  it("clears boot arguments before a later run without file arguments", () => {
    const bootArgAsm = assemble(`
      LDM 0x1018
      ADD 48
      OUTA
      OUT ':'
      LDM 0x101e
      OUTD
      HLT
    `);
    expect(bootArgAsm.success).toBe(true);

    let disk = writeProgramToBootDisk(
      new Uint8Array(DRIVE_SIZE),
      "bootarg",
      bootArgAsm.bytes,
    );
    disk = writeFileToBootDisk(
      disk,
      "notes",
      Uint8Array.from("hello".split("").map((ch) => ch.charCodeAt(0))),
    );

    const cpu = bootToPrompt(disk);

    sendShellCommand(cpu, "run bootarg notes");
    expect(runCpuUntil(cpu, () => cpu.state.halted)).toBe(true);
    expect(cpu.consoleOutput.join("")).toContain("1:5");

    const resumed = bootCpuToShell(cpu, { preserveConsole: true });
    expect(resumed).toBe(true);

    sendShellCommand(cpu, "run bootarg");
    expect(runCpuUntil(cpu, () => cpu.state.halted)).toBe(true);

    const output = cpu.consoleOutput.join("");
    expect(output).toContain("1:5");
    expect(output).toContain("0:0");
  });

  it("keeps the shell usable after error paths in cat and run", () => {
    const disk0 = writeProgramToBootDisk(new Uint8Array(DRIVE_SIZE), "calc", asm.bytes);
    const disk1 = writeFileToBootDisk(
      disk0,
      "notes",
      Uint8Array.from("hello".split("").map((ch) => ch.charCodeAt(0))),
    );

    const cpu = bootToPrompt(disk1);

    const beforeMissing = sendShellCommand(cpu, "cat missing");
    expect(
      runCpuUntil(
        cpu,
        () =>
          cpu.consoleOutput.join("").length > beforeMissing.length &&
          cpu.consoleOutput.join("").endsWith("unix$ "),
      ),
    ).toBe(true);
    expect(cpu.consoleOutput.join("").slice(beforeMissing.length)).toContain("not found");

    const beforeNotRunnable = sendShellCommand(cpu, "run notes");
    expect(
      runCpuUntil(
        cpu,
        () =>
          cpu.consoleOutput.join("").length > beforeNotRunnable.length &&
          cpu.consoleOutput.join("").endsWith("unix$ "),
      ),
    ).toBe(true);
    expect(cpu.consoleOutput.join("").slice(beforeNotRunnable.length)).toContain(
      "not runnable",
    );

    const beforeNotFile = sendShellCommand(cpu, "cat calc");
    expect(
      runCpuUntil(
        cpu,
        () =>
          cpu.consoleOutput.join("").length > beforeNotFile.length &&
          cpu.consoleOutput.join("").endsWith("unix$ "),
      ),
    ).toBe(true);
    expect(cpu.consoleOutput.join("").slice(beforeNotFile.length)).toContain("not file");

    const beforeRun = sendShellCommand(cpu, "run calc");
    expect(runCpuUntil(cpu, () => cpu.state.halted)).toBe(true);
    expect(cpu.consoleOutput.join("").slice(beforeRun.length)).toContain("OK");
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
