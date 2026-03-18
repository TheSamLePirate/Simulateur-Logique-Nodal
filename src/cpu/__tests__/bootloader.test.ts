import { describe, expect, it } from "vitest";

import { assemble } from "../assembler";
import { readBootArgumentBlock } from "../bootArgs";
import { compile } from "../compiler";
import { CPU } from "../cpu";
import { DRIVE_SIZE } from "../isa";
import { DEFAULT_PLOTTER_COLOR, encodePlotterCoord } from "../../plotter";
import {
  BOOT_DISK_MAX_ENTRIES,
  BOOTLOADER_PROMPT,
  bootCpuToShell,
  getBootloaderImage,
  getLinuxBootDiskImage,
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

function runBootInput(disk: Uint8Array, input: string, maxSteps = 400000) {
  const boot = getBootloaderImage();
  const cpu = new CPU();

  cpu.loadDriveData(disk);
  cpu.loadProgram(boot.bytes, boot.startAddr);
  for (const ch of input) {
    cpu.pushInput(ch.charCodeAt(0));
  }

  for (let i = 0; i < maxSteps && !cpu.state.halted; i++) {
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
    runCpuUntil(cpu, () => cpu.consoleOutput.join("").endsWith(BOOTLOADER_PROMPT)),
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
    expect(result.output).toContain("NodalLinux");
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
      if (cpu.consoleOutput.join("") === BOOTLOADER_PROMPT) {
        break;
      }
    }

    expect(cpu.consoleOutput.join("")).toBe(BOOTLOADER_PROMPT);
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
          cpu.consoleOutput.join("").endsWith(BOOTLOADER_PROMPT),
      ),
    ).toBe(true);
    expect(cpu.consoleOutput.join("").slice(beforeMissing.length)).toContain("not found");

    const beforeNotRunnable = sendShellCommand(cpu, "run notes");
    expect(
      runCpuUntil(
        cpu,
        () =>
          cpu.consoleOutput.join("").length > beforeNotRunnable.length &&
          cpu.consoleOutput.join("").endsWith(BOOTLOADER_PROMPT),
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
          cpu.consoleOutput.join("").endsWith(BOOTLOADER_PROMPT),
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
    expect(output).toContain("OK\nNodalLinux");
    expect(output).toContain(BOOTLOADER_PROMPT);
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

  it("builds a bundled Linux-like disk image with programs and files", () => {
    const disk = getLinuxBootDiskImage();
    const entries = readBootDiskEntries(disk);
    const names = entries.map((entry) => entry.name);

    expect(names).toContain("hello");
    expect(names).toContain("bootcat");
    expect(names).toContain("wc");
    expect(names).toContain("wget");
    expect(names).toContain("nano");
    expect(names).toContain("glxsh");
    expect(names).toContain("cp");
    expect(names).toContain("mv");
    expect(names).toContain("grep");
    expect(names).toContain("jsonp");
    expect(names).toContain("readme");
    expect(names).toContain("motd");
    expect(names).toContain("url");
    expect(names).toContain("DIGITS");
    expect(names).toContain("LETTERS");
    expect(names).toContain("result");
  });

  it("runs bundled Linux-like userland programs from disk", () => {
    const disk = getLinuxBootDiskImage();

    const hello = runBootCommand(disk, "run hello");
    expect(hello.output).toContain("hello from /bin/hello");

    const bootcat = runBootCommand(disk, "run bootcat readme");
    expect(bootcat.output).toContain("This is a tiny Linux-like environment");
  });

  it("copies a file with bundled cp", () => {
    const disk = getLinuxBootDiskImage();
    const result = runBootInput(disk, "run cp readme\ncopy2\n");
    const entries = readBootDiskEntries(result.cpu.driveData);
    const source = entries.find((entry) => entry.name === "readme");
    const copy = entries.find((entry) => entry.name === "copy2");

    expect(result.output).toContain("copied");
    expect(source).toBeDefined();
    expect(copy).toBeDefined();
    expect(copy!.sizeBytes).toBe(source!.sizeBytes);
    expect(
      String.fromCharCode(...Array.from(copy!.bytes.slice(0, copy!.sizeBytes))),
    ).toBe(
      String.fromCharCode(...Array.from(source!.bytes.slice(0, source!.sizeBytes))),
    );
  });

  it("moves a file with bundled mv", () => {
    const disk = getLinuxBootDiskImage();
    const result = runBootInput(disk, "run mv story\narchiv\n");
    const entries = readBootDiskEntries(result.cpu.driveData);

    expect(result.output).toContain("moved");
    expect(entries.find((entry) => entry.name === "story")).toBeUndefined();
    expect(entries.find((entry) => entry.name === "archiv")).toBeDefined();
  });

  it("searches text with bundled grep", () => {
    const disk = getLinuxBootDiskImage();
    const result = runBootInput(disk, "run grep story\ndreams\n");

    expect(result.output).toContain("match ");
  });

  it("extracts JSON values with bundled jsonp", () => {
    let disk = getLinuxBootDiskImage();
    disk = writeFileToBootDisk(
      disk,
      "samplejs",
      Uint8Array.from(
        Array.from('{"title":"Hello","done":false}').map((ch) => ch.charCodeAt(0)),
      ),
    );

    const result = runBootInput(disk, "run jsonp samplejs\ntitle\n");
    expect(result.output).toContain('"Hello"');
  });

  it("runs glxsh from the bundled disk with fonts already installed", () => {
    const disk = getLinuxBootDiskImage();
    const boot = getBootloaderImage();
    const cpu = new CPU();
    cpu.loadDriveData(disk);
    cpu.loadProgram(boot.bytes, boot.startAddr);

    for (const ch of "run glxsh\n") {
      cpu.pushInput(ch.charCodeAt(0));
    }

    cpu.run(600_000);

    expect(cpu.state.halted).toBe(false);
    expect(cpu.consoleOutput.join("")).not.toContain("NEED LETTERS DIGITS");
    expect(cpu.plotterPixels.size).toBeGreaterThan(0);
  });

  it("runs bundled wget against a URL file", async () => {
    const disk = getLinuxBootDiskImage();
    const boot = getBootloaderImage();
    const cpu = new CPU();
    cpu.httpFetch = async ({ method, url }) => {
      expect(method).toBe("GET");
      expect(url).toBe("https://jsonplaceholder.typicode.com/todos/1");
      return "tiny fetch ok";
    };
    cpu.loadDriveData(disk);
    cpu.loadProgram(boot.bytes, boot.startAddr);

    for (const ch of "run wget url\n") {
      cpu.pushInput(ch.charCodeAt(0));
    }

    await cpu.runAsync(500_000);

    expect(cpu.consoleOutput.join("")).toContain("tiny fetch ok");
    const resultEntry = readBootDiskEntries(cpu.driveData).find((entry) => entry.name === "result");
    expect(resultEntry).toBeDefined();
    expect(
      String.fromCharCode(
        ...Array.from(resultEntry!.bytes.slice(0, resultEntry!.sizeBytes)),
      ),
    ).toContain("tiny fetch ok");
    expect(cpu.state.halted).toBe(true);
  });

  it("keeps long wget URLs intact before issuing HTTP GET", async () => {
    let disk = getLinuxBootDiskImage();
    const longUrl = "https://jsonplaceholder.typicode.com/todos/1";
    disk = writeFileToBootDisk(
      disk,
      "url",
      Uint8Array.from(Array.from(longUrl).map((ch) => ch.charCodeAt(0))),
    );

    const boot = getBootloaderImage();
    const cpu = new CPU();
    cpu.httpFetch = async ({ method, url }) => {
      expect(method).toBe("GET");
      expect(url).toBe(longUrl);
      return "{\"ok\":1}";
    };
    cpu.loadDriveData(disk);
    cpu.loadProgram(boot.bytes, boot.startAddr);

    for (const ch of "run wget url\n") {
      cpu.pushInput(ch.charCodeAt(0));
    }

    await cpu.runAsync(500_000);

    expect(cpu.httpLastUrl).toBe(longUrl);
    expect(cpu.consoleOutput.join("")).toContain("{\"ok\":1}");
    const resultEntry = readBootDiskEntries(cpu.driveData).find((entry) => entry.name === "result");
    expect(resultEntry).toBeDefined();
    expect(
      String.fromCharCode(
        ...Array.from(resultEntry!.bytes.slice(0, resultEntry!.sizeBytes)),
      ),
    ).toContain("{\"ok\":1}");
  });
});
