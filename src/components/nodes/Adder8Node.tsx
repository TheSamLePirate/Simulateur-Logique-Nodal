import { Handle, Position } from "@xyflow/react";
import { Cpu, Maximize2 } from "lucide-react";

export const Adder8Node = ({ data }: any) => {
  return (
    <div className="bg-slate-800 border-2 border-blue-600 rounded-md p-3 min-w-[150px] shadow-lg relative">
      <button
        onClick={() =>
          window.dispatchEvent(
            new CustomEvent("inspect-node", { detail: "adder8" }),
          )
        }
        className="absolute top-2 right-2 text-slate-400 hover:text-white transition-colors"
        title="Voir le circuit interne"
      >
        <Maximize2 size={14} />
      </button>
      <div className="flex items-center justify-center gap-2 mb-4 border-b border-slate-700 pb-2">
        <Cpu size={16} className="text-blue-400" />
        <span className="font-bold text-white">Adder 8-bit</span>
      </div>

      <div className="flex justify-between">
        {/* Inputs */}
        <div className="flex flex-col gap-1">
          <div className="text-[10px] text-slate-500 font-mono mb-1">
            A [0..7]
          </div>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={`a${i}`} className="relative h-4 flex items-center">
              <Handle
                type="target"
                position={Position.Left}
                id={`a${i}`}
                className="w-2 h-2 bg-slate-400 -ml-4"
              />
              <span className="text-[8px] text-slate-400 font-mono ml-1">
                A{i}
              </span>
            </div>
          ))}
          <div className="text-[10px] text-slate-500 font-mono mt-2 mb-1">
            B [0..7]
          </div>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={`b${i}`} className="relative h-4 flex items-center">
              <Handle
                type="target"
                position={Position.Left}
                id={`b${i}`}
                className="w-2 h-2 bg-slate-400 -ml-4"
              />
              <span className="text-[8px] text-slate-400 font-mono ml-1">
                B{i}
              </span>
            </div>
          ))}
          <div className="relative h-4 flex items-center mt-2">
            <Handle
              type="target"
              position={Position.Left}
              id="cin"
              className="w-2 h-2 bg-red-400 -ml-4"
            />
            <span className="text-[8px] text-red-400 font-mono ml-1">Cin</span>
          </div>
        </div>

        {/* Outputs */}
        <div className="flex flex-col gap-1 items-end">
          <div className="text-[10px] text-slate-500 font-mono mb-1">
            Sum [0..7]
          </div>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={`s${i}`}
              className="relative h-4 flex items-center justify-end"
            >
              <span className="text-[8px] text-slate-400 font-mono mr-1">
                S{i}
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id={`s${i}`}
                className={`w-2 h-2 -mr-4 ${data.sum?.[i] ? "bg-green-400" : "bg-slate-600"}`}
              />
            </div>
          ))}
          <div className="relative h-4 flex items-center justify-end mt-2">
            <span className="text-[8px] text-red-400 font-mono mr-1">Cout</span>
            <Handle
              type="source"
              position={Position.Right}
              id="cout"
              className={`w-2 h-2 -mr-4 ${data.cout ? "bg-red-400" : "bg-slate-600"}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
