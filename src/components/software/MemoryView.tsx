import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Cpu, Layers } from "lucide-react";
import { MEMORY_SIZE } from "../../cpu/isa";

const NUM_PAGES = MEMORY_SIZE / 256;

/** Return a region label for a given page base address */
function regionLabel(base: number): string {
  if (base < 0x1000) return "Code";
  if (base < 0x1800) return "Data";
  return "Stack";
}

/** Region color class for page labels */
function regionColor(base: number): string {
  if (base < 0x1000) return "text-blue-400";
  if (base < 0x1800) return "text-emerald-400";
  return "text-orange-400";
}

interface MemoryViewProps {
  memory: Uint8Array;
  pc: number;
  sp: number;
  highlights?: Set<number>;
}

export function MemoryView({ memory, pc, sp, highlights }: MemoryViewProps) {
  const [page, setPage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [colCount, setColCount] = useState(16);

  const pageBase = page * 256;

  // Responsive column count via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setColCount(w >= 380 ? 16 : 8);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build rows dynamically based on colCount
  const rowCount = 256 / colCount;
  const rows = useMemo(() => {
    const result: { addr: number; cells: number[] }[] = [];
    for (let row = 0; row < rowCount; row++) {
      const addr = pageBase + row * colCount;
      const cells: number[] = [];
      for (let col = 0; col < colCount; col++) {
        cells.push(memory[addr + col] || 0);
      }
      result.push({ addr, cells });
    }
    return result;
  }, [memory, pageBase, colCount, rowCount]);

  const goToPC = useCallback(() => setPage(Math.floor(pc / 256)), [pc]);
  const goToSP = useCallback(() => setPage(Math.floor(sp / 256)), [sp]);
  const prevPage = useCallback(() => setPage((p) => Math.max(0, p - 1)), []);
  const nextPage = useCallback(
    () => setPage((p) => Math.min(NUM_PAGES - 1, p + 1)),
    [],
  );

  return (
    <div
      ref={containerRef}
      className="bg-slate-900 border border-slate-700 rounded-md overflow-hidden flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-slate-800 border-b border-slate-700 shrink-0 flex-wrap">
        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mr-1">
          Mémoire
        </span>

        {/* Quick-nav buttons */}
        <button
          onClick={goToPC}
          className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 hover:bg-green-500/30 transition-colors flex items-center gap-0.5"
          title={`Aller au PC (0x${pc.toString(16).padStart(4, "0").toUpperCase()})`}
        >
          <Cpu size={9} /> PC
        </button>
        <button
          onClick={goToSP}
          className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 hover:bg-purple-500/30 transition-colors flex items-center gap-0.5"
          title={`Aller au SP (0x${sp.toString(16).padStart(4, "0").toUpperCase()})`}
        >
          <Layers size={9} /> SP
        </button>

        {/* Page navigation */}
        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={prevPage}
            disabled={page === 0}
            className="text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <select
            value={page}
            onChange={(e) => setPage(parseInt(e.target.value))}
            className="bg-slate-700 text-slate-300 text-[10px] font-mono rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:border-blue-500"
          >
            {Array.from({ length: NUM_PAGES }, (_, p) => {
              const base = p * 256;
              return (
                <option key={p} value={p}>
                  0x{base.toString(16).padStart(4, "0").toUpperCase()} (
                  {regionLabel(base)})
                </option>
              );
            })}
          </select>
          <button
            onClick={nextPage}
            disabled={page === NUM_PAGES - 1}
            className="text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={14} />
          </button>

          {/* Region indicator */}
          <span
            className={`text-[9px] font-bold ml-1 ${regionColor(pageBase)}`}
          >
            {regionLabel(pageBase)}
          </span>
        </div>
      </div>

      {/* Column headers */}
      <div className="px-2 pt-1 flex font-mono text-[9px] text-slate-600 shrink-0">
        <span className="w-11 shrink-0" />
        {Array.from({ length: colCount }, (_, i) => (
          <span key={i} className="flex-1 text-center min-w-0">
            {i.toString(16).toUpperCase()}
          </span>
        ))}
      </div>

      {/* Hex grid */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
        {rows.map((row) => (
          <div key={row.addr} className="flex items-center">
            <span className="w-11 shrink-0 font-mono text-[9px] text-slate-600 text-right pr-1">
              {row.addr.toString(16).padStart(4, "0").toUpperCase()}
            </span>
            {row.cells.map((value, col) => {
              const addr = row.addr + col;
              const isPC = addr === pc;
              const isSP = addr === sp;
              const isHighlighted = highlights?.has(addr);
              const isNonZero = value !== 0;

              return (
                <span
                  key={col}
                  className={`flex-1 text-center font-mono text-[10px] leading-5 rounded-sm min-w-0 ${
                    isPC
                      ? "bg-green-500/30 text-green-300 font-bold"
                      : isSP
                        ? "bg-purple-500/25 text-purple-300 font-bold"
                        : isHighlighted
                          ? "bg-amber-500/20 text-amber-300"
                          : isNonZero
                            ? "text-slate-300"
                            : "text-slate-700"
                  }`}
                  title={`0x${addr.toString(16).padStart(4, "0").toUpperCase()} = ${value} (0x${value.toString(16).padStart(2, "0").toUpperCase()})${isPC ? " ◄ PC" : ""}${isSP ? " ◄ SP" : ""}`}
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
