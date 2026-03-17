import { Handle, Position } from "@xyflow/react";

export const TransistorNode = ({ data }: any) => {
  const isOn = data.conducting === 1;
  const hasSignal = data.inputValue === 1;
  const mode = data.mode === "pmos" ? "PMOS" : "NMOS";

  return (
    <div className="bg-slate-800 border-2 border-amber-700/70 rounded-md p-2 min-w-[120px] text-center shadow-lg">
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        style={{ top: "32%" }}
        className={`w-2 h-2 ${hasSignal ? "bg-blue-400" : "bg-slate-500"}`}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="gate"
        style={{ top: "72%" }}
        className={`w-2 h-2 ${isOn ? "bg-amber-400" : "bg-slate-500"}`}
      />

      <div className="text-[10px] font-bold text-amber-400 mb-1 uppercase tracking-wide">
        {data.label || "Transistor"}
      </div>
      <div className="text-[9px] text-slate-500 uppercase tracking-wide">
        {mode}
      </div>
      <div className="font-mono font-bold text-white text-sm">
        {isOn ? "ON" : "OFF"}
      </div>
      <div className="text-[10px] text-slate-400 mt-1">
        OUT: {data.value || 0}
      </div>
      <div className="flex justify-between text-[9px] text-slate-500 mt-2 px-1 uppercase">
        <span>In</span>
        <span>Gate</span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className={`w-3 h-3 ${data.value ? "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" : "bg-slate-600"}`}
      />
    </div>
  );
};
