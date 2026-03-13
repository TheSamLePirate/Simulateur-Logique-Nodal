import { useMemo, useState } from "react";
import { MEMORY_SIZE } from "../../cpu/isa";

const NUM_PAGES = MEMORY_SIZE / 256;

interface MemoryViewProps {
  memory: Uint8Array;
  pc: number;
  highlights?: Set<number>; // recently written addresses
}

export function MemoryView({ memory, pc, highlights }: MemoryViewProps) {
  const [page, setPage] = useState(0);
  const pageBase = page * 256;

  // Build 16×16 hex grid for current page
  const rows = useMemo(() => {
    const result: { addr: number; cells: number[] }[] = [];
    for (let row = 0; row < 16; row++) {
      const addr = pageBase + row * 16;
      const cells: number[] = [];
      for (let col = 0; col < 16; col++) {
        cells.push(memory[addr + col] || 0);
      }
      result.push({ addr, cells });
    }
    return result;
  }, [memory, pageBase]);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-md overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center px-3 py-1.5 bg-slate-800 border-b border-slate-700">
        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
          Mémoire ({MEMORY_SIZE} octets)
        </span>
        <div className="ml-auto flex gap-1">
          {Array.from({ length: NUM_PAGES }, (_, p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded transition-colors ${
                page === p
                  ? "bg-blue-500/30 text-blue-300 font-bold"
                  : "bg-slate-700 text-slate-500 hover:text-slate-300"
              }`}
            >
              {(p * 256).toString(16).padStart(3, "0").toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Column headers */}
      <div className="px-2 pt-1 flex font-mono text-[9px] text-slate-600">
        <span className="w-10 shrink-0" />
        {Array.from({ length: 16 }, (_, i) => (
          <span key={i} className="w-6 text-center shrink-0">
            {i.toString(16).toUpperCase()}
          </span>
        ))}
      </div>

      {/* Hex grid */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {rows.map((row) => (
          <div key={row.addr} className="flex items-center">
            <span className="w-10 shrink-0 font-mono text-[9px] text-slate-600 text-right pr-1">
              {row.addr.toString(16).padStart(3, "0").toUpperCase()}
            </span>
            {row.cells.map((value, col) => {
              const addr = row.addr + col;
              const isPC = addr === pc;
              const isHighlighted = highlights?.has(addr);
              const isNonZero = value !== 0;

              return (
                <span
                  key={col}
                  className={`w-6 text-center font-mono text-[10px] leading-5 rounded-sm ${
                    isPC
                      ? "bg-green-500/30 text-green-300 font-bold"
                      : isHighlighted
                        ? "bg-amber-500/20 text-amber-300"
                        : isNonZero
                          ? "text-slate-300"
                          : "text-slate-700"
                  }`}
                  title={`0x${addr.toString(16).padStart(3, "0").toUpperCase()} = ${value} (0x${value.toString(16).padStart(2, "0").toUpperCase()})`}
                >
                  {value.toString(16).padStart(2, "0").toUpperCase()}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
