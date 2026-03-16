import { assemble } from "./assembler";
import { DRIVE_PAGE_SIZE, DRIVE_SIZE } from "./isa";

export const BOOTLOADER_START = 0x0b00;
export const BOOT_DISK_MAGIC = 0x42;
export const BOOT_DISK_VERSION = 0x01;
export const BOOT_DISK_MAX_ENTRIES = 8;
export const BOOT_DISK_ENTRY_SIZE = 3;
export const BOOT_DISK_DIR_OFFSET = 0x10;
export const BOOT_DISK_DATA_START_PAGE = 1;
export const BOOT_DISK_PAGE_COUNT = DRIVE_SIZE / DRIVE_PAGE_SIZE;
export const BOOT_PROGRAM_MAX_PAGES = Math.floor(
  BOOTLOADER_START / DRIVE_PAGE_SIZE,
);

export interface BootDiskEntry {
  name: string;
  startPage: number;
  pageCount: number;
  bytes: Uint8Array;
}

export interface BootloaderImage {
  bytes: number[];
  startAddr: number;
}

function normalizeProgramName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Program name cannot be empty.");
  return trimmed[0];
}

function isBootDiskFormatted(driveData: ArrayLike<number>): boolean {
  return (
    (driveData[0] ?? 0) === BOOT_DISK_MAGIC &&
    (driveData[1] ?? 0) === BOOT_DISK_VERSION
  );
}

export function readBootDiskEntries(driveData: ArrayLike<number>): BootDiskEntry[] {
  if (!isBootDiskFormatted(driveData)) return [];

  const entries: BootDiskEntry[] = [];
  for (let i = 0; i < BOOT_DISK_MAX_ENTRIES; i++) {
    const base = BOOT_DISK_DIR_OFFSET + i * BOOT_DISK_ENTRY_SIZE;
    const nameByte = driveData[base] ?? 0;
    const startPage = driveData[base + 1] ?? 0;
    const pageCount = driveData[base + 2] ?? 0;
    if (nameByte === 0 || startPage === 0 || pageCount === 0) continue;

    const start = startPage * DRIVE_PAGE_SIZE;
    const end = Math.min(start + pageCount * DRIVE_PAGE_SIZE, DRIVE_SIZE);
    entries.push({
      name: String.fromCharCode(nameByte),
      startPage,
      pageCount,
      bytes: Uint8Array.from(
        { length: Math.max(0, end - start) },
        (_, idx) => driveData[start + idx] ?? 0,
      ),
    });
  }
  return entries;
}

export function writeProgramToBootDisk(
  driveData: ArrayLike<number>,
  name: string,
  programBytes: ArrayLike<number>,
): Uint8Array {
  const normalizedName = normalizeProgramName(name);
  const rawProgram = Uint8Array.from(programBytes);
  const pageCount = Math.ceil(rawProgram.length / DRIVE_PAGE_SIZE);

  if (pageCount <= 0) {
    throw new Error("Program is empty.");
  }
  if (pageCount > BOOT_PROGRAM_MAX_PAGES) {
    throw new Error(`Program is too large for disk boot (${rawProgram.length} bytes).`);
  }

  const existing = readBootDiskEntries(driveData).filter(
    (entry) => entry.name !== normalizedName,
  );
  const nextEntries = [
    ...existing,
    {
      name: normalizedName,
      startPage: 0,
      pageCount,
      bytes: rawProgram,
    },
  ];

  if (nextEntries.length > BOOT_DISK_MAX_ENTRIES) {
    throw new Error(`Disk directory full (max ${BOOT_DISK_MAX_ENTRIES} programs).`);
  }

  let nextPage = BOOT_DISK_DATA_START_PAGE;
  for (const entry of nextEntries) {
    entry.startPage = nextPage;
    nextPage += entry.pageCount;
  }

  if (nextPage > BOOT_DISK_PAGE_COUNT) {
    throw new Error("Disk is full.");
  }

  const nextDisk = new Uint8Array(DRIVE_SIZE);
  nextDisk[0] = BOOT_DISK_MAGIC;
  nextDisk[1] = BOOT_DISK_VERSION;

  nextEntries.forEach((entry, index) => {
    const base = BOOT_DISK_DIR_OFFSET + index * BOOT_DISK_ENTRY_SIZE;
    nextDisk[base] = entry.name.charCodeAt(0) & 0xff;
    nextDisk[base + 1] = entry.startPage & 0xff;
    nextDisk[base + 2] = entry.pageCount & 0xff;
    nextDisk.set(
      entry.bytes.slice(0, entry.pageCount * DRIVE_PAGE_SIZE),
      entry.startPage * DRIVE_PAGE_SIZE,
    );
  });

  return nextDisk;
}

function buildCopyRoutines(): string {
  return Array.from({ length: BOOT_PROGRAM_MAX_PAGES }, (_, i) => {
    const baseAddr = i * DRIVE_PAGE_SIZE;
    const nextLabel =
      i + 1 < BOOT_PROGRAM_MAX_PAGES ? `copy_page_${i + 1}` : "launch_program";
    return `
copy_page_${i}:
  LDA 0
  STA 0x1020
copy_page_${i}_loop:
  LDM 0x1020
  DRVRD
  STA 0x1021
  LDM 0x1020
  TAB
  LDM 0x1021
  STAI 0x${baseAddr.toString(16).padStart(4, "0")}
  LDM 0x1020
  INC
  STA 0x1020
  JNZ copy_page_${i}_loop
  LDM 0x1024
  INC
  STA 0x1024
  LDM 0x1025
  DEC
  STA 0x1025
  JZ launch_program
  LDM 0x1024
  DRVPG
  JMP ${nextLabel}
`;
  }).join("\n");
}

export const BOOTLOADER_SOURCE = `
start:
  LDA 0
  DRVPG
  OUT 'B'
  OUT 'O'
  OUT 'O'
  OUT 'T'
  OUT ' '
  OUT 'S'
  OUT 'H'
  OUT 'E'
  OUT 'L'
  OUT 'L'
  OUT 10
main_loop:
  LDA 0
  DRVPG
  OUT 'u'
  OUT 'n'
  OUT 'i'
  OUT 'x'
  OUT '$'
  OUT ' '
  CALL read_line
  LDA 0
  LDAI 0x1000
  CMP 0
  JZ main_loop
  LDA 0
  LDAI 0x1000
  CMP 'l'
  JNZ check_help
  LDA 1
  LDAI 0x1000
  CMP 's'
  JZ cmd_ls
check_help:
  LDA 0
  LDAI 0x1000
  CMP 'h'
  JZ cmd_help
check_run:
  LDA 0
  LDAI 0x1000
  CMP 'r'
  JNZ cmd_unknown
  LDA 1
  LDAI 0x1000
  CMP 'u'
  JNZ cmd_unknown
  LDA 2
  LDAI 0x1000
  CMP 'n'
  JNZ cmd_unknown
  LDA 4
  LDAI 0x1000
  STA 0x1023
  CALL find_entry
  CMP 0
  JZ cmd_not_found
  LDM 0x1024
  DRVPG
  JMP copy_page_0
cmd_ls:
  CALL list_entries
  JMP main_loop
cmd_help:
  OUT 'l'
  OUT 's'
  OUT ' '
  OUT '|'
  OUT ' '
  OUT 'r'
  OUT 'u'
  OUT 'n'
  OUT ' '
  OUT 'x'
  OUT ' '
  OUT '|'
  OUT ' '
  OUT 'h'
  OUT 'e'
  OUT 'l'
  OUT 'p'
  OUT 10
  JMP main_loop
cmd_not_found:
  OUT 'n'
  OUT 'o'
  OUT 't'
  OUT ' '
  OUT 'f'
  OUT 'o'
  OUT 'u'
  OUT 'n'
  OUT 'd'
  OUT 10
  JMP main_loop
cmd_unknown:
  OUT '?'
  OUT 10
  JMP main_loop

read_line:
  LDA 0
  STA 0x1020
read_wait:
  INA
  CMP 0
  JZ read_wait
  CMP 10
  JZ read_done
  STA 0x1021
  LDM 0x1020
  TAB
  LDM 0x1021
  STAI 0x1000
  LDM 0x1020
  INC
  STA 0x1020
  JMP read_wait
read_done:
  OUT 10
  LDM 0x1020
  TAB
  LDA 0
  STAI 0x1000
  RET

list_entries:
  LDA 0
  DRVPG
  LDA 0
  STA 0x1022
list_loop:
  LDM 0x1022
  ADD 16
  DRVRD
  CMP 0
  JZ list_next
  OUTA
  OUT ' '
  LDM 0x1022
  ADD 18
  DRVRD
  OUTD
  OUT 'p'
  OUT 10
list_next:
  LDM 0x1022
  ADD 3
  STA 0x1022
  CMP 24
  JNZ list_loop
  RET

find_entry:
  LDA 0
  DRVPG
  LDA 0
  STA 0x1022
find_loop:
  LDM 0x1022
  ADD 16
  DRVRD
  CMP 0
  JZ find_next
  TAB
  LDM 0x1023
  CMPB
  JZ find_found
find_next:
  LDM 0x1022
  ADD 3
  STA 0x1022
  CMP 24
  JNZ find_loop
  LDA 0
  RET
find_found:
  LDM 0x1022
  ADD 17
  DRVRD
  STA 0x1024
  LDM 0x1022
  ADD 18
  DRVRD
  STA 0x1025
  LDA 1
  RET

${buildCopyRoutines()}

launch_program:
  JMP 0
`;

let bootloaderCache: BootloaderImage | null = null;

export function getBootloaderImage(): BootloaderImage {
  if (bootloaderCache) return bootloaderCache;

  const result = assemble(BOOTLOADER_SOURCE, BOOTLOADER_START);
  if (!result.success) {
    throw new Error(
      `Bootloader assembly failed: ${result.errors.map((e) => e.message).join(" | ")}`,
    );
  }

  bootloaderCache = {
    bytes: result.bytes,
    startAddr: BOOTLOADER_START,
  };
  return bootloaderCache;
}
