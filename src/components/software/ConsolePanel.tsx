import { useEffect, useRef } from "react";
import { Trash2, Terminal } from "lucide-react";

interface ConsolePanelProps {
  output: string[];
  onClear: () => void;
}

export function ConsolePanel({ output, onClear }: ConsolePanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [output]);

  const displayText = output.join("");

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-700 rounded-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-green-400" />
          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
            Console
          </span>
        </div>
        <button
          onClick={onClear}
          className="text-slate-500 hover:text-red-400 transition-colors"
          title="Effacer la console"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Terminal output */}
      <div
        ref={scrollRef}
        className="flex-1 p-3 font-mono text-sm leading-relaxed text-green-400 bg-black overflow-y-auto whitespace-pre-wrap break-all min-h-[80px]"
      >
        {displayText || (
          <span className="text-slate-600 italic">En attente de sortie...</span>
        )}
        <span className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-0.5 align-text-bottom" />
      </div>
    </div>
  );
}
