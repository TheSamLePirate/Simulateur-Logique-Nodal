import { useEffect, useRef, useState } from "react";
import { Trash2, Grid3x3, Maximize2, Minimize2 } from "lucide-react";
import type { PlotterColor, PlotterPixels } from "../../plotter";
import { DEFAULT_PLOTTER_COLOR, unpackPlotterColor } from "../../plotter";

const CANVAS_SIZE = 256; // logical pixel grid (256×256)

interface PlotterPanelProps {
  pixels: PlotterPixels;
  currentColor?: PlotterColor;
  onClear: () => void;
}

export function PlotterPanel({
  pixels,
  currentColor = DEFAULT_PLOTTER_COLOR,
  onClear,
}: PlotterPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [viewportSize, setViewportSize] = useState(CANVAS_SIZE);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateViewportSize = () => {
      const nextSize = Math.max(
        1,
        Math.floor(Math.min(container.clientWidth, container.clientHeight)),
      );
      setViewportSize(nextSize);
    };

    updateViewportSize();

    const observer = new ResizeObserver(() => {
      updateViewportSize();
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [fullscreen]);

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
      for (const [encoded, color] of pixels.entries()) {
        const { r, g, b } = unpackPlotterColor(color);
        const x = encoded & 0xff;
        const y = (encoded >> 8) & 0xff;
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [pixels, fullscreen]);

  // ESC key to exit fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [fullscreen]);

  const header = (
    <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 border-b border-slate-700 shrink-0">
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
        <span className="text-[9px] text-slate-500 font-mono">
          rgb({currentColor.r},{currentColor.g},{currentColor.b})
        </span>
        <span
          className="w-2.5 h-2.5 rounded-sm border border-slate-600"
          style={{
            backgroundColor: `rgb(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`,
          }}
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onClear}
          className="text-slate-500 hover:text-red-400 transition-colors"
          title="Effacer le plotter"
        >
          <Trash2 size={14} />
        </button>
        <button
          onClick={() => setFullscreen((f) => !f)}
          className="text-slate-500 hover:text-cyan-400 transition-colors"
          title={fullscreen ? "Réduire (ESC)" : "Plein écran"}
        >
          {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
    </div>
  );

  const canvas = (
    <canvas
      ref={canvasRef}
      width={CANVAS_SIZE}
      height={CANVAS_SIZE}
      className="block"
      style={{
        imageRendering: "pixelated",
        width: `${viewportSize}px`,
        height: `${viewportSize}px`,
      }}
    />
  );

  // ── Fullscreen overlay ──
  if (fullscreen) {
    return (
      <>
        {/* Keep the inline slot so the layout doesn't collapse */}
        <div className="flex flex-col h-full bg-slate-900 border border-slate-700 rounded-md overflow-hidden">
          <div className="flex items-center justify-center flex-1 bg-black">
            <span className="text-[10px] text-slate-600 font-mono">
              Plein écran actif
            </span>
          </div>
        </div>

        {/* Fullscreen overlay */}
        <div className="fixed inset-0 z-50 bg-slate-700 flex flex-col">
          {header}
          <div
            ref={containerRef}
            className="flex-1 flex items-center justify-center p-2 min-h-0"
          >
            {canvas}
          </div>
          <div className="shrink-0 text-center pb-1">
            <span className="text-[10px] text-slate-500 font-mono">
              ESC pour quitter
            </span>
          </div>
        </div>
      </>
    );
  }

  // ── Normal inline view ──
  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-700 rounded-md overflow-hidden">
      {header}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center bg-black p-1 min-h-[80px]"
      >
        {canvas}
      </div>
    </div>
  );
}
