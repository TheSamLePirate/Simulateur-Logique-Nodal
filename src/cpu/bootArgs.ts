export const BOOT_ARG_BASE = 0x1018;
export const BOOT_ARG_BLOCK_SIZE = 8;

export const BOOT_ARG_COUNT_ADDR = BOOT_ARG_BASE + 0;
export const BOOT_ARG0_DIR_PAGE_ADDR = BOOT_ARG_BASE + 1;
export const BOOT_ARG0_DIR_OFFSET_ADDR = BOOT_ARG_BASE + 2;
export const BOOT_ARG0_TYPE_ADDR = BOOT_ARG_BASE + 3;
export const BOOT_ARG0_START_PAGE_ADDR = BOOT_ARG_BASE + 4;
export const BOOT_ARG0_PAGE_COUNT_ADDR = BOOT_ARG_BASE + 5;
export const BOOT_ARG0_SIZE_ADDR = BOOT_ARG_BASE + 6;
export const BOOT_ARG0_INDEX_ADDR = BOOT_ARG_BASE + 7;

export interface BootFileArgument {
  dirPage: number;
  dirOffset: number;
  type: number;
  startPage: number;
  pageCount: number;
  sizeBytes: number;
  entryIndex: number;
}

export interface BootArgumentBlock {
  count: number;
  file: BootFileArgument | null;
}

export function readBootArgumentBlock(memory: ArrayLike<number>): BootArgumentBlock {
  const count = memory[BOOT_ARG_COUNT_ADDR] ?? 0;
  if (count === 0) {
    return { count: 0, file: null };
  }

  return {
    count,
    file: {
      dirPage: memory[BOOT_ARG0_DIR_PAGE_ADDR] ?? 0,
      dirOffset: memory[BOOT_ARG0_DIR_OFFSET_ADDR] ?? 0,
      type: memory[BOOT_ARG0_TYPE_ADDR] ?? 0,
      startPage: memory[BOOT_ARG0_START_PAGE_ADDR] ?? 0,
      pageCount: memory[BOOT_ARG0_PAGE_COUNT_ADDR] ?? 0,
      sizeBytes: memory[BOOT_ARG0_SIZE_ADDR] ?? 0,
      entryIndex: memory[BOOT_ARG0_INDEX_ADDR] ?? 0,
    },
  };
}
