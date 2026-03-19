import type { Edge, Node } from "@xyflow/react";

import {
  FLOW_NODE_BASE_TOP,
  FLOW_NODE_HANDLE_Y_OFFSET,
  FLOW_NODE_ROW_GAP,
  FLOW_NODE_WIDTH,
  getArchitectureNodeHeight,
  getArchitectureNodePinsTop,
  type ArchitectureNodeData,
  type SignalEdgeData,
} from "./computerArchitectureFlowGraph";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function toneFill(tone: ArchitectureNodeData["tone"]) {
  switch (tone) {
    case "cpu":
      return { fill: "#0f2740", border: "#22d3ee", accent: "#67e8f9" };
    case "memory":
      return { fill: "#112c24", border: "#34d399", accent: "#86efac" };
    case "bus":
      return { fill: "#36260d", border: "#f59e0b", accent: "#fcd34d" };
    case "alu":
      return { fill: "#32103e", border: "#d946ef", accent: "#f0abfc" };
    default:
      return { fill: "#11263d", border: "#38bdf8", accent: "#93c5fd" };
  }
}

function getNodePin(
  node: Node<ArchitectureNodeData>,
  handleId: string,
) {
  const leftPins = node.data.leftPins ?? [];
  const rightPins = node.data.rightPins ?? [];
  const leftIndex = leftPins.findIndex((pin) => pin.id === handleId);
  if (leftIndex >= 0) {
    return {
      side: "left" as const,
      index: leftIndex,
    };
  }
  const rightIndex = rightPins.findIndex((pin) => pin.id === handleId);
  if (rightIndex >= 0) {
    return {
      side: "right" as const,
      index: rightIndex,
    };
  }
  throw new Error(`Missing handle ${handleId} on node ${node.id}`);
}

function getHandlePoint(
  node: Node<ArchitectureNodeData>,
  handleId: string,
) {
  const match = getNodePin(node, handleId);
  return {
    x: node.position.x + (match.side === "right" ? FLOW_NODE_WIDTH : 0),
    y: node.position.y + getArchitectureNodePinsTop(node.data) + match.index * FLOW_NODE_ROW_GAP + FLOW_NODE_HANDLE_Y_OFFSET,
  };
}

function buildEdgePath(
  source: { x: number; y: number },
  target: { x: number; y: number },
) {
  const deltaX = target.x - source.x;
  const curve = Math.max(90, Math.abs(deltaX) * 0.35);
  const direction = deltaX >= 0 ? 1 : -1;
  const c1x = source.x + curve * direction;
  const c2x = target.x - curve * direction;
  return `M ${source.x} ${source.y} C ${c1x} ${source.y} ${c2x} ${target.y} ${target.x} ${target.y}`;
}

function renderConsolePreview(node: Node<ArchitectureNodeData>) {
  const preview = node.data.consolePreview;
  if (!preview) return "";

  const x = node.position.x + 16;
  const y = node.position.y + FLOW_NODE_BASE_TOP;
  const width = FLOW_NODE_WIDTH - 32;
  const height = 112;

  return `
    <g transform="translate(${x}, ${y})">
      <rect width="${width}" height="${height}" rx="14" fill="#020617" stroke="#1e293b" />
      <rect x="0" y="0" width="${width}" height="22" rx="14" fill="#0f172a" />
      <circle cx="16" cy="11" r="3" fill="#fb7185" />
      <circle cx="28" cy="11" r="3" fill="#f59e0b" />
      <circle cx="40" cy="11" r="3" fill="#22c55e" />
      <text x="${width - 10}" y="15" fill="#64748b" font-size="9" font-family="system-ui" text-anchor="end">console preview</text>
      ${preview.lines.map((line, index) => `
        <text x="12" y="${40 + index * 12}" fill="#dbeafe" font-size="10" font-family="monospace">${escapeXml(line || " ")}</text>
      `).join("")}
    </g>
  `;
}

function renderPlotterPreview(node: Node<ArchitectureNodeData>) {
  const preview = node.data.plotterPreview;
  if (!preview) return "";

  const size = 196;
  const x = node.position.x + (FLOW_NODE_WIDTH - size) / 2;
  const y = node.position.y + FLOW_NODE_BASE_TOP;
  const cellWidth = size / preview.width;
  const cellHeight = size / preview.height;

  return `
    <g transform="translate(${x}, ${y})">
      <rect width="${size}" height="${size}" rx="18" fill="#020617" stroke="#1e293b" />
      <rect x="8" y="8" width="${size - 16}" height="${size - 16}" rx="10" fill="#02030a" stroke="#0f172a" />
      <g transform="translate(8, 8)">
        ${preview.pixels.map((pixel) => `
          <rect x="${pixel.x * cellWidth}" y="${pixel.y * cellHeight}" width="${cellWidth + 0.2}" height="${cellHeight + 0.2}" fill="${pixel.color}" />
        `).join("")}
      </g>
      ${preview.pixels.length === 0
        ? `<text x="${size / 2}" y="${size / 2 + 4}" fill="#64748b" font-size="11" font-family="monospace" text-anchor="middle">NO PIXELS</text>`
        : ""}
    </g>
  `;
}

export function assertComputerArchitectureGraphIntegrity(
  nodes: Array<Node<ArchitectureNodeData>>,
  edges: Array<Edge<SignalEdgeData>>,
) {
  const handleRegistry = new Map<string, Set<string>>();
  for (const node of nodes) {
    handleRegistry.set(
      node.id,
      new Set([
        ...(node.data.leftPins ?? []).map((pin) => pin.id),
        ...(node.data.rightPins ?? []).map((pin) => pin.id),
      ]),
    );
  }

  for (const edge of edges) {
    if (!handleRegistry.get(edge.source)?.has(edge.sourceHandle ?? "")) {
      throw new Error(`Missing source handle ${edge.sourceHandle ?? "?"} for edge ${edge.id}`);
    }
    if (!handleRegistry.get(edge.target)?.has(edge.targetHandle ?? "")) {
      throw new Error(`Missing target handle ${edge.targetHandle ?? "?"} for edge ${edge.id}`);
    }
  }
}

export function getComputerArchitectureFlowBounds(
  nodes: Array<Node<ArchitectureNodeData>>,
) {
  const bounds = nodes.reduce(
    (acc, node) => {
      const height = getArchitectureNodeHeight(node.data);
      return {
        maxX: Math.max(acc.maxX, node.position.x + FLOW_NODE_WIDTH),
        maxY: Math.max(acc.maxY, node.position.y + height),
      };
    },
    { maxX: 0, maxY: 0 },
  );
  return {
    width: bounds.maxX + 120,
    height: bounds.maxY + 120,
  };
}

export function renderComputerArchitectureFlowSvg(
  nodes: Array<Node<ArchitectureNodeData>>,
  edges: Array<Edge<SignalEdgeData>>,
) {
  const { width, height } = getComputerArchitectureFlowBounds(nodes);

  const edgeMarkup = edges.map((edge) => {
    const sourceNode = nodes.find((node) => node.id === edge.source);
    const targetNode = nodes.find((node) => node.id === edge.target);
    if (!sourceNode || !targetNode || !edge.sourceHandle || !edge.targetHandle) {
      throw new Error(`Edge ${edge.id} is not fully connected`);
    }
    const source = getHandlePoint(sourceNode, edge.sourceHandle);
    const target = getHandlePoint(targetNode, edge.targetHandle);
    const path = buildEdgePath(source, target);
    const labelX = (source.x + target.x) / 2;
    const labelY = (source.y + target.y) / 2;
    const color = edge.data?.color ?? "#64748b";
    const opacity = edge.data?.active ? (edge.data.pulseOn ? 1 : 0.76) : 0.34;
    const strokeWidth = edge.data?.active ? 4 : 2;
    const label = escapeXml(edge.data?.label ?? edge.id);
    const labelWidth = Math.max(72, label.length * 6.4 + 22);

    return `
      <path d="${path}" fill="none" stroke="${color}" stroke-width="${strokeWidth + 8}" stroke-linecap="round" opacity="${edge.data?.active ? 0.12 : 0}" />
      <path d="${path}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" opacity="${opacity}" />
      <g transform="translate(${labelX}, ${labelY})">
        <rect x="${-labelWidth / 2}" y="-12" width="${labelWidth}" height="24" rx="12" fill="#020617" stroke="#334155" />
        <text x="0" y="4" fill="#e2e8f0" font-family="monospace" font-size="10" text-anchor="middle">${label}</text>
      </g>
    `;
  }).join("");

  const nodeMarkup = nodes.map((node) => {
    const { fill, border, accent } = toneFill(node.data.tone);
    const heightPx = getArchitectureNodeHeight(node.data);
    const leftPins = node.data.leftPins ?? [];
    const rightPins = node.data.rightPins ?? [];

    const metrics = node.data.metrics.map((metric, index) => `
      <g transform="translate(${node.position.x + 16 + (index % 2) * 146}, ${node.position.y + 66 + Math.floor(index / 2) * 40})">
        <rect width="130" height="30" rx="10" fill="#020617" stroke="#1e293b" />
        <text x="10" y="12" fill="#64748b" font-size="9" font-family="system-ui">${escapeXml(metric.label)}</text>
        <text x="10" y="24" fill="#f8fafc" font-size="11" font-family="monospace">${escapeXml(metric.value)}</text>
      </g>
    `).join("");
    const previewMarkup = node.data.plotterPreview
      ? renderPlotterPreview(node)
      : renderConsolePreview(node);

    const renderPins = (pins: typeof leftPins, side: "left" | "right") =>
      pins.map((pin, index) => {
        const x = side === "left" ? node.position.x + 12 : node.position.x + 166;
        const y = node.position.y + getArchitectureNodePinsTop(node.data) + index * FLOW_NODE_ROW_GAP;
        const bg = pin.active ? (side === "left" ? "#083344" : "#052e16") : "#020617";
        const stroke = pin.active ? (side === "left" ? "#22d3ee" : "#4ade80") : "#1e293b";
        const handleX = side === "left" ? node.position.x : node.position.x + FLOW_NODE_WIDTH;
        const handleColor = side === "left" ? "#67e8f9" : "#86efac";

        return `
          <g transform="translate(${x}, ${y})">
            <rect width="142" height="24" rx="8" fill="${bg}" stroke="${stroke}" />
            <text x="8" y="10" fill="#e2e8f0" font-size="9" font-family="system-ui">${escapeXml(pin.label)}</text>
            <text x="8" y="20" fill="#cbd5e1" font-size="8" font-family="monospace">${escapeXml(pin.value)}</text>
          </g>
          <circle cx="${handleX}" cy="${y + FLOW_NODE_HANDLE_Y_OFFSET}" r="5" fill="${handleColor}" stroke="#020617" stroke-width="2" />
        `;
      }).join("");

    return `
      <g>
        <rect x="${node.position.x}" y="${node.position.y}" width="${FLOW_NODE_WIDTH}" height="${heightPx}" rx="24" fill="${fill}" stroke="${border}" stroke-width="2" />
        <text x="${node.position.x + 16}" y="${node.position.y + 26}" fill="${accent}" font-size="15" font-family="system-ui" font-weight="700">${escapeXml(node.data.title)}</text>
        <text x="${node.position.x + 16}" y="${node.position.y + 42}" fill="#94a3b8" font-size="11" font-family="system-ui">${escapeXml(node.data.subtitle)}</text>
        ${metrics}
        ${previewMarkup}
        ${renderPins(leftPins, "left")}
        ${renderPins(rightPins, "right")}
      </g>
    `;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)" />
  <g opacity="0.18">
    ${Array.from({ length: Math.floor(width / 40) }, (_, index) => `<line x1="${index * 40}" y1="0" x2="${index * 40}" y2="${height}" stroke="#1e293b" stroke-width="1" />`).join("")}
    ${Array.from({ length: Math.floor(height / 40) }, (_, index) => `<line x1="0" y1="${index * 40}" x2="${width}" y2="${index * 40}" stroke="#1e293b" stroke-width="1" />`).join("")}
  </g>
  ${edgeMarkup}
  ${nodeMarkup}
</svg>`;
}
