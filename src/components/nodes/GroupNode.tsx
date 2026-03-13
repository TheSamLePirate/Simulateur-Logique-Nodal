import { Handle, Position } from "@xyflow/react";
import { Maximize2, Package, Unlink, Save, Pencil } from "lucide-react";
import type { GroupNodeData } from "../../types";

export const GroupNode = ({
  data,
  id,
}: {
  data: GroupNodeData;
  id: string;
}) => {
  const { label, inputHandles, outputHandles, outputs } = data;

  const handleRename = () => {
    const newName = prompt("Renommer le module :", label);
    if (newName && newName !== label) {
      window.dispatchEvent(
        new CustomEvent("rename-module", {
          detail: { id, newLabel: newName },
        }),
      );
    }
  };

  return (
    <div className="bg-slate-800 border-2 border-purple-600 rounded-md p-3 min-w-[140px] shadow-lg relative">
      {/* Action buttons row */}
      <div className="absolute top-2 right-2 flex items-center gap-1">
        <button
          onClick={handleRename}
          className="text-slate-400 hover:text-white transition-colors p-0.5"
          title="Renommer"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("inspect-node", { detail: `group:${id}` }),
            )
          }
          className="text-slate-400 hover:text-white transition-colors p-0.5"
          title="Voir le circuit interne"
        >
          <Maximize2 size={12} />
        </button>
        <button
          onClick={() =>
            window.dispatchEvent(new CustomEvent("save-module", { detail: id }))
          }
          className="text-slate-400 hover:text-green-400 transition-colors p-0.5"
          title="Sauvegarder comme module réutilisable"
        >
          <Save size={12} />
        </button>
        <button
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("ungroup-node", { detail: id }),
            )
          }
          className="text-slate-400 hover:text-red-400 transition-colors p-0.5"
          title="Dégrouper"
        >
          <Unlink size={12} />
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center gap-2 mb-3 border-b border-slate-700 pb-2 pr-20">
        <Package size={16} className="text-purple-400 shrink-0" />
        <span className="font-bold text-white text-sm truncate max-w-[120px]">
          {label}
        </span>
      </div>

      <div className="flex justify-between gap-4">
        {/* Input handles (left side) */}
        {inputHandles.length > 0 && (
          <div className="flex flex-col gap-1">
            {inputHandles.map((h) => (
              <div key={h.handleId} className="relative h-4 flex items-center">
                <Handle
                  type="target"
                  position={Position.Left}
                  id={h.handleId}
                  className="w-2 h-2 bg-slate-400 -ml-4"
                />
                <span className="text-[8px] text-slate-400 font-mono ml-1 whitespace-nowrap">
                  {h.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Output handles (right side) */}
        {outputHandles.length > 0 && (
          <div className="flex flex-col gap-1 items-end">
            {outputHandles.map((h) => (
              <div
                key={h.handleId}
                className="relative h-4 flex items-center justify-end"
              >
                <span className="text-[8px] text-slate-400 font-mono mr-1 whitespace-nowrap">
                  {h.label}
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={h.handleId}
                  className={`w-2 h-2 -mr-4 ${outputs[h.handleId] ? "bg-purple-400" : "bg-slate-600"}`}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
