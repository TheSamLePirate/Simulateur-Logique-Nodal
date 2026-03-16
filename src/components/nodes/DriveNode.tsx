import { Handle, Position } from "@xyflow/react";
import { HardDrive } from "lucide-react";
import { DRIVE_SIZE, DRIVE_PAGE_SIZE } from "../../cpu/isa";

export const DriveNode = ({ data }: any) => {
  const bytes: number[] = data.bytes || Array(DRIVE_SIZE).fill(0);
  const currentAddress = data.currentAddress || 0;
  const lastRead = data.lastRead || 0;
  const lastWrite = data.lastWrite || 0;
  const currentPage = Math.floor(currentAddress / DRIVE_PAGE_SIZE);
  const previewBase = currentPage * DRIVE_PAGE_SIZE;
  const preview = bytes
    .slice(previewBase, previewBase + 32)
    .map((v) => v.toString(16).padStart(2, "0").toUpperCase())
    .join(" ");

  return (
    <div className="bg-slate-800 border-2 border-amber-600 rounded-md p-2 min-w-[260px] shadow-lg flex flex-col">
      <div className="flex items-center justify-center gap-2 mb-2 border-b border-slate-700 pb-2">
        <HardDrive size={14} className="text-amber-400" />
        <span className="text-[10px] font-bold text-white uppercase">
          {data.label || "EXT DRIVE"}
        </span>
      </div>

      <div className="bg-black rounded p-2 mb-2 border border-slate-700">
        <div className="text-[8px] text-amber-400 font-mono mb-1">
          page {currentPage.toString(16).padStart(2, "0").toUpperCase()} | addr{" "}
          {currentAddress.toString(16).padStart(4, "0").toUpperCase()} | rd{" "}
          {lastRead.toString(16).padStart(2, "0").toUpperCase()} | wr{" "}
          {lastWrite.toString(16).padStart(2, "0").toUpperCase()}
        </div>
        <div className="text-[8px] text-slate-500 font-mono mb-1">
          base {previewBase.toString(16).padStart(4, "0").toUpperCase()}
        </div>
        <pre className="text-[8px] text-slate-300 font-mono whitespace-pre-wrap break-all leading-tight">
          {preview}
        </pre>
      </div>

      <div className="flex justify-between">
        <div className="flex flex-col gap-1">
          <div className="text-[8px] text-cyan-400 font-bold">ADDR</div>
          {Array.from({ length: 13 }, (_, i) => i).map((i) => (
            <div key={`a${i}`} className="relative h-3 flex items-center">
              <Handle
                type="target"
                position={Position.Left}
                id={`a${i}`}
                className="w-2 h-2 bg-cyan-400 -ml-3"
              />
              <span className="text-[8px] text-slate-500 font-mono ml-1">
                A{i}
              </span>
            </div>
          ))}
          <div className="text-[8px] text-blue-400 font-bold mt-2">DATA IN</div>
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
          {[
            ["rd", "RD", "text-yellow-400", "bg-yellow-400"],
            ["wr", "WR", "text-amber-400", "bg-amber-400"],
            ["clr", "CLR", "text-red-400", "bg-red-400"],
          ].map(([id, label, textClass, dotClass]) => (
            <div key={id} className="relative h-3 flex items-center mt-1">
              <Handle
                type="target"
                position={Position.Left}
                id={id}
                className={`w-2 h-2 -ml-3 ${dotClass}`}
              />
              <span className={`text-[8px] font-mono ml-1 font-bold ${textClass}`}>
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1 items-end">
          <div className="text-[8px] text-green-400 font-bold">DATA OUT</div>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={`q${i}`} className="relative h-3 flex items-center">
              <span className="text-[8px] text-slate-500 font-mono mr-1">
                Q{i}
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id={`q${i}`}
                className="w-2 h-2 bg-green-400 -mr-3"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
