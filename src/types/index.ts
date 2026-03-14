import type { Node, Edge } from "@xyflow/react";

export type Bit = 0 | 1;

export type GateType = "AND" | "OR" | "XOR" | "NAND" | "NOR" | "NOT";

/** Describes one handle exposed on the outside of a group node */
export interface GroupHandle {
  /** Unique handle ID on the group node, e.g. "grp_in_0" */
  handleId: string;
  /** 'source' for outputs, 'target' for inputs */
  type: "source" | "target";
  /** Display label (from the internal I/O node's label) */
  label: string;
  /** ID of the internal I/O node this handle maps to */
  internalNodeId: string;
  /** Handle on the internal node (e.g. "out", "out0", "in", "in3") */
  internalHandleId: string;
}

/** The internal circuit stored inside a group node */
export interface GroupCircuit {
  nodes: Node[];
  edges: Edge[];
}

/** Data shape stored on a group node (node.data) */
export interface GroupNodeData {
  label: string;
  circuit: GroupCircuit;
  inputHandles: GroupHandle[];
  outputHandles: GroupHandle[];
  /** Current output values keyed by handleId */
  outputs: Record<string, Bit>;
  /** Info needed to restore original nodes when ungrouping */
  ungroupInfo: {
    nodeOffsets: Record<string, { x: number; y: number }>;
    groupPosition: { x: number; y: number };
    /** Boundary edges that were rewired when grouping (to restore on ungroup) */
    rewiredEdges: {
      edgeId: string;
      original: {
        source?: string;
        sourceHandle?: string;
        target?: string;
        targetHandle?: string;
      };
    }[];
    /** IDs of proxy nodes injected during grouping */
    proxyNodeIds: string[];
    /** IDs of proxy edges injected during grouping */
    proxyEdgeIds: string[];
  };
}

/** A saved module template that can be re-instantiated */
export interface SavedModule {
  id: string;
  label: string;
  circuit: GroupCircuit;
  inputHandles: GroupHandle[];
  outputHandles: GroupHandle[];
}

/** A saved scene preset (entire canvas state) */
export interface ScenePreset {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  builtIn?: boolean;
}

/** Active tab in the main UI */
export type ActiveTab = "hardware" | "software";
