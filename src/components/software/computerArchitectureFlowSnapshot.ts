import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

import type { Edge, Node } from "@xyflow/react";

import type { ArchitectureNodeData, SignalEdgeData } from "./computerArchitectureFlowGraph";
import {
  assertComputerArchitectureGraphIntegrity,
  getComputerArchitectureFlowBounds,
  renderComputerArchitectureFlowSvg,
} from "./computerArchitectureFlowSvg";

export interface ComputerArchitectureFlowArtifact {
  name: string;
  jsonPath: string;
  imagePath: string;
  pngPath: string;
  width: number;
  height: number;
  nodeCount: number;
  edgeCount: number;
  activeEdgeCount: number;
}

function runCommand(command: string, args: string[]) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function convertSvgToPng(svgPath: string, pngPath: string) {
  const converters: Array<{ command: string; args: string[] }> = [
    { command: "rsvg-convert", args: [svgPath, "-o", pngPath] },
    { command: "magick", args: [svgPath, pngPath] },
  ];

  for (const converter of converters) {
    const result = runCommand(converter.command, converter.args);
    if (result.status === 0) return;
    if (result.error && "code" in result.error && result.error.code === "ENOENT") {
      continue;
    }
  }

  throw new Error("Unable to convert architecture SVG to PNG: no working SVG rasterizer found");
}

export function writeComputerArchitectureFlowArtifacts(options: {
  reportDir: string;
  name: string;
  nodes: Array<Node<ArchitectureNodeData>>;
  edges: Array<Edge<SignalEdgeData>>;
  metadata?: Record<string, unknown>;
}): ComputerArchitectureFlowArtifact {
  const { reportDir, name, nodes, edges, metadata = {} } = options;
  const jsonPath = join(reportDir, `${name}.json`);
  const imagePath = join(reportDir, `${name}.svg`);
  const pngDir = join(reportDir, "png");
  const pngPath = join(pngDir, `${name}.png`);
  const activeEdgeCount = edges.filter((edge) => edge.data?.active).length;
  const { width, height } = getComputerArchitectureFlowBounds(nodes);

  assertComputerArchitectureGraphIntegrity(nodes, edges);

  mkdirSync(reportDir, { recursive: true });
  mkdirSync(pngDir, { recursive: true });
  const svgMarkup = renderComputerArchitectureFlowSvg(nodes, edges);
  writeFileSync(imagePath, svgMarkup);
  convertSvgToPng(imagePath, pngPath);
  writeFileSync(
    jsonPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        name,
        nodeCount: nodes.length,
        edgeCount: edges.length,
        activeEdgeCount,
        imagePath: relative(process.cwd(), imagePath),
        pngPath: relative(process.cwd(), pngPath),
        ...metadata,
        nodes,
        edges,
      },
      null,
      2,
    )}\n`,
  );

  return {
    name,
    jsonPath: relative(process.cwd(), jsonPath),
    imagePath: relative(process.cwd(), imagePath),
    pngPath: relative(process.cwd(), pngPath),
    width,
    height,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    activeEdgeCount,
  };
}
