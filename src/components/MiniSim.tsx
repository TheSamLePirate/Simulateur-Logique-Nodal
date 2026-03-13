import { useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Node,
} from "@xyflow/react";
import { Plus, MemoryStick, Package, X } from "lucide-react";
import { nodeTypes } from "./nodes";
import { adderNodes, adderEdges, sramNodes, sramEdges } from "../data/circuits";
import { simulateNodes, updateEdgeStyles } from "../logic/simulation";
import type { GroupNodeData } from "../types";

export const MiniSim = ({
  type,
  onClose,
  mainNodes,
}: {
  type: string;
  onClose: () => void;
  mainNodes?: Node[];
}) => {
  // Determine initial nodes/edges based on type
  const { initNodes, initEdges, headerIcon, headerText, footerText } =
    useMemo(() => {
      if (type === "adder8") {
        return {
          initNodes: adderNodes,
          initEdges: adderEdges,
          headerIcon: "adder" as const,
          headerText: "Circuit Interne : Full Adder (1-bit)",
          footerText:
            "Un additionneur 8-bit est composé de 8 blocs comme celui-ci (Full Adder) chaînés ensemble. La retenue sortante (Cout) de l'un est connectée à la retenue entrante (Cin) du suivant.",
        };
      }
      if (type === "sram8") {
        return {
          initNodes: sramNodes,
          initEdges: sramEdges,
          headerIcon: "sram" as const,
          headerText: "Circuit Interne : Cellule SRAM (D-Latch 1-bit)",
          footerText:
            "Une mémoire SRAM 256x8 contient 2048 cellules comme celle-ci (D-Latch), organisées en grille. Un décodeur d'adresse active le signal WE (Write Enable) uniquement pour les 8 cellules correspondant à l'adresse sélectionnée.",
        };
      }
      if (type.startsWith("group:") && mainNodes) {
        const groupId = type.replace("group:", "");
        const groupNode = mainNodes.find(
          (n) => n.id === groupId && n.type === "group",
        );
        if (groupNode) {
          const groupData = groupNode.data as unknown as GroupNodeData;
          return {
            initNodes: groupData.circuit.nodes,
            initEdges: groupData.circuit.edges,
            headerIcon: "group" as const,
            headerText: `Circuit Interne : ${groupData.label}`,
            footerText:
              "Ce module personnalisé contient un circuit interne simulé. Les noeuds Input/Output définissent les ports du module.",
          };
        }
      }
      return {
        initNodes: [] as Node[],
        initEdges: [],
        headerIcon: "group" as const,
        headerText: "Circuit Interne",
        footerText: "",
      };
    }, [type, mainNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);

  // Bind onChange to input nodes
  useEffect(() => {
    const handleNodeChange = (id: string, val: number) => {
      setNodes((nds: Node[]) =>
        nds.map((n: Node) =>
          n.id === id ? { ...n, data: { ...n.data, value: val } } : n,
        ),
      );
    };
    setNodes((nds: Node[]) =>
      nds.map((n: Node) =>
        n.type === "input" || n.type === "inputNumber"
          ? { ...n, data: { ...n.data, onChange: handleNodeChange } }
          : n,
      ),
    );
  }, [setNodes]);

  // Simulation loop using the shared simulation engine
  useEffect(() => {
    const simulate = () => {
      setNodes((nds: Node[]) => simulateNodes(nds, edges));
      setEdges((eds) => updateEdgeStyles(nodes, eds));
    };

    const interval = setInterval(simulate, 50);
    return () => clearInterval(interval);
  }, [nodes, edges, setNodes, setEdges]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-8">
      <div className="bg-slate-900 w-full h-full max-w-6xl max-h-[800px] rounded-xl border border-slate-700 flex flex-col overflow-hidden shadow-2xl relative">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            {headerIcon === "adder" && (
              <Plus size={20} className="text-blue-400" />
            )}
            {headerIcon === "sram" && (
              <MemoryStick size={20} className="text-amber-400" />
            )}
            {headerIcon === "group" && (
              <Package size={20} className="text-purple-400" />
            )}
            {headerText}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        <div className="flex-1 relative bg-slate-950">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background color="#334155" gap={16} />
            <Controls className="bg-slate-800 border-slate-700 fill-white" />
          </ReactFlow>
        </div>
        {footerText && (
          <div className="p-4 bg-slate-800 border-t border-slate-700 text-sm text-slate-300">
            {footerText}
          </div>
        )}
      </div>
    </div>
  );
};
