import { Handle, Position } from "@xyflow/react";
import { GitFork } from "lucide-react";

export const Mux8Node = ({ data }: any) => {
  const outVal = data.outVal || 0;
  const sel = data.sel || 0;

  return (
    <div className="bg-slate-800 border-2 border-indigo-600 rounded-md p-2 min-w-[160px] shadow-lg flex flex-col">
      <div className="flex items-center justify-center gap-2 mb-2 border-b border-slate-700 pb-2">
        <GitFork size={14} className="text-indigo-400" />
        <span className="text-[10px] font-bold text-white uppercase">
          {data.label || "MUX 8-bit"}
        </span>
      </div>

      {/* Selection + value display */}
      <div className="bg-slate-900 rounded p-1 mb-2 text-center border border-slate-700">
        <div className="text-[10px] text-indigo-400 font-mono">
          SEL={sel} → {sel ? "B" : "A"}
        </div>
        <div className="text-[10px] text-indigo-300 font-mono">
          OUT: 0x{outVal.toString(16).padStart(2, "0").toUpperCase()} ({outVal})
        </div>
      </div>

      <div className="flex justify-between">
        {/* Left side: SEL, A0-A7, B0-B7 */}
        <div className="flex flex-col gap-1">
          <div className="relative h-3 flex items-center">
            <Handle
              type="target"
              position={Position.Left}
              id="sel"
              className="w-2 h-2 bg-yellow-400 -ml-3"
            />
            <span className="text-[8px] text-yellow-400 font-mono ml-1 font-bold">
              SEL
            </span>
          </div>
          <div className="text-[8px] text-teal-500 font-bold mt-1">
            A [0..7]
          </div>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={`a${i}`} className="relative h-3 flex items-center">
              <Handle
                type="target"
                position={Position.Left}
                id={`a${i}`}
                className={`w-2 h-2 -ml-3 ${!sel ? "bg-teal-400" : "bg-slate-600"}`}
              />
              <span className="text-[8px] text-slate-500 font-mono ml-1">
                A{i}
              </span>
            </div>
          ))}
          <div className="text-[8px] text-pink-400 font-bold mt-1">
            B [0..7]
          </div>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={`b${i}`} className="relative h-3 flex items-center">
              <Handle
                type="target"
                position={Position.Left}
                id={`b${i}`}
                className={`w-2 h-2 -ml-3 ${sel ? "bg-pink-400" : "bg-slate-600"}`}
              />
              <span className="text-[8px] text-slate-500 font-mono ml-1">
                B{i}
              </span>
            </div>
          ))}
        </div>

        {/* Right side: OUT0-OUT7 */}
        <div className="flex flex-col gap-1 items-end mt-6">
          <div className="text-[8px] text-indigo-400 font-bold">OUT [0..7]</div>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const bitVal = outVal & (1 << i) ? 1 : 0;
            return (
              <div
                key={`out${i}`}
                className="relative h-3 flex items-center justify-end w-full"
              >
                <span className="text-[8px] text-slate-500 font-mono mr-1">
                  O{i}
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`out${i}`}
                  className={`w-2 h-2 -mr-3 ${bitVal ? "bg-indigo-400" : "bg-slate-600"}`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
