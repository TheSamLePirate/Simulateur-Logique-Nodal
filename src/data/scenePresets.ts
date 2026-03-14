import type { Node, Edge } from "@xyflow/react";
import type { ScenePreset } from "../types";
import { initialNodes, initialEdges } from "./initialScene";

// ── Edge helpers (same as initialScene) ──────────────────────
const wire = (
  id: string,
  src: string,
  tgt: string,
  srcH: string,
  tgtH: string,
): Edge => ({
  id,
  source: src,
  target: tgt,
  sourceHandle: srcH,
  targetHandle: tgtH,
  animated: false,
  style: { stroke: "#475569", strokeWidth: 2 },
});

const bus8 = (
  idPrefix: string,
  src: string,
  tgt: string,
  srcPrefix: string,
  tgtPrefix: string,
): Edge[] =>
  Array.from({ length: 8 }, (_, i) => ({
    id: `${idPrefix}${i}`,
    source: src,
    target: tgt,
    sourceHandle: `${srcPrefix}${i}`,
    targetHandle: `${tgtPrefix}${i}`,
    animated: false,
    style: { stroke: "#475569", strokeWidth: 2 },
  }));

// ═══════════════════════════════════════════════════════════════
//  Scene 1 — Interrupteur Va-et-vient
//
//  Deux interrupteurs contrôlent une lampe.
//  Changer n'importe quel interrupteur inverse l'état.
//  C'est la porte XOR : la base de toute l'informatique.
//
//   [Switch A] ──→ ┌─────┐
//                  │ XOR │──→ [💡 Lumière]
//   [Switch B] ──→ └─────┘
// ═══════════════════════════════════════════════════════════════

const vaEtVientNodes: Node[] = [
  {
    id: "sw_a",
    type: "input",
    position: { x: 0, y: 0 },
    data: { label: "Interrupteur A", value: 0 },
  },
  {
    id: "sw_b",
    type: "input",
    position: { x: 0, y: 200 },
    data: { label: "Interrupteur B", value: 0 },
  },
  {
    id: "xor",
    type: "gate",
    position: { x: 300, y: 70 },
    data: { type: "XOR", value: 0 },
  },
  {
    id: "led",
    type: "output",
    position: { x: 550, y: 85 },
    data: { label: "Lumière", value: 0 },
  },
];

const vaEtVientEdges: Edge[] = [
  wire("e-swa-xor", "sw_a", "xor", "out", "a"),
  wire("e-swb-xor", "sw_b", "xor", "out", "b"),
  wire("e-xor-led", "xor", "led", "out", "in"),
];

// ═══════════════════════════════════════════════════════════════
//  Scene 2 — Additionneur 8-bit
//
//  Deux nombres → Additionneur → Résultat + Retenue
//  Montre comment un ordinateur additionne en binaire.
//
//   [Nombre A] ──→ ┌─────────┐
//                  │ ADD 8b  │──→ [Résultat]
//   [Nombre B] ──→ └─────────┘──→ [Retenue]
// ═══════════════════════════════════════════════════════════════

const additionneurNodes: Node[] = [
  {
    id: "numA",
    type: "inputNumber",
    position: { x: 0, y: 0 },
    data: { label: "Nombre A", value: 0 },
  },
  {
    id: "numB",
    type: "inputNumber",
    position: { x: 0, y: 350 },
    data: { label: "Nombre B", value: 0 },
  },
  {
    id: "add",
    type: "adder8",
    position: { x: 400, y: 80 },
    data: { sum: [0, 0, 0, 0, 0, 0, 0, 0], cout: 0 },
  },
  {
    id: "res",
    type: "outputNumber",
    position: { x: 750, y: 100 },
    data: { label: "Résultat (A+B)", value: 0 },
  },
  {
    id: "carry",
    type: "output",
    position: { x: 750, y: 350 },
    data: { label: "Retenue (dépassement)", value: 0 },
  },
];

const additionneurEdges: Edge[] = [
  ...bus8("e-a-add-", "numA", "add", "out", "a"),
  ...bus8("e-b-add-", "numB", "add", "out", "b"),
  ...bus8("e-add-res-", "add", "res", "s", "in"),
  wire("e-add-carry", "add", "carry", "cout", "in"),
];

// ═══════════════════════════════════════════════════════════════
//  Scene 3 — Comparateur de nombres
//
//  L'ALU soustrait B de A. Si le résultat est 0, ils sont égaux.
//  C'est exactement comme ça qu'un vrai processeur compare.
//
//   [Nombre A] ──→ ┌─────────┐──→ [A − B]
//                  │  ALU    │
//   [Nombre B] ──→ │ (SUB)   │──→ [Égal ?]
//                  └─────────┘──→ [A < B ?]
//   [OP = 001] ──↗
// ═══════════════════════════════════════════════════════════════

const comparateurNodes: Node[] = [
  {
    id: "numA",
    type: "inputNumber",
    position: { x: 0, y: 0 },
    data: { label: "Nombre A", value: 5 },
  },
  {
    id: "numB",
    type: "inputNumber",
    position: { x: 0, y: 350 },
    data: { label: "Nombre B", value: 5 },
  },
  {
    id: "alu",
    type: "alu8",
    position: { x: 450, y: 50 },
    data: {
      a: 0,
      b: 0,
      result: 0,
      r: [0, 0, 0, 0, 0, 0, 0, 0],
      zero: 0,
      carry: 0,
      negative: 0,
      opName: "SUB",
    },
  },
  // SUB = opcode 001 → op0=1, op1=0, op2=0
  {
    id: "op0",
    type: "input",
    position: { x: 250, y: 550 },
    data: { label: "OP0 = 1 (SUB)", value: 1 },
  },
  {
    id: "op1",
    type: "input",
    position: { x: 370, y: 550 },
    data: { label: "OP1 = 0", value: 0 },
  },
  {
    id: "op2",
    type: "input",
    position: { x: 490, y: 550 },
    data: { label: "OP2 = 0", value: 0 },
  },
  {
    id: "diffDisp",
    type: "outputNumber",
    position: { x: 800, y: 50 },
    data: { label: "A − B", value: 0 },
  },
  {
    id: "equalLed",
    type: "output",
    position: { x: 800, y: 300 },
    data: { label: "Égal ? (flag Zéro)", value: 0 },
  },
  {
    id: "negLed",
    type: "output",
    position: { x: 800, y: 400 },
    data: { label: "A < B ? (flag Négatif)", value: 0 },
  },
];

const comparateurEdges: Edge[] = [
  ...bus8("e-a-alu-", "numA", "alu", "out", "a"),
  ...bus8("e-b-alu-", "numB", "alu", "out", "b"),
  wire("e-op0-alu", "op0", "alu", "out", "op0"),
  wire("e-op1-alu", "op1", "alu", "out", "op1"),
  wire("e-op2-alu", "op2", "alu", "out", "op2"),
  ...bus8("e-alu-diff-", "alu", "diffDisp", "r", "in"),
  wire("e-alu-eq", "alu", "equalLed", "zero", "in"),
  wire("e-alu-neg", "alu", "negLed", "neg", "in"),
];

// ═══════════════════════════════════════════════════════════════
//  Scene 4 — Lecture séquentielle de la mémoire
//
//  Une horloge fait avancer un compteur (registre PC).
//  Le compteur envoie l'adresse à la SRAM qui affiche la valeur.
//  L'additionneur PC+1 reboucle pour lire l'adresse suivante.
//  La mémoire contient la suite de Fibonacci.
//
//           ┌─────────────────────────────────────────┐
//   [CLK]──→[PC REG]──→[SRAM]──→[Valeur lue]        │
//   [LOAD=1]──↗  │                                    │
//                ↓                                    │
//             [ADD +1]─────────── → PC.d ─────────────┘
//   [CONST 1]──↗
// ═══════════════════════════════════════════════════════════════

// Pre-fill memory with Fibonacci sequence
const fibMemory = Array(1024).fill(0);
[1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233].forEach((v, i) => {
  fibMemory[i] = v;
});

const lectureMemNodes: Node[] = [
  // System clock
  {
    id: "clk",
    type: "clock",
    position: { x: 50, y: -120 },
    data: { label: "Horloge", value: 0, frequency: 1, tickCounter: 0 },
  },
  // PC register (address counter)
  {
    id: "pc",
    type: "register8",
    position: { x: 250, y: 50 },
    data: {
      label: "Compteur (PC)",
      value: 0,
      q: [0, 0, 0, 0, 0, 0, 0, 0],
      prevClk: 0,
    },
  },
  // Load enable = always ON
  {
    id: "pcLoad",
    type: "input",
    position: { x: 50, y: 130 },
    data: { label: "Charger = 1", value: 1 },
  },
  // Reset switch (optional)
  {
    id: "rst",
    type: "input",
    position: { x: 50, y: 230 },
    data: { label: "Reset", value: 0 },
  },
  // Adder: PC + 1
  {
    id: "pcInc",
    type: "adder8",
    position: { x: 250, y: 380 },
    data: { sum: [0, 0, 0, 0, 0, 0, 0, 0], cout: 0 },
  },
  // Constant 1
  {
    id: "one",
    type: "inputNumber",
    position: { x: -80, y: 430 },
    data: { label: "Constante 1", value: 1 },
  },
  // Current address display
  {
    id: "addrDisp",
    type: "outputNumber",
    position: { x: 550, y: 380 },
    data: { label: "Adresse actuelle", value: 0 },
  },
  // SRAM (pre-filled with Fibonacci)
  {
    id: "sram",
    type: "sram8",
    position: { x: 600, y: 0 },
    data: {
      memory: [...fibMemory],
      q: [0, 0, 0, 0, 0, 0, 0, 0],
      currentAddress: 0,
    },
  },
  // Value display
  {
    id: "output",
    type: "outputNumber",
    position: { x: 950, y: 100 },
    data: { label: "Valeur lue", value: 0 },
  },
];

const lectureMemEdges: Edge[] = [
  // Clock → PC register
  wire("e-clk-pc", "clk", "pc", "out", "clk"),
  // Load switch → PC.load
  wire("e-load-pc", "pcLoad", "pc", "out", "load"),
  // Reset → PC.rst
  wire("e-rst-pc", "rst", "pc", "out", "rst"),
  // PC.q → SRAM address (a0–a7)
  ...bus8("e-pc-sram-", "pc", "sram", "q", "a"),
  // SRAM.q → output display
  ...bus8("e-sram-out-", "sram", "output", "q", "in"),
  // PC.q → adder input A (current count)
  ...bus8("e-pc-inc-a-", "pc", "pcInc", "q", "a"),
  // Constant 1 → adder input B
  ...bus8("e-one-inc-b-", "one", "pcInc", "out", "b"),
  // Adder result → PC data input (feedback: next address)
  ...bus8("e-inc-pc-d-", "pcInc", "pc", "s", "d"),
  // PC.q → address display
  ...bus8("e-pc-addr-", "pc", "addrDisp", "q", "in"),
];

// ═══════════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════════

export const BUILTIN_PRESETS: ScenePreset[] = [
  {
    id: "__builtin_cpu8",
    name: "CPU 8-bit (complet)",
    nodes: initialNodes,
    edges: initialEdges,
    builtIn: true,
  },
  {
    id: "__builtin_vaevient",
    name: "1. Va-et-vient",
    nodes: vaEtVientNodes,
    edges: vaEtVientEdges,
    builtIn: true,
  },
  {
    id: "__builtin_additionneur",
    name: "2. Additionneur",
    nodes: additionneurNodes,
    edges: additionneurEdges,
    builtIn: true,
  },
  {
    id: "__builtin_comparateur",
    name: "3. Comparateur",
    nodes: comparateurNodes,
    edges: comparateurEdges,
    builtIn: true,
  },
  {
    id: "__builtin_lecture_mem",
    name: "4. Lecture mémoire",
    nodes: lectureMemNodes,
    edges: lectureMemEdges,
    builtIn: true,
  },
  {
    id: "__builtin_empty",
    name: "Vide (canvas libre)",
    nodes: [],
    edges: [],
    builtIn: true,
  },
];
