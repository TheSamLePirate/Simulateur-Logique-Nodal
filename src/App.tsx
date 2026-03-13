import { useState, useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  Node,
  Edge,
  Connection,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { v4 as uuidv4 } from "uuid";
import { Cpu, MemoryStick, Play, Square, Circle, Trash2 } from "lucide-react";

import type { Bit } from "./types";
import { nodeTypes } from "./components/nodes";
import { MiniSim } from "./components/MiniSim";
import { initialNodes, initialEdges } from "./data/initialScene";
import { simulateNodes, updateEdgeStyles } from "./logic/simulation";

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isRunning, setIsRunning] = useState(true);
  const [inspecting, setInspecting] = useState<string | null>(null);

  // Listen for inspect-node events from Adder8 / SRAM nodes
  useEffect(() => {
    const handleInspect = (e: any) => setInspecting(e.detail);
    window.addEventListener("inspect-node", handleInspect);
    return () => window.removeEventListener("inspect-node", handleInspect);
  }, []);

  // --- Simulation loop (20Hz) ---
  useEffect(() => {
    if (!isRunning) return;

    const simulate = () => {
      setNodes((nds) => simulateNodes(nds, edges));
      setEdges((eds) => updateEdgeStyles(nodes, eds));
    };

    const interval = setInterval(simulate, 50);
    return () => clearInterval(interval);
  }, [edges, nodes, isRunning, setNodes, setEdges]);

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

  const addNode = (type: string, specificType?: string) => {
    const id = uuidv4();
    const position = {
      x: Math.random() * 200 + 100,
      y: Math.random() * 200 + 100,
    };

    let newNode: Node;

    switch (type) {
      case "input":
        newNode = {
          id,
          type,
          position,
          data: { label: `IN_${id.slice(0, 4)}`, value: 0 },
        };
        break;
      case "output":
        newNode = {
          id,
          type,
          position,
          data: { label: `OUT_${id.slice(0, 4)}`, value: 0 },
        };
        break;
      case "gate":
        newNode = {
          id,
          type,
          position,
          data: { type: specificType, value: 0 },
        };
        break;
      case "adder8":
        newNode = {
          id,
          type,
          position,
          data: { sum: Array(8).fill(0), cout: 0 },
        };
        break;
      case "sram8":
        newNode = {
          id,
          type,
          position,
          data: {
            memory: Array(256).fill(0),
            q: Array(8).fill(0),
            currentAddress: 0,
          },
        };
        break;
      case "bus8":
        newNode = {
          id,
          type,
          position,
          data: { val: Array(8).fill(0) },
        };
        break;
      case "inputNumber":
        newNode = {
          id,
          type,
          position,
          data: { label: "NUM_IN", value: 0 },
        };
        break;
      case "outputNumber":
        newNode = {
          id,
          type,
          position,
          data: { label: "NUM_OUT", value: 0 },
        };
        break;
      default:
        return;
    }

    setNodes((nds) => [...nds, newNode]);
  };

  const clearCanvas = () => {
    setNodes([]);
    setEdges([]);
  };

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

      {/* Main Workspace */}
      <div className="flex-1 flex relative">
        {inspecting && (
          <MiniSim type={inspecting} onClose={() => setInspecting(null)} />
        )}

        {/* Sidebar / Toolbar */}
        <div className="w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col gap-6 overflow-y-auto z-10">
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              I/O Simples
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => addNode("input")}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded p-2 text-sm flex flex-col items-center gap-1 transition-colors"
              >
                <Square size={16} className="text-blue-400" /> Switch
              </button>
              <button
                onClick={() => addNode("output")}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded p-2 text-sm flex flex-col items-center gap-1 transition-colors"
              >
                <Circle size={16} className="text-green-400" /> LED
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              I/O 8-bit
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => addNode("inputNumber")}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded p-2 text-sm flex flex-col items-center gap-1 transition-colors"
              >
                <span className="font-mono text-blue-400 font-bold text-lg leading-none">
                  123
                </span>
                <span className="text-[10px]">Num In</span>
              </button>
              <button
                onClick={() => addNode("outputNumber")}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded p-2 text-sm flex flex-col items-center gap-1 transition-colors"
              >
                <span className="font-mono text-green-400 font-bold text-lg leading-none">
                  123
                </span>
                <span className="text-[10px]">Num Out</span>
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Portes Logiques
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {["AND", "OR", "XOR", "NAND", "NOR", "NOT"].map((gate) => (
                <button
                  key={gate}
                  onClick={() => addNode("gate", gate)}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded p-2 text-sm font-mono font-bold transition-colors"
                >
                  {gate}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Modules Complexes
            </h3>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => addNode("adder8")}
                className="bg-slate-800 hover:bg-slate-700 border border-blue-900/50 rounded p-3 text-sm flex items-center gap-3 transition-colors"
              >
                <Cpu size={18} className="text-blue-400" />
                <span className="font-bold">Additionneur 8-bit</span>
              </button>
              <button
                onClick={() => addNode("sram8")}
                className="bg-slate-800 hover:bg-slate-700 border border-amber-900/50 rounded p-3 text-sm flex items-center gap-3 transition-colors"
              >
                <MemoryStick size={18} className="text-amber-400" />
                <span className="font-bold">SRAM 8-bit</span>
              </button>
              <button
                onClick={() => addNode("bus8")}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-500/50 rounded p-3 text-sm flex items-center gap-3 transition-colors"
              >
                <div className="flex flex-col gap-[2px]">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="w-4 h-[2px] bg-slate-400"></div>
                  ))}
                </div>
                <span className="font-bold">Bus 8-bit</span>
              </button>
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-slate-800">
            <p className="text-xs text-slate-500 leading-relaxed">
              Glissez pour connecter les points. Cliquez sur un fil puis appuyez
              sur Retour Arrière pour le supprimer.
            </p>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 h-full bg-slate-950">
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
  );
}
