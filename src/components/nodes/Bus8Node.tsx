import { Handle, Position } from "@xyflow/react";

export const Bus8Node = ({ data }: any) => {
  return (
    <div className="bg-slate-800 border-2 border-slate-500 rounded-md p-2 min-w-[60px] shadow-lg flex flex-col items-center">
      <div className="text-[10px] font-bold text-slate-300 mb-2 uppercase">
        8-bit Bus
      </div>
      <div className="flex justify-between w-full gap-4">
        <div className="flex flex-col gap-1">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={`in${i}`} className="relative h-4 flex items-center">
              <Handle
                type="target"
                position={Position.Left}
                id={`in${i}`}
                className="w-2 h-2 bg-slate-400 -ml-3"
              />
              <span className="text-[8px] text-slate-500 font-mono ml-1">
                {i}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1 items-end">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={`out${i}`}
              className="relative h-4 flex items-center justify-end"
            >
              <span className="text-[8px] text-slate-500 font-mono mr-1">
                {i}
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id={`out${i}`}
                className={`w-2 h-2 -mr-3 ${data.val?.[i] ? "bg-blue-400" : "bg-slate-600"}`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
