import type { CPUState as CPUStateType } from "../../cpu/isa";

interface CPUStateProps {
  state: CPUStateType;
}

function hex(value: number): string {
  return "0x" + value.toString(16).padStart(2, "0").toUpperCase();
}

function FlagBadge({
  label,
  active,
  color,
}: {
  label: string;
  active: boolean;
  color: string;
}) {
  return (
    <span
      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
        active ? `${color} text-white` : "bg-slate-800 text-slate-600"
      }`}
    >
      {label}
    </span>
  );
}

export function CPUStatePanel({ state }: CPUStateProps) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-md p-3">
      <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
        Registres CPU
      </h3>

      <div className="grid grid-cols-4 gap-3">
        {/* Register A */}
        <div className="bg-slate-800 rounded p-2 text-center">
          <div className="text-[9px] text-slate-500 font-bold uppercase">A</div>
          <div className="text-sm font-mono font-bold text-orange-400">
            {hex(state.a)}
          </div>
          <div className="text-[10px] font-mono text-slate-400">{state.a}</div>
        </div>

        {/* Register B */}
        <div className="bg-slate-800 rounded p-2 text-center">
          <div className="text-[9px] text-slate-500 font-bold uppercase">B</div>
          <div className="text-sm font-mono font-bold text-blue-400">
            {hex(state.b)}
          </div>
          <div className="text-[10px] font-mono text-slate-400">{state.b}</div>
        </div>

        {/* Program Counter */}
        <div className="bg-slate-800 rounded p-2 text-center">
          <div className="text-[9px] text-slate-500 font-bold uppercase">
            PC
          </div>
          <div className="text-sm font-mono font-bold text-green-400">
            {hex(state.pc)}
          </div>
          <div className="text-[10px] font-mono text-slate-400">{state.pc}</div>
        </div>

        {/* Stack Pointer */}
        <div className="bg-slate-800 rounded p-2 text-center">
          <div className="text-[9px] text-slate-500 font-bold uppercase">
            SP
          </div>
          <div className="text-sm font-mono font-bold text-purple-400">
            {hex(state.sp)}
          </div>
          <div className="text-[10px] font-mono text-slate-400">{state.sp}</div>
        </div>
      </div>

      {/* Flags + Cycles */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-slate-500 font-bold uppercase mr-1">
            Flags
          </span>
          <FlagBadge label="Z" active={state.flags.z} color="bg-yellow-600" />
          <FlagBadge label="C" active={state.flags.c} color="bg-red-600" />
          <FlagBadge label="N" active={state.flags.n} color="bg-purple-600" />
        </div>
        <div className="text-[10px] text-slate-500 font-mono">
          <span className="text-slate-600">Cycles:</span>{" "}
          <span className="text-slate-300">{state.cycles}</span>
          {state.halted && (
            <span className="ml-2 text-red-400 font-bold">HALTED</span>
          )}
        </div>
      </div>
    </div>
  );
}
