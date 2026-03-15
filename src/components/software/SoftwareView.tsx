import { useState, useRef, useCallback, useEffect } from "react";
import { Play, Square, SkipForward, RotateCcw, Zap, Gauge } from "lucide-react";

import { CPU } from "../../cpu/cpu";
import { assemble, type AssemblerError } from "../../cpu/assembler";
import {
  compile,
  type CompileError,
  type MemoryLayout,
} from "../../cpu/compiler";
import { EXAMPLES } from "../../cpu/examples";
import { C_EXAMPLES } from "../../cpu/cexamples";
import type { CPUState } from "../../cpu/isa";
import { createInitialState, MEMORY_SIZE, CODE_SIZE } from "../../cpu/isa";

import { ASMEditor, type EditorLanguage } from "./ASMEditor";
import { CPUStatePanel } from "./CPUState";
import { MemoryView } from "./MemoryView";
import { ConsolePanel } from "./ConsolePanel";
import { PlotterPanel } from "./PlotterPanel";

interface EditorError {
  line: number;
  message: string;
}

export interface HardwareSyncData {
  pc: number;
  a: number;
  b: number;
  sp: number;
  memory: Uint8Array;
  flags: { z: boolean; c: boolean; n: boolean };
  consoleText: string;
  plotterPixels: number[];
  halted: boolean;
}

interface SoftwareViewProps {
  onHardwareSync?: (data: HardwareSyncData) => void;
  onProgramLoaded?: (bytes: number[]) => void;
}

export function SoftwareView({
  onHardwareSync,
  onProgramLoaded,
}: SoftwareViewProps) {
  // CPU instance (persists across renders)
  const cpuRef = useRef(new CPU());

  // Language mode
  const [language, setLanguage] = useState<EditorLanguage>("asm");

  // Separate code buffers per language
  const [asmCode, setAsmCode] = useState(EXAMPLES[0].code);
  const [cCode, setCCode] = useState(C_EXAMPLES[0].code);

  // Errors (for whichever tab is active)
  const [errors, setErrors] = useState<EditorError[]>([]);
  const [assembled, setAssembled] = useState(false);
  const [codeSize, setCodeSize] = useState(0);
  const [memLayout, setMemLayout] = useState<MemoryLayout | null>(null);

  // CPU state (snapshot for React rendering)
  const [cpuState, setCpuState] = useState<CPUState>(createInitialState());
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [plotterPixels, setPlotterPixels] = useState<Set<number>>(new Set());

  // Source map for line highlighting (ASM line → PC mapping)
  const sourceMapRef = useRef<Map<number, number>>(new Map());

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [runSpeed, setRunSpeed] = useState(10);
  const runIntervalRef = useRef<number | null>(null);

  // Memory write highlights
  const [memHighlights, setMemHighlights] = useState<Set<number>>(new Set());

  // Derived: active code based on language
  const code = language === "c" ? cCode : asmCode;
  const setCode = language === "c" ? setCCode : setAsmCode;

  // Current source line being executed (only for ASM tab)
  const currentLine =
    assembled && language === "asm"
      ? sourceMapRef.current.get(cpuState.pc) || undefined
      : undefined;

  // ─── Language toggle ───
  const handleLanguageChange = useCallback(
    (lang: EditorLanguage) => {
      if (lang === language) return;
      setLanguage(lang);
      // Don't reset assembled state — keep CPU loaded so you can switch
      // between tabs and still step/run
      setErrors([]);
    },
    [language],
  );

  // ─── Assemble / Compile ───
  const handleAssemble = useCallback(() => {
    if (language === "c") {
      // C mode: compile → ASM → assemble
      const compileResult = compile(cCode);

      if (!compileResult.success) {
        setErrors(
          compileResult.errors.map((e: CompileError) => ({
            line: e.line,
            message: `[${e.phase}] ${e.message}`,
          })),
        );
        setAssembled(false);
        setMemLayout(compileResult.memoryLayout || null);
        // Still show partial ASM if available
        if (compileResult.assembly) {
          setAsmCode(compileResult.assembly);
        }
        return;
      }

      // Put generated ASM into the ASM tab
      setAsmCode(compileResult.assembly);

      // Assemble the generated ASM
      const asmResult = assemble(compileResult.assembly);
      if (!asmResult.success) {
        setErrors(
          asmResult.errors.map((e: AssemblerError) => ({
            line: e.line,
            message: `[asm] ${e.message}`,
          })),
        );
        setAssembled(false);
        setMemLayout(compileResult.memoryLayout || null);
        return;
      }

      const cpu = cpuRef.current;
      cpu.reset();
      cpu.loadProgram(asmResult.bytes);
      sourceMapRef.current = asmResult.sourceMap;
      setCpuState(cpu.snapshot());
      setConsoleOutput([]);
      setAssembled(true);
      setIsRunning(false);
      setErrors([]);
      setCodeSize(asmResult.bytes.length);
      setMemLayout(compileResult.memoryLayout || null);
      setMemHighlights(new Set());
      onProgramLoaded?.(asmResult.bytes);
    } else {
      // ASM mode: direct assemble
      const result = assemble(asmCode);
      setErrors(
        result.errors.map((e: AssemblerError) => ({
          line: e.line,
          message: e.message,
        })),
      );

      if (result.success) {
        const cpu = cpuRef.current;
        cpu.reset();
        cpu.loadProgram(result.bytes);
        sourceMapRef.current = result.sourceMap;
        setCpuState(cpu.snapshot());
        setConsoleOutput([]);
        setAssembled(true);
        setIsRunning(false);
        setCodeSize(result.bytes.length);
        setMemLayout(null);
        setMemHighlights(new Set());
        onProgramLoaded?.(result.bytes);
      } else {
        setAssembled(false);
        setCodeSize(result.bytes.length);
        setMemLayout(null);
      }
    }
  }, [cCode, asmCode, language, onProgramLoaded]);

  // ─── Step ───
  const handleStep = useCallback(() => {
    if (!assembled) return;
    const cpu = cpuRef.current;
    const prevMem = new Uint8Array(cpu.state.memory);

    cpu.step();

    // Detect memory writes
    const writes = new Set<number>();
    for (let i = 0; i < MEMORY_SIZE; i++) {
      if (cpu.state.memory[i] !== prevMem[i]) writes.add(i);
    }
    if (writes.size > 0) {
      setMemHighlights((prev) => new Set([...prev, ...writes]));
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
    setPlotterPixels(new Set(cpu.plotterPixels));

    onHardwareSync?.({
      pc: cpu.state.pc,
      a: cpu.state.a,
      b: cpu.state.b,
      sp: cpu.state.sp,
      memory: new Uint8Array(cpu.state.memory),
      flags: { ...cpu.state.flags },
      consoleText: cpu.consoleOutput.join(""),
      plotterPixels: Array.from(cpu.plotterPixels),
      halted: cpu.state.halted,
    });

    if (cpu.state.halted) {
      setIsRunning(false);
    }
  }, [assembled, onHardwareSync]);

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
      setPlotterPixels(new Set(cpu.plotterPixels));

      onHardwareSync?.({
        pc: cpu.state.pc,
        a: cpu.state.a,
        b: cpu.state.b,
        sp: cpu.state.sp,
        memory: new Uint8Array(cpu.state.memory),
        flags: { ...cpu.state.flags },
        consoleText: cpu.consoleOutput.join(""),
        plotterPixels: Array.from(cpu.plotterPixels),
      });
    }, 50);

    return () => {
      if (runIntervalRef.current !== null) {
        clearInterval(runIntervalRef.current);
        runIntervalRef.current = null;
      }
    };
  }, [isRunning, runSpeed, onHardwareSync]);

  // ─── Reset ───
  const handleReset = useCallback(() => {
    const cpu = cpuRef.current;
    cpu.reset();
    setCpuState(cpu.snapshot());
    setConsoleOutput([]);
    setPlotterPixels(new Set());
    setAssembled(false);
    setIsRunning(false);
    setErrors([]);
    setCodeSize(0);
    setMemLayout(null);
    setMemHighlights(new Set());
  }, []);

  // ─── Console clear ───
  const handleClearConsole = useCallback(() => {
    cpuRef.current.consoleOutput = [];
    setConsoleOutput([]);
  }, []);

  // ─── Keyboard input (arrow keys + Enter) — only while CPU is running ───
  useEffect(() => {
    if (!isRunning) return;

    const cpu = cpuRef.current;
    const keyMap: Record<string, number> = {
      ArrowLeft: 0,
      ArrowRight: 1,
      ArrowUp: 2,
      ArrowDown: 3,
      Enter: 4,
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const index = keyMap[e.key];
      if (index !== undefined) {
        e.preventDefault();
        cpu.keyState[index] = 1;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const index = keyMap[e.key];
      if (index !== undefined) {
        cpu.keyState[index] = 0;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      // Reset key state when stopping
      cpu.keyState = [0, 0, 0, 0, 0];
    };
  }, [isRunning]);

  // ─── Console input ───
  const handleConsoleInput = useCallback((text: string) => {
    const cpu = cpuRef.current;
    for (let i = 0; i < text.length; i++) {
      cpu.pushInput(text.charCodeAt(i));
    }
    cpu.pushInput(10); // newline
  }, []);

  // ─── Plotter clear ───
  const handleClearPlotter = useCallback(() => {
    cpuRef.current.plotterPixels = new Set();
    setPlotterPixels(new Set());
  }, []);

  // ─── Example select ───
  const handleSelectExample = useCallback(
    (exCode: string) => {
      setCode(exCode);
      setAssembled(false);
      setErrors([]);
      setIsRunning(false);
      const cpu = cpuRef.current;
      cpu.reset();
      setCpuState(cpu.snapshot());
      setConsoleOutput([]);
      setPlotterPixels(new Set());
      setMemHighlights(new Set());
    },
    [setCode],
  );

  // Memory layout metrics
  // Architecture: Code 1024B (50%) | Data 512B (25%) | Stack 512B (25%)
  // Data area = globals(16) + scratch(8) + locals(488) = 512B
  const dataUsed = memLayout
    ? memLayout.globals + memLayout.scratch + memLayout.locals
    : 0;
  const dataMax = 512; // 0x400-0x5FF
  const dataFree = memLayout ? dataMax - dataUsed : 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Control bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-b border-slate-800 shrink-0">
        {/* Language toggle */}
        <div className="flex rounded-md overflow-hidden border border-slate-700">
          <button
            onClick={() => handleLanguageChange("asm")}
            className={`px-3 py-1 text-xs font-bold transition-colors ${
              language === "asm"
                ? "bg-blue-500/30 text-blue-300 border-r border-blue-500/50"
                : "bg-slate-800 text-slate-500 border-r border-slate-700 hover:bg-slate-700"
            }`}
          >
            ASM
          </button>
          <button
            onClick={() => handleLanguageChange("c")}
            className={`px-3 py-1 text-xs font-bold transition-colors ${
              language === "c"
                ? "bg-purple-500/30 text-purple-300"
                : "bg-slate-800 text-slate-500 hover:bg-slate-700"
            }`}
          >
            C
          </button>
        </div>

        <div className="w-px h-6 bg-slate-700 mx-1" />

        <button
          onClick={handleAssemble}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold transition-colors border ${
            language === "c"
              ? "bg-purple-500/20 text-purple-400 border-purple-500/50 hover:bg-purple-500/30"
              : "bg-blue-500/20 text-blue-400 border-blue-500/50 hover:bg-blue-500/30"
          }`}
        >
          <Zap size={14} /> {language === "c" ? "Compiler" : "Assembler"}
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
            max={100000}
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
          {codeSize > 0 && (
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                  codeSize > CODE_SIZE
                    ? "text-red-400 bg-red-500/10 border-red-500/30"
                    : codeSize > CODE_SIZE * 0.8
                      ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30"
                      : "text-slate-400 bg-slate-800 border-slate-700"
                }`}
              >
                Code {codeSize}/{CODE_SIZE}
              </span>
              {memLayout && (
                <>
                  <span className="text-[10px] font-mono text-slate-500">
                    Data {dataUsed}/{dataMax}
                  </span>
                  {/* Memory bar: fixed regions (50% code, 25% data, 25% stack) */}
                  <div
                    className="flex h-3 w-28 rounded-sm overflow-hidden border border-slate-700"
                    title={`── Code (0x000-0x3FF) ──\nProgramme: ${codeSize}/${CODE_SIZE}B\n\n── Data (0x400-0x5FF) ──\nGlobales: ${memLayout.globals}/16B\nScratch: ${memLayout.scratch}/8B (fixe)\nLocales: ${memLayout.locals}/488B\nLibre: ${dataFree}B\n\n── Stack (0x600-0x7FF) ──\nRéservé: ${memLayout.stackSize}B (fixe)`}
                  >
                    {/* Code region: 1024/2048 = 50% */}
                    <div
                      className="relative bg-blue-950/80"
                      style={{ width: "50%" }}
                    >
                      <div
                        className="absolute inset-y-0 left-0 bg-blue-500"
                        style={{
                          width: `${Math.min(100, (codeSize / CODE_SIZE) * 100)}%`,
                        }}
                      />
                    </div>
                    {/* Data region: 512/2048 = 25% */}
                    <div
                      className="relative bg-emerald-950/80"
                      style={{ width: "25%" }}
                    >
                      <div
                        className="absolute inset-y-0 left-0 bg-emerald-500"
                        style={{
                          width: `${Math.min(100, (dataUsed / dataMax) * 100)}%`,
                        }}
                      />
                    </div>
                    {/* Stack region: 512/2048 = 25% (always reserved) */}
                    <div
                      className="bg-orange-500/50"
                      style={{ width: "25%" }}
                    />
                  </div>
                  <span
                    className={`text-[10px] font-mono ${
                      dataFree <= 0
                        ? "text-red-400"
                        : dataFree < 50
                          ? "text-yellow-400"
                          : "text-slate-500"
                    }`}
                  >
                    Libre:{dataFree}
                  </span>
                </>
              )}
            </div>
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
              language={language}
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

            {/* Console + Plotter stacked */}
            <div className="w-1/2 flex flex-col gap-2 overflow-hidden">
              <div className="h-1/2 overflow-hidden">
                <ConsolePanel
                  output={consoleOutput}
                  onClear={handleClearConsole}
                  onInput={handleConsoleInput}
                />
              </div>
              <div className="h-1/2 overflow-hidden">
                <PlotterPanel
                  pixels={plotterPixels}
                  onClear={handleClearPlotter}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
