import {
  Activity,
  ArrowRightLeft,
  Cpu,
  Flag,
  PauseCircle,
  PlayCircle,
} from "lucide-react";

import type { ComputerPanelData } from "./computerPanelTypes";
import {
  decodeInstruction,
  describeLastInstruction,
  formatBytes,
  hex,
} from "./computerPanelUtils";

function registerTone(label: string): string {
  switch (label) {
    case "A":
      return "text-orange-300 border-orange-500/30 bg-orange-500/10";
    case "B":
      return "text-sky-300 border-sky-500/30 bg-sky-500/10";
    case "PC":
      return "text-emerald-300 border-emerald-500/30 bg-emerald-500/10";
    case "SP":
      return "text-fuchsia-300 border-fuchsia-500/30 bg-fuchsia-500/10";
    default:
      return "text-slate-200 border-slate-700 bg-slate-900";
  }
}

function RegisterTile({
  label,
  value,
  width = 2,
}: {
  label: string;
  value: number;
  width?: number;
}) {
  return (
    <div className={`rounded-xl border p-3 ${registerTone(label)}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 font-mono text-lg font-semibold">{hex(value, width)}</div>
      <div className="mt-1 font-mono text-xs text-slate-400">{value}</div>
    </div>
  );
}

function FlagPill({
  label,
  active,
  tone,
}: {
  label: string;
  active: boolean;
  tone: string;
}) {
  return (
    <span
      className={`rounded-full border px-2 py-1 font-mono text-[11px] font-semibold ${
        active
          ? `${tone} border-current/30`
          : "border-slate-700 bg-slate-900 text-slate-500"
      }`}
    >
      {label}:{active ? "1" : "0"}
    </span>
  );
}

export function ComputerStatusCard({ data }: { data: ComputerPanelData }) {
  const nextInstruction = decodeInstruction(data.state.memory, data.state.pc);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.4)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-slate-200">
            <Cpu size={16} className="text-cyan-300" />
            <h3 className="text-sm font-semibold">CPU and Live State</h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Same computer instance as the software view, without hardware-level granularity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              data.isRunning
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : data.state.halted
                  ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                  : "border-slate-700 bg-slate-900 text-slate-300"
            }`}
          >
            {data.isRunning ? "RUNNING" : data.state.halted ? "HALTED" : "READY"}
          </span>
          <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-300">
            {data.useBootloader ? "Bootloader" : "Raw program"}
          </span>
          <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-300">
            Code {formatBytes(data.codeSize)}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <RegisterTile label="A" value={data.state.a} />
        <RegisterTile label="B" value={data.state.b} />
        <RegisterTile label="PC" value={data.state.pc} width={4} />
        <RegisterTile label="SP" value={data.state.sp} width={4} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <div className="flex items-center gap-2 text-slate-200">
            <ArrowRightLeft size={15} className="text-sky-300" />
            <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Instruction Bus
            </h4>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                Next instruction
              </div>
              <div className="mt-2 font-mono text-sm font-semibold text-cyan-300">
                {nextInstruction.label}
              </div>
              <div className="mt-1 font-mono text-xs text-slate-400">
                @{hex(nextInstruction.addr, 4)} | {nextInstruction.description}
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {nextInstruction.bytes.map((value, index) => (
                  <span
                    key={`${value}-${index}`}
                    className={`rounded-md border px-2 py-1 font-mono text-xs ${
                      index === 0
                        ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
                        : "border-slate-700 bg-slate-900 text-slate-300"
                    }`}
                  >
                    {hex(value)}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                Last executed
              </div>
              <div className="mt-2 font-mono text-sm font-semibold text-amber-300">
                {describeLastInstruction(data.lastOpcode, data.lastOperand)}
              </div>
              <div className="mt-1 font-mono text-xs text-slate-400">
                opcode {data.lastOpcode >= 0 ? hex(data.lastOpcode) : "--"} | operand{" "}
                {hex(data.lastOperand, 4)}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-400">
                <div className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5">
                  Clock {data.clockBit}
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5">
                  Sleep {data.sleepCounter}
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5">
                  Cycles {data.state.cycles}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <div className="flex items-center gap-2 text-slate-200">
            {data.isRunning ? (
              <PlayCircle size={15} className="text-emerald-300" />
            ) : (
              <PauseCircle size={15} className="text-slate-400" />
            )}
            <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Execution Flags
            </h4>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <FlagPill label="Z" active={data.state.flags.z} tone="bg-yellow-500/15 text-yellow-300" />
            <FlagPill label="C" active={data.state.flags.c} tone="bg-rose-500/15 text-rose-300" />
            <FlagPill label="N" active={data.state.flags.n} tone="bg-fuchsia-500/15 text-fuchsia-300" />
          </div>

          <div className="mt-4 grid gap-2 text-xs text-slate-300">
            <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
              <span className="flex items-center gap-2 text-slate-400">
                <Activity size={13} className="text-emerald-300" />
                Input buffer
              </span>
              <span className="font-mono">{data.consoleInputBuffer.length} bytes</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
              <span className="flex items-center gap-2 text-slate-400">
                <Flag size={13} className="text-sky-300" />
                RNG state
              </span>
              <span className="font-mono">
                {hex(data.randSeed)} / {hex(data.randCounter)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
              <span className="flex items-center gap-2 text-slate-400">
                <Cpu size={13} className="text-cyan-300" />
                Memory load
              </span>
              <span className="font-mono">{data.assembled ? "loaded" : "empty"}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
