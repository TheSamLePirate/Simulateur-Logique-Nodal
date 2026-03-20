import {
  Gauge,
  Play,
  RotateCcw,
  SkipForward,
  Square,
} from "lucide-react";

interface HardwareCpuControlsProps {
  hwCpuLoaded: boolean;
  hwCpuRunning: boolean;
  hwCpuHalted: boolean;
  hwRunSpeed: number;
  hwClockFreq: number;
  onStep: () => void;
  onRun: () => void;
  onStop: () => void;
  onReset: () => void;
  onRunSpeedChange: (value: number) => void;
}

export function HardwareCpuControls({
  hwCpuLoaded,
  hwCpuRunning,
  hwCpuHalted,
  hwRunSpeed,
  hwClockFreq,
  onStep,
  onRun,
  onStop,
  onReset,
  onRunSpeedChange,
}: HardwareCpuControlsProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-b border-slate-800 shrink-0">
      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-2">
        CPU
      </span>

      <button
        onClick={onStep}
        disabled={!hwCpuLoaded || hwCpuRunning || hwCpuHalted}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold transition-colors bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <SkipForward size={14} /> Step
      </button>

      {hwCpuRunning ? (
        <button
          onClick={onStop}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold transition-colors bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30"
        >
          <Square size={14} /> Stop
        </button>
      ) : (
        <button
          onClick={onRun}
          disabled={!hwCpuLoaded || hwCpuHalted}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold transition-colors bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Play size={14} /> Run
        </button>
      )}

      <button
        onClick={onReset}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold transition-colors bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
      >
        <RotateCcw size={14} /> Reset
      </button>

      <div className="w-px h-6 bg-slate-700 mx-1" />

      <div className="flex items-center gap-2">
        <Gauge size={14} className="text-slate-500" />
        <input
          type="range"
          min={1}
          max={100000}
          value={hwRunSpeed}
          onChange={(event) => onRunSpeedChange(parseInt(event.target.value))}
          className="w-20 accent-blue-500"
        />
        <span className="text-[10px] text-slate-500 font-mono w-20">
          {hwRunSpeed} i/tick
        </span>
        <span className="text-[10px] text-slate-600 font-mono">
          (
          {hwClockFreq >= 1
            ? `${Math.round(hwClockFreq * hwRunSpeed)} i/s`
            : `${(hwClockFreq * hwRunSpeed).toFixed(1)} i/s`}
          )
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {!hwCpuLoaded && (
          <span className="text-xs text-slate-500">
            Assemblez un programme dans l'onglet Logiciel
          </span>
        )}
        {hwCpuHalted && (
          <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/30">
            HALTED
          </span>
        )}
        {hwCpuRunning && (
          <span className="text-xs font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/30 animate-pulse">
            RUNNING
          </span>
        )}
        {hwCpuLoaded && !hwCpuRunning && !hwCpuHalted && (
          <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/30">
            READY
          </span>
        )}
      </div>
    </div>
  );
}
