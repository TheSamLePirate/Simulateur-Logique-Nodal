import {
  BOOT_DISK_NAME_LENGTH,
  BOOT_DISK_PAGE_COUNT,
  BOOT_ENTRY_TYPE_FILE,
  BOOT_ENTRY_TYPE_PROGRAM,
  BOOT_DISK_DATA_START_PAGE,
  type BootDiskEntry,
  readBootDiskEntries,
} from "../../cpu/bootloader";
import { DRIVE_PAGE_SIZE, INSTRUCTION_INFO } from "../../cpu/isa";

export function hex(value: number, width = 2): string {
  return `0x${(value >>> 0).toString(16).padStart(width, "0").toUpperCase()}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function byteToAscii(value: number): string {
  if (value === 10) return "\\n";
  if (value === 9) return "\\t";
  if (value === 8) return "\\b";
  if (value === 27) return "ESC";
  if (value < 32 || value > 126) return ".";
  return String.fromCharCode(value);
}

export function formatAsciiPreview(bytes: ArrayLike<number>, max = 48): string {
  const preview: string[] = [];
  const len = Math.min(bytes.length ?? 0, max);
  for (let i = 0; i < len; i++) {
    preview.push(byteToAscii(bytes[i] ?? 0));
  }
  return preview.join("");
}

export function decodeInstruction(memory: ArrayLike<number>, addr: number) {
  const opcode = memory[addr] ?? 0;
  const info = INSTRUCTION_INFO[opcode];
  const size = info?.size ?? 1;
  const bytes = Array.from({ length: size }, (_, index) => memory[addr + index] ?? 0);
  const operand =
    size === 3 ? ((memory[addr + 2] ?? 0) << 8) | (memory[addr + 1] ?? 0) : 0;

  return {
    addr,
    opcode,
    operand,
    size,
    bytes,
    mnemonic: info?.mnemonic ?? "DB",
    description: info?.description ?? "Unknown instruction",
    label: info
      ? size === 3
        ? `${info.mnemonic} ${hex(operand, 4)}`
        : info.mnemonic
      : `DB ${hex(opcode)}`,
  };
}

export function describeLastInstruction(opcode: number, operand: number): string {
  if (opcode < 0) return "No instruction executed yet";
  const info = INSTRUCTION_INFO[opcode];
  if (!info) return `DB ${hex(opcode)}`;
  return info.size === 3 ? `${info.mnemonic} ${hex(operand, 4)}` : info.mnemonic;
}

export function summarizeDisk(driveData: ArrayLike<number>) {
  const entries = readBootDiskEntries(driveData);
  const usedPages = entries.reduce((sum, entry) => sum + entry.pageCount, 0);
  const freePages = Math.max(0, BOOT_DISK_PAGE_COUNT - BOOT_DISK_DATA_START_PAGE - usedPages);
  const usedBytes = usedPages * DRIVE_PAGE_SIZE;
  const freeBytes = freePages * DRIVE_PAGE_SIZE;

  return {
    entries,
    usedPages,
    freePages,
    usedBytes,
    freeBytes,
  };
}

export function typeLabel(type: number): string {
  if (type === BOOT_ENTRY_TYPE_FILE) return "file";
  if (type === BOOT_ENTRY_TYPE_PROGRAM) return "program";
  return `type-${type}`;
}

export function readDiskEntryNameAt(
  driveData: ArrayLike<number>,
  dirPage: number,
  dirOffset: number,
): string {
  const base = dirPage * DRIVE_PAGE_SIZE + dirOffset;
  let name = "";
  for (let i = 0; i < BOOT_DISK_NAME_LENGTH; i++) {
    const value = driveData[base + i] ?? 0;
    if (value === 0) break;
    name += String.fromCharCode(value);
  }
  return name;
}

export function sliceMemory(
  memory: ArrayLike<number>,
  start: number,
  length: number,
): Array<{ addr: number; value: number }> {
  return Array.from({ length }, (_, index) => ({
    addr: start + index,
    value: memory[start + index] ?? 0,
  }));
}

export function countNonZero(memory: ArrayLike<number>, start: number, end: number): number {
  let count = 0;
  for (let addr = start; addr < end; addr++) {
    if ((memory[addr] ?? 0) !== 0) count++;
  }
  return count;
}

export function sortDiskEntries(entries: BootDiskEntry[]): BootDiskEntry[] {
  return [...entries].sort((a, b) => a.startPage - b.startPage || a.name.localeCompare(b.name));
}
