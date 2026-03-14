import { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { Terminal } from "lucide-react";

export const ConsoleNode = ({ id, data }: any) => {
  const text = (data.text as string) || "";
  const lastChar = data.lastChar || 0;
  const inputBufferSize = data.inputBufferSize || 0;
  const [inputText, setInputText] = useState("");

  return (
    <div className="bg-slate-800 border-2 border-emerald-600 rounded-md p-2 min-w-[240px] shadow-lg flex flex-col">
      <div className="flex items-center justify-center gap-2 mb-2 border-b border-slate-700 pb-2">
        <Terminal size={14} className="text-emerald-400" />
        <span className="text-[10px] font-bold text-white uppercase">
          {data.label || "CONSOLE"}
        </span>
      </div>

      {/* Terminal display */}
      <div className="bg-black rounded p-2 mb-2 border border-slate-700 min-h-[60px] max-h-[120px] overflow-y-auto">
        <pre className="text-[10px] text-emerald-400 font-mono whitespace-pre-wrap break-all leading-tight">
          {text || <span className="text-slate-600">_</span>}
        </pre>
      </div>

      {/* Keyboard input */}
      <div className="flex items-center gap-1 mb-2">
        <span className="text-emerald-400 text-[8px] font-mono font-bold">
          &gt;
        </span>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (inputText) {
                window.dispatchEvent(
                  new CustomEvent("console-input", {
                    detail: { text: inputText, nodeId: id },
                  }),
                );
                setInputText("");
              }
            }
            e.stopPropagation();
          }}
          className="flex-1 bg-black text-emerald-400 text-[9px] font-mono px-1 py-0.5 border border-slate-700 rounded outline-none focus:border-emerald-500 min-w-0"
          placeholder="Saisie + Entrée..."
        />
      </div>

      {/* Status */}
      <div className="bg-slate-900 rounded p-1 mb-2 text-center border border-slate-700">
        <div className="text-[8px] text-slate-400 font-mono">
          Last: 0x{lastChar.toString(16).padStart(2, "0").toUpperCase()}
          {lastChar >= 32 && lastChar < 127
            ? ` '${String.fromCharCode(lastChar)}'`
            : ""}
        </div>
        <div className="flex justify-center gap-3">
          <span className="text-[8px] text-emerald-400 font-mono">
            {text.length} chars
          </span>
          <span className="text-[8px] text-orange-400 font-mono">
            buf: {inputBufferSize}
          </span>
        </div>
      </div>

      <div className="flex justify-between">
        {/* Left side: D0-D7 (data in), WR, MODE, CLR */}
        <div className="flex flex-col gap-1">
          <div className="text-[8px] text-blue-400 font-bold">DATA IN</div>
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
              id="wr"
              className="w-2 h-2 bg-emerald-400 -ml-3"
            />
            <span className="text-[8px] text-emerald-400 font-mono ml-1 font-bold">
              WR
            </span>
          </div>
          <div className="relative h-3 flex items-center">
            <Handle
              type="target"
              position={Position.Left}
              id="mode"
              className="w-2 h-2 bg-yellow-400 -ml-3"
            />
            <span className="text-[8px] text-yellow-400 font-mono ml-1 font-bold">
              MODE
            </span>
          </div>
          <div className="relative h-3 flex items-center">
            <Handle
              type="target"
              position={Position.Left}
              id="clr"
              className="w-2 h-2 bg-red-400 -ml-3"
            />
            <span className="text-[8px] text-red-400 font-mono ml-1 font-bold">
              CLR
            </span>
          </div>
        </div>

        {/* Right side: Q0-Q7 (data out), AVAIL, RD */}
        <div className="flex flex-col gap-1 items-end">
          <div className="text-[8px] text-orange-400 font-bold">DATA OUT</div>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={`q${i}`} className="relative h-3 flex items-center">
              <span className="text-[8px] text-slate-500 font-mono mr-1">
                Q{i}
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id={`q${i}`}
                className="w-2 h-2 bg-orange-400 -mr-3"
              />
            </div>
          ))}
          <div className="relative h-3 flex items-center mt-2">
            <span className="text-[8px] text-cyan-400 font-mono mr-1 font-bold">
              AVAIL
            </span>
            <Handle
              type="source"
              position={Position.Right}
              id="avail"
              className="w-2 h-2 bg-cyan-400 -mr-3"
            />
          </div>
          <div className="relative h-3 flex items-center">
            <span className="text-[8px] text-yellow-400 font-mono mr-1 font-bold">
              RD
            </span>
            <Handle
              type="target"
              position={Position.Right}
              id="rd"
              className="w-2 h-2 bg-yellow-400 -mr-3"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
