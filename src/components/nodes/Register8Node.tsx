import { Handle, Position } from "@xyflow/react";
import { Database } from "lucide-react";

export const Register8Node = ({ data }: any) => {
  const val = data.value || 0;

  return (
    <div className="bg-slate-800 border-2 border-cyan-600 rounded-md p-2 min-w-[150px] shadow-lg flex flex-col">
      <div className="flex items-center justify-center gap-2 mb-2 border-b border-slate-700 pb-2">
        <Database size={14} className="text-cyan-400" />
        <span className="text-[10px] font-bold text-white uppercase">
          {data.label || "REG 8-bit"}
        </span>
      </div>

      {/* Value display */}
      <div className="bg-slate-900 rounded p-1 mb-2 text-center border border-slate-700">
        <div className="text-[10px] text-cyan-400 font-mono">
          VAL: 0x{val.toString(16).padStart(2, "0").toUpperCase()} ({val})
        </div>
      </div>

      <div className="flex justify-between">
        {/* Left side: D0-D7, CLK, LOAD, RST */}
        <div className="flex flex-col gap-1">
          <div className="text-[8px] text-cyan-500 font-bold">DATA IN</div>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={`d${i}`} className="relative h-3 flex items-center">
              <Handle
                type="target"
                position={Position.Left}
                id={`d${i}`}
                className="w-2 h-2 bg-cyan-400 -ml-3"
              />
              <span className="text-[8px] text-slate-500 font-mono ml-1">
                D{i}
              </span>
            </div>
          ))}
          <div className="relative h-3 flex items-center mt-2">
            <Handle
              type="target"
              position={Position.Left}
              id="clk"
              className="w-2 h-2 bg-green-400 -ml-3"
            />
            <span className="text-[8px] text-green-400 font-mono ml-1 font-bold">
              CLK
            </span>
          </div>
          <div className="relative h-3 flex items-center">
            <Handle
              type="target"
              position={Position.Left}
              id="load"
              className="w-2 h-2 bg-yellow-400 -ml-3"
            />
            <span className="text-[8px] text-yellow-400 font-mono ml-1 font-bold">
              LOAD
            </span>
          </div>
          <div className="relative h-3 flex items-center">
            <Handle
              type="target"
              position={Position.Left}
              id="rst"
              className="w-2 h-2 bg-red-400 -ml-3"
            />
            <span className="text-[8px] text-red-400 font-mono ml-1 font-bold">
              RST
            </span>
          </div>
        </div>

        {/* Right side: Q0-Q7 */}
        <div className="flex flex-col gap-1 items-end mt-4">
          <div className="text-[8px] text-cyan-400 font-bold">DATA OUT</div>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const bitVal = val & (1 << i) ? 1 : 0;
            return (
              <div
                key={`q${i}`}
                className="relative h-3 flex items-center justify-end w-full"
              >
                <span className="text-[8px] text-slate-500 font-mono mr-1">
                  Q{i}
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`q${i}`}
                  className={`w-2 h-2 -mr-3 ${bitVal ? "bg-cyan-400" : "bg-slate-600"}`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
