import { useState, useEffect, useRef } from "react";
import { Trash2, Terminal } from "lucide-react";

interface ConsolePanelProps {
  output: string[];
  onClear: () => void;
  onInput?: (text: string) => void;
}

export function ConsolePanel({ output, onClear, onInput }: ConsolePanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = useState("");
  const displayText = output.join("");
  const lastAutoScrolledTextRef = useRef(displayText);

  // Only force the scroll position when the console text itself changes.
  useEffect(() => {
    if (scrollRef.current && lastAutoScrolledTextRef.current !== displayText) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      lastAutoScrolledTextRef.current = displayText;
    }
  }, [displayText]);

  const handleInputSubmit = () => {
    if (inputText && onInput) {
      onInput(inputText);
      setInputText("");
    }
  };

  return (
    <div className="flex h-[300px] min-h-[300px] flex-col overflow-hidden rounded-md border border-slate-700 bg-slate-900">
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
        className="min-h-0 flex-1 overflow-y-auto bg-black p-3 font-mono text-sm leading-relaxed text-green-400 whitespace-pre-wrap break-all"
      >
        {displayText || (
          <span className="text-slate-600 italic">En attente de sortie...</span>
        )}
        <span className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-0.5 align-text-bottom" />
      </div>

      {/* Input field */}
      {onInput && (
        <div className="flex items-center gap-1 px-2 py-1.5 bg-slate-900 border-t border-slate-700">
          <span className="text-green-400 text-xs font-mono font-bold">
            &gt;
          </span>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleInputSubmit();
              }
            }}
            className="flex-1 bg-black text-green-400 text-sm font-mono px-2 py-1 border border-slate-700 rounded outline-none focus:border-green-500"
            placeholder="Saisie + Entrée..."
          />
        </div>
      )}
    </div>
  );
}
