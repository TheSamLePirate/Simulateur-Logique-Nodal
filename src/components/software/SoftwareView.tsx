import { useState, useRef, useCallback, useEffect } from "react";
import { Play, Square, SkipForward, RotateCcw, Zap, Gauge } from "lucide-react";

import { CPU } from "../../cpu/cpu";
import { assemble, type AssemblerError } from "../../cpu/assembler";
import { EXAMPLES } from "../../cpu/examples";
import type { CPUState } from "../../cpu/isa";
import { createInitialState } from "../../cpu/isa";

import { ASMEditor } from "./ASMEditor";
import { CPUStatePanel } from "./CPUState";
import { MemoryView } from "./MemoryView";
import { ConsolePanel } from "./ConsolePanel";

export function SoftwareView() {
  // CPU instance (persists across renders)
  const cpuRef = useRef(new CPU());

  // Editor state
  const [code, setCode] = useState(EXAMPLES[0].code);
  const [errors, setErrors] = useState<AssemblerError[]>([]);
  const [assembled, setAssembled] = useState(false);

  // CPU state (snapshot for React rendering)
  const [cpuState, setCpuState] = useState<CPUState>(createInitialState());
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);

  // Source map for line highlighting
  const sourceMapRef = useRef<Map<number, number>>(new Map());

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [runSpeed, setRunSpeed] = useState(10); // instructions per 50ms tick
  const runIntervalRef = useRef<number | null>(null);

  // Memory write highlights
  const [memHighlights, setMemHighlights] = useState<Set<number>>(new Set());

  // Current source line being executed
  const currentLine = assembled
    ? sourceMapRef.current.get(cpuState.pc) || undefined
    : undefined;

  // ─── Assemble ───
  const handleAssemble = useCallback(() => {
    const result = assemble(code);
    setErrors(result.errors);

    if (result.success) {
      const cpu = cpuRef.current;
      cpu.reset();
      cpu.loadProgram(result.bytes);
      sourceMapRef.current = result.sourceMap;
      setCpuState(cpu.snapshot());
      setConsoleOutput([]);
      setAssembled(true);
      setIsRunning(false);
      setMemHighlights(new Set());
    } else {
      setAssembled(false);
    }
  }, [code]);

  // ─── Step ───
  const handleStep = useCallback(() => {
    if (!assembled) return;
    const cpu = cpuRef.current;
    const prevMem = new Uint8Array(cpu.state.memory);

    cpu.step();

    // Detect memory writes
    const writes = new Set<number>();
    for (let i = 0; i < 256; i++) {
      if (cpu.state.memory[i] !== prevMem[i]) writes.add(i);
    }
    if (writes.size > 0) {
      setMemHighlights((prev) => new Set([...prev, ...writes]));
      // Clear highlights after 1 second
      setTimeout(() => {
        setMemHighlights((prev) => {
          const next = new Set(prev);
          for (const addr of writes) next.delete(addr);
          return next;
        });
      }, 1000);
    }

    setCpuState(cpu.snapshot());
    setConsoleOutput([...cpu.consoleOutput]);

    if (cpu.state.halted) {
      setIsRunning(false);
    }
  }, [assembled]);

  // ─── Run / Stop ───
  const handleRun = useCallback(() => {
    if (!assembled || cpuRef.current.state.halted) return;
    setIsRunning(true);
  }, [assembled]);

  const handleStop = useCallback(() => {
    setIsRunning(false);
  }, []);

  // Run loop
  useEffect(() => {
    if (!isRunning) {
      if (runIntervalRef.current !== null) {
        clearInterval(runIntervalRef.current);
        runIntervalRef.current = null;
      }
      return;
    }

    runIntervalRef.current = window.setInterval(() => {
      const cpu = cpuRef.current;
      for (let i = 0; i < runSpeed; i++) {
        if (!cpu.step()) {
          setIsRunning(false);
          break;
        }
      }
      setCpuState(cpu.snapshot());
      setConsoleOutput([...cpu.consoleOutput]);
    }, 50);

    return () => {
      if (runIntervalRef.current !== null) {
        clearInterval(runIntervalRef.current);
        runIntervalRef.current = null;
      }
    };
  }, [isRunning, runSpeed]);

  // ─── Reset ───
  const handleReset = useCallback(() => {
    const cpu = cpuRef.current;
    cpu.reset();
    setCpuState(cpu.snapshot());
    setConsoleOutput([]);
    setAssembled(false);
    setIsRunning(false);
    setErrors([]);
    setMemHighlights(new Set());
  }, []);

  // ─── Console clear ───
  const handleClearConsole = useCallback(() => {
    cpuRef.current.consoleOutput = [];
    setConsoleOutput([]);
  }, []);

  // ─── Example select ───
  const handleSelectExample = useCallback((exCode: string) => {
    setCode(exCode);
    setAssembled(false);
    setErrors([]);
    setIsRunning(false);
    const cpu = cpuRef.current;
    cpu.reset();
    setCpuState(cpu.snapshot());
    setConsoleOutput([]);
    setMemHighlights(new Set());
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Control bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-b border-slate-800 shrink-0">
        <button
          onClick={handleAssemble}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold transition-colors bg-blue-500/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500/30"
        >
          <Zap size={14} /> Assembler
        </button>

        <div className="w-px h-6 bg-slate-700 mx-1" />

        <button
          onClick={handleStep}
          disabled={!assembled || isRunning || cpuState.halted}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold transition-colors bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <SkipForward size={14} /> Step
        </button>

        {isRunning ? (
          <button
            onClick={handleStop}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold transition-colors bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30"
          >
            <Square size={14} /> Stop
          </button>
        ) : (
          <button
            onClick={handleRun}
            disabled={!assembled || cpuState.halted}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold transition-colors bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Play size={14} /> Run
          </button>
        )}

        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold transition-colors bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
        >
          <RotateCcw size={14} /> Reset
        </button>

        <div className="w-px h-6 bg-slate-700 mx-1" />

        {/* Speed control */}
        <div className="flex items-center gap-2">
          <Gauge size={14} className="text-slate-500" />
          <input
            type="range"
            min={1}
            max={100}
            value={runSpeed}
            onChange={(e) => setRunSpeed(parseInt(e.target.value))}
            className="w-20 accent-blue-500"
          />
          <span className="text-[10px] text-slate-500 font-mono w-16">
            {runSpeed} instr/tick
          </span>
        </div>

        {/* Status indicator */}
        <div className="ml-auto flex items-center gap-2">
          {cpuState.halted && (
            <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/30">
              HALTED
            </span>
          )}
          {isRunning && (
            <span className="text-xs font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/30 animate-pulse">
              RUNNING
            </span>
          )}
          {assembled && !isRunning && !cpuState.halted && (
            <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/30">
              READY
            </span>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: Editor */}
        <div className="w-1/2 flex flex-col p-2 gap-2 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <ASMEditor
              code={code}
              onChange={setCode}
              errors={errors}
              currentLine={currentLine}
              onSelectExample={handleSelectExample}
            />
          </div>
        </div>

        {/* Right panel: CPU state + Memory + Console */}
        <div className="w-1/2 flex flex-col p-2 gap-2 overflow-hidden border-l border-slate-800">
          {/* CPU Registers */}
          <div className="shrink-0">
            <CPUStatePanel state={cpuState} />
          </div>

          {/* Memory + Console split */}
          <div className="flex-1 flex gap-2 overflow-hidden">
            {/* Memory */}
            <div className="w-1/2 overflow-hidden">
              <MemoryView
                memory={cpuState.memory}
                pc={cpuState.pc}
                highlights={memHighlights}
              />
            </div>

            {/* Console */}
            <div className="w-1/2 overflow-hidden">
              <ConsolePanel
                output={consoleOutput}
                onClear={handleClearConsole}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
