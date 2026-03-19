import { expect } from "vitest";

import {
  BOOTLOADER_PROMPT,
  getBootloaderImage,
  getLinuxBootDiskImage,
  readBootDiskEntries,
  writeFileToBootDisk,
} from "../cpu/bootloader";
import { CPU, type HttpFetchHandler } from "../cpu/cpu";
import { LINUX_USERLAND_PROGRAMS, type LinuxUserlandProgram } from "../cpu/linuxUserland";

export interface LinuxUserlandProgramScenario {
  timeout?: number;
  run: (program: LinuxUserlandProgram) => Promise<CPU> | CPU;
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
}

export function cloneLinuxDisk() {
  return new Uint8Array(getLinuxBootDiskImage());
}

export function runCpuUntil(
  cpu: CPU,
  predicate: () => boolean,
  maxSteps = 400_000,
) {
  for (let step = 0; step < maxSteps && !cpu.state.halted; step++) {
    if (predicate()) return true;
    cpu.step();
  }
  return predicate();
}

export function bootToPrompt(disk: Uint8Array, httpFetch?: HttpFetchHandler) {
  const boot = getBootloaderImage();
  const cpu = new CPU();
  if (httpFetch) {
    cpu.httpFetch = httpFetch;
  }

  cpu.loadDriveData(disk);
  cpu.loadProgram(boot.bytes, boot.startAddr);

  expect(
    runCpuUntil(cpu, () => cpu.consoleOutput.join("").endsWith(BOOTLOADER_PROMPT)),
  ).toBe(true);

  return cpu;
}

export function pushText(cpu: CPU, text: string) {
  for (const char of text) {
    cpu.pushInput(char.charCodeAt(0));
  }
}

export function runBootInput(
  disk: Uint8Array,
  input: string,
  maxSteps = 600_000,
  httpFetch?: HttpFetchHandler,
) {
  const cpu = bootToPrompt(disk, httpFetch);
  pushText(cpu, input);
  cpu.run(maxSteps);
  return cpu;
}

export async function runBootInputAsync(
  disk: Uint8Array,
  input: string,
  maxCycles = 600_000,
  httpFetch?: HttpFetchHandler,
) {
  const cpu = bootToPrompt(disk, httpFetch);
  pushText(cpu, input);
  await cpu.runAsync(maxCycles);
  return cpu;
}

export function requireEntry(cpu: CPU, name: string) {
  const entry = readBootDiskEntries(cpu.driveData).find((candidate) => candidate.name === name);
  expect(entry).toBeDefined();
  return entry!;
}

export const LINUX_USERLAND_PROGRAM_SCENARIOS: Record<string, LinuxUserlandProgramScenario> = {
  hello: {
    run: () => {
      const cpu = runBootInput(cloneLinuxDisk(), "run hello\n", 200_000);
      expect(cpu.consoleOutput.join("")).toContain("hello from /bin/hello");
      return cpu;
    },
  },
  sysinfo: {
    run: () => {
      const cpu = runBootInput(cloneLinuxDisk(), "run sysinfo\n", 200_000);
      expect(cpu.consoleOutput.join("")).toContain("NodalLinux 8-bit");
      return cpu;
    },
  },
  uname: {
    run: () => {
      const cpu = runBootInput(cloneLinuxDisk(), "run uname\n", 200_000);
      expect(cpu.consoleOutput.join("")).toContain("NodalLinux 8-bit 0.3");
      return cpu;
    },
  },
  pwd: {
    run: () => {
      const cpu = runBootInput(cloneLinuxDisk(), "run pwd\n", 200_000);
      expect(cpu.consoleOutput.join("")).toContain("/\n");
      return cpu;
    },
  },
  bootcat: {
    run: () => {
      const cpu = runBootInput(cloneLinuxDisk(), "run bootcat readme\n", 300_000);
      expect(cpu.consoleOutput.join("")).toContain("Programs live on the external drive");
      return cpu;
    },
  },
  argdump: {
    run: () => {
      const cpu = runBootInput(cloneLinuxDisk(), "run argdump readme\n", 300_000);
      expect(cpu.consoleOutput.join("")).toContain("type file");
      expect(cpu.consoleOutput.join("")).toContain("size ");
      return cpu;
    },
  },
  wc: {
    run: () => {
      const cpu = runBootInput(cloneLinuxDisk(), "run wc story\n", 300_000);
      expect(cpu.consoleOutput.join("")).toContain("b ");
      expect(cpu.consoleOutput.join("")).toContain("l");
      return cpu;
    },
  },
  head: {
    run: () => {
      const cpu = runBootInput(cloneLinuxDisk(), "run head readme\n", 300_000);
      expect(cpu.consoleOutput.join("")).toContain("This is a tiny Linux-like env");
      return cpu;
    },
  },
  wget: {
    run: async () => {
      const cpu = await runBootInputAsync(
        cloneLinuxDisk(),
        "run wget url\n",
        700_000,
        async ({ method, url }) => {
          expect(method).toBe("GET");
          expect(url).toBe("https://jsonplaceholder.typicode.com/todos/1");
          return "{\"ok\":1}";
        },
      );
      expect(cpu.consoleOutput.join("")).toContain("{\"ok\":1}");
      return cpu;
    },
  },
  ascii: {
    run: () => {
      const cpu = runBootInput(cloneLinuxDisk(), "run ascii\n", 250_000);
      expect(cpu.consoleOutput.join("")).toContain("! \" #");
      return cpu;
    },
  },
  upper: {
    run: () => {
      const cpu = bootToPrompt(cloneLinuxDisk());
      pushText(cpu, "run upper\nabc\n");
      expect(
        runCpuUntil(cpu, () => cpu.consoleOutput.join("").includes("ABC"), 400_000),
      ).toBe(true);
      expect(cpu.state.halted).toBe(false);
      return cpu;
    },
  },
  echoio: {
    run: () => {
      const cpu = bootToPrompt(cloneLinuxDisk());
      pushText(cpu, "run echoio\nabc\n");
      expect(
        runCpuUntil(cpu, () => cpu.consoleOutput.join("").includes("abc"), 400_000),
      ).toBe(true);
      expect(cpu.state.halted).toBe(false);
      return cpu;
    },
  },
  plot: {
    timeout: 10_000,
    run: () => {
      const cpu = runBootInput(cloneLinuxDisk(), "run plot\n", 2_000_000);
      expect(cpu.plotterPixels.size).toBeGreaterThan(0);
      return cpu;
    },
  },
  nano: {
    timeout: 10_000,
    run: () => {
      const cpu = runBootInput(cloneLinuxDisk(), "run nano readme\n@\n", 1_200_000);
      expect(cpu.consoleOutput.join("")).toContain("=== EDITEUR FS ASM ===");
      return cpu;
    },
  },
  glxnano: {
    timeout: 10_000,
    run: () => {
      const cpu = bootToPrompt(cloneLinuxDisk());
      pushText(cpu, "run glxnano readme\n");
      expect(
        runCpuUntil(
          cpu,
          () => cpu.plotterPixels.size > 0 && cpu.state.memory[0x1009] === 0,
          700_000,
        ),
      ).toBe(true);
      expect(cpu.state.halted).toBe(false);
      return cpu;
    },
  },
  glxsh: {
    timeout: 10_000,
    run: () => {
      const cpu = bootToPrompt(cloneLinuxDisk());
      pushText(cpu, "run glxsh\n");
      cpu.run(700_000);
      expect(cpu.state.halted).toBe(false);
      expect(cpu.plotterPixels.size).toBeGreaterThan(0);
      return cpu;
    },
  },
  cp: {
    run: () => {
      const cpu = runBootInput(cloneLinuxDisk(), "run cp readme\ncopy2\n", 800_000);
      expect(cpu.consoleOutput.join("")).toContain("copied");
      requireEntry(cpu, "copy2");
      return cpu;
    },
  },
  mv: {
    run: () => {
      const cpu = runBootInput(cloneLinuxDisk(), "run mv story\narchiv\n", 800_000);
      expect(cpu.consoleOutput.join("")).toContain("moved");
      expect(readBootDiskEntries(cpu.driveData).find((entry) => entry.name === "story")).toBeUndefined();
      requireEntry(cpu, "archiv");
      return cpu;
    },
  },
  grep: {
    run: () => {
      const cpu = runBootInput(cloneLinuxDisk(), "run grep story\ndreams\n", 800_000);
      expect(cpu.consoleOutput.join("")).toContain("match ");
      return cpu;
    },
  },
  jsonp: {
    run: () => {
      let disk = cloneLinuxDisk();
      disk = writeFileToBootDisk(
        disk,
        "samplejs",
        Uint8Array.from(
          Array.from("{\"title\":\"Hello\",\"done\":false}").map((char) => char.charCodeAt(0)),
        ),
      );
      const cpu = runBootInput(disk, "run jsonp samplejs\ntitle\n", 800_000);
      expect(cpu.consoleOutput.join("")).toContain("\"Hello\"");
      return cpu;
    },
  },
};

export function getLinuxUserlandScenario(program: LinuxUserlandProgram) {
  const scenario = LINUX_USERLAND_PROGRAM_SCENARIOS[program.name];
  expect(scenario, `Missing Linux userland test scenario for "${program.name}"`).toBeDefined();
  return scenario!;
}

export function expectLinuxUserlandScenarioCoverage() {
  const expected = new Set(LINUX_USERLAND_PROGRAMS.map((program) => program.name));
  const actual = new Set(Object.keys(LINUX_USERLAND_PROGRAM_SCENARIOS));

  expect([...expected].filter((name) => !actual.has(name))).toEqual([]);
  expect([...actual].filter((name) => !expected.has(name))).toEqual([]);
}
