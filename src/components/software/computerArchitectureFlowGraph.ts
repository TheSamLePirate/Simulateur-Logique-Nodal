import { MarkerType, type Edge, type Node } from "@xyflow/react";

import { unpackPlotterColor, type PlotterPixels } from "../../plotter";
import type { ComputerPanelData } from "./computerPanelTypes";
import { hex } from "./computerPanelUtils";
import {
  buildComputerArchitectureModel,
  type ComputerArchitectureModel,
} from "./computerArchitectureModel";

export type ArchitectureTone = "cpu" | "memory" | "bus" | "io" | "alu";

export interface FlowMetric {
  label: string;
  value: string;
}

export interface FlowPin {
  id: string;
  label: string;
  value: string;
  active?: boolean;
  handleType: "source" | "target";
}

export interface ConsolePreviewData {
  lines: string[];
}

export interface PlotterPreviewPixel {
  x: number;
  y: number;
  color: string;
}

export interface PlotterPreviewData {
  width: number;
  height: number;
  pixels: PlotterPreviewPixel[];
}

export interface ArchitectureNodeData extends Record<string, unknown> {
  title: string;
  subtitle: string;
  tone: ArchitectureTone;
  icon:
    | "cpu"
    | "memory"
    | "bus"
    | "alu"
    | "console"
    | "keyboard"
    | "plotter"
    | "drive"
    | "network";
  metrics: FlowMetric[];
  leftPins?: FlowPin[];
  rightPins?: FlowPin[];
  consolePreview?: ConsolePreviewData;
  plotterPreview?: PlotterPreviewData;
}

export interface SignalEdgeData extends Record<string, unknown> {
  label: string;
  color: string;
  active: boolean;
  pulseOn: boolean;
}

export interface ComputerArchitectureFlowGraph {
  model: ComputerArchitectureModel;
  nodes: Array<Node<ArchitectureNodeData>>;
  edges: Array<Edge<SignalEdgeData>>;
}

export const FLOW_NODE_WIDTH = 320;
export const FLOW_NODE_BASE_TOP = 144;
export const FLOW_NODE_ROW_GAP = 28;
export const FLOW_NODE_FOOTER = 24;
export const FLOW_NODE_HANDLE_Y_OFFSET = 12;
export const FLOW_NODE_PREVIEW_GAP = 16;

function pin(
  id: string,
  label: string,
  value: string,
  handleType: "source" | "target",
  active = false,
): FlowPin {
  return { id, label, value, handleType, active };
}

function node(
  id: string,
  x: number,
  y: number,
  data: ArchitectureNodeData,
): Node<ArchitectureNodeData> {
  return {
    id,
    type: "architecture",
    position: { x, y },
    draggable: false,
    data,
  };
}

export function getArchitectureNodeHeight(data: ArchitectureNodeData) {
  const leftPins = data.leftPins ?? [];
  const rightPins = data.rightPins ?? [];
  const maxPins = Math.max(leftPins.length, rightPins.length, 1);
  return getArchitectureNodePinsTop(data) + maxPins * FLOW_NODE_ROW_GAP + FLOW_NODE_FOOTER;
}

export function getArchitectureNodePreviewHeight(data: ArchitectureNodeData) {
  if (data.plotterPreview) return 220;
  if (data.consolePreview) return 112;
  return 0;
}

export function getArchitectureNodePinsTop(data: ArchitectureNodeData) {
  const previewHeight = getArchitectureNodePreviewHeight(data);
  return FLOW_NODE_BASE_TOP + previewHeight + (previewHeight > 0 ? FLOW_NODE_PREVIEW_GAP : 0);
}

function signalEdge(
  id: string,
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle: string,
  label: string,
  color: string,
  active: boolean,
  pulseOn: boolean,
): Edge<SignalEdgeData> {
  return {
    id,
    type: "signal",
    source,
    sourceHandle,
    target,
    targetHandle,
    animated: active,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 18,
      height: 18,
      color,
    },
    data: {
      label,
      color,
      active,
      pulseOn,
    },
  };
}

function truncateConsoleLine(value: string, max = 36) {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

function buildConsolePreview(output: string): ConsolePreviewData {
  const normalized = output.replaceAll("\r", "");
  const lines = normalized.split("\n");
  const visibleLines = (normalized.endsWith("\n") ? [...lines, ""] : lines)
    .slice(-6)
    .map((line) => truncateConsoleLine(line || " "));

  return {
    lines: visibleLines.length > 0 ? visibleLines : ["idle"],
  };
}

function colorToHex(color: number) {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function buildPlotterPreview(plotterPixels: PlotterPixels): PlotterPreviewData {
  const width = 48;
  const height = 48;
  const previewPixels = new Map<string, PlotterPreviewPixel>();

  for (const [coord, packedColor] of plotterPixels) {
    const x = coord & 0xff;
    const y = (coord >> 8) & 0xff;
    const previewX = Math.floor((x * width) / 256);
    const previewY = Math.floor((y * height) / 256);
    const { r, g, b } = unpackPlotterColor(packedColor);
    previewPixels.set(`${previewX}:${previewY}`, {
      x: previewX,
      y: previewY,
      color: colorToHex((r << 16) | (g << 8) | b),
    });
  }

  return {
    width,
    height,
    pixels: Array.from(previewPixels.values()),
  };
}

export function buildComputerArchitectureFlowGraph(
  data: ComputerPanelData,
): ComputerArchitectureFlowGraph {
  const model = buildComputerArchitectureModel(data);
  const memoryBusActive = model.memory.readActive || model.memory.writeActive;
  const driveBusActive =
    model.drive.readActive || model.drive.writeActive || model.drive.clearActive;
  const networkRequestFlowActive =
    model.network.requestActive || model.network.pending || model.network.readActive;
  const networkResponseActive = model.network.pending || model.network.readActive;
  const plotterColorLabel = `${hex(model.plotter.colorR)}/${hex(model.plotter.colorG)}/${hex(model.plotter.colorB)}`;
  const keyboardSelection = `slot ${hex(data.state.a)}`;

  const nodes: Array<Node<ArchitectureNodeData>> = [
    node("console", 20, 40, {
      title: "Console Terminal",
      subtitle: "CPU writes chars and reads queued input",
      tone: "io",
      icon: "console",
      metrics: [
        { label: "OUTPUT", value: model.console.outputPreview },
        { label: "INPUT", value: model.console.inputPreview },
        { label: "LAST BYTE", value: model.console.latestChar },
        { label: "QUEUE", value: `${model.console.inputDepth} bytes` },
      ],
      consolePreview: buildConsolePreview(data.consoleOutput.join("")),
      leftPins: [
        pin("write-data", "WRITE BYTE", model.console.latestChar, "target", model.console.writeActive),
        pin("read-req", "READ STB", model.console.readActive ? "1" : "0", "target", model.console.readActive),
      ],
      rightPins: [
        pin("input-byte", "INPUT BYTE", model.console.inputPreview, "source", model.console.readActive),
      ],
    }),
    node("keyboard", 20, 420, {
      title: "Keyboard Matrix",
      subtitle: "selection index in A, state returns to CPU",
      tone: "io",
      icon: "keyboard",
      metrics: [
        { label: "ACTIVE", value: model.keyboard.activeKeys.join(", ") || "none" },
        { label: "SELECT", value: keyboardSelection },
        { label: "READ", value: model.keyboard.readActive ? "scan" : "idle" },
      ],
      leftPins: [
        pin("select", "SELECT", keyboardSelection, "target", model.keyboard.readActive),
        pin("read", "READ STB", model.keyboard.readActive ? "1" : "0", "target", model.keyboard.readActive),
      ],
      rightPins: [
        pin("state", "KEY STATE", model.keyboard.activeKeys.join(",") || "idle", "source", model.keyboard.readActive),
      ],
    }),
    node("cpu", 420, 120, {
      title: "CPU Core",
      subtitle: `${model.instruction.mnemonic} @ ${hex(data.state.pc, 4)} • cycles ${data.state.cycles}`,
      tone: "cpu",
      icon: "cpu",
      metrics: [
        { label: "A", value: hex(data.state.a) },
        { label: "B", value: hex(data.state.b) },
        { label: "PC", value: hex(data.state.pc, 4) },
        { label: "OPERAND", value: hex(model.instruction.operand, 4) },
        { label: "SP", value: hex(data.state.sp, 4) },
        { label: "PULSE", value: model.pulseOn ? "HIGH" : "LOW" },
      ],
      leftPins: [
        pin("mem-fetch", "FETCH BYTE", hex(model.memory.fetchByte), "target", true),
        pin("mem-read", "MEM DATA", hex(model.memory.operandData), "target", model.memory.readActive),
        pin("alu-out", "ALU RESULT", hex(model.alu.result), "target", true),
        pin("alu-flags", "FLAGS", `${model.alu.zero ? 1 : 0}/${model.alu.carry ? 1 : 0}/${model.alu.negative ? 1 : 0}`, "target", true),
        pin("con-in", "CONSOLE IN", model.console.inputPreview, "target", model.console.readActive),
        pin("key-in", "KEY STATE", model.keyboard.activeKeys.join(",") || "idle", "target", model.keyboard.readActive),
        pin("drv-in", "DRIVE IN", hex(model.drive.lastRead), "target", model.drive.readActive),
        pin("net-in", "NET IN", model.network.responsePreview, "target", networkResponseActive),
      ],
      rightPins: [
        pin("fetch-pc", "FETCH PC", hex(model.memory.fetchAddress, 4), "source", true),
        pin("mem-addr", "MEM ADDR", `${model.memory.operandAddressLabel} ${hex(model.memory.operandAddress, 4)}`, "source", memoryBusActive),
        pin("mem-data", "MEM WRITE", hex(model.memory.writeValue), "source", model.memory.writeActive),
        pin("mem-read-req", "MEM READ", model.memory.readActive ? "1" : "0", "source", model.memory.readActive),
        pin("mem-we", "MEM WRITE EN", model.memory.writeActive ? "1" : "0", "source", model.memory.writeActive),
        pin("alu-a", "ALU A", hex(model.alu.a), "source", true),
        pin("alu-b", "ALU B", hex(model.alu.b), "source", true),
        pin("alu-op", "ALU OP", model.alu.opName, "source", true),
        pin("con-out", "CONSOLE OUT", model.console.latestChar, "source", model.console.writeActive),
        pin("con-rd", "CONSOLE RD", model.console.readActive ? "1" : "0", "source", model.console.readActive),
        pin("key-sel", "KEY SLOT", keyboardSelection, "source", model.keyboard.readActive),
        pin("key-rd", "KEY READ", model.keyboard.readActive ? "1" : "0", "source", model.keyboard.readActive),
        pin("plot-x", "PLOT X", hex(model.plotter.x), "source", model.plotter.drawActive),
        pin("plot-y", "PLOT Y", hex(model.plotter.y), "source", model.plotter.drawActive),
        pin("plot-color", "PLOT RGB", plotterColorLabel, "source", model.plotter.colorActive || model.plotter.drawActive),
        pin("plot-draw", "PLOT DRAW", model.plotter.drawActive ? "1" : "0", "source", model.plotter.drawActive),
        pin("plot-clear", "PLOT CLR", model.plotter.clearActive ? "1" : "0", "source", model.plotter.clearActive),
        pin("drv-page", "DRIVE PAGE", hex(model.drive.page), "source", driveBusActive),
        pin("drv-addr", "DRIVE ADDR", hex(model.drive.address, 4), "source", driveBusActive),
        pin("drv-data", "DRIVE DATA", hex(model.drive.dataOut), "source", model.drive.writeActive),
        pin("drv-rd", "DRIVE RD", model.drive.readActive ? "1" : "0", "source", model.drive.readActive),
        pin("drv-wr", "DRIVE WR", model.drive.writeActive ? "1" : "0", "source", model.drive.writeActive),
        pin("drv-clr", "DRIVE CLR", model.drive.clearActive ? "1" : "0", "source", model.drive.clearActive),
        pin("net-addr", "HTTP PTR", `${model.network.requestAddressLabel} ${hex(model.network.requestAddress, 4)}`, "source", networkRequestFlowActive),
        pin("net-get", "HTTP GET", model.network.getActive ? "1" : "0", "source", model.network.getActive),
        pin("net-post", "HTTP POST", model.network.postActive ? "1" : "0", "source", model.network.postActive),
        pin("net-rd", "HTTP READ", model.network.readActive ? "1" : "0", "source", model.network.readActive),
      ],
    }),
    node("memory-bus", 850, 100, {
      title: "Memory Bus",
      subtitle: "fetch lane + operand lane + read/write strobes",
      tone: "bus",
      icon: "bus",
      metrics: [
        { label: "FETCH @", value: hex(model.memory.fetchAddress, 4) },
        { label: "OPERAND @", value: `${model.memory.operandAddressLabel} ${hex(model.memory.operandAddress, 4)}` },
        { label: "FETCH BYTE", value: hex(model.memory.fetchByte) },
        { label: "DATA BYTE", value: hex(model.memory.operandData) },
      ],
      leftPins: [
        pin("fetch-in", "FETCH ADDR", hex(model.memory.fetchAddress, 4), "target", true),
        pin("addr-in", "OPERAND ADDR", hex(model.memory.operandAddress, 4), "target", memoryBusActive),
        pin("data-in", "WRITE DATA", hex(model.memory.writeValue), "target", model.memory.writeActive),
        pin("read-in", "READ STB", model.memory.readActive ? "1" : "0", "target", model.memory.readActive),
        pin("we-in", "WRITE STB", model.memory.writeActive ? "1" : "0", "target", model.memory.writeActive),
        pin("fetch-data-in", "FETCH BYTE", hex(model.memory.fetchByte), "target", true),
        pin("read-data-in", "READ BYTE", hex(model.memory.operandData), "target", model.memory.readActive || model.network.requestActive),
      ],
      rightPins: [
        pin("fetch-addr-out", "FETCH ADDR", hex(model.memory.fetchAddress, 4), "source", true),
        pin("addr-out", "OPERAND ADDR", hex(model.memory.operandAddress, 4), "source", memoryBusActive),
        pin("data-out", "WRITE DATA", hex(model.memory.writeValue), "source", model.memory.writeActive),
        pin("read-out", "READ STB", model.memory.readActive ? "1" : "0", "source", model.memory.readActive || model.network.requestActive),
        pin("we-out", "WRITE STB", model.memory.writeActive ? "1" : "0", "source", model.memory.writeActive),
        pin("fetch-out", "FETCH -> CPU", hex(model.memory.fetchByte), "source", true),
        pin("operand-out", "DATA -> CPU", hex(model.memory.operandData), "source", model.memory.readActive),
        pin("cstring-out", "RAM -> URL/BODY", `${model.network.requestAddressLabel} ${hex(model.network.requestAddress, 4)}`, "source", model.network.requestActive),
      ],
    }),
    node("memory", 1280, 100, {
      title: "SRAM",
      subtitle: "program bytes, stack, userland strings, and data",
      tone: "memory",
      icon: "memory",
      metrics: [
        { label: "FETCH BYTE", value: hex(model.memory.fetchByte) },
        { label: "OPERAND BYTE", value: hex(model.memory.operandData) },
        { label: "READ", value: model.memory.readActive ? "active" : "idle" },
        { label: "WRITE", value: model.memory.writeActive ? hex(model.memory.writeValue) : "idle" },
      ],
      leftPins: [
        pin("fetch-addr", "FETCH ADDR", hex(model.memory.fetchAddress, 4), "target", true),
        pin("addr", "OPERAND ADDR", hex(model.memory.operandAddress, 4), "target", memoryBusActive),
        pin("read", "READ STB", model.memory.readActive ? "1" : "0", "target", model.memory.readActive || model.network.requestActive),
        pin("data", "WRITE DATA", hex(model.memory.writeValue), "target", model.memory.writeActive),
        pin("write", "WRITE STB", model.memory.writeActive ? "1" : "0", "target", model.memory.writeActive),
      ],
      rightPins: [
        pin("fetch", "FETCH BYTE", hex(model.memory.fetchByte), "source", true),
        pin("operand", "READ BYTE", hex(model.memory.operandData), "source", model.memory.readActive || model.network.requestActive),
      ],
    }),
    node("alu", 420, 980, {
      title: "ALU State",
      subtitle: model.alu.immediate ? "immediate operand in B lane" : "register-to-register lane",
      tone: "alu",
      icon: "alu",
      metrics: [
        { label: "OP", value: model.alu.opName },
        { label: "A", value: hex(model.alu.a) },
        { label: "B", value: hex(model.alu.b) },
        { label: "RESULT", value: hex(model.alu.result) },
        { label: "ZERO/CARRY/NEG", value: `${model.alu.zero ? 1 : 0}/${model.alu.carry ? 1 : 0}/${model.alu.negative ? 1 : 0}` },
      ],
      leftPins: [
        pin("a-in", "A IN", hex(model.alu.a), "target", true),
        pin("b-in", "B IN", hex(model.alu.b), "target", true),
        pin("op-in", "OP IN", model.alu.opName, "target", true),
      ],
      rightPins: [
        pin("result", "RESULT", hex(model.alu.result), "source", true),
        pin("flags", "FLAGS", `${model.alu.zero ? 1 : 0}/${model.alu.carry ? 1 : 0}/${model.alu.negative ? 1 : 0}`, "source", true),
      ],
    }),
    node("plotter-stage", 850, 620, {
      title: "Plotter Latches",
      subtitle: "A -> X, B -> Y, RGB registers, draw/clear strobes",
      tone: "bus",
      icon: "bus",
      metrics: [
        { label: "X", value: hex(model.plotter.x) },
        { label: "Y", value: hex(model.plotter.y) },
        { label: "RGB", value: plotterColorLabel },
        { label: "MODE", value: model.plotter.clearActive ? "clear" : model.plotter.drawActive ? "draw" : model.plotter.colorActive ? "color" : "idle" },
      ],
      leftPins: [
        pin("x-in", "X FROM CPU", hex(model.plotter.x), "target", model.plotter.drawActive),
        pin("y-in", "Y FROM CPU", hex(model.plotter.y), "target", model.plotter.drawActive),
        pin("rgb-in", "RGB LATCH", plotterColorLabel, "target", model.plotter.colorActive || model.plotter.drawActive),
        pin("draw-in", "DRAW STB", model.plotter.drawActive ? "1" : "0", "target", model.plotter.drawActive),
        pin("clear-in", "CLEAR STB", model.plotter.clearActive ? "1" : "0", "target", model.plotter.clearActive),
      ],
      rightPins: [
        pin("x-out", "X -> FB", hex(model.plotter.x), "source", model.plotter.drawActive),
        pin("y-out", "Y -> FB", hex(model.plotter.y), "source", model.plotter.drawActive),
        pin("rgb-out", "RGB -> FB", plotterColorLabel, "source", model.plotter.colorActive || model.plotter.drawActive),
        pin("draw-out", "DRAW -> FB", model.plotter.drawActive ? "1" : "0", "source", model.plotter.drawActive),
        pin("clear-out", "CLEAR -> FB", model.plotter.clearActive ? "1" : "0", "source", model.plotter.clearActive),
      ],
    }),
    node("plotter-io", 1280, 620, {
      title: "Plotter Framebuffer",
      subtitle: "256x256 RGB pixels driven by x/y/color latches",
      tone: "io",
      icon: "plotter",
      metrics: [
        { label: "PIXELS", value: `${model.plotter.pixels}` },
        { label: "X/Y", value: `${hex(model.plotter.x)}/${hex(model.plotter.y)}` },
        { label: "RGB", value: model.plotter.colorText },
        { label: "STATE", value: model.plotter.clearActive ? "clear" : model.plotter.drawActive ? "drawing" : "idle" },
      ],
      plotterPreview: buildPlotterPreview(data.plotterPixels),
      leftPins: [
        pin("x", "X", hex(model.plotter.x), "target", model.plotter.drawActive),
        pin("y", "Y", hex(model.plotter.y), "target", model.plotter.drawActive),
        pin("rgb", "RGB", plotterColorLabel, "target", model.plotter.colorActive || model.plotter.drawActive),
        pin("draw", "DRAW", model.plotter.drawActive ? "1" : "0", "target", model.plotter.drawActive),
        pin("clear", "CLEAR", model.plotter.clearActive ? "1" : "0", "target", model.plotter.clearActive),
      ],
      rightPins: [],
    }),
    node("drive-stage", 850, 980, {
      title: "Drive Controller",
      subtitle: "page latch + address mux + B data out",
      tone: "bus",
      icon: "bus",
      metrics: [
        { label: "PAGE", value: hex(model.drive.page) },
        { label: "ADDR", value: hex(model.drive.address, 4) },
        { label: "DATA OUT", value: hex(model.drive.dataOut) },
        { label: "MODE", value: model.drive.clearActive ? "clear" : model.drive.writeActive ? "write" : model.drive.readActive ? "read" : "idle" },
      ],
      leftPins: [
        pin("page-in", "PAGE FROM CPU", hex(model.drive.page), "target", driveBusActive),
        pin("addr-in", "ADDR FROM CPU", hex(model.drive.address, 4), "target", driveBusActive),
        pin("data-in", "DATA FROM B", hex(model.drive.dataOut), "target", model.drive.writeActive),
        pin("rd-in", "READ STB", model.drive.readActive ? "1" : "0", "target", model.drive.readActive),
        pin("wr-in", "WRITE STB", model.drive.writeActive ? "1" : "0", "target", model.drive.writeActive),
        pin("clr-in", "CLEAR STB", model.drive.clearActive ? "1" : "0", "target", model.drive.clearActive),
      ],
      rightPins: [
        pin("page-out", "PAGE -> DRIVE", hex(model.drive.page), "source", driveBusActive),
        pin("addr-out", "ADDR -> DRIVE", hex(model.drive.address, 4), "source", driveBusActive),
        pin("data-out", "DATA -> DRIVE", hex(model.drive.dataOut), "source", model.drive.writeActive),
        pin("rd-out", "READ -> DRIVE", model.drive.readActive ? "1" : "0", "source", model.drive.readActive),
        pin("wr-out", "WRITE -> DRIVE", model.drive.writeActive ? "1" : "0", "source", model.drive.writeActive),
        pin("clr-out", "CLEAR -> DRIVE", model.drive.clearActive ? "1" : "0", "source", model.drive.clearActive),
        pin("data-back", "DATA -> CPU", hex(model.drive.lastRead), "source", model.drive.readActive),
      ],
    }),
    node("drive", 1280, 980, {
      title: "External Drive",
      subtitle: "paged storage device addressed by page:offset",
      tone: "io",
      icon: "drive",
      metrics: [
        { label: "PAGE", value: hex(model.drive.page) },
        { label: "ADDR", value: hex(model.drive.address, 4) },
        { label: "READ BYTE", value: hex(model.drive.lastRead) },
        { label: "WRITE BYTE", value: hex(model.drive.lastWrite) },
      ],
      leftPins: [
        pin("page", "PAGE", hex(model.drive.page), "target", driveBusActive),
        pin("addr", "ADDR", hex(model.drive.address, 4), "target", driveBusActive),
        pin("data", "DATA IN", hex(model.drive.dataOut), "target", model.drive.writeActive),
        pin("rd", "READ", model.drive.readActive ? "1" : "0", "target", model.drive.readActive),
        pin("wr", "WRITE", model.drive.writeActive ? "1" : "0", "target", model.drive.writeActive),
        pin("clr", "CLEAR", model.drive.clearActive ? "1" : "0", "target", model.drive.clearActive),
      ],
      rightPins: [
        pin("read-data", "READ BYTE", hex(model.drive.lastRead), "source", model.drive.readActive),
      ],
    }),
    node("network-stage", 850, 1320, {
      title: "Network Request Builder",
      subtitle: "operand points into RAM; strings become URL/body; response returns byte stream",
      tone: "bus",
      icon: "bus",
      metrics: [
        { label: "REQ PTR", value: `${model.network.requestAddressLabel} ${hex(model.network.requestAddress, 4)}` },
        { label: "URL", value: model.network.urlPreview },
        { label: "BODY", value: model.network.bodyPreview },
        { label: "RESP", value: model.network.responsePreview },
      ],
      leftPins: [
        pin("addr-in", "PTR FROM CPU", `${model.network.requestAddressLabel} ${hex(model.network.requestAddress, 4)}`, "target", networkRequestFlowActive),
        pin("ram-in", "RAM CSTRING", hex(model.memory.operandData), "target", model.network.requestActive),
        pin("get-in", "GET STB", model.network.getActive ? "1" : "0", "target", model.network.getActive),
        pin("post-in", "POST STB", model.network.postActive ? "1" : "0", "target", model.network.postActive),
        pin("read-in", "READ STB", model.network.readActive ? "1" : "0", "target", model.network.readActive),
        pin("resp-in", "RESP BYTE", hex(model.network.lastByte), "target", networkResponseActive),
      ],
      rightPins: [
        pin("url-out", "URL -> NET", model.network.urlPreview, "source", model.network.requestActive || model.network.pending),
        pin("body-out", "BODY -> NET", model.network.bodyPreview, "source", model.network.postActive || Boolean(model.network.bodyPreview && model.network.pending)),
        pin("get-out", "GET -> NET", model.network.getActive ? "1" : "0", "source", model.network.getActive),
        pin("post-out", "POST -> NET", model.network.postActive ? "1" : "0", "source", model.network.postActive),
        pin("read-out", "READ -> NET", model.network.readActive ? "1" : "0", "source", model.network.readActive),
        pin("data-out", "DATA -> CPU", model.network.responsePreview, "source", networkResponseActive),
      ],
    }),
    node("network", 1280, 1320, {
      title: "Network Device",
      subtitle: model.network.status || "idle",
      tone: "io",
      icon: "network",
      metrics: [
        { label: "STATUS", value: model.network.status || "idle" },
        { label: "PENDING", value: model.network.pending ? "yes" : "no" },
        { label: "URL", value: model.network.urlPreview },
        { label: "BUFFER", value: `${model.network.responseBytes} bytes` },
      ],
      leftPins: [
        pin("url", "URL", model.network.urlPreview, "target", model.network.requestActive || model.network.pending),
        pin("body", "BODY", model.network.bodyPreview, "target", model.network.postActive || Boolean(model.network.bodyPreview && model.network.pending)),
        pin("get", "GET", model.network.getActive ? "1" : "0", "target", model.network.getActive),
        pin("post", "POST", model.network.postActive ? "1" : "0", "target", model.network.postActive),
        pin("read", "READ", model.network.readActive ? "1" : "0", "target", model.network.readActive),
      ],
      rightPins: [
        pin("data", "RESPONSE BYTE", hex(model.network.lastByte), "source", networkResponseActive),
      ],
    }),
  ];

  const edges: Array<Edge<SignalEdgeData>> = [
    signalEdge("cpu-fetch-bus", "cpu", "fetch-pc", "memory-bus", "fetch-in", `PC ${hex(model.memory.fetchAddress, 4)}`, "#f59e0b", true, model.pulseOn),
    signalEdge("cpu-addr-bus", "cpu", "mem-addr", "memory-bus", "addr-in", `ADDR ${hex(model.memory.operandAddress, 4)}`, "#f59e0b", memoryBusActive, model.pulseOn),
    signalEdge("cpu-data-bus", "cpu", "mem-data", "memory-bus", "data-in", `WRITE ${hex(model.memory.writeValue)}`, "#f97316", model.memory.writeActive, model.pulseOn),
    signalEdge("cpu-readreq-bus", "cpu", "mem-read-req", "memory-bus", "read-in", "READ", "#38bdf8", model.memory.readActive, model.pulseOn),
    signalEdge("cpu-we-bus", "cpu", "mem-we", "memory-bus", "we-in", "WRITE", "#fb7185", model.memory.writeActive, model.pulseOn),
    signalEdge("bus-mem-fetch-addr", "memory-bus", "fetch-addr-out", "memory", "fetch-addr", hex(model.memory.fetchAddress, 4), "#fbbf24", true, model.pulseOn),
    signalEdge("bus-mem-addr", "memory-bus", "addr-out", "memory", "addr", hex(model.memory.operandAddress, 4), "#10b981", memoryBusActive, model.pulseOn),
    signalEdge("bus-mem-read", "memory-bus", "read-out", "memory", "read", "RD", "#22d3ee", model.memory.readActive || model.network.requestActive, model.pulseOn),
    signalEdge("bus-mem-data", "memory-bus", "data-out", "memory", "data", hex(model.memory.writeValue), "#22c55e", model.memory.writeActive, model.pulseOn),
    signalEdge("bus-mem-we", "memory-bus", "we-out", "memory", "write", "WE", "#f43f5e", model.memory.writeActive, model.pulseOn),
    signalEdge("mem-bus-fetch", "memory", "fetch", "memory-bus", "fetch-data-in", hex(model.memory.fetchByte), "#fde047", true, model.pulseOn),
    signalEdge("bus-cpu-fetch", "memory-bus", "fetch-out", "cpu", "mem-fetch", hex(model.memory.fetchByte), "#facc15", true, model.pulseOn),
    signalEdge("mem-bus-read", "memory", "operand", "memory-bus", "read-data-in", hex(model.memory.operandData), "#22d3ee", model.memory.readActive || model.network.requestActive, model.pulseOn),
    signalEdge("bus-cpu-read", "memory-bus", "operand-out", "cpu", "mem-read", hex(model.memory.operandData), "#22d3ee", model.memory.readActive, model.pulseOn),
    signalEdge("cpu-alu-a", "cpu", "alu-a", "alu", "a-in", `A ${hex(model.alu.a)}`, "#a78bfa", true, model.pulseOn),
    signalEdge("cpu-alu-b", "cpu", "alu-b", "alu", "b-in", `B ${hex(model.alu.b)}`, "#d946ef", true, model.pulseOn),
    signalEdge("cpu-alu-op", "cpu", "alu-op", "alu", "op-in", model.alu.opName, "#f472b6", true, model.pulseOn),
    signalEdge("alu-cpu-result", "alu", "result", "cpu", "alu-out", hex(model.alu.result), "#e879f9", true, model.pulseOn),
    signalEdge("alu-cpu-flags", "alu", "flags", "cpu", "alu-flags", `${model.alu.zero ? 1 : 0}/${model.alu.carry ? 1 : 0}/${model.alu.negative ? 1 : 0}`, "#c084fc", true, model.pulseOn),
    signalEdge("cpu-console-out", "cpu", "con-out", "console", "write-data", model.console.latestChar, "#38bdf8", model.console.writeActive, model.pulseOn),
    signalEdge("cpu-console-read", "cpu", "con-rd", "console", "read-req", "READ", "#60a5fa", model.console.readActive, model.pulseOn),
    signalEdge("console-cpu-in", "console", "input-byte", "cpu", "con-in", model.console.inputPreview, "#93c5fd", model.console.readActive, model.pulseOn),
    signalEdge("cpu-key-select", "cpu", "key-sel", "keyboard", "select", keyboardSelection, "#22c55e", model.keyboard.readActive, model.pulseOn),
    signalEdge("cpu-key-rd", "cpu", "key-rd", "keyboard", "read", "SCAN", "#4ade80", model.keyboard.readActive, model.pulseOn),
    signalEdge("keyboard-cpu-state", "keyboard", "state", "cpu", "key-in", model.keyboard.activeKeys.join(",") || "idle", "#86efac", model.keyboard.readActive, model.pulseOn),
    signalEdge("cpu-plot-x", "cpu", "plot-x", "plotter-stage", "x-in", `X ${hex(model.plotter.x)}`, "#f59e0b", model.plotter.drawActive, model.pulseOn),
    signalEdge("cpu-plot-y", "cpu", "plot-y", "plotter-stage", "y-in", `Y ${hex(model.plotter.y)}`, "#fb923c", model.plotter.drawActive, model.pulseOn),
    signalEdge("cpu-plot-rgb", "cpu", "plot-color", "plotter-stage", "rgb-in", plotterColorLabel, "#fb7185", model.plotter.colorActive || model.plotter.drawActive, model.pulseOn),
    signalEdge("cpu-plot-draw", "cpu", "plot-draw", "plotter-stage", "draw-in", "DRAW", "#f97316", model.plotter.drawActive, model.pulseOn),
    signalEdge("cpu-plot-clear", "cpu", "plot-clear", "plotter-stage", "clear-in", "CLEAR", "#e11d48", model.plotter.clearActive, model.pulseOn),
    signalEdge("plotter-stage-x", "plotter-stage", "x-out", "plotter-io", "x", hex(model.plotter.x), "#f59e0b", model.plotter.drawActive, model.pulseOn),
    signalEdge("plotter-stage-y", "plotter-stage", "y-out", "plotter-io", "y", hex(model.plotter.y), "#fb923c", model.plotter.drawActive, model.pulseOn),
    signalEdge("plotter-stage-rgb", "plotter-stage", "rgb-out", "plotter-io", "rgb", plotterColorLabel, "#fb7185", model.plotter.colorActive || model.plotter.drawActive, model.pulseOn),
    signalEdge("plotter-stage-draw", "plotter-stage", "draw-out", "plotter-io", "draw", "DRAW", "#f97316", model.plotter.drawActive, model.pulseOn),
    signalEdge("plotter-stage-clear", "plotter-stage", "clear-out", "plotter-io", "clear", "CLEAR", "#e11d48", model.plotter.clearActive, model.pulseOn),
    signalEdge("cpu-drive-page", "cpu", "drv-page", "drive-stage", "page-in", hex(model.drive.page), "#fbbf24", driveBusActive, model.pulseOn),
    signalEdge("cpu-drive-addr", "cpu", "drv-addr", "drive-stage", "addr-in", hex(model.drive.address, 4), "#f59e0b", driveBusActive, model.pulseOn),
    signalEdge("cpu-drive-data", "cpu", "drv-data", "drive-stage", "data-in", hex(model.drive.dataOut), "#f97316", model.drive.writeActive, model.pulseOn),
    signalEdge("cpu-drive-rd", "cpu", "drv-rd", "drive-stage", "rd-in", "READ", "#fdba74", model.drive.readActive, model.pulseOn),
    signalEdge("cpu-drive-wr", "cpu", "drv-wr", "drive-stage", "wr-in", "WRITE", "#fb923c", model.drive.writeActive, model.pulseOn),
    signalEdge("cpu-drive-clr", "cpu", "drv-clr", "drive-stage", "clr-in", "CLEAR", "#ef4444", model.drive.clearActive, model.pulseOn),
    signalEdge("drive-stage-page", "drive-stage", "page-out", "drive", "page", hex(model.drive.page), "#fbbf24", driveBusActive, model.pulseOn),
    signalEdge("drive-stage-addr", "drive-stage", "addr-out", "drive", "addr", hex(model.drive.address, 4), "#f59e0b", driveBusActive, model.pulseOn),
    signalEdge("drive-stage-data", "drive-stage", "data-out", "drive", "data", hex(model.drive.dataOut), "#f97316", model.drive.writeActive, model.pulseOn),
    signalEdge("drive-stage-rd", "drive-stage", "rd-out", "drive", "rd", "READ", "#fdba74", model.drive.readActive, model.pulseOn),
    signalEdge("drive-stage-wr", "drive-stage", "wr-out", "drive", "wr", "WRITE", "#fb923c", model.drive.writeActive, model.pulseOn),
    signalEdge("drive-stage-clr", "drive-stage", "clr-out", "drive", "clr", "CLEAR", "#ef4444", model.drive.clearActive, model.pulseOn),
    signalEdge("drive-stage-back", "drive-stage", "data-back", "cpu", "drv-in", hex(model.drive.lastRead), "#fde68a", model.drive.readActive, model.pulseOn),
    signalEdge("drive-back-stage", "drive", "read-data", "drive-stage", "data-in", hex(model.drive.lastRead), "#fef3c7", model.drive.readActive, model.pulseOn),
    signalEdge("cpu-net-addr", "cpu", "net-addr", "network-stage", "addr-in", `${model.network.requestAddressLabel} ${hex(model.network.requestAddress, 4)}`, "#06b6d4", networkRequestFlowActive, model.pulseOn),
    signalEdge("bus-net-cstring", "memory-bus", "cstring-out", "network-stage", "ram-in", model.network.urlPreview, "#22d3ee", model.network.requestActive, model.pulseOn),
    signalEdge("cpu-net-get", "cpu", "net-get", "network-stage", "get-in", "GET", "#0891b2", model.network.getActive, model.pulseOn),
    signalEdge("cpu-net-post", "cpu", "net-post", "network-stage", "post-in", "POST", "#0ea5e9", model.network.postActive, model.pulseOn),
    signalEdge("cpu-net-rd", "cpu", "net-rd", "network-stage", "read-in", "READ", "#38bdf8", model.network.readActive, model.pulseOn),
    signalEdge("network-stage-url", "network-stage", "url-out", "network", "url", model.network.urlPreview, "#06b6d4", model.network.requestActive || model.network.pending, model.pulseOn),
    signalEdge("network-stage-body", "network-stage", "body-out", "network", "body", model.network.bodyPreview, "#0ea5e9", model.network.postActive || Boolean(model.network.bodyPreview && model.network.pending), model.pulseOn),
    signalEdge("network-stage-get", "network-stage", "get-out", "network", "get", "GET", "#0891b2", model.network.getActive, model.pulseOn),
    signalEdge("network-stage-post", "network-stage", "post-out", "network", "post", "POST", "#0ea5e9", model.network.postActive, model.pulseOn),
    signalEdge("network-stage-read", "network-stage", "read-out", "network", "read", "READ", "#38bdf8", model.network.readActive, model.pulseOn),
    signalEdge("network-back-stage", "network", "data", "network-stage", "resp-in", hex(model.network.lastByte), "#67e8f9", networkResponseActive, model.pulseOn),
    signalEdge("network-stage-cpu", "network-stage", "data-out", "cpu", "net-in", model.network.responsePreview, "#a5f3fc", networkResponseActive, model.pulseOn),
  ];

  return {
    model,
    nodes,
    edges,
  };
}
