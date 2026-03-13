import React from "react";
import { Handle, Position } from "@xyflow/react";

export const InputNumberNode = ({ data, id }: any) => {
  const val = data.value || 0;
  return (
    <div className="bg-slate-800 border-2 border-slate-600 rounded-md p-2 min-w-[100px] shadow-lg flex flex-col">
      <div className="text-[10px] font-bold text-slate-400 mb-1 text-center uppercase">
        {data.label || "Num In"}
      </div>
      <input
        type="number"
        min="0"
        max="255"
        value={val}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          let v = parseInt(e.target.value, 10);
          if (isNaN(v)) v = 0;
          if (v < 0) v = 0;
          if (v > 255) v = 255;
          data.onChange(id, v);
        }}
        className="w-full bg-slate-900 text-white text-center font-mono text-lg rounded border border-slate-700 nodrag"
      />
      <div className="flex flex-col gap-1 mt-2 items-end">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const bitVal = val & (1 << i) ? 1 : 0;
          return (
            <div
              key={`out${i}`}
              className="relative h-3 flex items-center justify-end w-full"
            >
              <span className="text-[8px] text-slate-500 font-mono mr-1">
                Bit {i}
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id={`out${i}`}
                className={`w-2 h-2 -mr-3 ${bitVal ? "bg-blue-400" : "bg-slate-600"}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
