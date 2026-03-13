import { useCallback, useMemo, useRef, useEffect } from "react";
import { MNEMONIC_TO_OPCODE } from "../../cpu/isa";
import { EXAMPLES } from "../../cpu/examples";
import type { AssemblerError } from "../../cpu/assembler";

interface ASMEditorProps {
  code: string;
  onChange: (code: string) => void;
  errors: AssemblerError[];
  currentLine?: number; // 1-based line being executed (for step highlight)
  onSelectExample: (code: string) => void;
}

// All known mnemonics for highlighting
const ALL_MNEMONICS = new Set(Object.keys(MNEMONIC_TO_OPCODE));

/**
 * Syntax-highlight a single line of assembly.
 * Returns an array of JSX spans.
 */
function highlightLine(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = line;
  let key = 0;

  // Comment
  const commentIdx = remaining.indexOf(";");
  let comment = "";
  if (commentIdx >= 0) {
    comment = remaining.substring(commentIdx);
    remaining = remaining.substring(0, commentIdx);
  }

  // Label
  const labelMatch = remaining.match(/^([a-zA-Z_]\w*)\s*:/);
  if (labelMatch) {
    parts.push(
      <span key={key++} className="text-yellow-400 font-bold">
        {labelMatch[0]}
      </span>,
    );
    remaining = remaining.substring(labelMatch[0].length);
  }

  // Split remaining into tokens
  const tokens = remaining.split(/(\s+)/);
  let foundMnemonic = false;

  for (const token of tokens) {
    if (!token) continue;

    // Whitespace
    if (/^\s+$/.test(token)) {
      parts.push(<span key={key++}>{token}</span>);
      continue;
    }

    // Mnemonic
    if (!foundMnemonic && ALL_MNEMONICS.has(token.toUpperCase())) {
      foundMnemonic = true;
      parts.push(
        <span key={key++} className="text-cyan-400 font-bold">
          {token}
        </span>,
      );
      continue;
    }

    // Directive
    if (token.toLowerCase().startsWith(".db")) {
      parts.push(
        <span key={key++} className="text-pink-400 font-bold">
          {token}
        </span>,
      );
      continue;
    }

    // Number (hex, binary, decimal)
    if (
      /^0x[0-9a-fA-F]+$/.test(token) ||
      /^0b[01]+$/.test(token) ||
      /^-?\d+$/.test(token)
    ) {
      parts.push(
        <span key={key++} className="text-green-400">
          {token}
        </span>,
      );
      continue;
    }

    // Char literal
    if (/^'.'$/.test(token)) {
      parts.push(
        <span key={key++} className="text-amber-300">
          {token}
        </span>,
      );
      continue;
    }

    // Label reference (after mnemonic)
    if (foundMnemonic && /^[a-zA-Z_]\w*$/.test(token)) {
      parts.push(
        <span key={key++} className="text-yellow-300">
          {token}
        </span>,
      );
      continue;
    }

    // Default
    parts.push(
      <span key={key++} className="text-slate-300">
        {token}
      </span>,
    );
  }

  // Append comment
  if (comment) {
    parts.push(
      <span key={key++} className="text-slate-500 italic">
        {comment}
      </span>,
    );
  }

  return parts;
}

export function ASMEditor({
  code,
  onChange,
  errors,
  currentLine,
  onSelectExample,
}: ASMEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => code.split("\n"), [code]);
  const errorLineSet = useMemo(
    () => new Set(errors.map((e) => e.line)),
    [errors],
  );
  const errorMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const e of errors) {
      map.set(e.line, e.message);
    }
    return map;
  }, [errors]);

  // Sync scroll between textarea and highlight overlay
  const syncScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current && lineNumbersRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  // Keep highlight scroll in sync
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.addEventListener("scroll", syncScroll);
    return () => textarea.removeEventListener("scroll", syncScroll);
  }, [syncScroll]);

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-700 rounded-md overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border-b border-slate-700">
        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mr-2">
          Éditeur ASM
        </span>
        <select
          className="bg-slate-700 text-slate-300 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500"
          onChange={(e) => {
            const idx = parseInt(e.target.value);
            if (!isNaN(idx) && EXAMPLES[idx]) {
              onSelectExample(EXAMPLES[idx].code);
            }
          }}
          defaultValue=""
        >
          <option value="" disabled>
            Charger un exemple...
          </option>
          {EXAMPLES.map((ex, i) => (
            <option key={i} value={i}>
              {ex.name} — {ex.description}
            </option>
          ))}
        </select>
      </div>

      {/* Editor area */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* Line numbers */}
        <div
          ref={lineNumbersRef}
          className="w-10 shrink-0 bg-slate-850 border-r border-slate-800 overflow-hidden select-none"
          style={{ backgroundColor: "#1a1f2e" }}
        >
          <div className="pt-2 px-1">
            {lines.map((_, i) => {
              const lineNum = i + 1;
              const isCurrentLine = currentLine === lineNum;
              const isError = errorLineSet.has(lineNum);
              return (
                <div
                  key={i}
                  className={`text-right font-mono text-[11px] leading-5 pr-1 ${
                    isCurrentLine
                      ? "text-green-400 font-bold"
                      : isError
                        ? "text-red-400"
                        : "text-slate-600"
                  }`}
                >
                  {lineNum}
                </div>
              );
            })}
          </div>
        </div>

        {/* Highlight overlay + textarea stack */}
        <div className="flex-1 relative">
          {/* Syntax highlight overlay (behind textarea) */}
          <div
            ref={highlightRef}
            className="absolute inset-0 overflow-hidden pointer-events-none p-2"
            aria-hidden="true"
          >
            <pre className="font-mono text-[12px] leading-5 whitespace-pre">
              {lines.map((line, i) => {
                const lineNum = i + 1;
                const isCurrentLine = currentLine === lineNum;
                const isError = errorLineSet.has(lineNum);
                return (
                  <div
                    key={i}
                    className={`${
                      isCurrentLine
                        ? "bg-green-500/10 border-l-2 border-green-400 -ml-2 pl-[6px]"
                        : isError
                          ? "bg-red-500/10 border-l-2 border-red-400 -ml-2 pl-[6px]"
                          : ""
                    }`}
                    title={errorMap.get(lineNum) || undefined}
                  >
                    {highlightLine(line)}
                  </div>
                );
              })}
            </pre>
          </div>

          {/* Actual textarea (transparent text, captures input) */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full p-2 font-mono text-[12px] leading-5 bg-transparent text-transparent caret-white resize-none outline-none selection:bg-blue-500/30"
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>
      </div>

      {/* Error summary */}
      {errors.length > 0 && (
        <div className="px-3 py-1.5 bg-red-500/10 border-t border-red-500/30 max-h-20 overflow-y-auto">
          {errors.map((err, i) => (
            <div key={i} className="text-[11px] text-red-400 font-mono">
              <span className="text-red-500 font-bold">L{err.line}:</span>{" "}
              {err.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
