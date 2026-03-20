import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  Edge,
  Connection,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { v4 as uuidv4 } from "uuid";
import { Cpu, Package, Play, Square, Trash2 } from "lucide-react";

import type {
  Bit,
  GroupNodeData,
  SavedModule,
  ScenePreset,
  ActiveTab,
} from "./types";
import { nodeTypes } from "./components/nodes";
import { MiniSim } from "./components/MiniSim";
import { initialNodes, initialEdges } from "./data/initialScene";
import { simulateNodes, updateEdgeStyles } from "./logic/simulation";
import { SoftwareView } from "./components/software/SoftwareView";
import { CPU } from "./cpu/cpu";
import { BUILTIN_PRESETS } from "./data/scenePresets";
import { EmbeddedMarkdownDocument } from "./components/app/EmbeddedMarkdownDocument";
import {
  USER_GUIDE_EN_MARKDOWN,
  USER_GUIDE_FR_MARKDOWN,
} from "./content/generatedUserGuides";
import { useStoredState } from "./app/useStoredState";
import {
  createNode,
  instantiateSavedModuleNode,
  type AppNodeType,
} from "./app/nodeFactories";
import {
  applyGroupToEdges,
  applyGroupToNodes,
  applyUngroupToEdges,
  applyUngroupToNodes,
  createGroupSelection,
  restoreGroupContents,
} from "./app/grouping";
import {
  applyHardwareSyncToNodes,
  resetHardwarePlotterNodes,
  syncHardwareCpuStateToNodes,
} from "./app/hardwareSync";
import type { HardwareSyncData } from "./components/software/hardwareSyncTypes";
import { HardwareSidebar } from "./components/app/HardwareSidebar";
import { HardwareCpuControls } from "./components/app/HardwareCpuControls";

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isRunning, setIsRunning] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("hardware");
  const [inspecting, setInspecting] = useState<string | null>(null);
  const [scenesOpen, setScenesOpen] = useState(false);

  // ── Hardware CPU for running programs on the hardware view ──
  const hwCpuRef = useRef(new CPU());
  const [hwCpuLoaded, setHwCpuLoaded] = useState(false);
  const [hwCpuRunning, setHwCpuRunning] = useState(false);
  const [hwCpuHalted, setHwCpuHalted] = useState(false);
  const [hwRunSpeed, setHwRunSpeed] = useState(10);
  const hwRunIntervalRef = useRef<number | null>(null);
  const pendingHardwareSyncRef = useRef<HardwareSyncData | null>(null);

  // Derive clock frequency from clock node (used to pace the hardware CPU run loop)
  const hwClockFreq = useMemo(() => {
    const clkNode = nodes.find((n) => n.id === "clk");
    return (clkNode?.data as any)?.frequency ?? 1;
  }, [nodes]);

  const [savedModules, setSavedModules] = useStoredState<SavedModule[]>(
    "logique_saved_modules",
    [],
  );
  const [savedScenes, setSavedScenes] = useStoredState<ScenePreset[]>(
    "logique_saved_scenes",
    [],
  );

  // Listen for inspect-node events from Adder8 / SRAM / Group nodes
  useEffect(() => {
    const handleInspect = (e: any) => setInspecting(e.detail);
    window.addEventListener("inspect-node", handleInspect);
    return () => window.removeEventListener("inspect-node", handleInspect);
  }, []);

  // Listen for save-module events from GroupNode
  useEffect(() => {
    const handleSave = (e: any) => {
      const groupId = e.detail as string;
      const groupNode = nodes.find(
        (n) => n.id === groupId && n.type === "group",
      );
      if (!groupNode) return;
      const gd = groupNode.data as unknown as GroupNodeData;
      const saveName =
        prompt("Nom du module à sauvegarder :", gd.label) || gd.label;
      const moduleId = uuidv4();
      setSavedModules((prev) => [
        ...prev,
        {
          id: moduleId,
          label: saveName,
          circuit: {
            nodes: gd.circuit.nodes.map((n) => ({ ...n, data: { ...n.data } })),
            edges: gd.circuit.edges.map((e) => ({ ...e })),
          },
          inputHandles: gd.inputHandles.map((h) => ({ ...h })),
          outputHandles: gd.outputHandles.map((h) => ({ ...h })),
        },
      ]);
    };
    window.addEventListener("save-module", handleSave);
    return () => window.removeEventListener("save-module", handleSave);
  }, [nodes, setSavedModules]);

  // Listen for rename-module events from GroupNode
  useEffect(() => {
    const handleRename = (e: any) => {
      const { id, newLabel } = e.detail as {
        id: string;
        newLabel: string;
      };
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === id && n.type === "group") {
            return { ...n, data: { ...n.data, label: newLabel } };
          }
          return n;
        }),
      );
    };
    window.addEventListener("rename-module", handleRename);
    return () => window.removeEventListener("rename-module", handleRename);
  }, [setNodes]);

  // Listen for console-input events from ConsoleNode (hardware view)
  useEffect(() => {
    const handler = (e: any) => {
      const { text, nodeId } = e.detail;
      // Push to hardware CPU input buffer (for software-driven execution)
      const cpu = hwCpuRef.current;
      for (let i = 0; i < text.length; i++) {
        cpu.pushInput(text.charCodeAt(i));
      }
      cpu.pushInput(10); // newline

      // Also push to the console node's inputBuffer (for hardware-wired rd/avail)
      if (nodeId) {
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === nodeId && n.type === "console") {
              const buf = (n.data.inputBuffer as number[]) || [];
              const chars: number[] = [];
              for (let i = 0; i < text.length; i++) {
                chars.push(text.charCodeAt(i));
              }
              chars.push(10); // newline
              const newBuf = [...buf, ...chars];
              return {
                ...n,
                data: {
                  ...n.data,
                  inputBuffer: newBuf,
                  inputBufferSize: newBuf.length,
                  avail: 1,
                },
              };
            }
            return n;
          }),
        );
      }
    };
    window.addEventListener("console-input", handler);
    return () => window.removeEventListener("console-input", handler);
  }, [setNodes]);

  // Listen for clock-frequency change events from ClockNode
  useEffect(() => {
    const handler = (e: any) => {
      const { id, frequency } = e.detail;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id && n.type === "clock"
            ? { ...n, data: { ...n.data, frequency } }
            : n,
        ),
      );
    };
    window.addEventListener("clock-frequency", handler);
    return () => window.removeEventListener("clock-frequency", handler);
  }, [setNodes]);

  // Listen for keyboard-state events from KeyboardNode
  useEffect(() => {
    const handler = (e: any) => {
      const { index, value } = e.detail;
      // Update hardware CPU key state
      const cpu = hwCpuRef.current;
      if (index >= 0 && index < 5) {
        cpu.keyState[index] = value;
      }
      // Update keyboard node visual state
      setNodes((nds) =>
        nds.map((n) => {
          if (n.type === "keyboard") {
            const keys = [...((n.data.keys as number[]) || [0, 0, 0, 0, 0])];
            keys[index] = value;
            return { ...n, data: { ...n.data, keys } };
          }
          return n;
        }),
      );
    };
    window.addEventListener("keyboard-state", handler);
    return () => window.removeEventListener("keyboard-state", handler);
  }, [setNodes]);

  useEffect(() => {
    const handler = (e: any) => {
      const { nodeId, ...patch } = e.detail as {
        nodeId: string;
        method?: "GET" | "POST";
        url?: string;
        body?: string;
      };

      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId && node.type === "network"
            ? { ...node, data: { ...node.data, ...patch } }
            : node,
        ),
      );
    };

    window.addEventListener("network-node-config", handler);
    return () => window.removeEventListener("network-node-config", handler);
  }, [setNodes]);

  useEffect(() => {
    const handler = (e: any) => {
      const {
        nodeId,
        requestSerial,
        text,
      }: { nodeId: string; requestSerial: number; text: string } = e.detail;
      const encoded = Array.from(
        new TextEncoder().encode(text),
        (byte) => byte & 0xff,
      );

      setNodes((nds) =>
        nds.map((node) => {
          if (node.id !== nodeId || node.type !== "network") return node;
          if ((node.data.requestSerial as number) !== requestSerial)
            return node;
          return {
            ...node,
            data: {
              ...node.data,
              q: Array(8).fill(0),
              avail: encoded.length > 0 ? 1 : 0,
              pending: 0,
              responseBuffer: encoded,
              responseSize: encoded.length,
              lastByte: 0,
            },
          };
        }),
      );
    };

    window.addEventListener("network-node-response", handler);
    return () => window.removeEventListener("network-node-response", handler);
  }, [setNodes]);

  // --- Simulation loop (20Hz) ---
  useEffect(() => {
    if (!isRunning) return;

    const simulate = () => {
      // Always run node simulation (evaluates output/LED nodes, gates, etc.).
      // When hwCpuLoaded, syncHwCpuToNodes overwrites CPU-specific nodes each step,
      // but non-CPU nodes (e.g. LEDs connected to keyboard) still need simulation.
      setNodes((nds) => simulateNodes(nds, edges));
      setEdges((eds) => updateEdgeStyles(nodes, eds));
    };

    const interval = setInterval(simulate, 50);
    return () => clearInterval(interval);
  }, [edges, nodes, isRunning, hwCpuLoaded, setNodes, setEdges]);

  // --- Handlers ---
  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: false,
            style: { stroke: "#475569", strokeWidth: 2 },
          } as Edge,
          eds,
        ),
      ),
    [setEdges],
  );

  const handleInputChange = useCallback(
    (id: string, newValue: Bit) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            return { ...node, data: { ...node.data, value: newValue } };
          }
          return node;
        }),
      );
    },
    [setNodes],
  );

  // Inject the onChange handler into input nodes
  const nodesWithHandlers = useMemo(() => {
    return nodes.map((node) => {
      if (node.type === "input" || node.type === "inputNumber") {
        return { ...node, data: { ...node.data, onChange: handleInputChange } };
      }
      return node;
    });
  }, [nodes, handleInputChange]);

  const groupSelectedNodes = useCallback(() => {
    const groupId = uuidv4();
    const defaultName = `Module_${groupId.slice(0, 4)}`;
    const moduleName = prompt("Nom du module :", defaultName) || defaultName;
    const groupSelection = createGroupSelection(
      nodes,
      edges,
      groupId,
      moduleName,
    );
    if (!groupSelection) return;

    setNodes((currentNodes) =>
      applyGroupToNodes(
        currentNodes,
        groupSelection.selectedIds,
        groupSelection.groupNode,
      ),
    );
    setEdges((currentEdges) =>
      applyGroupToEdges(
        currentEdges,
        groupSelection.selectedIds,
        groupSelection.edgeRewrites,
        groupId,
      ),
    );
  }, [nodes, edges, setNodes, setEdges]);

  const ungroupNodes = useCallback(
    (groupNodeId: string) => {
      const groupNode = nodes.find(
        (n) => n.id === groupNodeId && n.type === "group",
      );
      if (!groupNode) return;

      const { restoredNodes, restoredEdges, rewiredEdges } =
        restoreGroupContents(groupNode);

      setNodes((currentNodes) =>
        applyUngroupToNodes(currentNodes, groupNodeId, restoredNodes),
      );
      setEdges((currentEdges) =>
        applyUngroupToEdges(
          currentEdges,
          groupNodeId,
          rewiredEdges,
          restoredEdges,
        ),
      );
    },
    [nodes, setNodes, setEdges],
  );

  // Listen for ungroup-node events
  useEffect(() => {
    const handleUngroup = (e: any) => ungroupNodes(e.detail);
    window.addEventListener("ungroup-node", handleUngroup);
    return () => window.removeEventListener("ungroup-node", handleUngroup);
  }, [ungroupNodes]);

  // Ctrl+G keyboard shortcut for grouping
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "g") {
        e.preventDefault();
        groupSelectedNodes();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [groupSelectedNodes]);

  const instantiateModule = useCallback(
    (mod: SavedModule) => {
      setNodes((currentNodes) => [
        ...currentNodes,
        instantiateSavedModuleNode(mod),
      ]);
    },
    [setNodes],
  );

  const addNode = useCallback(
    (type: AppNodeType, specificType?: string) => {
      const newNode = createNode(type, specificType);
      if (!newNode) return;
      setNodes((currentNodes) => [...currentNodes, newNode]);
    },
    [setNodes],
  );

  const clearCanvas = () => {
    setNodes([]);
    setEdges([]);
  };

  // ── Scene preset loading / saving ──
  const loadScene = useCallback(
    (preset: ScenePreset) => {
      // Deep-clone to avoid shared references (e.g. SRAM memory arrays)
      const clonedNodes = JSON.parse(JSON.stringify(preset.nodes));
      const clonedEdges = JSON.parse(JSON.stringify(preset.edges));
      setNodes(clonedNodes);
      setEdges(clonedEdges);
      // Reset hardware CPU state
      hwCpuRef.current = new CPU();
      setHwCpuLoaded(false);
      setHwCpuRunning(false);
      setHwCpuHalted(false);
      if (hwRunIntervalRef.current !== null) {
        clearInterval(hwRunIntervalRef.current);
        hwRunIntervalRef.current = null;
      }
    },
    [setNodes, setEdges],
  );

  const saveCurrentScene = useCallback(() => {
    const name = window.prompt("Nom de la scène :");
    if (!name || !name.trim()) return;
    const newPreset: ScenePreset = {
      id: uuidv4(),
      name: name.trim(),
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    };
    setSavedScenes((prev) => [...prev, newPreset]);
  }, [nodes, edges, setSavedScenes]);

  const allScenes = useMemo(
    () => [...BUILTIN_PRESETS, ...savedScenes],
    [savedScenes],
  );

  const applyHardwareSync = useCallback(
    (data: HardwareSyncData) => {
      setNodes((currentNodes) => applyHardwareSyncToNodes(currentNodes, data));
    },
    [setNodes],
  );

  const handleHardwareSync = useCallback(
    (data: HardwareSyncData) => {
      pendingHardwareSyncRef.current = data;
      const hwCpu = hwCpuRef.current;
      hwCpu.loadDriveData(data.driveData);
      hwCpu.driveLastAddr = data.driveLastAddr;
      hwCpu.driveLastRead = data.driveLastRead & 0xff;
      hwCpu.driveLastWrite = data.driveLastWrite & 0xff;

      if (activeTab !== "hardware") {
        return;
      }

      applyHardwareSync(data);
    },
    [activeTab, applyHardwareSync],
  );

  useEffect(() => {
    if (activeTab !== "hardware") {
      return;
    }
    if (!pendingHardwareSyncRef.current) {
      return;
    }
    applyHardwareSync(pendingHardwareSyncRef.current);
  }, [activeTab, applyHardwareSync]);

  const syncHwCpuToNodes = useCallback(() => {
    const cpu = hwCpuRef.current;
    setNodes((currentNodes) => syncHardwareCpuStateToNodes(currentNodes, cpu));
  }, [setNodes]);

  const handleProgramLoaded = useCallback(
    (image: { bytes: number[]; startAddr: number }) => {
      const cpu = hwCpuRef.current;
      cpu.reset();
      cpu.loadProgram(image.bytes, image.startAddr);
      setHwCpuLoaded(true);
      setHwCpuRunning(false);
      setHwCpuHalted(false);
      syncHwCpuToNodes();
    },
    [syncHwCpuToNodes],
  );

  const hwStep = useCallback(() => {
    if (!hwCpuLoaded || hwCpuHalted) return;
    const cpu = hwCpuRef.current;
    cpu.step();
    if (cpu.state.halted) setHwCpuHalted(true);
    syncHwCpuToNodes();
  }, [hwCpuLoaded, hwCpuHalted, syncHwCpuToNodes]);

  const hwRun = useCallback(() => {
    if (!hwCpuLoaded || hwCpuHalted) return;
    setHwCpuRunning(true);
  }, [hwCpuLoaded, hwCpuHalted]);

  const hwStop = useCallback(() => {
    setHwCpuRunning(false);
  }, []);

  const hwReset = useCallback(() => {
    const cpu = hwCpuRef.current;
    cpu.reset();
    setHwCpuLoaded(false);
    setHwCpuRunning(false);
    setHwCpuHalted(false);
    syncHwCpuToNodes();
    setNodes((currentNodes) => resetHardwarePlotterNodes(currentNodes));
  }, [setNodes, syncHwCpuToNodes]);

  // Hardware CPU run loop — paced by the clock node's frequency
  // At clock=1Hz, i/tick=1 → 1 instruction per second
  // At clock=10Hz, i/tick=1 → 10 instructions per second
  // At clock=1Hz, i/tick=5 → 5 instructions per second
  useEffect(() => {
    if (!hwCpuRunning) {
      if (hwRunIntervalRef.current !== null) {
        clearInterval(hwRunIntervalRef.current);
        hwRunIntervalRef.current = null;
      }
      return;
    }

    // interval = 1000 / clockFreq (ms per clock tick)
    // minimum 16ms (~60fps) to avoid locking the browser
    const intervalMs = Math.max(16, Math.round(1000 / hwClockFreq));

    hwRunIntervalRef.current = window.setInterval(() => {
      const cpu = hwCpuRef.current;
      for (let i = 0; i < hwRunSpeed; i++) {
        if (!cpu.step()) {
          setHwCpuRunning(false);
          setHwCpuHalted(true);
          break;
        }
      }
      syncHwCpuToNodes();
    }, intervalMs);

    return () => {
      if (hwRunIntervalRef.current !== null) {
        clearInterval(hwRunIntervalRef.current);
        hwRunIntervalRef.current = null;
      }
    };
  }, [hwCpuRunning, hwRunSpeed, hwClockFreq, syncHwCpuToNodes]);

  const hasSelection = nodes.some((n) => n.selected);

  return (
    <div className="h-screen w-full flex flex-col bg-slate-950 text-slate-200 font-sans">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 h-14 flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
            <Cpu size={20} className="text-white" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-white">
            Logique &amp; Systèmes
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {hasSelection && (
            <button
              onClick={groupSelectedNodes}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-colors bg-purple-500/20 text-purple-400 border border-purple-500/50 hover:bg-purple-500/30"
              title="Grouper la sélection (Ctrl+G)"
            >
              <Package size={16} /> Grouper
            </button>
          )}
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${isRunning ? "bg-green-500/20 text-green-400 border border-green-500/50" : "bg-slate-800 text-slate-400 border border-slate-700"}`}
          >
            {isRunning ? (
              <>
                <Play size={16} /> En cours
              </>
            ) : (
              <>
                <Square size={16} /> En pause
              </>
            )}
          </button>
          <button
            onClick={clearCanvas}
            className="text-slate-400 hover:text-red-400 transition-colors"
            title="Tout effacer"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div className="bg-slate-900 border-b border-slate-800 flex px-6 shrink-0 z-10">
        <button
          onClick={() => setActiveTab("hardware")}
          className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 ${
            activeTab === "hardware"
              ? "border-blue-500 text-white"
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          Matériel
        </button>
        <button
          onClick={() => setActiveTab("software")}
          className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 ${
            activeTab === "software"
              ? "border-blue-500 text-white"
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          Logiciel
        </button>
        <button
          onClick={() => setActiveTab("userguide-en")}
          className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 ${
            activeTab === "userguide-en"
              ? "border-blue-500 text-white"
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          Guide EN
        </button>
        <button
          onClick={() => setActiveTab("userguide-fr")}
          className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 ${
            activeTab === "userguide-fr"
              ? "border-blue-500 text-white"
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          Guide FR
        </button>
      </div>

      {/* Main Workspace */}
      {activeTab === "software" ? (
        <SoftwareView
          onHardwareSync={handleHardwareSync}
          onProgramLoaded={handleProgramLoaded}
        />
      ) : activeTab === "userguide-en" ? (
        <EmbeddedMarkdownDocument
          markdown={USER_GUIDE_EN_MARKDOWN}
          title="User Guide (English)"
          subtitle="Bundled directly into the application so the guide ships inside the same build as the simulator."
        />
      ) : activeTab === "userguide-fr" ? (
        <EmbeddedMarkdownDocument
          markdown={USER_GUIDE_FR_MARKDOWN}
          title="Guide Utilisateur (Français)"
          subtitle="Inclus directement dans l’application pour que la documentation fasse partie du build, au même titre que le simulateur."
        />
      ) : (
        <div className="flex-1 flex relative">
          {inspecting && (
            <MiniSim
              type={inspecting}
              onClose={() => setInspecting(null)}
              mainNodes={nodes}
            />
          )}

          <HardwareSidebar
            scenesOpen={scenesOpen}
            allScenes={allScenes}
            savedModules={savedModules}
            onToggleScenes={() => setScenesOpen((open) => !open)}
            onLoadScene={loadScene}
            onDeleteScene={(sceneId) =>
              setSavedScenes((prev) =>
                prev.filter((scene) => scene.id !== sceneId),
              )
            }
            onSaveScene={saveCurrentScene}
            onAddNode={addNode}
            onInstantiateModule={instantiateModule}
            onDeleteModule={(moduleId) =>
              setSavedModules((prev) =>
                prev.filter((module) => module.id !== moduleId),
              )
            }
          />

          {/* Canvas + HW CPU controls */}
          <div className="flex-1 flex flex-col h-full bg-slate-950">
            <HardwareCpuControls
              hwCpuLoaded={hwCpuLoaded}
              hwCpuRunning={hwCpuRunning}
              hwCpuHalted={hwCpuHalted}
              hwRunSpeed={hwRunSpeed}
              hwClockFreq={hwClockFreq}
              onStep={hwStep}
              onRun={hwRun}
              onStop={hwStop}
              onReset={hwReset}
              onRunSpeedChange={setHwRunSpeed}
            />

            <div className="flex-1">
              <ReactFlow
                nodes={nodesWithHandlers}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
                className="bg-slate-950"
                colorMode="dark"
              >
                <Background color="#334155" gap={20} size={1} />
                <Controls className="bg-slate-800 border-slate-700 fill-slate-300" />
              </ReactFlow>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
