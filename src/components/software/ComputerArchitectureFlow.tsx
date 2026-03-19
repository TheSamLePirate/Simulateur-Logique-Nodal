import { memo, useMemo } from "react";
import { Database } from "lucide-react";

import type { ComputerPanelData } from "./computerPanelTypes";
import { buildComputerArchitectureFlowGraph } from "./computerArchitectureFlowGraph";
import { renderComputerArchitectureFlowSvg } from "./computerArchitectureFlowSvg";

export const ComputerArchitectureFlow = memo(function ComputerArchitectureFlow({
  data,
}: {
  data: ComputerPanelData;
}) {
  const { model, nodes, edges } = useMemo(
    () => buildComputerArchitectureFlowGraph(data),
    [data],
  );
  const svgMarkup = useMemo(
    () => renderComputerArchitectureFlowSvg(nodes, edges),
    [nodes, edges],
  );

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-800 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_22%),linear-gradient(180deg,_rgba(15,23,42,0.98),_rgba(2,6,23,1))] shadow-[0_28px_120px_rgba(2,6,23,0.55)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/70 px-5 py-4">
        <div>
          <div className="flex items-center gap-2 text-slate-100">
            <Database size={16} className="text-cyan-300" />
            <h3 className="text-sm font-semibold">Computer Architecture Flow</h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Live CPU, ALU, memory bus, and I/O topology rendered from the same SVG generator as the test snapshots.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-300">
            instruction {model.instruction.mnemonic}
          </span>
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
            model.pulseOn
              ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
              : "border-slate-700 bg-slate-900 text-slate-400"
          }`}>
            data pulse {model.pulseOn ? "ON" : "OFF"}
          </span>
        </div>
      </div>

      <div className="h-[900px] min-h-[720px] w-full overflow-auto bg-[linear-gradient(180deg,_rgba(2,6,23,0.55),_rgba(2,6,23,0.9))] xl:h-[1080px]">
        <div
          className="min-w-max"
          // The SVG is generated from internal data only, so rendering it directly
          // keeps the UI pixel-identical to the test artifacts without React Flow drift.
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
      </div>
    </section>
  );
});
