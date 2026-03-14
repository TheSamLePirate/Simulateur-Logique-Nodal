import { useState, useCallback, useEffect, useMemo, useRef } from "react";
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
import {
  Cpu,
  MemoryStick,
  Play,
  Square,
  Circle,
  Trash2,
  Package,
  Clock,
  Database,
  Calculator,
  GitFork,
  Terminal,
  Grid3X3,
  SkipForward,
  RotateCcw,
  Gauge,
} from "lucide-react";

import type {
  Bit,
  GroupHandle,
  GroupNodeData,
  SavedModule,
  ActiveTab,
} from "./types";
import { nodeTypes } from "./components/nodes";
import { MiniSim } from "./components/MiniSim";
import { initialNodes, initialEdges } from "./data/initialScene";
import { simulateNodes, updateEdgeStyles } from "./logic/simulation";
import { PREBUILT_MODULES } from "./data/prebuiltModules";
import {
  SoftwareView,
  type HardwareSyncData,
} from "./components/software/SoftwareView";
import { CPU } from "./cpu/cpu";
import { Opcode } from "./cpu/isa";

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isRunning, setIsRunning] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("hardware");
  const [inspecting, setInspecting] = useState<string | null>(null);

  // ── Hardware CPU for running programs on the hardware view ──
  const hwCpuRef = useRef(new CPU());
  const [hwCpuLoaded, setHwCpuLoaded] = useState(false);
  const [hwCpuRunning, setHwCpuRunning] = useState(false);
  const [hwCpuHalted, setHwCpuHalted] = useState(false);
  const [hwRunSpeed, setHwRunSpeed] = useState(10);
  const hwRunIntervalRef = useRef<number | null>(null);

  // Load saved modules from localStorage
  const [savedModules, setSavedModules] = useState<SavedModule[]>(() => {
    try {
      const stored = localStorage.getItem("logique_saved_modules");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Persist saved modules to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(
        "logique_saved_modules",
        JSON.stringify(savedModules),
      );
    } catch {
      // Storage full or unavailable, ignore
    }
  }, [savedModules]);

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
  }, [nodes]);

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

  // =============================================
  //  GROUPING – handles boundary edges properly
  // =============================================
  const groupSelectedNodes = useCallback(() => {
    const selectedNodes = nodes.filter((n) => n.selected);
    if (selectedNodes.length < 2) return;

    const selectedIds = new Set(selectedNodes.map((n) => n.id));

    // Classify edges
    const internalEdges: Edge[] = [];
    const incomingBoundary: Edge[] = []; // outside → inside
    const outgoingBoundary: Edge[] = []; // inside → outside
    for (const e of edges) {
      const srcIn = selectedIds.has(e.source);
      const tgtIn = selectedIds.has(e.target);
      if (srcIn && tgtIn) internalEdges.push(e);
      else if (!srcIn && tgtIn) incomingBoundary.push(e);
      else if (srcIn && !tgtIn) outgoingBoundary.push(e);
    }

    // Compute bounding box of selected nodes for proxy node placement
    const minX = Math.min(...selectedNodes.map((n) => n.position.x));
    const maxX = Math.max(...selectedNodes.map((n) => n.position.x));
    const minY = Math.min(...selectedNodes.map((n) => n.position.y));

    // ---- Build input handles ----
    const inputHandles: GroupHandle[] = [];
    const proxyNodes: Node[] = [];
    const proxyEdges: Edge[] = [];
    const proxyNodeIds: string[] = [];
    const proxyEdgeIds: string[] = [];
    const edgeRewrites: {
      edgeId: string;
      original: {
        source?: string;
        sourceHandle?: string;
        target?: string;
        targetHandle?: string;
      };
      newTarget?: string;
      newTargetHandle?: string;
      newSource?: string;
      newSourceHandle?: string;
    }[] = [];

    let inputIdx = 0;
    // Deduplicate by (targetNodeId, targetHandle)
    const incomingMap = new Map<string, Edge[]>();
    for (const e of incomingBoundary) {
      const key = `${e.target}::${e.targetHandle || "default"}`;
      if (!incomingMap.has(key)) incomingMap.set(key, []);
      incomingMap.get(key)!.push(e);
    }

    for (const [, edgesForHandle] of incomingMap) {
      const rep = edgesForHandle[0];
      const handleId = `grp_in_${inputIdx}`;
      const proxyId = `__proxy_in_${inputIdx}`;
      const proxyEdgeId = `__proxy_edge_in_${inputIdx}`;
      inputIdx++;

      // Find internal target node to get a label
      const targetNode = selectedNodes.find((n) => n.id === rep.target);
      const label =
        (targetNode?.data.label as string) ||
        `${targetNode?.type || "?"}.${rep.targetHandle || "in"}`;

      // Create proxy Input node (positioned to the left)
      proxyNodes.push({
        id: proxyId,
        type: "input",
        position: { x: minX - 200, y: minY + inputIdx * 60 },
        data: { label, value: 0 },
      });
      proxyNodeIds.push(proxyId);

      // Create internal edge from proxy → internal target
      proxyEdges.push({
        id: proxyEdgeId,
        source: proxyId,
        sourceHandle: "out",
        target: rep.target,
        targetHandle: rep.targetHandle || undefined,
        animated: false,
        style: { stroke: "#475569", strokeWidth: 2 },
      });
      proxyEdgeIds.push(proxyEdgeId);

      // Group handle maps to the proxy node
      inputHandles.push({
        handleId,
        type: "target",
        label,
        internalNodeId: proxyId,
        internalHandleId: "out",
      });

      // Record rewrites for all edges sharing this target
      for (const e of edgesForHandle) {
        edgeRewrites.push({
          edgeId: e.id,
          original: { target: e.target, targetHandle: e.targetHandle },
          newTargetHandle: handleId,
        });
      }
    }

    // ---- Build output handles from boundary edges ----
    const outputHandles: GroupHandle[] = [];
    let outputIdx = 0;
    // Deduplicate by (sourceNodeId, sourceHandle)
    const outgoingMap = new Map<string, Edge[]>();
    for (const e of outgoingBoundary) {
      const key = `${e.source}::${e.sourceHandle || "default"}`;
      if (!outgoingMap.has(key)) outgoingMap.set(key, []);
      outgoingMap.get(key)!.push(e);
    }

    for (const [, edgesForHandle] of outgoingMap) {
      const rep = edgesForHandle[0];
      const handleId = `grp_out_${outputIdx}`;
      const proxyId = `__proxy_out_${outputIdx}`;
      const proxyEdgeId = `__proxy_edge_out_${outputIdx}`;
      outputIdx++;

      // Find internal source node to get a label
      const sourceNode = selectedNodes.find((n) => n.id === rep.source);
      const label =
        (sourceNode?.data.label as string) ||
        `${sourceNode?.type || "?"}.${rep.sourceHandle || "out"}`;

      // Create proxy Output node (positioned to the right)
      proxyNodes.push({
        id: proxyId,
        type: "output",
        position: { x: maxX + 200, y: minY + outputIdx * 60 },
        data: { label, value: 0 },
      });
      proxyNodeIds.push(proxyId);

      // Create internal edge from internal source → proxy
      proxyEdges.push({
        id: proxyEdgeId,
        source: rep.source,
        sourceHandle: rep.sourceHandle || undefined,
        target: proxyId,
        targetHandle: "in",
        animated: false,
        style: { stroke: "#475569", strokeWidth: 2 },
      });
      proxyEdgeIds.push(proxyEdgeId);

      // Group handle maps to the proxy node
      outputHandles.push({
        handleId,
        type: "source",
        label,
        internalNodeId: proxyId,
        internalHandleId: "in",
      });

      // Record rewrites
      for (const e of edgesForHandle) {
        edgeRewrites.push({
          edgeId: e.id,
          original: { source: e.source, sourceHandle: e.sourceHandle },
          newSourceHandle: handleId,
        });
      }
    }

    // ---- Also detect internal Input/Output nodes as ports ----
    // These are I/O nodes inside the selection that define the group interface
    // (even when they have no boundary edges crossing them)
    const nodesAlreadyProxiedAsInput = new Set(
      incomingBoundary.map((e) => e.target),
    );
    const nodesAlreadyProxiedAsOutput = new Set(
      outgoingBoundary.map((e) => e.source),
    );

    for (const iNode of selectedNodes) {
      if (iNode.type === "input" && !nodesAlreadyProxiedAsInput.has(iNode.id)) {
        inputHandles.push({
          handleId: `grp_in_${inputIdx++}`,
          type: "target",
          label: (iNode.data.label as string) || "IN",
          internalNodeId: iNode.id,
          internalHandleId: "out",
        });
      } else if (
        iNode.type === "inputNumber" &&
        !nodesAlreadyProxiedAsInput.has(iNode.id)
      ) {
        for (let bit = 0; bit < 8; bit++) {
          inputHandles.push({
            handleId: `grp_in_${inputIdx++}`,
            type: "target",
            label: `${(iNode.data.label as string) || "NUM"}[${bit}]`,
            internalNodeId: iNode.id,
            internalHandleId: `out${bit}`,
          });
        }
      } else if (
        iNode.type === "output" &&
        !nodesAlreadyProxiedAsOutput.has(iNode.id)
      ) {
        outputHandles.push({
          handleId: `grp_out_${outputIdx++}`,
          type: "source",
          label: (iNode.data.label as string) || "OUT",
          internalNodeId: iNode.id,
          internalHandleId: "in",
        });
      } else if (
        iNode.type === "outputNumber" &&
        !nodesAlreadyProxiedAsOutput.has(iNode.id)
      ) {
        for (let bit = 0; bit < 8; bit++) {
          outputHandles.push({
            handleId: `grp_out_${outputIdx++}`,
            type: "source",
            label: `${(iNode.data.label as string) || "NUM"}[${bit}]`,
            internalNodeId: iNode.id,
            internalHandleId: `in${bit}`,
          });
        }
      }
    }

    // ---- Compute center position ----
    const avgX =
      selectedNodes.reduce((s, n) => s + n.position.x, 0) /
      selectedNodes.length;
    const avgY =
      selectedNodes.reduce((s, n) => s + n.position.y, 0) /
      selectedNodes.length;

    // Save offsets for ungrouping
    const nodeOffsets: Record<string, { x: number; y: number }> = {};
    for (const n of selectedNodes) {
      nodeOffsets[n.id] = {
        x: n.position.x - avgX,
        y: n.position.y - avgY,
      };
    }

    // Build internal circuit (original selected nodes + proxy nodes, internal edges + proxy edges)
    const circuitNodes = [
      ...selectedNodes.map((n) => ({
        ...n,
        selected: false,
        data: { ...n.data },
      })),
      ...proxyNodes,
    ];
    const circuitEdges = [
      ...internalEdges.map((e) => ({ ...e })),
      ...proxyEdges,
    ];

    const groupId = uuidv4();

    // Ask user for a module name
    const moduleName =
      prompt("Nom du module :", `Module_${groupId.slice(0, 4)}`) ||
      `Module_${groupId.slice(0, 4)}`;

    const groupNode: Node = {
      id: groupId,
      type: "group",
      position: { x: avgX, y: avgY },
      data: {
        label: moduleName,
        circuit: { nodes: circuitNodes, edges: circuitEdges },
        inputHandles,
        outputHandles,
        outputs: Object.fromEntries(
          outputHandles.map((h) => [h.handleId, 0 as Bit]),
        ),
        ungroupInfo: {
          nodeOffsets,
          groupPosition: { x: avgX, y: avgY },
          rewiredEdges: edgeRewrites.map((r) => ({
            edgeId: r.edgeId,
            original: r.original,
          })),
          proxyNodeIds,
          proxyEdgeIds,
        },
      },
    };

    // Apply: remove selected nodes, add group node, rewire boundary edges
    setNodes((nds) => [
      ...nds.filter((n) => !selectedIds.has(n.id)),
      groupNode,
    ]);

    setEdges((eds) => {
      // Remove internal edges (both endpoints in selection)
      const remaining = eds.filter(
        (e) => !(selectedIds.has(e.source) && selectedIds.has(e.target)),
      );

      // Rewire boundary edges
      return remaining.map((e) => {
        const rewrite = edgeRewrites.find((r) => r.edgeId === e.id);
        if (!rewrite) return e;

        const updated = { ...e };
        if (rewrite.newTargetHandle !== undefined) {
          updated.target = groupId;
          updated.targetHandle = rewrite.newTargetHandle;
        }
        if (rewrite.newSourceHandle !== undefined) {
          updated.source = groupId;
          updated.sourceHandle = rewrite.newSourceHandle;
        }
        return updated;
      });
    });
  }, [nodes, edges, setNodes, setEdges]);

  // =============================================
  //  UNGROUPING – restores original nodes & edges
  // =============================================
  const ungroupNodes = useCallback(
    (groupNodeId: string) => {
      const groupNode = nodes.find(
        (n) => n.id === groupNodeId && n.type === "group",
      );
      if (!groupNode) return;

      const groupData = groupNode.data as unknown as GroupNodeData;
      const { circuit, ungroupInfo } = groupData;
      const { nodeOffsets, proxyNodeIds, proxyEdgeIds, rewiredEdges } =
        ungroupInfo;

      const proxyNodeSet = new Set(proxyNodeIds || []);
      const proxyEdgeSet = new Set(proxyEdgeIds || []);

      // Restore internal nodes (excluding proxy nodes), at positions relative to group
      const restoredNodes = circuit.nodes
        .filter((n) => !proxyNodeSet.has(n.id))
        .map((n) => ({
          ...n,
          position: {
            x: groupNode.position.x + (nodeOffsets[n.id]?.x || 0),
            y: groupNode.position.y + (nodeOffsets[n.id]?.y || 0),
          },
          selected: false,
        }));

      // Restore internal edges (excluding proxy edges)
      const restoredEdges = circuit.edges.filter(
        (e) => !proxyEdgeSet.has(e.id),
      );

      setNodes((nds) => [
        ...nds.filter((n) => n.id !== groupNodeId),
        ...restoredNodes,
      ]);

      setEdges((eds) => {
        // Remove edges connected to the group node
        const withoutGroup = eds.filter(
          (e) => e.source !== groupNodeId && e.target !== groupNodeId,
        );

        // Restore rewired boundary edges to their original endpoints
        const restored = withoutGroup.map((e) => {
          const rw = (rewiredEdges || []).find((r) => r.edgeId === e.id);
          if (!rw) return e;
          return { ...e, ...rw.original };
        });

        return [...restored, ...restoredEdges];
      });
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

  // =============================================
  //  INSTANTIATE SAVED MODULE
  // =============================================
  const instantiateModule = useCallback(
    (mod: SavedModule) => {
      // Remap all internal node & edge IDs so each instance is unique
      const idMap = new Map<string, string>();
      const remapId = (oldId: string) => {
        if (!idMap.has(oldId)) idMap.set(oldId, uuidv4());
        return idMap.get(oldId)!;
      };

      const newCircuitNodes = mod.circuit.nodes.map((n) => ({
        ...n,
        id: remapId(n.id),
        data: { ...n.data },
      }));
      const newCircuitEdges = mod.circuit.edges.map((e) => ({
        ...e,
        id: uuidv4(),
        source: remapId(e.source),
        target: remapId(e.target),
      }));

      const newInputHandles = mod.inputHandles.map((h, i) => ({
        ...h,
        handleId: `grp_in_${i}`,
        internalNodeId: remapId(h.internalNodeId),
      }));
      const newOutputHandles = mod.outputHandles.map((h, i) => ({
        ...h,
        handleId: `grp_out_${i}`,
        internalNodeId: remapId(h.internalNodeId),
      }));

      const groupId = uuidv4();
      const nodeOffsets: Record<string, { x: number; y: number }> = {};
      for (const n of newCircuitNodes) {
        nodeOffsets[n.id] = { x: 0, y: 0 };
      }

      const groupNode: Node = {
        id: groupId,
        type: "group",
        position: {
          x: Math.random() * 200 + 100,
          y: Math.random() * 200 + 100,
        },
        data: {
          label: mod.label,
          circuit: { nodes: newCircuitNodes, edges: newCircuitEdges },
          inputHandles: newInputHandles,
          outputHandles: newOutputHandles,
          outputs: Object.fromEntries(
            newOutputHandles.map((h) => [h.handleId, 0 as Bit]),
          ),
          ungroupInfo: {
            nodeOffsets,
            groupPosition: { x: 0, y: 0 },
            rewiredEdges: [],
            proxyNodeIds: [],
            proxyEdgeIds: [],
          },
        },
      };

      setNodes((nds) => [...nds, groupNode]);
    },
    [setNodes],
  );

  // =============================================
  //  ADD NODE
  // =============================================
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
      case "clock":
        newNode = {
          id,
          type,
          position,
          data: {
            label: "CLK",
            value: 0 as Bit,
            frequency: 1,
            tickCounter: 0,
          },
        };
        break;
      case "register8":
        newNode = {
          id,
          type,
          position,
          data: {
            label: "REG",
            value: 0,
            q: Array(8).fill(0),
            prevClk: 0 as Bit,
          },
        };
        break;
      case "alu8":
        newNode = {
          id,
          type,
          position,
          data: {
            a: 0,
            b: 0,
            result: 0,
            r: Array(8).fill(0),
            zero: 0 as Bit,
            carry: 0 as Bit,
            negative: 0 as Bit,
            opName: "ADD",
          },
        };
        break;
      case "mux8":
        newNode = {
          id,
          type,
          position,
          data: {
            label: "MUX",
            sel: 0 as Bit,
            outVal: 0,
            out: Array(8).fill(0),
          },
        };
        break;
      case "console":
        newNode = {
          id,
          type,
          position,
          data: {
            label: "CONSOLE",
            text: "",
            lastChar: 0,
            prevWr: 0 as Bit,
          },
        };
        break;
      case "plotter":
        newNode = {
          id,
          type,
          position,
          data: {
            label: "PLOTTER",
            pixels: [],
            prevDraw: 0 as Bit,
          },
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

  // =============================================
  //  SOFTWARE → HARDWARE SYNC
  // =============================================
  const handleHardwareSync = useCallback(
    (data: HardwareSyncData) => {
      const toBits = (val: number, bits = 8) =>
        Array.from({ length: bits }, (_, i) => (val & (1 << i) ? 1 : 0));

      setNodes((nds) =>
        nds.map((node) => {
          switch (node.id) {
            case "pc":
              return {
                ...node,
                data: { ...node.data, value: data.pc, q: toBits(data.pc) },
              };
            case "ir":
              return {
                ...node,
                data: {
                  ...node.data,
                  value: data.memory[data.pc] || 0,
                  q: toBits(data.memory[data.pc] || 0),
                },
              };
            case "aReg":
              return {
                ...node,
                data: { ...node.data, value: data.a, q: toBits(data.a) },
              };
            case "bReg":
              return {
                ...node,
                data: { ...node.data, value: data.b, q: toBits(data.b) },
              };
            case "sp":
              return {
                ...node,
                data: { ...node.data, value: data.sp, q: toBits(data.sp) },
              };
            case "sram":
              return {
                ...node,
                data: {
                  ...node.data,
                  memory: Array.from(data.memory),
                },
              };
            case "flagZ":
              return {
                ...node,
                data: { ...node.data, value: data.flags.z ? 1 : 0 },
              };
            case "flagC":
              return {
                ...node,
                data: { ...node.data, value: data.flags.c ? 1 : 0 },
              };
            case "flagN":
              return {
                ...node,
                data: { ...node.data, value: data.flags.n ? 1 : 0 },
              };
            case "console":
              return {
                ...node,
                data: { ...node.data, text: data.consoleText },
              };
            case "plotter":
              return {
                ...node,
                data: { ...node.data, pixels: data.plotterPixels },
              };
            default:
              return node;
          }
        }),
      );
    },
    [setNodes],
  );

  // =============================================
  //  HARDWARE CPU – program load & execution
  // =============================================
  const syncHwCpuToNodes = useCallback(() => {
    const cpu = hwCpuRef.current;
    const s = cpu.state;
    const op = cpu.lastOpcode;
    const toBits = (val: number, bits = 8) =>
      Array.from({ length: bits }, (_, i) => (val & (1 << i) ? 1 : 0));

    // ── Derive control signals from last executed opcode ──
    const aLoad = [
      Opcode.LDA,
      Opcode.ADD,
      Opcode.SUB,
      Opcode.AND,
      Opcode.OR,
      Opcode.XOR,
      Opcode.INC,
      Opcode.DEC,
      Opcode.NOT,
      Opcode.SHL,
      Opcode.SHR,
      Opcode.TBA,
      Opcode.ADDB,
      Opcode.SUBB,
      Opcode.POP,
      Opcode.LDM,
    ].includes(op)
      ? 1
      : 0;

    const bLoad = [Opcode.LDB, Opcode.TAB, Opcode.LBM].includes(op) ? 1 : 0;
    const spLoad = [Opcode.PUSH, Opcode.POP, Opcode.CALL, Opcode.RET].includes(
      op,
    )
      ? 1
      : 0;
    const memWE = [Opcode.STA, Opcode.STB].includes(op) ? 1 : 0;
    const addrSel = [Opcode.STA, Opcode.STB, Opcode.LDM, Opcode.LBM].includes(
      op,
    )
      ? 1
      : 0;
    const dataSel = [Opcode.LDM, Opcode.LBM].includes(op) ? 1 : 0;
    const conWr = [Opcode.OUTA, Opcode.OUTD, Opcode.OUT].includes(op) ? 1 : 0;
    const conMode = op === Opcode.OUTD ? 1 : 0;
    const plotDraw = op === Opcode.DRAW ? 1 : 0;
    const plotClr = op === Opcode.CLR ? 1 : 0;

    // ALU op bits (3-bit encoding matching ALU8 simulation)
    let aluOp = 0b000; // ADD
    if ([Opcode.SUB, Opcode.SUBB, Opcode.CMP, Opcode.DEC].includes(op))
      aluOp = 0b001;
    else if (op === Opcode.AND) aluOp = 0b010;
    else if (op === Opcode.OR) aluOp = 0b011;
    else if (op === Opcode.XOR) aluOp = 0b100;
    else if (op === Opcode.NOT) aluOp = 0b101;
    else if (op === Opcode.SHL) aluOp = 0b110;
    else if (op === Opcode.SHR) aluOp = 0b111;

    setNodes((nds) =>
      nds.map((node) => {
        switch (node.id) {
          // ── Registers (values from CPU state) ──
          case "pc":
            return {
              ...node,
              data: { ...node.data, value: s.pc, q: toBits(s.pc) },
            };
          case "ir":
            return {
              ...node,
              data: {
                ...node.data,
                value: s.memory[s.pc] || 0,
                q: toBits(s.memory[s.pc] || 0),
              },
            };
          case "aReg":
            return {
              ...node,
              data: { ...node.data, value: s.a, q: toBits(s.a) },
            };
          case "bReg":
            return {
              ...node,
              data: { ...node.data, value: s.b, q: toBits(s.b) },
            };
          case "sp":
            return {
              ...node,
              data: { ...node.data, value: s.sp, q: toBits(s.sp) },
            };

          // ── Memory ──
          case "sram":
            return {
              ...node,
              data: { ...node.data, memory: Array.from(s.memory) },
            };

          // ── Flags ──
          case "flagZ":
            return {
              ...node,
              data: { ...node.data, value: s.flags.z ? 1 : 0 },
            };
          case "flagC":
            return {
              ...node,
              data: { ...node.data, value: s.flags.c ? 1 : 0 },
            };
          case "flagN":
            return {
              ...node,
              data: { ...node.data, value: s.flags.n ? 1 : 0 },
            };

          // ── I/O peripherals ──
          case "console":
            return {
              ...node,
              data: { ...node.data, text: cpu.consoleOutput.join("") },
            };
          case "plotter":
            return {
              ...node,
              data: { ...node.data, pixels: Array.from(cpu.plotterPixels) },
            };

          // ── Clock (toggles each CPU step) ──
          case "clk":
            return { ...node, data: { ...node.data, value: cpu.clockBit } };

          // ── Register load enables ──
          case "pcLoad":
            return { ...node, data: { ...node.data, value: 1 } };
          case "irLoad":
            return { ...node, data: { ...node.data, value: 1 } };
          case "aLoad":
            return { ...node, data: { ...node.data, value: aLoad } };
          case "bLoad":
            return { ...node, data: { ...node.data, value: bLoad } };
          case "spLoad":
            return { ...node, data: { ...node.data, value: spLoad } };

          // ── MUX selects ──
          case "addrSel":
            return { ...node, data: { ...node.data, value: addrSel } };
          case "dataSel":
            return { ...node, data: { ...node.data, value: dataSel } };

          // ── Memory write enable ──
          case "memWE":
            return { ...node, data: { ...node.data, value: memWE } };

          // ── ALU operation select ──
          case "op0":
            return { ...node, data: { ...node.data, value: (aluOp >> 0) & 1 } };
          case "op1":
            return { ...node, data: { ...node.data, value: (aluOp >> 1) & 1 } };
          case "op2":
            return { ...node, data: { ...node.data, value: (aluOp >> 2) & 1 } };

          // ── Console control ──
          case "consoleWr":
            return { ...node, data: { ...node.data, value: conWr } };
          case "consoleMode":
            return { ...node, data: { ...node.data, value: conMode } };
          case "consoleClear":
            return { ...node, data: { ...node.data, value: 0 } };

          // ── Plotter control ──
          case "plotDraw":
            return { ...node, data: { ...node.data, value: plotDraw } };
          case "plotClear":
            return { ...node, data: { ...node.data, value: plotClr } };

          // ── Operand address (for memory access instructions) ──
          case "operand":
            return {
              ...node,
              data: { ...node.data, value: cpu.lastOperand & 0xff },
            };

          // ── Reset ──
          case "rst":
            return { ...node, data: { ...node.data, value: 0 } };

          // ── Display outputs (updated via bus8 edges from registers) ──
          default:
            return node;
        }
      }),
    );
  }, [setNodes]);

  const handleProgramLoaded = useCallback(
    (bytes: number[]) => {
      const cpu = hwCpuRef.current;
      cpu.reset();
      cpu.loadProgram(bytes);
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
  }, [syncHwCpuToNodes]);

  // Hardware CPU run loop
  useEffect(() => {
    if (!hwCpuRunning) {
      if (hwRunIntervalRef.current !== null) {
        clearInterval(hwRunIntervalRef.current);
        hwRunIntervalRef.current = null;
      }
      return;
    }

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
    }, 50);

    return () => {
      if (hwRunIntervalRef.current !== null) {
        clearInterval(hwRunIntervalRef.current);
        hwRunIntervalRef.current = null;
      }
    };
  }, [hwCpuRunning, hwRunSpeed, syncHwCpuToNodes]);

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
      </div>

      {/* Main Workspace */}
      {activeTab === "software" ? (
        <SoftwareView
          onHardwareSync={handleHardwareSync}
          onProgramLoaded={handleProgramLoaded}
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
                Modules Intégrés
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

            {/* CPU building blocks */}
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                Composants CPU
              </h3>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => addNode("clock")}
                  className="bg-slate-800 hover:bg-slate-700 border border-green-900/50 rounded p-3 text-sm flex items-center gap-3 transition-colors"
                >
                  <Clock size={18} className="text-green-400" />
                  <span className="font-bold">Horloge</span>
                </button>
                <button
                  onClick={() => addNode("register8")}
                  className="bg-slate-800 hover:bg-slate-700 border border-cyan-900/50 rounded p-3 text-sm flex items-center gap-3 transition-colors"
                >
                  <Database size={18} className="text-cyan-400" />
                  <span className="font-bold">Registre 8-bit</span>
                </button>
                <button
                  onClick={() => addNode("alu8")}
                  className="bg-slate-800 hover:bg-slate-700 border border-orange-900/50 rounded p-3 text-sm flex items-center gap-3 transition-colors"
                >
                  <Calculator size={18} className="text-orange-400" />
                  <span className="font-bold">ALU 8-bit</span>
                </button>
                <button
                  onClick={() => addNode("mux8")}
                  className="bg-slate-800 hover:bg-slate-700 border border-indigo-900/50 rounded p-3 text-sm flex items-center gap-3 transition-colors"
                >
                  <GitFork size={18} className="text-indigo-400" />
                  <span className="font-bold">MUX 8-bit</span>
                </button>
                <button
                  onClick={() => addNode("console")}
                  className="bg-slate-800 hover:bg-slate-700 border border-emerald-900/50 rounded p-3 text-sm flex items-center gap-3 transition-colors"
                >
                  <Terminal size={18} className="text-emerald-400" />
                  <span className="font-bold">Console</span>
                </button>
                <button
                  onClick={() => addNode("plotter")}
                  className="bg-slate-800 hover:bg-slate-700 border border-cyan-900/50 rounded p-3 text-sm flex items-center gap-3 transition-colors"
                >
                  <Grid3X3 size={18} className="text-cyan-400" />
                  <span className="font-bold">Plotter</span>
                </button>
              </div>
            </div>

            {/* Pre-built group modules (from gates) */}
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                Modules Logiques
              </h3>
              <div className="flex flex-col gap-2">
                {PREBUILT_MODULES.map((mod) => (
                  <button
                    key={mod.id}
                    onClick={() => instantiateModule(mod)}
                    className="bg-slate-800 hover:bg-slate-700 border border-purple-900/50 rounded p-3 text-sm flex items-center gap-3 transition-colors"
                    title={`Ajouter un ${mod.label}`}
                  >
                    <Package size={16} className="text-purple-400" />
                    <span className="font-bold text-left truncate">
                      {mod.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* User-saved custom modules */}
            {savedModules.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Mes Modules
                </h3>
                <div className="flex flex-col gap-2">
                  {savedModules.map((mod) => (
                    <div
                      key={mod.id}
                      className="bg-slate-800 hover:bg-slate-700 border border-purple-900/50 rounded p-3 text-sm flex items-center gap-2 transition-colors group"
                    >
                      <Package size={16} className="text-purple-400 shrink-0" />
                      <button
                        onClick={() => instantiateModule(mod)}
                        className="font-bold truncate text-left flex-1"
                        title={`Ajouter un ${mod.label}`}
                      >
                        {mod.label}
                      </button>
                      <button
                        onClick={() =>
                          setSavedModules((prev) =>
                            prev.filter((m) => m.id !== mod.id),
                          )
                        }
                        className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                        title="Supprimer ce module"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-auto pt-4 border-t border-slate-800">
              <p className="text-xs text-slate-500 leading-relaxed">
                Glissez pour connecter les points. Cliquez sur un fil puis
                appuyez sur Retour Arrière pour le supprimer. Sélectionnez des
                noeuds et appuyez sur Ctrl+G pour grouper.
              </p>
            </div>
          </div>

          {/* Canvas + HW CPU controls */}
          <div className="flex-1 flex flex-col h-full bg-slate-950">
            {/* Hardware CPU control bar */}
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-b border-slate-800 shrink-0">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-2">
                CPU
              </span>

              <button
                onClick={hwStep}
                disabled={!hwCpuLoaded || hwCpuRunning || hwCpuHalted}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold transition-colors bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <SkipForward size={14} /> Step
              </button>

              {hwCpuRunning ? (
                <button
                  onClick={hwStop}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold transition-colors bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30"
                >
                  <Square size={14} /> Stop
                </button>
              ) : (
                <button
                  onClick={hwRun}
                  disabled={!hwCpuLoaded || hwCpuHalted}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold transition-colors bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Play size={14} /> Run
                </button>
              )}

              <button
                onClick={hwReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold transition-colors bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
              >
                <RotateCcw size={14} /> Reset
              </button>

              <div className="w-px h-6 bg-slate-700 mx-1" />

              <div className="flex items-center gap-2">
                <Gauge size={14} className="text-slate-500" />
                <input
                  type="range"
                  min={1}
                  max={100000}
                  value={hwRunSpeed}
                  onChange={(e) => setHwRunSpeed(parseInt(e.target.value))}
                  className="w-20 accent-blue-500"
                />
                <span className="text-[10px] text-slate-500 font-mono w-16">
                  {hwRunSpeed} i/tick
                </span>
              </div>

              {/* Status */}
              <div className="ml-auto flex items-center gap-2">
                {!hwCpuLoaded && (
                  <span className="text-xs text-slate-500">
                    Assemblez un programme dans l'onglet Logiciel
                  </span>
                )}
                {hwCpuHalted && (
                  <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/30">
                    HALTED
                  </span>
                )}
                {hwCpuRunning && (
                  <span className="text-xs font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/30 animate-pulse">
                    RUNNING
                  </span>
                )}
                {hwCpuLoaded && !hwCpuRunning && !hwCpuHalted && (
                  <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/30">
                    READY
                  </span>
                )}
              </div>
            </div>

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
