import { useCallback, useMemo, useRef, useEffect } from "react";
import { MNEMONIC_TO_OPCODE } from "../../cpu/isa";
import { EXAMPLES } from "../../cpu/examples";
import { C_EXAMPLES } from "../../cpu/cexamples";

export type EditorLanguage = "asm" | "c";

interface EditorError {
  line: number;
  message: string;
}

interface ASMEditorProps {
  code: string;
  onChange: (code: string) => void;
  errors: EditorError[];
  currentLine?: number; // 1-based line being executed (for step highlight)
  onSelectExample: (code: string) => void;
  language: EditorLanguage;
}

// ─── ASM Highlighting ───

const ALL_MNEMONICS = new Set(Object.keys(MNEMONIC_TO_OPCODE));

function highlightASMLine(line: string): React.ReactNode[] {
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

    if (/^\s+$/.test(token)) {
      parts.push(<span key={key++}>{token}</span>);
      continue;
    }

    if (!foundMnemonic && ALL_MNEMONICS.has(token.toUpperCase())) {
      foundMnemonic = true;
      parts.push(
        <span key={key++} className="text-cyan-400 font-bold">
          {token}
        </span>,
      );
      continue;
    }

    if (token.toLowerCase().startsWith(".db")) {
      parts.push(
        <span key={key++} className="text-pink-400 font-bold">
          {token}
        </span>,
      );
      continue;
    }

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

    if (/^'.'$/.test(token)) {
      parts.push(
        <span key={key++} className="text-amber-300">
          {token}
        </span>,
      );
      continue;
    }

    if (foundMnemonic && /^[a-zA-Z_]\w*$/.test(token)) {
      parts.push(
        <span key={key++} className="text-yellow-300">
          {token}
        </span>,
      );
      continue;
    }

    parts.push(
      <span key={key++} className="text-slate-300">
        {token}
      </span>,
    );
  }

  if (comment) {
    parts.push(
      <span key={key++} className="text-slate-500 italic">
        {comment}
      </span>,
    );
  }

  return parts;
}

// ─── C Highlighting ───

const C_KEYWORDS = new Set([
  "int",
  "void",
  "if",
  "else",
  "while",
  "for",
  "return",
]);
const C_BUILTINS = new Set([
  "putchar",
  "print_num",
  "print",
  "draw",
  "clear",
  "getchar",
  "getchar_nb",
  "getKey",
  "rand",
  "sleep",
  "drive_read",
  "drive_write",
  "drive_clear",
  "drive_set_page",
  "drive_read_at",
  "drive_write_at",
]);

function highlightCLine(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let key = 0;

  // Tokenize using regex that captures different token types
  // Order matters: strings, comments, numbers, identifiers, operators, whitespace
  const regex =
    /(\/\/.*$|\/\*[\s\S]*?\*\/|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|#\w+|0x[0-9a-fA-F]+|\d+|[a-zA-Z_]\w*|[+\-*/%=!<>&|^~]+|[{}();,[\]]|\s+)/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    const token = match[0];

    // Whitespace
    if (/^\s+$/.test(token)) {
      parts.push(<span key={key++}>{token}</span>);
      continue;
    }

    // Line comment
    if (token.startsWith("//")) {
      parts.push(
        <span key={key++} className="text-slate-500 italic">
          {token}
        </span>,
      );
      continue;
    }

    // Block comment
    if (token.startsWith("/*")) {
      parts.push(
        <span key={key++} className="text-slate-500 italic">
          {token}
        </span>,
      );
      continue;
    }

    // Preprocessor directive
    if (token.startsWith("#")) {
      parts.push(
        <span key={key++} className="text-pink-400 font-bold">
          {token}
        </span>,
      );
      continue;
    }

    // String literal
    if (token.startsWith('"')) {
      parts.push(
        <span key={key++} className="text-amber-300">
          {token}
        </span>,
      );
      continue;
    }

    // Char literal
    if (token.startsWith("'")) {
      parts.push(
        <span key={key++} className="text-amber-300">
          {token}
        </span>,
      );
      continue;
    }

    // Number
    if (/^(0x[0-9a-fA-F]+|\d+)$/.test(token)) {
      parts.push(
        <span key={key++} className="text-green-400">
          {token}
        </span>,
      );
      continue;
    }

    // Keyword
    if (C_KEYWORDS.has(token)) {
      parts.push(
        <span key={key++} className="text-purple-400 font-bold">
          {token}
        </span>,
      );
      continue;
    }

    // Built-in function
    if (C_BUILTINS.has(token)) {
      parts.push(
        <span key={key++} className="text-cyan-400 font-bold">
          {token}
        </span>,
      );
      continue;
    }

    // Identifier
    if (/^[a-zA-Z_]\w*$/.test(token)) {
      parts.push(
        <span key={key++} className="text-slate-200">
          {token}
        </span>,
      );
      continue;
    }

    // Operators and punctuation
    if (/^[+\-*/%=!<>&|^~]+$/.test(token)) {
      parts.push(
        <span key={key++} className="text-sky-300">
          {token}
        </span>,
      );
      continue;
    }

    // Braces, parens, etc.
    if (/^[{}();,[\]]$/.test(token)) {
      parts.push(
        <span key={key++} className="text-slate-400">
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

  return parts;
}

// ─── Main component ───

export function ASMEditor({
  code,
  onChange,
  errors,
  currentLine,
  onSelectExample,
  language,
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

  const highlightLine = language === "c" ? highlightCLine : highlightASMLine;

  const examples = language === "c" ? C_EXAMPLES : EXAMPLES;

  // Sync scroll between textarea and highlight overlay
  const syncScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current && lineNumbersRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

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
          {language === "c" ? "Éditeur C" : "Éditeur ASM"}
        </span>
        <select
          className="bg-slate-700 text-slate-300 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500"
          onChange={(e) => {
            const idx = parseInt(e.target.value);
            if (!isNaN(idx) && examples[idx]) {
              onSelectExample(examples[idx].code);
            }
          }}
          defaultValue=""
          key={language} // reset dropdown on language change
        >
          <option value="" disabled>
            Charger un exemple...
          </option>
          {examples.map((ex, i) => (
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
            <pre className="font-mono text-[12px] leading-5 whitespace-pre m-0 p-0">
              {lines.map((line, i) => {
                const lineNum = i + 1;
                const isCurrentLine = currentLine === lineNum;
                const isError = errorLineSet.has(lineNum);
                const highlighted = highlightLine(line);
                return (
                  <div
                    key={i}
                    className={`h-5 ${
                      isCurrentLine
                        ? "bg-green-500/10 border-l-2 border-green-400 -ml-2 pl-[6px]"
                        : isError
                          ? "bg-red-500/10 border-l-2 border-red-400 -ml-2 pl-[6px]"
                          : ""
                    }`}
                    title={errorMap.get(lineNum) || undefined}
                  >
                    {highlighted.length > 0 ? highlighted : "\u00A0"}
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
            wrap="off"
            className="absolute inset-0 w-full h-full p-2 font-mono text-[12px] leading-5 bg-transparent text-transparent caret-white resize-none outline-none border-0 whitespace-pre overflow-auto selection:bg-blue-500/30"
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
