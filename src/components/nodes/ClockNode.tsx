import { Handle, Position } from "@xyflow/react";
import { Clock } from "lucide-react";

export const ClockNode = ({ data, id }: any) => {
  const adjustFrequency = (delta: number) => {
    const newFreq = Math.max(0.5, Math.min(10, (data.frequency || 1) + delta));
    window.dispatchEvent(
      new CustomEvent("clock-frequency", {
        detail: { id, frequency: newFreq },
      }),
    );
  };

  return (
    <div className="bg-slate-800 border-2 border-green-600 rounded-md p-3 min-w-[110px] shadow-lg text-center">
      <div className="flex items-center justify-center gap-2 mb-2 border-b border-slate-700 pb-2">
        <Clock size={14} className="text-green-400" />
        <span className="text-[10px] font-bold text-white uppercase">
          {data.label || "CLK"}
        </span>
      </div>

      {/* Frequency display with +/- controls */}
      <div className="flex items-center justify-center gap-2 mb-2">
        <button
          onClick={() => adjustFrequency(-0.5)}
          className="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold nodrag cursor-pointer"
        >
          -
        </button>
        <span className="text-sm font-mono text-green-400 min-w-[40px]">
          {data.frequency || 1} Hz
        </span>
        <button
          onClick={() => adjustFrequency(0.5)}
          className="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold nodrag cursor-pointer"
        >
          +
        </button>
      </div>

      {/* Pulsing indicator */}
      <div
        className={`w-5 h-5 rounded-full mx-auto mb-1 transition-all ${
          data.value
            ? "bg-green-400 shadow-[0_0_15px_rgba(74,222,128,0.8)]"
            : "bg-slate-600"
        }`}
      />

      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className={`w-3 h-3 ${
          data.value
            ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]"
            : "bg-slate-600"
        }`}
      />
    </div>
  );
};
