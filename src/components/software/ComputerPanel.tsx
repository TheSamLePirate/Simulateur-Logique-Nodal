import { memo, type ReactNode } from "react";
import { Maximize2, Minimize2, Monitor } from "lucide-react";
import { useEffect, useState } from "react";

import { ConsolePanel } from "./ConsolePanel";
import { PlotterPanel } from "./PlotterPanel";
import { ComputerArchitectureFlow } from "./ComputerArchitectureFlow";
import { ComputerFilesystemCard } from "./ComputerFilesystemCard";
import { ComputerKeyboardCard } from "./ComputerKeyboardCard";
import { ComputerMemoryCard } from "./ComputerMemoryCard";
import { ComputerNetworkCard } from "./ComputerNetworkCard";
import { ComputerStatusCard } from "./ComputerStatusCard";
import type { ComputerPanelData } from "./computerPanelTypes";

const MemoConsolePanel = memo(ConsolePanel);
const MemoPlotterPanel = memo(PlotterPanel);

interface ComputerPanelProps {
  data: ComputerPanelData;
  onClearConsole: () => void;
  onConsoleInput: (text: string) => void;
  onClearPlotter: () => void;
  onKeyDown: (key: string) => void;
  onKeyUp: (key: string) => void;
}

function ComputerPanelFrame({
  children,
  fullscreen,
  onToggleFullscreen,
}: {
  children: ReactNode;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),_transparent_28%),linear-gradient(180deg,_rgba(15,23,42,0.96),_rgba(2,6,23,1))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/70 px-4 py-3">
        <div>
          <div className="flex items-center gap-2 text-slate-100">
            <Monitor size={16} className="text-cyan-300" />
            <h2 className="text-sm font-semibold">Computer Overview</h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Unified live representation of the software computer and its peripherals.
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleFullscreen}
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-300 transition hover:border-cyan-500/40 hover:text-cyan-200"
          title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
    </div>
  );
}

function ComputerPanelInner({
  data,
  onClearConsole,
  onConsoleInput,
  onClearPlotter,
  onKeyDown,
  onKeyUp,
}: ComputerPanelProps) {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [fullscreen]);

  const content = (
    <div className="grid gap-4">
      <ComputerArchitectureFlow data={data} />

      <div className="grid gap-4 2xl:grid-cols-[1.08fr_0.92fr]">
        <div className="grid gap-4">
          <ComputerStatusCard data={data} />
          <ComputerMemoryCard data={data} />
          <ComputerFilesystemCard data={data} />
          <ComputerNetworkCard data={data} />
        </div>

        <div className="grid gap-4">
          <div className="aspect-square w-full overflow-hidden">
            <MemoPlotterPanel
              pixels={data.plotterPixels}
              currentColor={data.plotterColor}
              onClear={onClearPlotter}
            />
          </div>
          <div className="overflow-hidden">
            <MemoConsolePanel
              output={data.consoleOutput}
              onClear={onClearConsole}
              onInput={onConsoleInput}
            />
          </div>
          <ComputerKeyboardCard
            keyState={data.keyState}
            inputBuffer={data.consoleInputBuffer}
            isRunning={data.isRunning}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
          />
        </div>
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <>
        <div className="flex h-full items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/70 text-xs text-slate-500">
          Fullscreen panel active
        </div>
        <div className="fixed inset-0 z-50 bg-slate-950 p-4">
          <ComputerPanelFrame
            fullscreen
            onToggleFullscreen={() => setFullscreen(false)}
          >
            {content}
          </ComputerPanelFrame>
        </div>
      </>
    );
  }

  return (
    <ComputerPanelFrame
      fullscreen={false}
      onToggleFullscreen={() => setFullscreen(true)}
    >
      {content}
    </ComputerPanelFrame>
  );
}

export const ComputerPanel = memo(
  ComputerPanelInner,
  (prev, next) =>
    prev.data === next.data &&
    prev.onClearConsole === next.onClearConsole &&
    prev.onConsoleInput === next.onConsoleInput &&
    prev.onClearPlotter === next.onClearPlotter &&
    prev.onKeyDown === next.onKeyDown &&
    prev.onKeyUp === next.onKeyUp,
);
