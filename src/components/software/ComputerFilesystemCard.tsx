import { memo } from "react";
import { HardDrive, Info, Package } from "lucide-react";

import {
  BOOT_DISK_DATA_START_PAGE,
  BOOT_DISK_PAGE_COUNT,
  isBootDiskFormatted,
} from "../../cpu/bootloader";
import { DRIVE_PAGE_SIZE } from "../../cpu/isa";
import type { ComputerPanelData } from "./computerPanelTypes";
import {
  byteToAscii,
  formatAsciiPreview,
  formatBytes,
  hex,
  sortDiskEntries,
  summarizeDisk,
  typeLabel,
} from "./computerPanelUtils";

function ComputerFilesystemCardInner({ data }: { data: ComputerPanelData }) {
  const formatted = isBootDiskFormatted(data.driveData);
  const disk = summarizeDisk(data.driveData);
  const entries = sortDiskEntries(disk.entries);
  const lastReadAscii = byteToAscii(data.driveLastRead);
  const lastWriteAscii = byteToAscii(data.driveLastWrite);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-200">
          <HardDrive size={16} className="text-cyan-300" />
          <h3 className="text-sm font-semibold">Filesystem Disk</h3>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
            formatted
              ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
              : "border-slate-700 bg-slate-900 text-slate-400"
          }`}
        >
          {formatted ? "Boot FS ready" : "Unformatted"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Entries</div>
          <div className="mt-2 text-2xl font-semibold text-slate-100">{entries.length}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Used</div>
          <div className="mt-2 text-lg font-semibold text-cyan-300">
            {disk.usedPages}p / {formatBytes(disk.usedBytes)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Free</div>
          <div className="mt-2 text-lg font-semibold text-emerald-300">
            {disk.freePages}p / {formatBytes(disk.freeBytes)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Drive page</div>
          <div className="mt-2 text-lg font-semibold text-slate-100">{data.drivePage}</div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70">
        <div className="grid grid-cols-[minmax(0,1.2fr)_auto_auto_auto_auto] gap-3 border-b border-slate-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          <span>Name</span>
          <span>Type</span>
          <span>Size</span>
          <span>Pages</span>
          <span>Start</span>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {entries.length === 0 ? (
            <div className="px-3 py-4 text-sm text-slate-500">No files on disk.</div>
          ) : (
            entries.map((entry) => (
              <div
                key={`${entry.name}-${entry.startPage}`}
                className="grid grid-cols-[minmax(0,1.2fr)_auto_auto_auto_auto] gap-3 border-b border-slate-800/70 px-3 py-2 text-sm last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="truncate font-mono text-slate-100">{entry.name}</div>
                  <div className="truncate text-xs text-slate-500">
                    {formatAsciiPreview(entry.bytes, 28) || "(binary or empty)"}
                  </div>
                </div>
                <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-xs text-slate-300">
                  {typeLabel(entry.type)}
                </span>
                <span className="font-mono text-xs text-slate-300">{entry.sizeBytes} B</span>
                <span className="font-mono text-xs text-slate-300">{entry.pageCount}</span>
                <span className="font-mono text-xs text-slate-300">{entry.startPage}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <details className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          <Info size={13} className="text-slate-500" />
          Filesystem info
        </summary>
        <div className="mt-3 grid gap-2 text-xs text-slate-300">
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
            Directory pages reserved: {BOOT_DISK_DATA_START_PAGE} / {BOOT_DISK_PAGE_COUNT}
            {" · "}
            page size {DRIVE_PAGE_SIZE} bytes
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
              Last addr {hex(data.driveLastAddr, 4)}
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
              Last read {hex(data.driveLastRead)} ({lastReadAscii})
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
              Last write {hex(data.driveLastWrite)} ({lastWriteAscii})
            </div>
          </div>
          {entries.length > 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
              <div className="mb-2 flex items-center gap-2 text-slate-400">
                <Package size={13} className="text-cyan-300" />
                First entry preview
              </div>
              <div className="font-mono text-slate-200">{entries[0].name}</div>
              <div className="mt-1 break-all text-slate-500">
                {formatAsciiPreview(entries[0].bytes, 80)}
              </div>
            </div>
          )}
        </div>
      </details>
    </section>
  );
}

export const ComputerFilesystemCard = memo(
  ComputerFilesystemCardInner,
  (prev, next) =>
    prev.data.driveData === next.data.driveData &&
    prev.data.drivePage === next.data.drivePage &&
    prev.data.driveLastAddr === next.data.driveLastAddr &&
    prev.data.driveLastRead === next.data.driveLastRead &&
    prev.data.driveLastWrite === next.data.driveLastWrite,
);
