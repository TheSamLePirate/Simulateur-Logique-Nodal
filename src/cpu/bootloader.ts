import { assemble } from "./assembler";
import {
  BOOT_ARG_COUNT_ADDR,
  BOOT_ARG0_DIR_OFFSET_ADDR,
  BOOT_ARG0_DIR_PAGE_ADDR,
  BOOT_ARG0_INDEX_ADDR,
  BOOT_ARG0_PAGE_COUNT_ADDR,
  BOOT_ARG0_SIZE_ADDR,
  BOOT_ARG0_START_PAGE_ADDR,
  BOOT_ARG0_TYPE_ADDR,
} from "./bootArgs";
import { CPU } from "./cpu";
import { CODE_SIZE, DRIVE_PAGE_SIZE, DRIVE_SIZE } from "./isa";

export const BOOTLOADER_START = 0x1100;
export const BOOTLOADER_LIMIT = 0x1800;
export const BOOT_DISK_MAGIC = 0x42;
export const BOOT_DISK_VERSION = 0x03;
export const BOOT_DISK_MAX_ENTRIES = 64;
export const BOOT_DISK_NAME_LENGTH = 8;
export const BOOT_DISK_ENTRY_SIZE = 12;
export const BOOT_DISK_DIR_OFFSET = 0x10;
export const BOOT_DISK_PAGE_COUNT = DRIVE_SIZE / DRIVE_PAGE_SIZE;
export const BOOT_DISK_DATA_START_PAGE = Math.ceil(
  (BOOT_DISK_DIR_OFFSET + BOOT_DISK_MAX_ENTRIES * BOOT_DISK_ENTRY_SIZE) /
    DRIVE_PAGE_SIZE,
);
export const BOOT_PROGRAM_MAX_PAGES = CODE_SIZE / DRIVE_PAGE_SIZE;
export const BOOT_ENTRY_TYPE_FILE = 1;
export const BOOT_ENTRY_TYPE_PROGRAM = 2;
export const BOOTLOADER_PROMPT = "unix$ ";
export const BOOT_DISK_TYPE_OFFSET = BOOT_DISK_NAME_LENGTH;
export const BOOT_DISK_START_PAGE_OFFSET = BOOT_DISK_NAME_LENGTH + 1;
export const BOOT_DISK_PAGE_COUNT_OFFSET = BOOT_DISK_NAME_LENGTH + 2;
export const BOOT_DISK_SIZE_OFFSET = BOOT_DISK_NAME_LENGTH + 3;

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
  if (/\s/.test(trimmed)) {
    throw new Error("Entry names cannot contain spaces.");
  }
  if (trimmed.length > BOOT_DISK_NAME_LENGTH) {
    throw new Error(`Entry names are limited to ${BOOT_DISK_NAME_LENGTH} characters.`);
  }
  return trimmed;
}

function readEntryName(driveData: ArrayLike<number>, base: number): string {
  let name = "";
  for (let i = 0; i < BOOT_DISK_NAME_LENGTH; i++) {
    const value = driveData[base + i] ?? 0;
    if (value === 0) break;
    name += String.fromCharCode(value);
  }
  return name;
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
    const name = readEntryName(driveData, base);
    const type = driveData[base + BOOT_DISK_TYPE_OFFSET] ?? 0;
    const startPage = driveData[base + BOOT_DISK_START_PAGE_OFFSET] ?? 0;
    const pageCount = driveData[base + BOOT_DISK_PAGE_COUNT_OFFSET] ?? 0;
    const sizeBytes = driveData[base + BOOT_DISK_SIZE_OFFSET] ?? 0;

    if (!name || type === 0 || startPage === 0 || pageCount === 0) {
      continue;
    }

    const start = startPage * DRIVE_PAGE_SIZE;
    const byteLength = Math.min(
      DRIVE_SIZE - start,
      pageCount * DRIVE_PAGE_SIZE,
    );
    entries.push({
      name,
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
    for (let i = 0; i < BOOT_DISK_NAME_LENGTH; i++) {
      disk[base + i] = entry.name.charCodeAt(i) & 0xff || 0;
    }
    disk[base + BOOT_DISK_TYPE_OFFSET] = entry.type & 0xff;
    disk[base + BOOT_DISK_START_PAGE_OFFSET] = nextPage & 0xff;
    disk[base + BOOT_DISK_PAGE_COUNT_OFFSET] = pageCount & 0xff;
    disk[base + BOOT_DISK_SIZE_OFFSET] = entry.sizeBytes & 0xff;

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
  STA 0x1023
  CALL skip_spaces
  CALL find_entry
  CMP 0
  JZ cmd_not_found
  LDM 0x1026
  CMP 2
  JNZ cmd_not_program
  LDM 0x1024
  STA 0x1034
  LDM 0x1025
  STA 0x1035
  CALL clear_boot_args
  CALL advance_to_next_token
  LDM 0x1023
  TAB
  LDAI 0x1000
  CMP 0
  JZ copy_program
  CALL find_entry
  CMP 0
  JZ cmd_not_found
  CALL store_boot_arg0
  JMP copy_program
check_cat:
  LDA 0
  LDAI 0x1000
  CMP 'c'
  JNZ check_clr
  LDA 1
  LDAI 0x1000
  CMP 'a'
  JNZ check_clr
  LDA 2
  LDAI 0x1000
  CMP 't'
  JNZ cmd_unknown
  LDA 4
  STA 0x1023
  CALL skip_spaces
  CALL find_entry
  CMP 0
  JZ cmd_not_found
  LDM 0x1026
  CMP 1
  JNZ cmd_not_file
  CALL cat_entry
  JMP main_loop
check_clr:
  LDA 0
  LDAI 0x1000
  CMP 'c'
  JNZ check_free
  LDA 1
  LDAI 0x1000
  CMP 'l'
  JNZ cmd_unknown
  LDA 2
  LDAI 0x1000
  CMP 'r'
  JNZ cmd_unknown
  LDA 3
  LDAI 0x1000
  CMP 0
  JNZ cmd_unknown
  CALL cmd_clr
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
  OUT 'n'
  OUT 'a'
  OUT 'm'
  OUT 'e'
  OUT ' '
  OUT '['
  OUT 'f'
  OUT 'i'
  OUT 'l'
  OUT 'e'
  OUT ']'
  OUT ' '
  OUT '|'
  OUT ' '
  OUT 'c'
  OUT 'a'
  OUT 't'
  OUT ' '
  OUT 'n'
  OUT 'a'
  OUT 'm'
  OUT 'e'
  OUT ' '
  OUT '|'
  OUT ' '
  OUT 'c'
  OUT 'l'
  OUT 'r'
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
  LDA ${BOOT_DISK_PAGE_COUNT - BOOT_DISK_DATA_START_PAGE}
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
cmd_clr:
  CLCON
  CLR
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

skip_spaces:
skip_spaces_loop:
  LDM 0x1023
  TAB
  LDAI 0x1000
  CMP ' '
  JNZ skip_spaces_done
  LDM 0x1023
  INC
  STA 0x1023
  JMP skip_spaces_loop
skip_spaces_done:
  RET

advance_to_next_token:
  CALL skip_spaces
advance_token_loop:
  LDM 0x1023
  TAB
  LDAI 0x1000
  CMP 0
  JZ advance_token_done
  CMP ' '
  JZ advance_after_space
  LDM 0x1023
  INC
  STA 0x1023
  JMP advance_token_loop
advance_after_space:
  LDM 0x1023
  INC
  STA 0x1023
  CALL skip_spaces
advance_token_done:
  RET

clear_boot_args:
  LDA 0
  STA ${BOOT_ARG_COUNT_ADDR}
  STA ${BOOT_ARG0_DIR_PAGE_ADDR}
  STA ${BOOT_ARG0_DIR_OFFSET_ADDR}
  STA ${BOOT_ARG0_TYPE_ADDR}
  STA ${BOOT_ARG0_START_PAGE_ADDR}
  STA ${BOOT_ARG0_PAGE_COUNT_ADDR}
  STA ${BOOT_ARG0_SIZE_ADDR}
  STA ${BOOT_ARG0_INDEX_ADDR}
  RET

store_boot_arg0:
  LDA 1
  STA ${BOOT_ARG_COUNT_ADDR}
  LDM 0x1036
  STA ${BOOT_ARG0_DIR_PAGE_ADDR}
  LDM 0x1037
  STA ${BOOT_ARG0_DIR_OFFSET_ADDR}
  LDM 0x1026
  STA ${BOOT_ARG0_TYPE_ADDR}
  LDM 0x1024
  STA ${BOOT_ARG0_START_PAGE_ADDR}
  LDM 0x1025
  STA ${BOOT_ARG0_PAGE_COUNT_ADDR}
  LDM 0x1027
  STA ${BOOT_ARG0_SIZE_ADDR}
  LDM 0x1022
  STA ${BOOT_ARG0_INDEX_ADDR}
  RET

dir_seek_entry_base:
  LDA 0
  STA 0x1030
  LDA 16
  STA 0x1031
  LDA 0
  STA 0x1032
dir_seek_loop:
  LDM 0x1032
  TAB
  LDM 0x1022
  CMPB
  JZ dir_seek_done
  LDM 0x1031
  ADD 12
  STA 0x1031
  JNC dir_seek_next
  LDM 0x1030
  INC
  STA 0x1030
dir_seek_next:
  LDM 0x1032
  INC
  STA 0x1032
  JMP dir_seek_loop
dir_seek_done:
  RET

dir_read_field:
  STA 0x1033
  CALL dir_seek_entry_base
  LDM 0x1031
  TAB
  LDM 0x1033
  ADDB
  STA 0x1031
  JNC dir_field_page_ok
  LDM 0x1030
  INC
  STA 0x1030
dir_field_page_ok:
  LDM 0x1030
  DRVPG
  LDM 0x1031
  DRVRD
  RET

list_entries:
  LDA 0
  STA 0x1029
  LDA 0
  STA 0x1022
list_loop:
  LDA 0
  CALL dir_read_field
  CMP 0
  JZ list_next
  LDA 1
  STA 0x1029
  LDA ${BOOT_DISK_TYPE_OFFSET}
  CALL dir_read_field
  CMP 1
  JZ list_file
  OUT 'p'
  JMP list_name
list_file:
  OUT 'f'
list_name:
  OUT ' '
  CALL print_entry_name
  OUT ' '
  LDA ${BOOT_DISK_TYPE_OFFSET}
  CALL dir_read_field
  CMP 1
  JZ list_file_size
  LDA ${BOOT_DISK_PAGE_COUNT_OFFSET}
  CALL dir_read_field
  OUTD
  OUT 'p'
  OUT 10
  JMP list_next
list_file_size:
  LDA ${BOOT_DISK_SIZE_OFFSET}
  CALL dir_read_field
  OUTD
  OUT 'b'
  OUT 10
list_next:
  LDM 0x1022
  INC
  STA 0x1022
  CMP ${BOOT_DISK_MAX_ENTRIES}
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

print_entry_name:
  LDA 0
  STA 0x102b
print_name_loop:
  LDM 0x102b
  CMP 8
  JZ print_name_done
  LDM 0x102b
  CALL dir_read_field
  CMP 0
  JZ print_name_done
  OUTA
  LDM 0x102b
  INC
  STA 0x102b
  JMP print_name_loop
print_name_done:
  RET

find_entry:
  LDA 0
  STA 0x1022
find_loop:
  LDA 0
  CALL dir_read_field
  CMP 0
  JZ find_next
  LDA 0
  STA 0x102b
find_cmp_loop:
  LDM 0x102b
  CMP 8
  JZ find_found
  TAB
  LDM 0x1023
  ADDB
  TAB
  LDAI 0x1000
  STA 0x102c
  CMP ' '
  JZ find_cmp_end
  LDM 0x102b
  CALL dir_read_field
  STA 0x102e
  LDM 0x102c
  CMP 0
  JNZ find_cmp_value
  LDM 0x102e
  CMP 0
  JZ find_found
  JMP find_next
find_cmp_end:
  LDM 0x102b
  CALL dir_read_field
  CMP 0
  JZ find_found
  JMP find_next
find_cmp_value:
  TAB
  LDM 0x102e
  CMPB
  JNZ find_next
  LDM 0x102b
  INC
  STA 0x102b
  JMP find_cmp_loop
find_next:
  LDM 0x1022
  INC
  STA 0x1022
  CMP ${BOOT_DISK_MAX_ENTRIES}
  JNZ find_loop
  LDA 0
  RET
find_found:
  CALL dir_seek_entry_base
  LDM 0x1030
  STA 0x1036
  LDM 0x1031
  STA 0x1037
  LDA ${BOOT_DISK_TYPE_OFFSET}
  CALL dir_read_field
  STA 0x1026
  LDA ${BOOT_DISK_START_PAGE_OFFSET}
  CALL dir_read_field
  STA 0x1024
  LDA ${BOOT_DISK_PAGE_COUNT_OFFSET}
  CALL dir_read_field
  STA 0x1025
  LDA ${BOOT_DISK_SIZE_OFFSET}
  CALL dir_read_field
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
  CALL dir_read_field
  CMP 0
  JZ count_next
  LDM 0x1028
  TAB
  LDA ${BOOT_DISK_PAGE_COUNT_OFFSET}
  CALL dir_read_field
  ADDB
  STA 0x1028
count_next:
  LDM 0x1022
  INC
  STA 0x1022
  CMP ${BOOT_DISK_MAX_ENTRIES}
  JNZ count_loop
  LDM 0x1028
  RET

copy_program:
  LDA 0
  STA 0x102a
copy_page_loop:
  LDM 0x102a
  TAB
  LDM 0x1035
  CMPB
  JZ launch_program
  LDM 0x102a
  TAB
  LDM 0x1034
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
  options: {
    preserveConsole?: boolean;
    preservePlotter?: boolean;
    maxSteps?: number;
  } = {},
): boolean {
  const {
    preserveConsole = true,
    preservePlotter = false,
    maxSteps = 200000,
  } = options;
  const previousConsole = preserveConsole ? [...cpu.consoleOutput] : [];
  const previousPlotterPixels = preservePlotter ? new Map(cpu.plotterPixels) : null;
  const previousPlotterColor = preservePlotter ? { ...cpu.plotterColor } : null;
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
  if (preservePlotter && previousPlotterPixels && previousPlotterColor) {
    cpu.plotterPixels = previousPlotterPixels;
    cpu.plotterColor = previousPlotterColor;
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
