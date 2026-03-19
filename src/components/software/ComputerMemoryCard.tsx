import { Database, Layers, Workflow } from "lucide-react";

import { CODE_SIZE, MEMORY_SIZE } from "../../cpu/isa";
import { readBootArgumentBlock } from "../../cpu/bootArgs";
import type { ComputerPanelData } from "./computerPanelTypes";
import {
  countNonZero,
  formatBytes,
  hex,
  readDiskEntryNameAt,
  sliceMemory,
} from "./computerPanelUtils";

function UsageBar({
  label,
  used,
  max,
  tone,
}: {
  label: string;
  used: number;
  max: number;
  tone: string;
}) {
  const width = max > 0 ? Math.min(100, (used / max) * 100) : 0;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-300">{label}</span>
        <span className="font-mono text-xs text-slate-400">
          {used}/{max}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function ComputerMemoryCard({ data }: { data: ComputerPanelData }) {
  let liveCodeUsed = 0;
  for (let i = CODE_SIZE - 1; i >= 0; i--) {
    if (data.state.memory[i] !== 0) {
      liveCodeUsed = i + 1;
      break;
    }
  }

  const actualDataUsed = countNonZero(data.state.memory, 0x1000, 0x1800);
  const dataReserved = data.memLayout
    ? data.memLayout.globals + data.memLayout.scratch + data.memLayout.locals
    : actualDataUsed;
  const stackMax = data.memLayout?.stackSize ?? 2048;
  const stackUsed = Math.max(0, Math.min(stackMax, MEMORY_SIZE - 1 - data.state.sp));
  const bootArgs = readBootArgumentBlock(data.state.memory);
  const bootArgName =
    bootArgs.file && bootArgs.count > 0
      ? readDiskEntryNameAt(
          data.driveData,
          bootArgs.file.dirPage,
          bootArgs.file.dirOffset,
        ) || "(unknown)"
      : null;
  const pcWindow = sliceMemory(
    data.state.memory,
    Math.max(0, data.state.pc - 4),
    Math.min(12, MEMORY_SIZE - Math.max(0, data.state.pc - 4)),
  );
  const stackWindowStart = Math.min(MEMORY_SIZE - 8, Math.max(0, data.state.sp + 1));
  const stackWindow = sliceMemory(data.state.memory, stackWindowStart, 8);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-200">
          <Database size={16} className="text-emerald-300" />
          <h3 className="text-sm font-semibold">Memory, Stack and Boot Args</h3>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-300">
          RAM {formatBytes(MEMORY_SIZE)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <UsageBar label="Code region" used={liveCodeUsed} max={CODE_SIZE} tone="bg-blue-500" />
        <UsageBar label="Data region" used={dataReserved} max={2048} tone="bg-emerald-500" />
        <UsageBar label="Stack region" used={stackUsed} max={stackMax} tone="bg-fuchsia-500" />
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <div className="flex items-center gap-2 text-slate-200">
            <Workflow size={15} className="text-cyan-300" />
            <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Around PC
            </h4>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6">
            {pcWindow.map(({ addr, value }) => (
              <div
                key={addr}
                className={`rounded-lg border px-2.5 py-2 ${
                  addr === data.state.pc
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-slate-800 bg-slate-950/70"
                }`}
              >
                <div className="font-mono text-[10px] text-slate-500">{hex(addr, 4)}</div>
                <div className="mt-1 font-mono text-sm text-slate-200">{hex(value)}</div>
                <div className="mt-1 font-mono text-[10px] text-slate-500">{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <div className="flex items-center gap-2 text-slate-200">
            <Layers size={15} className="text-fuchsia-300" />
            <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Stack Top
            </h4>
          </div>
          <div className="mt-3 grid gap-2">
            {stackWindow.map(({ addr, value }) => (
              <div
                key={addr}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                  addr === data.state.sp + 1
                    ? "border-fuchsia-500/30 bg-fuchsia-500/10"
                    : "border-slate-800 bg-slate-950/70"
                }`}
              >
                <span className="font-mono text-xs text-slate-400">{hex(addr, 4)}</span>
                <span className="font-mono text-sm text-slate-200">{hex(value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <details className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 p-3" open>
        <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Boot arguments
        </summary>
        <div className="mt-3 grid gap-2 text-sm">
          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
            <span className="text-slate-400">Argument count</span>
            <span className="font-mono text-slate-200">{bootArgs.count}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
            <span className="text-slate-400">Resolved file</span>
            <span className="font-mono text-slate-200">{bootArgName ?? "none"}</span>
          </div>
          {bootArgs.file && (
            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
                dir {bootArgs.file.dirPage}:{bootArgs.file.dirOffset} | type {bootArgs.file.type}
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
                start page {bootArgs.file.startPage} | pages {bootArgs.file.pageCount} | size {bootArgs.file.sizeBytes}
              </div>
            </div>
          )}
        </div>
      </details>
    </section>
  );
}
