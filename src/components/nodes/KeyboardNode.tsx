import { useEffect, useCallback } from "react";
import { Handle, Position } from "@xyflow/react";
import { Keyboard } from "lucide-react";

const KEY_LABELS = ["\u2190", "\u2192", "\u2191", "\u2193", "\u21B5"];
const KEY_NAMES = ["LEFT", "RIGHT", "UP", "DOWN", "ENTER"];

export const KeyboardNode = ({ id, data }: any) => {
  const keys: number[] = data.keys || [0, 0, 0, 0, 0];

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      let index = -1;
      if (e.key === "ArrowLeft") index = 0;
      else if (e.key === "ArrowRight") index = 1;
      else if (e.key === "ArrowUp") index = 2;
      else if (e.key === "ArrowDown") index = 3;
      else if (e.key === "Enter") index = 4;

      if (index >= 0) {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent("keyboard-state", {
            detail: { index, value: 1, nodeId: id },
          }),
        );
      }
    },
    [id],
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      let index = -1;
      if (e.key === "ArrowLeft") index = 0;
      else if (e.key === "ArrowRight") index = 1;
      else if (e.key === "ArrowUp") index = 2;
      else if (e.key === "ArrowDown") index = 3;
      else if (e.key === "Enter") index = 4;

      if (index >= 0) {
        window.dispatchEvent(
          new CustomEvent("keyboard-state", {
            detail: { index, value: 0, nodeId: id },
          }),
        );
      }
    },
    [id],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  return (
    <div className="bg-slate-800 border-2 border-violet-600 rounded-md p-2 min-w-[180px] shadow-lg flex flex-col">
      <div className="flex items-center justify-center gap-2 mb-2 border-b border-slate-700 pb-2">
        <Keyboard size={14} className="text-violet-400" />
        <span className="text-[10px] font-bold text-white uppercase">
          {data.label || "KEYBOARD"}
        </span>
      </div>

      {/* Arrow keys layout */}
      <div className="flex flex-col items-center gap-1 mb-2">
        {/* Up */}
        <div
          className={`w-8 h-6 rounded text-center text-[12px] font-bold leading-6 border ${
            keys[2]
              ? "bg-violet-500 text-white border-violet-400"
              : "bg-slate-700 text-slate-400 border-slate-600"
          }`}
        >
          {KEY_LABELS[2]}
        </div>
        {/* Left Down Right */}
        <div className="flex gap-1">
          <div
            className={`w-8 h-6 rounded text-center text-[12px] font-bold leading-6 border ${
              keys[0]
                ? "bg-violet-500 text-white border-violet-400"
                : "bg-slate-700 text-slate-400 border-slate-600"
            }`}
          >
            {KEY_LABELS[0]}
          </div>
          <div
            className={`w-8 h-6 rounded text-center text-[12px] font-bold leading-6 border ${
              keys[3]
                ? "bg-violet-500 text-white border-violet-400"
                : "bg-slate-700 text-slate-400 border-slate-600"
            }`}
          >
            {KEY_LABELS[3]}
          </div>
          <div
            className={`w-8 h-6 rounded text-center text-[12px] font-bold leading-6 border ${
              keys[1]
                ? "bg-violet-500 text-white border-violet-400"
                : "bg-slate-700 text-slate-400 border-slate-600"
            }`}
          >
            {KEY_LABELS[1]}
          </div>
        </div>
        {/* Enter */}
        <div
          className={`w-[104px] h-6 rounded text-center text-[10px] font-bold leading-6 border ${
            keys[4]
              ? "bg-violet-500 text-white border-violet-400"
              : "bg-slate-700 text-slate-400 border-slate-600"
          }`}
        >
          ENTER
        </div>
      </div>

      {/* Output handles */}
      <div className="flex flex-col gap-1 items-end">
        <div className="text-[8px] text-orange-400 font-bold">KEY OUT</div>
        {KEY_NAMES.map((name, i) => (
          <div key={`k${i}`} className="relative h-3 flex items-center">
            <span
              className={`text-[8px] font-mono mr-1 font-bold ${
                keys[i] ? "text-violet-400" : "text-slate-500"
              }`}
            >
              K{i} {name}
            </span>
            <Handle
              type="source"
              position={Position.Right}
              id={`k${i}`}
              className="w-2 h-2 bg-orange-400 -mr-3"
            />
          </div>
        ))}
        <div className="relative h-3 flex items-center mt-1">
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
  );
};
