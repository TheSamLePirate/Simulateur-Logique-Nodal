import { useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import { Plus, MemoryStick, X } from "lucide-react";
import { logicGates } from "../logic/gates";
import { nodeTypes } from "./nodes";
import { adderNodes, adderEdges, sramNodes, sramEdges } from "../data/circuits";

export const MiniSim = ({
  type,
  onClose,
}: {
  type: string;
  onClose: () => void;
}) => {
  const initNodes = type === "adder8" ? adderNodes : sramNodes;
  const initEdges = type === "adder8" ? adderEdges : sramEdges;

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);

  // Bind onChange to inputs
  useEffect(() => {
    const handleNodeChange = (id: string, val: number) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, value: val } } : n,
        ),
      );
    };
    setNodes((nds) =>
      nds.map((n) =>
        n.type === "input"
          ? { ...n, data: { ...n.data, onChange: handleNodeChange } }
          : n,
      ),
    );
  }, [setNodes]);

  useEffect(() => {
    const simulate = () => {
      let changed = false;
      const newNodes = [...nodes];

      const getInputValue = (
        targetId: string,
        targetHandle: string,
      ): number => {
        const edge = edges.find(
          (e) => e.target === targetId && e.targetHandle === targetHandle,
        );
        if (!edge) return 0;
        const sourceNode = newNodes.find((n) => n.id === edge.source);
        if (!sourceNode) return 0;
        return (sourceNode.data.value as number) || 0;
      };

      newNodes.forEach((node, index) => {
        if (node.type === "output") {
          const val = getInputValue(node.id, "in");
          if (node.data.value !== val) {
            newNodes[index] = { ...node, data: { ...node.data, value: val } };
            changed = true;
          }
        } else if (node.type === "gate") {
          const gateType = node.data.type as keyof typeof logicGates;
          let val: 0 | 1 = 0;
          if (gateType === "NOT") {
            val = logicGates.NOT(getInputValue(node.id, "in") as 0 | 1);
          } else {
            val = logicGates[gateType](
              getInputValue(node.id, "a") as 0 | 1,
              getInputValue(node.id, "b") as 0 | 1,
            );
          }
          if (node.data.value !== val) {
            newNodes[index] = { ...node, data: { ...node.data, value: val } };
            changed = true;
          }
        }
      });

      if (changed) setNodes(newNodes);

      setEdges((eds) =>
        eds.map((edge) => {
          const sourceNode = newNodes.find((n) => n.id === edge.source);
          const isActive = sourceNode?.data.value === 1;
          const strokeColor = isActive ? "#60a5fa" : "#475569";
          if (
            edge.animated !== isActive ||
            edge.style?.stroke !== strokeColor
          ) {
            return {
              ...edge,
              animated: isActive,
              style: {
                ...edge.style,
                stroke: strokeColor,
                strokeWidth: isActive ? 3 : 2,
              },
            };
          }
          return edge;
        }),
      );
    };

    const interval = setInterval(simulate, 50);
    return () => clearInterval(interval);
  }, [nodes, edges, setNodes, setEdges]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-8">
      <div className="bg-slate-900 w-full h-full max-w-6xl max-h-[800px] rounded-xl border border-slate-700 flex flex-col overflow-hidden shadow-2xl relative">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            {type === "adder8" ? (
              <>
                <Plus size={20} className="text-blue-400" /> Circuit Interne :
                Full Adder (1-bit)
              </>
            ) : (
              <>
                <MemoryStick size={20} className="text-amber-400" /> Circuit
                Interne : Cellule SRAM (D-Latch 1-bit)
              </>
            )}
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
        <div className="p-4 bg-slate-800 border-t border-slate-700 text-sm text-slate-300">
          {type === "adder8"
            ? "Un additionneur 8-bit est composé de 8 blocs comme celui-ci (Full Adder) chaînés ensemble. La retenue sortante (Cout) de l'un est connectée à la retenue entrante (Cin) du suivant."
            : "Une mémoire SRAM 256x8 contient 2048 cellules comme celle-ci (D-Latch), organisées en grille. Un décodeur d'adresse active le signal WE (Write Enable) uniquement pour les 8 cellules correspondant à l'adresse sélectionnée."}
        </div>
      </div>
    </div>
  );
};
