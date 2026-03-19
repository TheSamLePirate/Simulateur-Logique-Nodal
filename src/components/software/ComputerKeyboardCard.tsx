import { Keyboard, MoveHorizontal, MoveVertical } from "lucide-react";
import { memo, useMemo, useState } from "react";

import { byteToAscii, formatAsciiPreview } from "./computerPanelUtils";

interface ComputerKeyboardCardProps {
  keyState: number[];
  inputBuffer: number[];
  isRunning: boolean;
  onKeyDown: (key: string) => void;
  onKeyUp: (key: string) => void;
}

interface KeyboardKeyDef {
  label: string;
  keyValue: string;
  width?: string;
  accent?: string;
}

const KEYBOARD_ROWS: KeyboardKeyDef[][] = [
  [
    { label: "Esc", keyValue: "Escape", accent: "text-rose-300" },
    { label: "1", keyValue: "1" },
    { label: "2", keyValue: "2" },
    { label: "3", keyValue: "3" },
    { label: "4", keyValue: "4" },
    { label: "5", keyValue: "5" },
    { label: "6", keyValue: "6" },
    { label: "7", keyValue: "7" },
    { label: "8", keyValue: "8" },
    { label: "9", keyValue: "9" },
    { label: "0", keyValue: "0" },
    { label: "-", keyValue: "-" },
    { label: "=", keyValue: "=" },
    { label: "Backspace", keyValue: "Backspace", width: "col-span-2" },
  ],
  [
    { label: "Tab", keyValue: "Tab", width: "col-span-2" },
    { label: "Q", keyValue: "q" },
    { label: "W", keyValue: "w" },
    { label: "E", keyValue: "e" },
    { label: "R", keyValue: "r" },
    { label: "T", keyValue: "t" },
    { label: "Y", keyValue: "y" },
    { label: "U", keyValue: "u" },
    { label: "I", keyValue: "i" },
    { label: "O", keyValue: "o" },
    { label: "P", keyValue: "p" },
    { label: "[", keyValue: "[" },
    { label: "]", keyValue: "]" },
    { label: "\\", keyValue: "\\" },
  ],
  [
    { label: "A", keyValue: "a", width: "col-span-2" },
    { label: "S", keyValue: "s" },
    { label: "D", keyValue: "d" },
    { label: "F", keyValue: "f" },
    { label: "G", keyValue: "g" },
    { label: "H", keyValue: "h" },
    { label: "J", keyValue: "j" },
    { label: "K", keyValue: "k" },
    { label: "L", keyValue: "l" },
    { label: ";", keyValue: ";" },
    { label: "'", keyValue: "'" },
    { label: "Enter", keyValue: "Enter", width: "col-span-3", accent: "text-emerald-300" },
  ],
  [
    { label: "Z", keyValue: "z", width: "col-span-2" },
    { label: "X", keyValue: "x" },
    { label: "C", keyValue: "c" },
    { label: "V", keyValue: "v" },
    { label: "B", keyValue: "b" },
    { label: "N", keyValue: "n" },
    { label: "M", keyValue: "m" },
    { label: ",", keyValue: "," },
    { label: ".", keyValue: "." },
    { label: "/", keyValue: "/" },
    { label: "Space", keyValue: " ", width: "col-span-4", accent: "text-cyan-300" },
  ],
];

const LIVE_KEYS = [
  { label: "Left", value: 0 },
  { label: "Right", value: 1 },
  { label: "Up", value: 2 },
  { label: "Down", value: 3 },
  { label: "Enter", value: 4 },
];

function pressAndRelease(
  keyValue: string,
  onKeyDown: (key: string) => void,
  onKeyUp: (key: string) => void,
) {
  onKeyDown(keyValue);
  window.setTimeout(() => onKeyUp(keyValue), 0);
}

function KeyButton({
  definition,
  onKeyDown,
  onKeyUp,
}: {
  definition: KeyboardKeyDef;
  onKeyDown: (key: string) => void;
  onKeyUp: (key: string) => void;
}) {
  return (
    <button
      type="button"
      className={`rounded-xl border border-slate-700 bg-slate-900/90 px-2 py-2 text-center text-xs font-semibold text-slate-200 transition hover:border-cyan-500/40 hover:bg-slate-800 active:translate-y-[1px] ${definition.width ?? ""} ${definition.accent ?? ""}`}
      onPointerDown={(event) => {
        event.preventDefault();
        onKeyDown(definition.keyValue);
      }}
      onPointerUp={(event) => {
        event.preventDefault();
        onKeyUp(definition.keyValue);
      }}
      onPointerCancel={() => onKeyUp(definition.keyValue)}
      onPointerLeave={() => onKeyUp(definition.keyValue)}
      onDoubleClick={() => pressAndRelease(definition.keyValue, onKeyDown, onKeyUp)}
    >
      {definition.label}
    </button>
  );
}

function ComputerKeyboardCardInner({
  keyState,
  inputBuffer,
  isRunning,
  onKeyDown,
  onKeyUp,
}: ComputerKeyboardCardProps) {
  const [expanded, setExpanded] = useState(false);
  const bufferPreview = useMemo(
    () => formatAsciiPreview(inputBuffer.slice(-48), 48),
    [inputBuffer],
  );

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-200">
          <Keyboard size={16} className="text-amber-300" />
          <h3 className="text-sm font-semibold">Immediate Keyboard</h3>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:border-cyan-500/40 hover:text-cyan-200"
        >
          {expanded ? "Collapse" : "Expand keyboard"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="grid gap-3">
          <div
            tabIndex={0}
            className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 outline-none transition focus:border-cyan-500/40 focus:bg-slate-900"
            onKeyDown={(event) => {
              onKeyDown(event.key);
              event.preventDefault();
            }}
            onKeyUp={(event) => {
              onKeyUp(event.key);
              event.preventDefault();
            }}
          >
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Capture surface</div>
            <p className="mt-2 text-sm text-slate-300">
              Click here, then type on your physical keyboard for immediate input.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {isRunning
                ? "Global host keyboard capture is active while the CPU runs."
                : "This focused area still lets you feed keys even while paused."}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
              <MoveHorizontal size={12} className="text-cyan-300" />
              Live key lines
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {LIVE_KEYS.map((item) => (
                <span
                  key={item.label}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                    keyState[item.value]
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-slate-700 bg-slate-950 text-slate-500"
                  }`}
                >
                  {item.label}: {keyState[item.value] ? "1" : "0"}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
              <MoveVertical size={12} className="text-amber-300" />
              Input queue
            </div>
            <div className="mt-2 text-sm text-slate-300">{inputBuffer.length} byte(s)</div>
            <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-950/70 p-3 font-mono text-xs text-slate-400">
              {bufferPreview || "(empty)"}
            </pre>
            {inputBuffer.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {inputBuffer.slice(-8).map((value, index) => (
                  <span
                    key={`${value}-${index}`}
                    className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-[11px] text-slate-300"
                  >
                    {byteToAscii(value)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {expanded && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
            <div className="mb-3 text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Clickable keyboard
            </div>
            <div className="grid gap-2">
              {KEYBOARD_ROWS.map((row, rowIndex) => (
                <div
                  key={rowIndex}
                  className="grid gap-2"
                  style={{ gridTemplateColumns: "repeat(15, minmax(0, 1fr))" }}
                >
                  {row.map((definition) => (
                    <KeyButton
                      key={`${definition.label}-${definition.keyValue}`}
                      definition={definition}
                      onKeyDown={onKeyDown}
                      onKeyUp={onKeyUp}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export const ComputerKeyboardCard = memo(
  ComputerKeyboardCardInner,
  (prev, next) =>
    prev.keyState === next.keyState &&
    prev.inputBuffer === next.inputBuffer &&
    prev.isRunning === next.isRunning &&
    prev.onKeyDown === next.onKeyDown &&
    prev.onKeyUp === next.onKeyUp,
);
