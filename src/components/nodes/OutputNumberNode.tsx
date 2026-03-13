import { Handle, Position } from "@xyflow/react";

export const OutputNumberNode = ({ data }: any) => {
  const val = data.value || 0;
  return (
    <div className="bg-slate-800 border-2 border-slate-600 rounded-md p-2 min-w-[100px] shadow-lg flex flex-col">
      <div className="text-[10px] font-bold text-slate-400 mb-1 text-center uppercase">
        {data.label || "Num Out"}
      </div>
      <div className="w-full bg-slate-900 text-green-400 text-center font-mono text-xl rounded border border-slate-700 p-1 shadow-[0_0_10px_rgba(34,197,94,0.2)]">
        {val}
      </div>
      <div className="flex flex-col gap-1 mt-2">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={`in${i}`} className="relative h-3 flex items-center w-full">
            <Handle
              type="target"
              position={Position.Left}
              id={`in${i}`}
              className="w-2 h-2 bg-slate-400 -ml-3"
            />
            <span className="text-[8px] text-slate-500 font-mono ml-1">
              Bit {i}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
