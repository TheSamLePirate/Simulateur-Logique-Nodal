import { Handle, Position } from "@xyflow/react";

export const InputNode = ({ data, id }: any) => {
  return (
    <div className="bg-slate-800 border-2 border-slate-600 rounded-md p-2 min-w-[80px] text-center shadow-lg">
      <div className="text-xs font-bold text-slate-400 mb-2 uppercase">
        {data.label || "Input"}
      </div>
      <button
        className={`w-12 h-12 rounded-full font-mono text-xl font-bold transition-all ${data.value ? "bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.6)]" : "bg-slate-700 text-slate-500"}`}
        onClick={() => data.onChange(id, data.value ? 0 : 1)}
      >
        {data.value || 0}
      </button>
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className="w-3 h-3 bg-blue-400"
      />
    </div>
  );
};
