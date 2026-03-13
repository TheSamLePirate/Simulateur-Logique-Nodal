import { Handle, Position } from "@xyflow/react";

export const GateNode = ({ data }: any) => {
  const isNot = data.type === "NOT";
  return (
    <div className="bg-slate-800 border-2 border-slate-600 rounded-md p-2 min-w-[100px] text-center shadow-lg">
      {!isNot && (
        <Handle
          type="target"
          position={Position.Left}
          id="a"
          style={{ top: "30%" }}
          className="w-2 h-2 bg-slate-400"
        />
      )}
      {!isNot && (
        <Handle
          type="target"
          position={Position.Left}
          id="b"
          style={{ top: "70%" }}
          className="w-2 h-2 bg-slate-400"
        />
      )}
      {isNot && (
        <Handle
          type="target"
          position={Position.Left}
          id="in"
          className="w-2 h-2 bg-slate-400"
        />
      )}

      <div className="font-mono font-bold text-lg text-white py-2">
        {data.type}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className={`w-3 h-3 ${data.value ? "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" : "bg-slate-600"}`}
      />
    </div>
  );
};
