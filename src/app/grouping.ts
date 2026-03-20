import type { Edge, Node } from "@xyflow/react";

import type { Bit, GroupHandle, GroupNodeData } from "../types";

interface EdgeRewrite {
  edgeId: string;
  original: {
    source?: string;
    sourceHandle?: string;
    target?: string;
    targetHandle?: string;
  };
  newTargetHandle?: string;
  newSourceHandle?: string;
}

export interface GroupSelectionResult {
  groupNode: Node;
  selectedIds: Set<string>;
  edgeRewrites: EdgeRewrite[];
}

const defaultEdgeStyle = { stroke: "#475569", strokeWidth: 2 };

export const createGroupSelection = (
  nodes: Node[],
  edges: Edge[],
  groupId: string,
  moduleName: string,
): GroupSelectionResult | null => {
  const selectedNodes = nodes.filter((node) => node.selected);
  if (selectedNodes.length < 2) {
    return null;
  }

  const selectedIds = new Set(selectedNodes.map((node) => node.id));

  const internalEdges: Edge[] = [];
  const incomingBoundary: Edge[] = [];
  const outgoingBoundary: Edge[] = [];

  for (const edge of edges) {
    const srcIn = selectedIds.has(edge.source);
    const tgtIn = selectedIds.has(edge.target);
    if (srcIn && tgtIn) internalEdges.push(edge);
    else if (!srcIn && tgtIn) incomingBoundary.push(edge);
    else if (srcIn && !tgtIn) outgoingBoundary.push(edge);
  }

  const minX = Math.min(...selectedNodes.map((node) => node.position.x));
  const maxX = Math.max(...selectedNodes.map((node) => node.position.x));
  const minY = Math.min(...selectedNodes.map((node) => node.position.y));

  const inputHandles: GroupHandle[] = [];
  const proxyNodes: Node[] = [];
  const proxyEdges: Edge[] = [];
  const proxyNodeIds: string[] = [];
  const proxyEdgeIds: string[] = [];
  const edgeRewrites: EdgeRewrite[] = [];

  let inputIdx = 0;
  const incomingMap = new Map<string, Edge[]>();
  for (const edge of incomingBoundary) {
    const key = `${edge.target}::${edge.targetHandle || "default"}`;
    if (!incomingMap.has(key)) incomingMap.set(key, []);
    incomingMap.get(key)!.push(edge);
  }

  for (const [, edgesForHandle] of incomingMap) {
    const representative = edgesForHandle[0];
    const handleId = `grp_in_${inputIdx}`;
    const proxyId = `__proxy_in_${inputIdx}`;
    const proxyEdgeId = `__proxy_edge_in_${inputIdx}`;
    inputIdx++;

    const targetNode = selectedNodes.find(
      (node) => node.id === representative.target,
    );
    const label =
      (targetNode?.data.label as string) ||
      `${targetNode?.type || "?"}.${representative.targetHandle || "in"}`;

    proxyNodes.push({
      id: proxyId,
      type: "input",
      position: { x: minX - 200, y: minY + inputIdx * 60 },
      data: { label, value: 0 },
    });
    proxyNodeIds.push(proxyId);

    proxyEdges.push({
      id: proxyEdgeId,
      source: proxyId,
      sourceHandle: "out",
      target: representative.target,
      targetHandle: representative.targetHandle || undefined,
      animated: false,
      style: defaultEdgeStyle,
    });
    proxyEdgeIds.push(proxyEdgeId);

    inputHandles.push({
      handleId,
      type: "target",
      label,
      internalNodeId: proxyId,
      internalHandleId: "out",
    });

    for (const edge of edgesForHandle) {
      edgeRewrites.push({
        edgeId: edge.id,
        original: { target: edge.target, targetHandle: edge.targetHandle },
        newTargetHandle: handleId,
      });
    }
  }

  const outputHandles: GroupHandle[] = [];
  let outputIdx = 0;
  const outgoingMap = new Map<string, Edge[]>();
  for (const edge of outgoingBoundary) {
    const key = `${edge.source}::${edge.sourceHandle || "default"}`;
    if (!outgoingMap.has(key)) outgoingMap.set(key, []);
    outgoingMap.get(key)!.push(edge);
  }

  for (const [, edgesForHandle] of outgoingMap) {
    const representative = edgesForHandle[0];
    const handleId = `grp_out_${outputIdx}`;
    const proxyId = `__proxy_out_${outputIdx}`;
    const proxyEdgeId = `__proxy_edge_out_${outputIdx}`;
    outputIdx++;

    const sourceNode = selectedNodes.find(
      (node) => node.id === representative.source,
    );
    const label =
      (sourceNode?.data.label as string) ||
      `${sourceNode?.type || "?"}.${representative.sourceHandle || "out"}`;

    proxyNodes.push({
      id: proxyId,
      type: "output",
      position: { x: maxX + 200, y: minY + outputIdx * 60 },
      data: { label, value: 0 },
    });
    proxyNodeIds.push(proxyId);

    proxyEdges.push({
      id: proxyEdgeId,
      source: representative.source,
      sourceHandle: representative.sourceHandle || undefined,
      target: proxyId,
      targetHandle: "in",
      animated: false,
      style: defaultEdgeStyle,
    });
    proxyEdgeIds.push(proxyEdgeId);

    outputHandles.push({
      handleId,
      type: "source",
      label,
      internalNodeId: proxyId,
      internalHandleId: "in",
    });

    for (const edge of edgesForHandle) {
      edgeRewrites.push({
        edgeId: edge.id,
        original: { source: edge.source, sourceHandle: edge.sourceHandle },
        newSourceHandle: handleId,
      });
    }
  }

  const nodesAlreadyProxiedAsInput = new Set(incomingBoundary.map((edge) => edge.target));
  const nodesAlreadyProxiedAsOutput = new Set(outgoingBoundary.map((edge) => edge.source));

  for (const node of selectedNodes) {
    if (node.type === "input" && !nodesAlreadyProxiedAsInput.has(node.id)) {
      inputHandles.push({
        handleId: `grp_in_${inputIdx++}`,
        type: "target",
        label: (node.data.label as string) || "IN",
        internalNodeId: node.id,
        internalHandleId: "out",
      });
    } else if (
      node.type === "inputNumber" &&
      !nodesAlreadyProxiedAsInput.has(node.id)
    ) {
      for (let bit = 0; bit < 8; bit++) {
        inputHandles.push({
          handleId: `grp_in_${inputIdx++}`,
          type: "target",
          label: `${(node.data.label as string) || "NUM"}[${bit}]`,
          internalNodeId: node.id,
          internalHandleId: `out${bit}`,
        });
      }
    } else if (
      node.type === "output" &&
      !nodesAlreadyProxiedAsOutput.has(node.id)
    ) {
      outputHandles.push({
        handleId: `grp_out_${outputIdx++}`,
        type: "source",
        label: (node.data.label as string) || "OUT",
        internalNodeId: node.id,
        internalHandleId: "in",
      });
    } else if (
      node.type === "outputNumber" &&
      !nodesAlreadyProxiedAsOutput.has(node.id)
    ) {
      for (let bit = 0; bit < 8; bit++) {
        outputHandles.push({
          handleId: `grp_out_${outputIdx++}`,
          type: "source",
          label: `${(node.data.label as string) || "NUM"}[${bit}]`,
          internalNodeId: node.id,
          internalHandleId: `in${bit}`,
        });
      }
    }
  }

  const avgX =
    selectedNodes.reduce((sum, node) => sum + node.position.x, 0) /
    selectedNodes.length;
  const avgY =
    selectedNodes.reduce((sum, node) => sum + node.position.y, 0) /
    selectedNodes.length;

  const nodeOffsets: Record<string, { x: number; y: number }> = {};
  for (const node of selectedNodes) {
    nodeOffsets[node.id] = {
      x: node.position.x - avgX,
      y: node.position.y - avgY,
    };
  }

  const circuitNodes = [
    ...selectedNodes.map((node) => ({
      ...node,
      selected: false,
      data: { ...node.data },
    })),
    ...proxyNodes,
  ];
  const circuitEdges = [
    ...internalEdges.map((edge) => ({ ...edge })),
    ...proxyEdges,
  ];

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
        outputHandles.map((handle) => [handle.handleId, 0 as Bit]),
      ),
      ungroupInfo: {
        nodeOffsets,
        groupPosition: { x: avgX, y: avgY },
        rewiredEdges: edgeRewrites.map((rewrite) => ({
          edgeId: rewrite.edgeId,
          original: rewrite.original,
        })),
        proxyNodeIds,
        proxyEdgeIds,
      },
    } satisfies GroupNodeData,
  };

  return { groupNode, selectedIds, edgeRewrites };
};

export const applyGroupToNodes = (
  nodes: Node[],
  selectedIds: Set<string>,
  groupNode: Node,
) => [...nodes.filter((node) => !selectedIds.has(node.id)), groupNode];

export const applyGroupToEdges = (
  edges: Edge[],
  selectedIds: Set<string>,
  edgeRewrites: EdgeRewrite[],
  groupId: string,
) => {
  const remaining = edges.filter(
    (edge) => !(selectedIds.has(edge.source) && selectedIds.has(edge.target)),
  );

  return remaining.map((edge) => {
    const rewrite = edgeRewrites.find((candidate) => candidate.edgeId === edge.id);
    if (!rewrite) return edge;

    const updated = { ...edge };
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
};

export const restoreGroupContents = (groupNode: Node) => {
  const groupData = groupNode.data as unknown as GroupNodeData;
  const { circuit, ungroupInfo } = groupData;
  const { nodeOffsets, proxyNodeIds, proxyEdgeIds, rewiredEdges } = ungroupInfo;

  const proxyNodeSet = new Set(proxyNodeIds || []);
  const proxyEdgeSet = new Set(proxyEdgeIds || []);

  const restoredNodes = circuit.nodes
    .filter((node) => !proxyNodeSet.has(node.id))
    .map((node) => ({
      ...node,
      position: {
        x: groupNode.position.x + (nodeOffsets[node.id]?.x || 0),
        y: groupNode.position.y + (nodeOffsets[node.id]?.y || 0),
      },
      selected: false,
    }));

  const restoredEdges = circuit.edges.filter((edge) => !proxyEdgeSet.has(edge.id));

  return {
    restoredNodes,
    restoredEdges,
    rewiredEdges,
  };
};

export const applyUngroupToNodes = (
  nodes: Node[],
  groupNodeId: string,
  restoredNodes: Node[],
) => [...nodes.filter((node) => node.id !== groupNodeId), ...restoredNodes];

export const applyUngroupToEdges = (
  edges: Edge[],
  groupNodeId: string,
  rewiredEdges: GroupNodeData["ungroupInfo"]["rewiredEdges"],
  restoredEdges: Edge[],
) => {
  const withoutGroup = edges.filter(
    (edge) => edge.source !== groupNodeId && edge.target !== groupNodeId,
  );

  const restoredBoundaryEdges = withoutGroup.map((edge) => {
    const rewrite = (rewiredEdges || []).find(
      (candidate) => candidate.edgeId === edge.id,
    );
    if (!rewrite) return edge;
    return { ...edge, ...rewrite.original };
  });

  return [...restoredBoundaryEdges, ...restoredEdges];
};
