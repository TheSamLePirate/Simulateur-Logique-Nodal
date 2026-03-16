import { Handle, Position } from "@xyflow/react";
import { Globe } from "lucide-react";

export const NetworkControllerNode = ({ id, data }: any) => {
  const url = (data.url as string) || "";
  const body = (data.body as string) || "";
  const method = (data.method as string) || "GET";
  const pending = data.pending === 1;
  const avail = data.avail === 1;
  const lastByte = data.lastByte || 0;
  const responseBytes = (data.responseBuffer as number[]) || [];
  const responseSize = data.responseSize || responseBytes.length || 0;

  const updateConfig = (patch: Record<string, unknown>) => {
    window.dispatchEvent(
      new CustomEvent("network-node-config", {
        detail: { nodeId: id, ...patch },
      }),
    );
  };

  return (
    <div className="bg-slate-800 border-2 border-sky-600 rounded-md p-2 min-w-[280px] shadow-lg flex flex-col">
      <div className="flex items-center justify-center gap-2 mb-2 border-b border-slate-700 pb-2">
        <Globe size={14} className="text-sky-400" />
        <span className="text-[10px] font-bold text-white uppercase">
          {data.label || "NETWORK"}
        </span>
      </div>

      <div className="bg-slate-900 rounded p-2 mb-2 border border-slate-700">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[8px] text-sky-400 font-mono font-bold">
            method
          </span>
          <span
            className={`text-[8px] font-mono font-bold ${
              pending ? "text-amber-400" : avail ? "text-emerald-400" : "text-slate-400"
            }`}
          >
            {pending ? "PENDING" : avail ? "READY" : "IDLE"}
          </span>
        </div>
        <select
          value={method}
          onChange={(e) => updateConfig({ method: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="nodrag w-full bg-black text-sky-300 text-[9px] font-mono px-1 py-1 border border-slate-700 rounded outline-none focus:border-sky-500 mb-2"
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
        </select>
        <div className="text-[8px] text-slate-400 font-mono mb-1">url</div>
        <input
          type="text"
          value={url}
          onChange={(e) => updateConfig({ url: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="nodrag w-full bg-black text-sky-200 text-[9px] font-mono px-1 py-1 border border-slate-700 rounded outline-none focus:border-sky-500 mb-2"
          placeholder="https://example.com"
        />
        <div className="text-[8px] text-slate-400 font-mono mb-1">body</div>
        <textarea
          value={body}
          onChange={(e) => updateConfig({ body: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          rows={3}
          className="nodrag w-full resize-none bg-black text-sky-200 text-[9px] font-mono px-1 py-1 border border-slate-700 rounded outline-none focus:border-sky-500"
          placeholder='{"hello":"world"}'
        />
      </div>

      <div className="bg-slate-900 rounded p-1 mb-2 text-center border border-slate-700">
        <div className="text-[8px] text-slate-400 font-mono">
          {method} | resp {responseSize}B | queue {responseBytes.length}B
        </div>
        <div className="flex justify-center gap-3 mt-1">
          <span className="text-[8px] text-orange-400 font-mono">
            byte: 0x{lastByte.toString(16).padStart(2, "0").toUpperCase()}
          </span>
          <span className="text-[8px] text-cyan-400 font-mono">
            avail: {avail ? 1 : 0}
          </span>
          <span className="text-[8px] text-amber-400 font-mono">
            pending: {pending ? 1 : 0}
          </span>
        </div>
      </div>

      <div className="flex justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="text-[8px] text-sky-400 font-bold">CONTROL</div>
          {[
            ["get", "GET", "text-sky-400", "bg-sky-400"],
            ["post", "POST", "text-indigo-400", "bg-indigo-400"],
            ["rd", "RD", "text-yellow-400", "bg-yellow-400"],
            ["clr", "CLR", "text-red-400", "bg-red-400"],
          ].map(([handleId, label, textClass, dotClass]) => (
            <div key={handleId} className="relative h-3 flex items-center">
              <Handle
                type="target"
                position={Position.Left}
                id={handleId}
                className={`w-2 h-2 -ml-3 ${dotClass}`}
              />
              <span className={`text-[8px] font-mono ml-1 font-bold ${textClass}`}>
                {label}
              </span>
            </div>
          ))}
        </div>

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
          <div className="relative h-3 flex items-center mt-1">
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
            <span className="text-[8px] text-amber-400 font-mono mr-1 font-bold">
              PEND
            </span>
            <Handle
              type="source"
              position={Position.Right}
              id="pending"
              className="w-2 h-2 bg-amber-400 -mr-3"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
