import { useEffect, useRef } from "react";
import { Trash2, Grid3x3 } from "lucide-react";

const CANVAS_SIZE = 256; // logical pixel grid (256×256)

interface PlotterPanelProps {
  pixels: Set<number>;
  onClear: () => void;
}

export function PlotterPanel({ pixels, onClear }: PlotterPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Redraw canvas whenever pixels change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear to black
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw pixels
    if (pixels.size > 0) {
      ctx.fillStyle = "#22d3ee"; // cyan-400
      for (const encoded of pixels) {
        const x = encoded & 0xff;
        const y = (encoded >> 8) & 0xff;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [pixels]);

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-700 rounded-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Grid3x3 size={14} className="text-cyan-400" />
          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
            Plotter
          </span>
          {pixels.size > 0 && (
            <span className="text-[9px] text-slate-500 font-mono">
              {pixels.size}px
            </span>
          )}
        </div>
        <button
          onClick={onClear}
          className="text-slate-500 hover:text-red-400 transition-colors"
          title="Effacer le plotter"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center bg-black p-1 min-h-[80px]"
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="w-full h-full object-contain"
          style={{ imageRendering: "pixelated" }}
        />
      </div>
    </div>
  );
}
