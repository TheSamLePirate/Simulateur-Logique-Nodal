import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type ChangeEvent,
} from "react";
import {
  Play,
  Square,
  SkipForward,
  RotateCcw,
  Zap,
  Gauge,
  Download,
  Upload,
  HardDrive,
} from "lucide-react";

import { CPU } from "../../cpu/cpu";
import { assemble, type AssemblerError } from "../../cpu/assembler";
import {
  compile,
  type CompileError,
  type MemoryLayout,
} from "../../cpu/compiler";
import {
  bootCpuToShell,
  getBootloaderImage,
  getLinuxBootDiskImage,
  writeProgramToBootDisk,
} from "../../cpu/bootloader";
import { EXAMPLES } from "../../cpu/examples";
import { C_EXAMPLES } from "../../cpu/cexamples";
import type { CPUState } from "../../cpu/isa";
import {
  createInitialState,
  MEMORY_SIZE,
  CODE_SIZE,
  DRIVE_SIZE,
} from "../../cpu/isa";
import {
  DEFAULT_PLOTTER_COLOR,
  serializePlotterPixels,
  type PlotterColor,
  type PlotterPixels,
} from "../../plotter";

import { ASMEditor, type EditorLanguage } from "./ASMEditor";
import { CPUStatePanel } from "./CPUState";
import { MemoryView } from "./MemoryView";
import { ConsolePanel } from "./ConsolePanel";
import { PlotterPanel } from "./PlotterPanel";
import { ResizablePanel } from "./ResizablePanel";
import { ComputerPanel } from "./ComputerPanel";
import type { ComputerPanelData } from "./computerPanelTypes";
import {
  handleRunningKeyboardDown,
  handleRunningKeyboardUp,
} from "./runningKeyboard";
import type { HardwareSyncData } from "./hardwareSyncTypes";

interface EditorError {
  line: number;
  message: string;
}

interface SoftwareViewProps {
  onHardwareSync?: (data: HardwareSyncData) => void;
  onProgramLoaded?: (image: { bytes: number[]; startAddr: number }) => void;
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
  const [useBootloader, setUseBootloader] = useState(false);

  // CPU state (snapshot for React rendering)
  const [cpuState, setCpuState] = useState<CPUState>(createInitialState());
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [plotterPixels, setPlotterPixels] = useState<PlotterPixels>(new Map());
  const [plotterColor, setPlotterColor] = useState<PlotterColor>(
    DEFAULT_PLOTTER_COLOR,
  );
  const [consoleInputBuffer, setConsoleInputBuffer] = useState<number[]>([]);
  const [keyStateSnapshot, setKeyStateSnapshot] = useState<number[]>([
    0, 0, 0, 0, 0,
  ]);
  const [driveDataSnapshot, setDriveDataSnapshot] = useState<Uint8Array>(
    () => cpuRef.current.exportDriveData(),
  );
  const [driveStateSnapshot, setDriveStateSnapshot] = useState({
    page: 0,
    lastAddr: 0,
    lastRead: 0,
    lastWrite: 0,
  });
  const [networkSnapshot, setNetworkSnapshot] = useState<{
    method: "GET" | "POST";
    url: string;
    body: string;
    status: string;
    pending: boolean;
    responseBuffer: number[];
    lastByte: number;
    completedMethod: "GET" | "POST";
    completedUrl: string;
    completedBody: string;
    completedStatus: string;
    completedResponseText: string;
    history: import("../../cpu/cpu").HttpHistoryEntry[];
  }>({
    method: "GET",
    url: "",
    body: "",
    status: "Idle",
    pending: false,
    responseBuffer: [],
    lastByte: 0,
    completedMethod: "GET",
    completedUrl: "",
    completedBody: "",
    completedStatus: "",
    completedResponseText: "",
    history: [],
  });

  // Source map for line highlighting (ASM line → PC mapping)
  const sourceMapRef = useRef<Map<number, number>>(new Map());

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [runSpeed, setRunSpeed] = useState(10);
  const runIntervalRef = useRef<number | null>(null);
  const diskInputRef = useRef<HTMLInputElement | null>(null);

  // Memory write highlights
  const [memHighlights, setMemHighlights] = useState<Set<number>>(new Set());
  const [compiledProgramBytes, setCompiledProgramBytes] = useState<number[] | null>(
    null,
  );
  const [runtimePanelMode, setRuntimePanelMode] = useState<"computer" | "classic">(
    "computer",
  );
  const keyStateSnapshotRef = useRef<number[]>([0, 0, 0, 0, 0]);
  const consoleRevisionRef = useRef(cpuRef.current.consoleRevision);
  const plotterRevisionRef = useRef(cpuRef.current.plotterRevision);
  const inputRevisionRef = useRef(cpuRef.current.inputRevision);
  const networkRevisionRef = useRef(cpuRef.current.networkRevision);
  const driveContentRevisionRef = useRef(cpuRef.current.driveContentRevision);
  const driveStateRevisionRef = useRef(cpuRef.current.driveStateRevision);

  // Derived: active code based on language
  const code = language === "c" ? cCode : asmCode;
  const setCode = language === "c" ? setCCode : setAsmCode;

  // Current source line being executed (only for ASM tab)
  const currentLine =
    assembled && language === "asm"
      ? sourceMapRef.current.get(cpuState.pc) || undefined
      : undefined;

  const syncCpuView = useCallback(
    (cpu: CPU) => {
      setCpuState(cpu.snapshot());

      if (consoleRevisionRef.current !== cpu.consoleRevision) {
        consoleRevisionRef.current = cpu.consoleRevision;
        setConsoleOutput([...cpu.consoleOutput]);
      }

      if (plotterRevisionRef.current !== cpu.plotterRevision) {
        plotterRevisionRef.current = cpu.plotterRevision;
        setPlotterPixels(new Map(cpu.plotterPixels));
        setPlotterColor({ ...cpu.plotterColor });
      }

      if (inputRevisionRef.current !== cpu.inputRevision) {
        inputRevisionRef.current = cpu.inputRevision;
        setConsoleInputBuffer([...cpu.consoleInputBuffer]);
      }

      if (
        keyStateSnapshotRef.current.length !== cpu.keyState.length ||
        keyStateSnapshotRef.current.some(
          (value, index) => value !== cpu.keyState[index],
        )
      ) {
        const nextKeyState = [...cpu.keyState];
        keyStateSnapshotRef.current = nextKeyState;
        setKeyStateSnapshot(nextKeyState);
      }

      if (driveContentRevisionRef.current !== cpu.driveContentRevision) {
        driveContentRevisionRef.current = cpu.driveContentRevision;
        setDriveDataSnapshot(cpu.exportDriveData());
      }

      if (driveStateRevisionRef.current !== cpu.driveStateRevision) {
        driveStateRevisionRef.current = cpu.driveStateRevision;
        setDriveStateSnapshot({
          page: cpu.drivePage,
          lastAddr: cpu.driveLastAddr,
          lastRead: cpu.driveLastRead,
          lastWrite: cpu.driveLastWrite,
        });
      }

      if (networkRevisionRef.current !== cpu.networkRevision) {
        networkRevisionRef.current = cpu.networkRevision;
        setNetworkSnapshot({
          method: cpu.httpLastMethod,
          url: cpu.httpLastUrl,
          body: cpu.httpLastBody,
          status: cpu.httpLastStatus,
          pending: cpu.httpPending,
          responseBuffer: [...cpu.httpResponseBuffer],
          lastByte: cpu.httpLastByte,
          completedMethod: cpu.httpCompletedMethod,
          completedUrl: cpu.httpCompletedUrl,
          completedBody: cpu.httpCompletedBody,
          completedStatus: cpu.httpCompletedStatus,
          completedResponseText: cpu.httpCompletedResponseText,
          history: [...cpu.httpHistory],
        });
      }

      onHardwareSync?.({
        pc: cpu.state.pc,
        a: cpu.state.a,
        b: cpu.state.b,
        sp: cpu.state.sp,
        memory: new Uint8Array(cpu.state.memory),
        flags: { ...cpu.state.flags },
        consoleText: cpu.consoleOutput.join(""),
        plotterPixels: serializePlotterPixels(cpu.plotterPixels),
        plotterColor: { ...cpu.plotterColor },
        driveData: cpu.exportDriveData(),
        driveLastAddr: cpu.driveLastAddr,
        driveLastRead: cpu.driveLastRead,
        driveLastWrite: cpu.driveLastWrite,
        networkMethod: cpu.httpLastMethod,
        networkUrl: cpu.httpLastUrl,
        networkBody: cpu.httpLastBody,
        networkStatus: cpu.httpLastStatus,
        networkPending: cpu.httpPending,
        networkResponseBuffer: [...cpu.httpResponseBuffer],
        networkLastByte: cpu.httpLastByte,
        networkCompletedMethod: cpu.httpCompletedMethod,
        networkCompletedUrl: cpu.httpCompletedUrl,
        networkCompletedBody: cpu.httpCompletedBody,
        networkCompletedStatus: cpu.httpCompletedStatus,
        networkCompletedResponseText: cpu.httpCompletedResponseText,
        halted: cpu.state.halted,
      });
    },
    [onHardwareSync],
  );

  useEffect(() => {
    const cpu = cpuRef.current;
    cpu.onExternalStateChange = () => {
      syncCpuView(cpu);
    };
    return () => {
      if (cpu.onExternalStateChange) {
        cpu.onExternalStateChange = undefined;
      }
    };
  }, [syncCpuView]);

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

  const ensureBootloaderReady = useCallback(
    (preserveConsole = true) => {
      const cpu = cpuRef.current;
      const image = getBootloaderImage();
      let hasBootloader = true;

      for (let i = 0; i < image.bytes.length; i++) {
        if (cpu.state.memory[image.startAddr + i] !== image.bytes[i]) {
          hasBootloader = false;
          break;
        }
      }

      if (hasBootloader) {
        return true;
      }

      cpu.reset();
      cpu.loadProgram(image.bytes, image.startAddr);
      const booted = bootCpuToShell(cpu, {
        preserveConsole,
        preserveNetwork: true,
      });
      syncCpuView(cpu);
      onProgramLoaded?.(image);
      return booted;
    },
    [onProgramLoaded, syncCpuView],
  );

  // ─── Assemble / Compile ───
  const handleAssemble = useCallback(() => {
    const loadImage = (
      programBytes: number[],
      sourceMap: Map<number, number>,
      layout: MemoryLayout | null,
    ) => {
      if (useBootloader) {
        ensureBootloaderReady(false);
        sourceMapRef.current = new Map();
        setCompiledProgramBytes(programBytes);
        setAssembled(true);
        setErrors([]);
        setCodeSize(programBytes.length);
        setMemLayout(layout);
        setMemHighlights(new Set());
        return;
      }

      const cpu = cpuRef.current;
      const image = { bytes: programBytes, startAddr: 0 };

      cpu.reset();
      cpu.loadProgram(image.bytes, image.startAddr);
      sourceMapRef.current = sourceMap;
      syncCpuView(cpu);
      setCompiledProgramBytes(programBytes);
      setAssembled(true);
      setIsRunning(false);
      setErrors([]);
      setCodeSize(programBytes.length);
      setMemLayout(layout);
      setMemHighlights(new Set());
      onProgramLoaded?.(image);
    };

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
        setCompiledProgramBytes(null);
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
        setCompiledProgramBytes(null);
        return;
      }

      loadImage(
        asmResult.bytes,
        asmResult.sourceMap,
        compileResult.memoryLayout || null,
      );
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
        loadImage(result.bytes, result.sourceMap, null);
      } else {
        setAssembled(false);
        setCodeSize(result.bytes.length);
        setMemLayout(null);
        setCompiledProgramBytes(null);
      }
    }
  }, [
    cCode,
    asmCode,
    language,
    ensureBootloaderReady,
    onProgramLoaded,
    syncCpuView,
    useBootloader,
  ]);

  // ─── Step ───
  const handleStep = useCallback(() => {
    if (!assembled) return;
    if (useBootloader && !ensureBootloaderReady()) return;
    const cpu = cpuRef.current;
    const prevMem = new Uint8Array(cpu.state.memory);

    cpu.step();

    if (cpu.state.halted && useBootloader) {
      bootCpuToShell(cpu, {
        preserveConsole: true,
        preservePlotter: true,
        preserveNetwork: true,
      });
      syncCpuView(cpu);
      return;
    }

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

    syncCpuView(cpu);

    if (cpu.state.halted) {
      setIsRunning(false);
    }
  }, [assembled, ensureBootloaderReady, syncCpuView, useBootloader]);

  // ─── Run / Stop ───
  const handleRun = useCallback(() => {
    if (!assembled) return;
    if (useBootloader && !ensureBootloaderReady()) return;
    if (cpuRef.current.state.halted) {
      if (!useBootloader) return;
      if (
        !bootCpuToShell(cpuRef.current, {
          preserveConsole: true,
          preservePlotter: true,
          preserveNetwork: true,
        })
      ) {
        return;
      }
      syncCpuView(cpuRef.current);
    }
    setIsRunning(true);
  }, [assembled, ensureBootloaderReady, syncCpuView, useBootloader]);

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
          if (
            useBootloader &&
            bootCpuToShell(cpu, {
              preserveConsole: true,
              preservePlotter: true,
              preserveNetwork: true,
            })
          ) {
            break;
          }
          setIsRunning(false);
          break;
        }
      }
      syncCpuView(cpu);
    }, 50);

    return () => {
      if (runIntervalRef.current !== null) {
        clearInterval(runIntervalRef.current);
        runIntervalRef.current = null;
      }
    };
  }, [isRunning, runSpeed, syncCpuView, useBootloader]);

  // ─── Reset ───
  const handleReset = useCallback(() => {
    const cpu = cpuRef.current;
    cpu.reset();
    syncCpuView(cpu);
    setAssembled(false);
    setIsRunning(false);
    setErrors([]);
    setCodeSize(0);
    setMemLayout(null);
    setMemHighlights(new Set());
  }, [syncCpuView]);

  // ─── Console clear ───
  const handleClearConsole = useCallback(() => {
    const cpu = cpuRef.current;
    cpu.consoleOutput = [];
    cpu.consoleRevision++;
    syncCpuView(cpu);
  }, [syncCpuView]);

  // ─── Keyboard input (arrow keys + Enter) — only while CPU is running ───
  useEffect(() => {
    if (!isRunning) return;

    const cpu = cpuRef.current;

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        handleRunningKeyboardDown(cpu, {
          key: e.key,
          altKey: e.altKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          target: e.target as EventTarget & {
            tagName?: string;
            isContentEditable?: boolean;
          },
        })
      ) {
        syncCpuView(cpu);
        e.preventDefault();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (handleRunningKeyboardUp(cpu, { key: e.key })) {
        syncCpuView(cpu);
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      // Reset key state when stopping
      cpu.keyState = [0, 0, 0, 0, 0];
      syncCpuView(cpu);
    };
  }, [isRunning, syncCpuView]);

  // ─── Console input ───
  const handleConsoleInput = useCallback((text: string) => {
    const cpu = cpuRef.current;
    for (let i = 0; i < text.length; i++) {
      cpu.pushInput(text.charCodeAt(i));
    }
    cpu.pushInput(10); // newline
    syncCpuView(cpu);
  }, [syncCpuView]);

  const handleImmediateKeyDown = useCallback(
    (key: string) => {
      const cpu = cpuRef.current;
      if (handleRunningKeyboardDown(cpu, { key })) {
        syncCpuView(cpu);
      }
    },
    [syncCpuView],
  );

  const handleImmediateKeyUp = useCallback(
    (key: string) => {
      const cpu = cpuRef.current;
      if (handleRunningKeyboardUp(cpu, { key })) {
        syncCpuView(cpu);
      }
    },
    [syncCpuView],
  );

  // ─── Plotter clear ───
  const handleClearPlotter = useCallback(() => {
    cpuRef.current.plotterPixels = new Map();
    cpuRef.current.plotterRevision++;
    syncCpuView(cpuRef.current);
  }, [syncCpuView]);

  // ─── Example select ───
  const handleSelectExample = useCallback(
    (exCode: string) => {
      setCode(exCode);
      setAssembled(false);
      setCompiledProgramBytes(null);
      setErrors([]);
      setMemHighlights(new Set());
      if (!useBootloader) {
        setIsRunning(false);
        const cpu = cpuRef.current;
        cpu.reset();
        syncCpuView(cpu);
      }
    },
    [setCode, syncCpuView, useBootloader],
  );

  const handleCompileToDisk = useCallback(() => {
    if (!compiledProgramBytes) return;
    const requestedName = window.prompt(
      "Program name on disk (max 8 chars):",
      "program",
    );
    if (!requestedName) return;

    try {
      const nextDisk = writeProgramToBootDisk(
        cpuRef.current.driveData,
        requestedName,
        compiledProgramBytes,
      );
      cpuRef.current.loadDriveData(nextDisk);
      syncCpuView(cpuRef.current);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Could not write program to disk.",
      );
    }
  }, [compiledProgramBytes, syncCpuView]);

  const handleInstallLinuxDisk = useCallback(() => {
    const confirmed = window.confirm(
      "Replace the current external drive with the bundled Linux-like disk image?",
    );
    if (!confirmed) return;

    const cpu = cpuRef.current;
    cpu.loadDriveData(getLinuxBootDiskImage(true));
    syncCpuView(cpu);
  }, [syncCpuView]);

  const handleExportDisk = useCallback(() => {
    const blob = new Blob([cpuRef.current.exportDriveData()], {
      type: "application/octet-stream",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "external-drive.bin";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const handleImportDiskClick = useCallback(() => {
    diskInputRef.current?.click();
  }, []);

  const handleImportDisk = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;

      const bytes = new Uint8Array(await file.arrayBuffer());
      const cpu = cpuRef.current;
      cpu.loadDriveData(bytes);
      syncCpuView(cpu);
    },
    [syncCpuView],
  );

  // Memory layout metrics
  // Architecture: Code 4096B (50%) | Data 2072B (25.3%) | Stack 2048B (25%)
  // Data area = globals(16) + scratch(8) + locals(2024) = 2048B max used
  let liveCodeUsed = 0;
  for (let i = CODE_SIZE - 1; i >= 0; i--) {
    if (cpuState.memory[i] !== 0) {
      liveCodeUsed = i + 1;
      break;
    }
  }
  const dataUsed = memLayout
    ? memLayout.globals + memLayout.scratch + memLayout.locals
    : 0;
  const dataMax = 2048; // 0x1000-0x17FF
  const dataFree = memLayout ? dataMax - dataUsed : 0;
  const stackMax = memLayout?.stackSize ?? 2048;
  const stackTop = MEMORY_SIZE - 1;
  const stackUsed = Math.max(0, Math.min(stackMax, stackTop - cpuState.sp));
  const totalRamUsed = dataUsed + stackUsed;
  const totalRamMax = dataMax + stackMax;
  const totalRamFree = totalRamMax - totalRamUsed;
  let driveUsed = 0;
  for (const byte of cpuRef.current.driveData) {
    if (byte !== 0) driveUsed++;
  }

  const computerPanelData: ComputerPanelData = useMemo(
    () => ({
      state: cpuState,
      consoleOutput,
      consoleInputBuffer,
      plotterPixels,
      plotterColor,
      keyState: keyStateSnapshot,
      driveData: driveDataSnapshot,
      drivePage: driveStateSnapshot.page,
      driveLastAddr: driveStateSnapshot.lastAddr,
      driveLastRead: driveStateSnapshot.lastRead,
      driveLastWrite: driveStateSnapshot.lastWrite,
      networkMethod: networkSnapshot.method,
      networkUrl: networkSnapshot.url,
      networkBody: networkSnapshot.body,
      networkStatus: networkSnapshot.status,
      networkPending: networkSnapshot.pending,
      networkResponseBuffer: networkSnapshot.responseBuffer,
      networkLastByte: networkSnapshot.lastByte,
      networkCompletedMethod: networkSnapshot.completedMethod,
      networkCompletedUrl: networkSnapshot.completedUrl,
      networkCompletedBody: networkSnapshot.completedBody,
      networkCompletedStatus: networkSnapshot.completedStatus,
      networkCompletedResponseText: networkSnapshot.completedResponseText,
      networkHistory: networkSnapshot.history,
      lastOpcode: cpuRef.current.lastOpcode,
      lastOperand: cpuRef.current.lastOperand,
      clockBit: cpuRef.current.clockBit,
      randSeed: cpuRef.current.randSeed,
      randCounter: cpuRef.current.randCounter,
      sleepCounter: cpuRef.current.sleepCounter,
      assembled,
      isRunning,
      useBootloader,
      memLayout,
      codeSize,
    }),
    [
      assembled,
      codeSize,
      consoleInputBuffer,
      consoleOutput,
      cpuState,
      driveDataSnapshot,
      driveStateSnapshot,
      isRunning,
      keyStateSnapshot,
      memLayout,
      networkSnapshot,
      plotterColor,
      plotterPixels,
      useBootloader,
    ],
  );

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
          disabled={!assembled || isRunning || (cpuState.halted && !useBootloader)}
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
            disabled={!assembled || (cpuState.halted && !useBootloader)}
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

        <label className="flex items-center gap-2 px-2 py-1 rounded-md border border-slate-700 bg-slate-900 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={useBootloader}
            onChange={(e) => setUseBootloader(e.target.checked)}
            className="accent-cyan-500"
          />
          Use bootloader
        </label>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded border text-cyan-300 bg-cyan-500/10 border-cyan-500/30">
            <HardDrive size={12} />
            Disk {driveUsed}/{DRIVE_SIZE}
          </span>
          <button
            onClick={handleImportDiskClick}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
          >
            <Upload size={13} /> Import
          </button>
          <button
            onClick={handleExportDisk}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
          >
            <Download size={13} /> Export
          </button>
          <button
            onClick={handleCompileToDisk}
            disabled={!compiledProgramBytes}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <HardDrive size={13} /> Compile to Disk
          </button>
          {useBootloader && (
            <button
              onClick={handleInstallLinuxDisk}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
            >
              <HardDrive size={13} /> Install Linux Disk
            </button>
          )}
        </div>

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
          <input
            type="number"
            min={1}
            max={100000}
            value={runSpeed}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              if (!isNaN(v) && v >= 1 && v <= 100000) setRunSpeed(v);
            }}
            className="w-16 text-[10px] text-slate-300 font-mono bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 text-center focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="text-[10px] text-slate-500 font-mono">
            instr/tick
          </span>
        </div>
        <input
          ref={diskInputRef}
          type="file"
          accept=".bin,.img,.disk,application/octet-stream"
          onChange={handleImportDisk}
          className="hidden"
        />

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
                  liveCodeUsed > CODE_SIZE
                    ? "text-red-400 bg-red-500/10 border-red-500/30"
                    : liveCodeUsed > CODE_SIZE * 0.8
                      ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30"
                      : "text-slate-400 bg-slate-800 border-slate-700"
                }`}
              >
                Code {liveCodeUsed}/{CODE_SIZE}
              </span>
              {memLayout && (
                <>
                  <span className="text-[10px] font-mono text-slate-500">
                    RAM {totalRamUsed}/{totalRamMax}
                  </span>
                  {/* Memory bar: fixed regions (50% code, 25% data, 25% stack) */}
                  <div
                    className="flex h-3 w-28 rounded-sm overflow-hidden border border-slate-700"
                    title={`── Code (0x0000-0x0FFF) ──\nUtilise maintenant: ${liveCodeUsed}/${CODE_SIZE}B\nDerniere compilation: ${codeSize}/${CODE_SIZE}B\n\n── Data (0x1000-0x17FF) ──\nGlobales: ${memLayout.globals}/16B\nScratch: ${memLayout.scratch}/8B (fixe)\nLocales: ${memLayout.locals}/2024B\nReserve: ${dataUsed}/${dataMax}B\nLibre: ${dataFree}B\n\n── Stack (0x1800-0x1FFF) ──\nUtilise maintenant: ${stackUsed}/${stackMax}B\nSP: 0x${cpuState.sp.toString(16).padStart(4, "0")}\nLibre: ${stackMax - stackUsed}B\n\n── RAM totale (hors code) ──\nUtilise: ${totalRamUsed}/${totalRamMax}B\nLibre: ${totalRamFree}B`}
                  >
                    {/* Code region: 4096/8192 = 50% */}
                    <div
                      className="relative bg-blue-950/80"
                      style={{ width: "50%" }}
                    >
                      <div
                        className="absolute inset-y-0 left-0 bg-blue-500"
                        style={{
                          width: `${Math.min(100, (liveCodeUsed / CODE_SIZE) * 100)}%`,
                        }}
                      />
                    </div>
                    {/* Data region: 2048/8192 = 25% */}
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
                    {/* Stack region: 2048/8192 = 25% (live usage from SP) */}
                    <div
                      className="relative bg-orange-950/80"
                      style={{ width: "25%" }}
                    >
                      <div
                        className="absolute inset-y-0 left-0 bg-orange-500"
                        style={{
                          width: `${Math.min(100, (stackUsed / stackMax) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-mono ${
                      totalRamFree <= 0
                        ? "text-red-400"
                        : totalRamFree < 50
                          ? "text-yellow-400"
                          : "text-slate-500"
                    }`}
                  >
                    Stack:{stackUsed}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        <ResizablePanel
          direction="horizontal"
          initialRatio={0.5}
          minRatio={0.25}
          maxRatio={0.75}
          className="flex-1 h-full"
          first={
            <div className="flex flex-col p-2 gap-2 h-full overflow-hidden">
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
          }
          second={
            <div className="flex flex-col p-2 gap-2 h-full overflow-hidden">
              <div className="shrink-0 rounded-md border border-slate-800 bg-slate-900/80 p-1.5">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setRuntimePanelMode("computer")}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      runtimePanelMode === "computer"
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    }`}
                  >
                    Computer
                  </button>
                  <button
                    onClick={() => setRuntimePanelMode("classic")}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      runtimePanelMode === "classic"
                        ? "bg-slate-700 text-slate-100 border border-slate-600"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    }`}
                  >
                    Classic
                  </button>
                  <span className="ml-auto px-2 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                    Same live CPU
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-hidden">
                {runtimePanelMode === "computer" ? (
                  <ComputerPanel
                    data={computerPanelData}
                    onClearConsole={handleClearConsole}
                    onConsoleInput={handleConsoleInput}
                    onClearPlotter={handleClearPlotter}
                    onKeyDown={handleImmediateKeyDown}
                    onKeyUp={handleImmediateKeyUp}
                  />
                ) : (
                  <div className="flex flex-col gap-2 h-full overflow-hidden">
                    {/* CPU Registers */}
                    <div className="shrink-0">
                      <CPUStatePanel state={cpuState} />
                    </div>

                    {/* Memory + Console/Plotter split */}
                    <div className="flex-1 overflow-hidden">
                      <ResizablePanel
                        direction="horizontal"
                        initialRatio={0.5}
                        minRatio={0.3}
                        maxRatio={0.7}
                        className="h-full"
                        first={
                          <div className="h-full overflow-hidden">
                            <MemoryView
                              memory={cpuState.memory}
                              pc={cpuState.pc}
                              sp={cpuState.sp}
                              highlights={memHighlights}
                            />
                          </div>
                        }
                        second={
                          <ResizablePanel
                            direction="vertical"
                            initialRatio={0.5}
                            minRatio={0.2}
                            maxRatio={0.8}
                            className="h-full"
                            first={
                              <div className="h-full overflow-hidden">
                                <ConsolePanel
                                  output={consoleOutput}
                                  onClear={handleClearConsole}
                                  onInput={handleConsoleInput}
                                />
                              </div>
                            }
                            second={
                              <div className="h-full overflow-hidden">
                                <PlotterPanel
                                  pixels={plotterPixels}
                                  currentColor={plotterColor}
                                  onClear={handleClearPlotter}
                                />
                              </div>
                            }
                          />
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
}
