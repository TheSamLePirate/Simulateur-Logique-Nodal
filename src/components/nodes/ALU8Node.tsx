import { Handle, Position } from "@xyflow/react";
import { Calculator } from "lucide-react";

export const ALU8Node = ({ data }: any) => {
  const result = data.result || 0;

  return (
    <div className="bg-slate-800 border-2 border-orange-600 rounded-md p-2 min-w-[170px] shadow-lg flex flex-col">
      <div className="flex items-center justify-center gap-2 mb-2 border-b border-slate-700 pb-2">
        <Calculator size={14} className="text-orange-400" />
        <span className="text-[10px] font-bold text-white uppercase">
          ALU 8-bit
        </span>
      </div>

      {/* Operation + result display */}
      <div className="bg-slate-900 rounded p-1 mb-2 text-center border border-slate-700">
        <div className="text-[10px] text-orange-400 font-mono">
          {data.opName || "ADD"}: 0x
          {result.toString(16).padStart(2, "0").toUpperCase()} ({result})
        </div>
        <div className="flex justify-center gap-2 mt-1">
          <span
            className={`text-[8px] font-mono px-1 rounded ${data.zero ? "bg-yellow-500/30 text-yellow-400" : "text-slate-600"}`}
          >
            Z
          </span>
          <span
            className={`text-[8px] font-mono px-1 rounded ${data.carry ? "bg-red-500/30 text-red-400" : "text-slate-600"}`}
          >
            C
          </span>
          <span
            className={`text-[8px] font-mono px-1 rounded ${data.negative ? "bg-purple-500/30 text-purple-400" : "text-slate-600"}`}
          >
            N
          </span>
        </div>
      </div>

      <div className="flex justify-between">
        {/* Left side: A0-A7, B0-B7, OP0-OP2 */}
        <div className="flex flex-col gap-1">
          <div className="text-[8px] text-orange-500 font-bold">A [0..7]</div>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={`a${i}`} className="relative h-3 flex items-center">
              <Handle
                type="target"
                position={Position.Left}
                id={`a${i}`}
                className="w-2 h-2 bg-orange-400 -ml-3"
              />
              <span className="text-[8px] text-slate-500 font-mono ml-1">
                A{i}
              </span>
            </div>
          ))}
          <div className="text-[8px] text-blue-400 font-bold mt-1">
            B [0..7]
          </div>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={`b${i}`} className="relative h-3 flex items-center">
              <Handle
                type="target"
                position={Position.Left}
                id={`b${i}`}
                className="w-2 h-2 bg-blue-400 -ml-3"
              />
              <span className="text-[8px] text-slate-500 font-mono ml-1">
                B{i}
              </span>
            </div>
          ))}
          <div className="text-[8px] text-yellow-400 font-bold mt-1">OP</div>
          {[0, 1, 2].map((i) => (
            <div key={`op${i}`} className="relative h-3 flex items-center">
              <Handle
                type="target"
                position={Position.Left}
                id={`op${i}`}
                className="w-2 h-2 bg-yellow-400 -ml-3"
              />
              <span className="text-[8px] text-slate-500 font-mono ml-1">
                OP{i}
              </span>
            </div>
          ))}
        </div>

        {/* Right side: R0-R7, flags */}
        <div className="flex flex-col gap-1 items-end mt-4">
          <div className="text-[8px] text-orange-400 font-bold">R [0..7]</div>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const bitVal = result & (1 << i) ? 1 : 0;
            return (
              <div
                key={`r${i}`}
                className="relative h-3 flex items-center justify-end w-full"
              >
                <span className="text-[8px] text-slate-500 font-mono mr-1">
                  R{i}
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`r${i}`}
                  className={`w-2 h-2 -mr-3 ${bitVal ? "bg-orange-400" : "bg-slate-600"}`}
                />
              </div>
            );
          })}
          <div className="text-[8px] text-slate-300 font-bold mt-1">FLAGS</div>
          <div className="relative h-3 flex items-center justify-end w-full">
            <span className="text-[8px] text-yellow-400 font-mono mr-1">
              ZERO
            </span>
            <Handle
              type="source"
              position={Position.Right}
              id="zero"
              className={`w-2 h-2 -mr-3 ${data.zero ? "bg-yellow-400" : "bg-slate-600"}`}
            />
          </div>
          <div className="relative h-3 flex items-center justify-end w-full">
            <span className="text-[8px] text-red-400 font-mono mr-1">
              CARRY
            </span>
            <Handle
              type="source"
              position={Position.Right}
              id="carry"
              className={`w-2 h-2 -mr-3 ${data.carry ? "bg-red-400" : "bg-slate-600"}`}
            />
          </div>
          <div className="relative h-3 flex items-center justify-end w-full">
            <span className="text-[8px] text-purple-400 font-mono mr-1">
              NEG
            </span>
            <Handle
              type="source"
              position={Position.Right}
              id="neg"
              className={`w-2 h-2 -mr-3 ${data.negative ? "bg-purple-400" : "bg-slate-600"}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
