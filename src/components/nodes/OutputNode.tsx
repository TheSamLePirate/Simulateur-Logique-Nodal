import { Handle, Position } from "@xyflow/react";

export const OutputNode = ({ data }: any) => {
  return (
    <div className="bg-slate-800 border-2 border-slate-600 rounded-md p-2 min-w-[80px] text-center shadow-lg">
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className="w-3 h-3 bg-slate-400"
      />
      <div className="text-xs font-bold text-slate-400 mb-2 uppercase">
        {data.label || "Output"}
      </div>
      <div
        className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center font-mono text-xl font-bold transition-all ${data.value ? "bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.8)]" : "bg-slate-700 text-slate-500"}`}
      >
        {data.value || 0}
      </div>
    </div>
  );
};
