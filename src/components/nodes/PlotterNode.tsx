import { Handle, Position } from "@xyflow/react";
import { useEffect, useMemo, useRef } from "react";
import { Grid3X3 } from "lucide-react";
import { DEFAULT_PLOTTER_COLOR, type PlotterColor, type PlotterPixel } from "../../plotter";

const CANVAS_SIZE = 128; // display size in CSS pixels
const GRID_SIZE = 256; // logical pixel grid (256×256)

export const PlotterNode = ({ data }: any) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixels = useMemo(
    () => (data.pixels as PlotterPixel[]) || [],
    [data.pixels],
  );
  const currentColor = (data.currentColor as PlotterColor) || DEFAULT_PLOTTER_COLOR;
  const pixelCount = pixels.length;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear to black
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, GRID_SIZE, GRID_SIZE);

    for (const pixel of pixels) {
      const { x, y, r, g, b } = pixel;
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }, [pixels]);

  return (
    <div className="bg-slate-800 border-2 border-cyan-600 rounded-md p-2 min-w-[180px] shadow-lg flex flex-col">
      <div className="flex items-center justify-center gap-2 mb-2 border-b border-slate-700 pb-2">
        <Grid3X3 size={14} className="text-cyan-400" />
        <span className="text-[10px] font-bold text-white uppercase">
          {data.label || "PLOTTER"}
        </span>
      </div>

      {/* Canvas display */}
      <div className="flex justify-center mb-2">
        <canvas
          ref={canvasRef}
          width={GRID_SIZE}
          height={GRID_SIZE}
          className="border border-slate-700 rounded"
          style={{
            width: CANVAS_SIZE,
            height: CANVAS_SIZE,
            imageRendering: "pixelated",
          }}
        />
      </div>

      {/* Status */}
      <div className="bg-slate-900 rounded p-1 mb-2 text-center border border-slate-700">
        <div className="text-[8px] text-cyan-400 font-mono">
          {pixelCount} pixels
        </div>
        <div className="flex items-center justify-center gap-1 mt-1">
          <span className="text-[8px] text-slate-500 font-mono">
            rgb({currentColor.r},{currentColor.g},{currentColor.b})
          </span>
          <span
            className="w-2.5 h-2.5 rounded-sm border border-slate-600"
            style={{
              backgroundColor: `rgb(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`,
            }}
          />
        </div>
      </div>

      <div className="flex justify-between">
        {/* Left side: X0-X7 */}
        <div className="flex flex-col gap-1">
          <div className="text-[8px] text-teal-400 font-bold">X [0..7]</div>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={`x${i}`} className="relative h-3 flex items-center">
              <Handle
                type="target"
                position={Position.Left}
                id={`x${i}`}
                className="w-2 h-2 bg-teal-400 -ml-3"
              />
              <span className="text-[8px] text-slate-500 font-mono ml-1">
                X{i}
              </span>
            </div>
          ))}
          <div className="text-[8px] text-pink-400 font-bold mt-1">
            Y [0..7]
          </div>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={`y${i}`} className="relative h-3 flex items-center">
              <Handle
                type="target"
                position={Position.Left}
                id={`y${i}`}
                className="w-2 h-2 bg-pink-400 -ml-3"
              />
              <span className="text-[8px] text-slate-500 font-mono ml-1">
                Y{i}
              </span>
            </div>
          ))}
          <div className="relative h-3 flex items-center mt-2">
            <Handle
              type="target"
              position={Position.Left}
              id="draw"
              className="w-2 h-2 bg-cyan-400 -ml-3"
            />
            <span className="text-[8px] text-cyan-400 font-mono ml-1 font-bold">
              DRAW
            </span>
          </div>
          <div className="relative h-3 flex items-center">
            <Handle
              type="target"
              position={Position.Left}
              id="clr"
              className="w-2 h-2 bg-red-400 -ml-3"
            />
            <span className="text-[8px] text-red-400 font-mono ml-1 font-bold">
              CLR
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
