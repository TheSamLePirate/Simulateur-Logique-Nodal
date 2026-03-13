import { useMemo } from "react";

interface MemoryViewProps {
  memory: Uint8Array;
  pc: number;
  highlights?: Set<number>; // recently written addresses
}

export function MemoryView({ memory, pc, highlights }: MemoryViewProps) {
  // Build 16×16 hex grid
  const rows = useMemo(() => {
    const result: { addr: number; cells: number[] }[] = [];
    for (let row = 0; row < 16; row++) {
      const addr = row * 16;
      const cells: number[] = [];
      for (let col = 0; col < 16; col++) {
        cells.push(memory[addr + col] || 0);
      }
      result.push({ addr, cells });
    }
    return result;
  }, [memory]);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-md overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center px-3 py-1.5 bg-slate-800 border-b border-slate-700">
        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
          Mémoire (256 octets)
        </span>
      </div>

      {/* Column headers */}
      <div className="px-2 pt-1 flex font-mono text-[9px] text-slate-600">
        <span className="w-8 shrink-0" />
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
            <span className="w-8 shrink-0 font-mono text-[9px] text-slate-600 text-right pr-1">
              {row.addr.toString(16).padStart(2, "0").toUpperCase()}
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
                  title={`Addr: ${addr.toString(16).padStart(2, "0").toUpperCase()} = ${value} (0x${value.toString(16).padStart(2, "0").toUpperCase()})`}
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
