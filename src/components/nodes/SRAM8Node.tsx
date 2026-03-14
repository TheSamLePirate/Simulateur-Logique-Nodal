import { Handle, Position } from "@xyflow/react";
import { Maximize2, MemoryStick } from "lucide-react";

export const SRAM8Node = ({ data }: any) => {
  const addr = data.currentAddress || 0;
  const memSize = data.memory ? data.memory.length : 256;
  const addrBits = memSize <= 256 ? 8 : 10;
  const addrHexWidth = addrBits <= 8 ? 2 : 3;
  const val = data.memory ? data.memory[addr] : 0;

  return (
    <div className="bg-slate-800 border-2 border-amber-600 rounded-md p-2 min-w-[150px] shadow-lg flex flex-col relative">
      <button
        onClick={() =>
          window.dispatchEvent(
            new CustomEvent("inspect-node", { detail: "sram8" }),
          )
        }
        className="absolute top-2 right-2 text-slate-400 hover:text-white transition-colors"
        title="Voir le circuit interne"
      >
        <Maximize2 size={14} />
      </button>
      <div className="flex items-center justify-center gap-2 mb-2 border-b border-slate-700 pb-2">
        <MemoryStick size={14} className="text-amber-400" />
        <span className="text-[10px] font-bold text-white uppercase">
          SRAM {memSize}x8
        </span>
      </div>

      <div className="bg-slate-900 rounded p-1 mb-2 text-center border border-slate-700">
        <div className="text-[10px] text-slate-400 font-mono">
          ADDR: 0x{addr.toString(16).padStart(addrHexWidth, "0").toUpperCase()}
        </div>
        <div className="text-[10px] text-green-400 font-mono">
          DATA: 0x{val.toString(16).padStart(2, "0").toUpperCase()}
        </div>
      </div>

      <div className="flex justify-between">
        {/* Left side: A0-A9, D0-D7, WE */}
        <div className="flex flex-col gap-1">
          <div className="text-[8px] text-yellow-500 font-bold">ADDR</div>
          {Array.from({ length: addrBits }, (_, i) => (
            <div key={`a${i}`} className="relative h-3 flex items-center">
              <Handle
                type="target"
                position={Position.Left}
                id={`a${i}`}
                className="w-2 h-2 bg-yellow-400 -ml-3"
              />
              <span className="text-[8px] text-slate-500 font-mono ml-1">
                A{i}
              </span>
            </div>
          ))}
          <div className="text-[8px] text-blue-400 font-bold mt-1">DATA IN</div>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={`d${i}`} className="relative h-3 flex items-center">
              <Handle
                type="target"
                position={Position.Left}
                id={`d${i}`}
                className="w-2 h-2 bg-blue-400 -ml-3"
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
              id="we"
              className="w-2 h-2 bg-red-400 -ml-3"
            />
            <span className="text-[8px] text-red-400 font-mono ml-1 font-bold">
              WE
            </span>
          </div>
        </div>

        {/* Right side: Q0-Q7 */}
        <div className="flex flex-col gap-1 items-end mt-4">
          <div className="text-[8px] text-green-400 font-bold">DATA OUT</div>
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
                  className={`w-2 h-2 -mr-3 ${bitVal ? "bg-green-400" : "bg-slate-600"}`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
