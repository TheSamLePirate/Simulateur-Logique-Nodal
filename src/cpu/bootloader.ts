import { assemble } from "./assembler";
import { CPU } from "./cpu";
import { CODE_SIZE, DRIVE_PAGE_SIZE, DRIVE_SIZE } from "./isa";

export const BOOTLOADER_START = 0x1100;
export const BOOTLOADER_LIMIT = 0x1800;
export const BOOT_DISK_MAGIC = 0x42;
export const BOOT_DISK_VERSION = 0x02;
export const BOOT_DISK_MAX_ENTRIES = 8;
export const BOOT_DISK_ENTRY_SIZE = 5;
export const BOOT_DISK_DIR_OFFSET = 0x10;
export const BOOT_DISK_DATA_START_PAGE = 1;
export const BOOT_DISK_PAGE_COUNT = DRIVE_SIZE / DRIVE_PAGE_SIZE;
export const BOOT_PROGRAM_MAX_PAGES = CODE_SIZE / DRIVE_PAGE_SIZE;
export const BOOT_ENTRY_TYPE_FILE = 1;
export const BOOT_ENTRY_TYPE_PROGRAM = 2;
export const BOOTLOADER_PROMPT = "unix$ ";

export interface BootDiskEntry {
  name: string;
  type: number;
  startPage: number;
  pageCount: number;
  sizeBytes: number;
  bytes: Uint8Array;
}

export interface BootloaderImage {
  bytes: number[];
  startAddr: number;
}

function normalizeEntryName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Entry name cannot be empty.");
  return trimmed[0];
}

export function isBootDiskFormatted(driveData: ArrayLike<number>): boolean {
  return (
    (driveData[0] ?? 0) === BOOT_DISK_MAGIC &&
    (driveData[1] ?? 0) === BOOT_DISK_VERSION
  );
}

export function formatBootDisk(): Uint8Array {
  const disk = new Uint8Array(DRIVE_SIZE);
  disk[0] = BOOT_DISK_MAGIC;
  disk[1] = BOOT_DISK_VERSION;
  return disk;
}

export function readBootDiskEntries(driveData: ArrayLike<number>): BootDiskEntry[] {
  if (!isBootDiskFormatted(driveData)) return [];

  const entries: BootDiskEntry[] = [];
  for (let i = 0; i < BOOT_DISK_MAX_ENTRIES; i++) {
    const base = BOOT_DISK_DIR_OFFSET + i * BOOT_DISK_ENTRY_SIZE;
    const nameByte = driveData[base] ?? 0;
    const type = driveData[base + 1] ?? 0;
    const startPage = driveData[base + 2] ?? 0;
    const pageCount = driveData[base + 3] ?? 0;
    const sizeBytes = driveData[base + 4] ?? 0;

    if (nameByte === 0 || type === 0 || startPage === 0 || pageCount === 0) {
      continue;
    }

    const start = startPage * DRIVE_PAGE_SIZE;
    const byteLength = Math.min(
      DRIVE_SIZE - start,
      pageCount * DRIVE_PAGE_SIZE,
    );
    entries.push({
      name: String.fromCharCode(nameByte),
      type,
      startPage,
      pageCount,
      sizeBytes,
      bytes: Uint8Array.from(
        { length: Math.max(0, byteLength) },
        (_, idx) => driveData[start + idx] ?? 0,
      ),
    });
  }

  return entries;
}

function packBootDiskEntries(entries: BootDiskEntry[]): Uint8Array {
  if (entries.length > BOOT_DISK_MAX_ENTRIES) {
    throw new Error(`Disk directory full (max ${BOOT_DISK_MAX_ENTRIES} entries).`);
  }

  const disk = formatBootDisk();
  let nextPage = BOOT_DISK_DATA_START_PAGE;

  entries.forEach((entry, index) => {
    const pageCount = Math.max(1, entry.pageCount);
    if (nextPage + pageCount > BOOT_DISK_PAGE_COUNT) {
      throw new Error("Disk is full.");
    }

    const base = BOOT_DISK_DIR_OFFSET + index * BOOT_DISK_ENTRY_SIZE;
    disk[base] = entry.name.charCodeAt(0) & 0xff;
    disk[base + 1] = entry.type & 0xff;
    disk[base + 2] = nextPage & 0xff;
    disk[base + 3] = pageCount & 0xff;
    disk[base + 4] = entry.sizeBytes & 0xff;

    disk.set(
      entry.bytes.slice(0, pageCount * DRIVE_PAGE_SIZE),
      nextPage * DRIVE_PAGE_SIZE,
    );
    nextPage += pageCount;
  });

  return disk;
}

function writeEntryToBootDisk(
  driveData: ArrayLike<number>,
  nextEntry: BootDiskEntry,
): Uint8Array {
  const name = normalizeEntryName(nextEntry.name);
  const existing = readBootDiskEntries(driveData).filter(
    (entry) => entry.name !== name,
  );

  return packBootDiskEntries([
    ...existing,
    {
      ...nextEntry,
      name,
    },
  ]);
}

export function writeProgramToBootDisk(
  driveData: ArrayLike<number>,
  name: string,
  programBytes: ArrayLike<number>,
): Uint8Array {
  const rawProgram = Uint8Array.from(programBytes);
  const pageCount = Math.ceil(rawProgram.length / DRIVE_PAGE_SIZE);

  if (rawProgram.length === 0) {
    throw new Error("Program is empty.");
  }
  if (pageCount > BOOT_PROGRAM_MAX_PAGES) {
    throw new Error(`Program is too large for disk boot (${rawProgram.length} bytes).`);
  }

  return writeEntryToBootDisk(driveData, {
    name,
    type: BOOT_ENTRY_TYPE_PROGRAM,
    startPage: 0,
    pageCount,
    sizeBytes: rawProgram.length & 0xff,
    bytes: rawProgram,
  });
}

export function writeFileToBootDisk(
  driveData: ArrayLike<number>,
  name: string,
  fileBytes: ArrayLike<number>,
): Uint8Array {
  const rawFile = Uint8Array.from(fileBytes);
  if (rawFile.length > 255) {
    throw new Error("Text files are limited to 255 bytes on this filesystem.");
  }

  return writeEntryToBootDisk(driveData, {
    name,
    type: BOOT_ENTRY_TYPE_FILE,
    startPage: 0,
    pageCount: 1,
    sizeBytes: rawFile.length & 0xff,
    bytes: rawFile,
  });
}

export const BOOTLOADER_SOURCE = `
start:
  OUT 'U'
  OUT 'N'
  OUT 'I'
  OUT 'X'
  OUT ' '
  OUT 'B'
  OUT 'O'
  OUT 'O'
  OUT 'T'
  OUT 10
  CALL cmd_help
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
  JNZ check_cat
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
  LDM 0x1026
  CMP 2
  JNZ cmd_not_program
  JMP copy_program
check_cat:
  LDA 0
  LDAI 0x1000
  CMP 'c'
  JNZ check_free
  LDA 1
  LDAI 0x1000
  CMP 'a'
  JNZ cmd_unknown
  LDA 2
  LDAI 0x1000
  CMP 't'
  JNZ cmd_unknown
  LDA 4
  LDAI 0x1000
  STA 0x1023
  CALL find_entry
  CMP 0
  JZ cmd_not_found
  LDM 0x1026
  CMP 1
  JNZ cmd_not_file
  CALL cat_entry
  JMP main_loop
check_free:
  LDA 0
  LDAI 0x1000
  CMP 'f'
  JNZ cmd_unknown
  LDA 1
  LDAI 0x1000
  CMP 'r'
  JNZ cmd_unknown
  LDA 2
  LDAI 0x1000
  CMP 'e'
  JNZ cmd_unknown
  LDA 3
  LDAI 0x1000
  CMP 'e'
  JNZ cmd_unknown
  CALL cmd_free
  JMP main_loop
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
  OUT 'c'
  OUT 'a'
  OUT 't'
  OUT ' '
  OUT 'x'
  OUT ' '
  OUT '|'
  OUT ' '
  OUT 'f'
  OUT 'r'
  OUT 'e'
  OUT 'e'
  OUT ' '
  OUT '|'
  OUT ' '
  OUT 'h'
  OUT 'e'
  OUT 'l'
  OUT 'p'
  OUT 10
  RET
cmd_free:
  CALL count_used_pages
  STA 0x1028
  LDM 0x1028
  TAB
  LDA 31
  SUBB
  OUTD
  OUT 'p'
  OUT ' '
  OUT 'f'
  OUT 'r'
  OUT 'e'
  OUT 'e'
  OUT 10
  RET
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
cmd_not_program:
  OUT 'n'
  OUT 'o'
  OUT 't'
  OUT ' '
  OUT 'r'
  OUT 'u'
  OUT 'n'
  OUT 'n'
  OUT 'a'
  OUT 'b'
  OUT 'l'
  OUT 'e'
  OUT 10
  JMP main_loop
cmd_not_file:
  OUT 'n'
  OUT 'o'
  OUT 't'
  OUT ' '
  OUT 'f'
  OUT 'i'
  OUT 'l'
  OUT 'e'
  OUT 10
  JMP main_loop
cmd_unknown:
  OUT '?'
  OUT ' '
  OUT 'h'
  OUT 'e'
  OUT 'l'
  OUT 'p'
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
  STA 0x1029
  LDA 0
  STA 0x1022
list_loop:
  LDA 0
  DRVPG
  LDM 0x1022
  ADD 16
  DRVRD
  CMP 0
  JZ list_next
  STA 0x1023
  LDA 1
  STA 0x1029
  LDA 0
  DRVPG
  LDM 0x1022
  ADD 17
  DRVRD
  CMP 1
  JZ list_file
  OUT 'p'
  JMP list_name
list_file:
  OUT 'f'
list_name:
  OUT ' '
  LDM 0x1023
  OUTA
  OUT ' '
  LDA 0
  DRVPG
  LDM 0x1022
  ADD 17
  DRVRD
  CMP 1
  JZ list_file_size
  LDA 0
  DRVPG
  LDM 0x1022
  ADD 19
  DRVRD
  OUTD
  OUT 'p'
  OUT 10
  JMP list_next
list_file_size:
  LDA 0
  DRVPG
  LDM 0x1022
  ADD 20
  DRVRD
  OUTD
  OUT 'b'
  OUT 10
list_next:
  LDM 0x1022
  ADD 5
  STA 0x1022
  CMP 40
  JNZ list_loop
  LDM 0x1029
  CMP 0
  JNZ list_done
  OUT '('
  OUT 'e'
  OUT 'm'
  OUT 'p'
  OUT 't'
  OUT 'y'
  OUT ')'
  OUT 10
list_done:
  RET

find_entry:
  LDA 0
  STA 0x1022
find_loop:
  LDA 0
  DRVPG
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
  ADD 5
  STA 0x1022
  CMP 40
  JNZ find_loop
  LDA 0
  RET
find_found:
  LDA 0
  DRVPG
  LDM 0x1022
  ADD 17
  DRVRD
  STA 0x1026
  LDA 0
  DRVPG
  LDM 0x1022
  ADD 18
  DRVRD
  STA 0x1024
  LDA 0
  DRVPG
  LDM 0x1022
  ADD 19
  DRVRD
  STA 0x1025
  LDA 0
  DRVPG
  LDM 0x1022
  ADD 20
  DRVRD
  STA 0x1027
  LDA 1
  RET

cat_entry:
  LDM 0x1024
  DRVPG
  LDA 0
  STA 0x1020
cat_loop:
  LDM 0x1020
  TAB
  LDM 0x1027
  CMPB
  JZ cat_done
  TBA
  DRVRD
  OUTA
  LDM 0x1020
  INC
  STA 0x1020
  JMP cat_loop
cat_done:
  OUT 10
  RET

count_used_pages:
  LDA 0
  STA 0x1028
  LDA 0
  STA 0x1022
count_loop:
  LDA 0
  DRVPG
  LDM 0x1022
  ADD 16
  DRVRD
  CMP 0
  JZ count_next
  LDM 0x1028
  TAB
  LDA 0
  DRVPG
  LDM 0x1022
  ADD 19
  DRVRD
  ADDB
  STA 0x1028
count_next:
  LDM 0x1022
  ADD 5
  STA 0x1022
  CMP 40
  JNZ count_loop
  LDM 0x1028
  RET

copy_program:
  LDA 0
  STA 0x102a
copy_page_loop:
  LDM 0x102a
  TAB
  LDM 0x1025
  CMPB
  JZ launch_program
  LDM 0x102a
  TAB
  LDM 0x1024
  ADDB
  DRVPG
  LDA 0
  STA patch_store+1
  LDM 0x102a
  STA patch_store+2
  LDA 0
  STA 0x1020
copy_byte_loop:
  LDM 0x1020
  DRVRD
  STA 0x1021
  LDM 0x1020
  TAB
  LDM 0x1021
patch_store:
  STAI 0x0000
  LDM 0x1020
  INC
  STA 0x1020
  JNZ copy_byte_loop
  LDM 0x102a
  INC
  STA 0x102a
  JMP copy_page_loop

launch_program:
  JMP 0
`;

let bootloaderCache: BootloaderImage | null = null;

export function getBootloaderImage(): BootloaderImage {
  if (bootloaderCache) return bootloaderCache;

  const result = assemble(BOOTLOADER_SOURCE, BOOTLOADER_START, BOOTLOADER_LIMIT);
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

export function bootCpuToShell(
  cpu: CPU,
  options: { preserveConsole?: boolean; maxSteps?: number } = {},
): boolean {
  const { preserveConsole = true, maxSteps = 200000 } = options;
  const previousConsole = preserveConsole ? [...cpu.consoleOutput] : [];
  if (
    preserveConsole &&
    previousConsole.length > 0 &&
    previousConsole[previousConsole.length - 1] !== "\n"
  ) {
    previousConsole.push("\n");
  }
  const image = getBootloaderImage();

  cpu.reset();
  if (preserveConsole) {
    cpu.consoleOutput = previousConsole;
  }
  cpu.loadProgram(image.bytes, image.startAddr);

  for (let i = 0; i < maxSteps; i++) {
    if (cpu.consoleOutput.join("").endsWith(BOOTLOADER_PROMPT)) {
      return true;
    }
    if (!cpu.step()) {
      return false;
    }
  }

  return cpu.consoleOutput.join("").endsWith(BOOTLOADER_PROMPT);
}
