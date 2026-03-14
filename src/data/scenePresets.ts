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

// ╔═══════════════════════════════════════════════════════════════╗
// ║                                                               ║
// ║   NIVEAU 1 — PORTES LOGIQUES                                  ║
// ║   Les briques fondamentales de l'informatique                 ║
// ║                                                               ║
// ╚═══════════════════════════════════════════════════════════════╝

// ═══════════════════════════════════════════════════════════════
//  1. Interrupteur Va-et-vient
//
//  Deux interrupteurs contrôlent une lampe.
//  Changer n'importe lequel inverse l'état : c'est la porte XOR.
//
//   [Switch A] ──→ ┌─────┐
//                  │ XOR │──→ [💡]
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
//  2. Demi-additionneur (Half Adder)
//
//  Additionne 2 bits avec juste un XOR et un AND.
//  XOR = Somme, AND = Retenue.
//  C'est LE circuit fondamental de l'addition binaire.
//
//          ┌─────┐
//   A ──┬─→│ XOR │──→ Somme
//       │  └─────┘
//       │  ┌─────┐
//   B ──┴─→│ AND │──→ Retenue
//          └─────┘
// ═══════════════════════════════════════════════════════════════

const halfAdderNodes: Node[] = [
  {
    id: "bitA",
    type: "input",
    position: { x: 0, y: 50 },
    data: { label: "Bit A", value: 0 },
  },
  {
    id: "bitB",
    type: "input",
    position: { x: 0, y: 250 },
    data: { label: "Bit B", value: 0 },
  },
  {
    id: "xor",
    type: "gate",
    position: { x: 300, y: 20 },
    data: { type: "XOR", value: 0 },
  },
  {
    id: "and",
    type: "gate",
    position: { x: 300, y: 200 },
    data: { type: "AND", value: 0 },
  },
  {
    id: "somme",
    type: "output",
    position: { x: 550, y: 35 },
    data: { label: "Somme (S)", value: 0 },
  },
  {
    id: "retenue",
    type: "output",
    position: { x: 550, y: 215 },
    data: { label: "Retenue (C)", value: 0 },
  },
];

const halfAdderEdges: Edge[] = [
  wire("e-a-xor", "bitA", "xor", "out", "a"),
  wire("e-b-xor", "bitB", "xor", "out", "b"),
  wire("e-a-and", "bitA", "and", "out", "a"),
  wire("e-b-and", "bitB", "and", "out", "b"),
  wire("e-xor-s", "xor", "somme", "out", "in"),
  wire("e-and-c", "and", "retenue", "out", "in"),
];

// ═══════════════════════════════════════════════════════════════
//  3. Mémoire 1-bit (Bascule SR)
//
//  Deux portes NOR croisées = 1 bit de mémoire.
//  SET → mémorise 1, RESET → mémorise 0.
//  C'est comme ça qu'un registre stocke un bit !
//
//              ┌─────┐
//   RESET ──→a│ NOR │──→ Q ───────┐
//         ┌→b │     │             │
//         │   └─────┘             │
//         │                       ↓ b
//         │   ┌─────┐           ┌─────┐
//         └───│ NOR │←a── SET   │     │
//             │     │←b─────────│     │
//             └─────┘           └─────┘
//               Q̄ ←──────────────┘
// ═══════════════════════════════════════════════════════════════

const srLatchNodes: Node[] = [
  {
    id: "set_sw",
    type: "input",
    position: { x: 0, y: 0 },
    data: { label: "SET (mémoriser 1)", value: 0 },
  },
  {
    id: "rst_sw",
    type: "input",
    position: { x: 0, y: 250 },
    data: { label: "RESET (mémoriser 0)", value: 0 },
  },
  // NOR1: inputs = R + Q̄ → output = Q
  {
    id: "nor1",
    type: "gate",
    position: { x: 350, y: 220 },
    data: { type: "NOR", value: 1 },
  },
  // NOR2: inputs = S + Q → output = Q̄
  {
    id: "nor2",
    type: "gate",
    position: { x: 350, y: 30 },
    data: { type: "NOR", value: 0 },
  },
  {
    id: "q_led",
    type: "output",
    position: { x: 620, y: 235 },
    data: { label: "Q (valeur mémorisée)", value: 0 },
  },
  {
    id: "qbar_led",
    type: "output",
    position: { x: 620, y: 45 },
    data: { label: "Q̄ (inverse)", value: 0 },
  },
];

const srLatchEdges: Edge[] = [
  // Reset → NOR1 input a
  wire("e-rst-nor1", "rst_sw", "nor1", "out", "a"),
  // Q̄ (NOR2 output) → NOR1 input b (feedback)
  wire("e-nor2-nor1", "nor2", "nor1", "out", "b"),
  // Set → NOR2 input a
  wire("e-set-nor2", "set_sw", "nor2", "out", "a"),
  // Q (NOR1 output) → NOR2 input b (feedback)
  wire("e-nor1-nor2", "nor1", "nor2", "out", "b"),
  // Q output to LED
  wire("e-nor1-qled", "nor1", "q_led", "out", "in"),
  // Q̄ output to LED
  wire("e-nor2-qbarled", "nor2", "qbar_led", "out", "in"),
];

// ═══════════════════════════════════════════════════════════════
//  4. Convertisseur binaire visuel
//
//  Un nombre décimal → 8 LEDs montrant chaque bit.
//  Voir concrètement comment 42 = 00101010 en binaire.
//
//   [Nombre] ──→ bit0 ○  (1)
//            ──→ bit1 ○  (2)
//            ──→ bit2 ○  (4)
//            ──→ ...
//            ──→ bit7 ○  (128)
// ═══════════════════════════════════════════════════════════════

const binaireNodes: Node[] = [
  {
    id: "numIn",
    type: "inputNumber",
    position: { x: 0, y: 150 },
    data: { label: "Nombre (0-255)", value: 42 },
  },
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `led${i}`,
    type: "output" as const,
    position: { x: 400, y: i * 70 },
    data: { label: `Bit ${i}  (= ${1 << i})`, value: 0 },
  })),
];

const binaireEdges: Edge[] = Array.from({ length: 8 }, (_, i) =>
  wire(`e-num-led${i}`, "numIn", `led${i}`, `out${i}`, "in"),
);

// ╔═══════════════════════════════════════════════════════════════╗
// ║                                                               ║
// ║   NIVEAU 2 — COMPOSANTS                                       ║
// ║   Les blocs de construction d'un processeur                   ║
// ║                                                               ║
// ╚═══════════════════════════════════════════════════════════════╝

// ═══════════════════════════════════════════════════════════════
//  5. Additionneur 8-bit
//
//  Deux nombres → Additionneur → Résultat + Retenue
//  La retenue s'allume si le résultat dépasse 255.
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
//  6. Comparateur de nombres
//
//  L'ALU soustrait B de A. Si le résultat = 0, ils sont égaux.
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
//  7. Calculatrice 4 opérations
//
//  L'ALU peut faire ADD, SUB, AND, OR selon les switches OP.
//  OP: 000=ADD  001=SUB  010=AND  011=OR
//      100=XOR  101=NOT  110=SHL  111=SHR
//
//   [A] ──→ ┌─────────┐──→ [Résultat]
//           │  ALU     │──→ [Zéro]
//   [B] ──→ │          │──→ [Retenue]
//           └─────────┘──→ [Négatif]
//   [OP0][OP1][OP2] ──↗
// ═══════════════════════════════════════════════════════════════

const calculatriceNodes: Node[] = [
  {
    id: "numA",
    type: "inputNumber",
    position: { x: 0, y: 0 },
    data: { label: "Nombre A", value: 12 },
  },
  {
    id: "numB",
    type: "inputNumber",
    position: { x: 0, y: 350 },
    data: { label: "Nombre B", value: 7 },
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
      opName: "ADD",
    },
  },
  {
    id: "op0",
    type: "input",
    position: { x: 200, y: 550 },
    data: { label: "OP0 (bit 0)", value: 0 },
  },
  {
    id: "op1",
    type: "input",
    position: { x: 340, y: 550 },
    data: { label: "OP1 (bit 1)", value: 0 },
  },
  {
    id: "op2",
    type: "input",
    position: { x: 480, y: 550 },
    data: { label: "OP2 (bit 2)", value: 0 },
  },
  {
    id: "result",
    type: "outputNumber",
    position: { x: 800, y: 50 },
    data: { label: "Résultat", value: 0 },
  },
  {
    id: "zeroLed",
    type: "output",
    position: { x: 800, y: 280 },
    data: { label: "Flag Zéro", value: 0 },
  },
  {
    id: "carryLed",
    type: "output",
    position: { x: 800, y: 370 },
    data: { label: "Flag Retenue", value: 0 },
  },
  {
    id: "negLed",
    type: "output",
    position: { x: 800, y: 460 },
    data: { label: "Flag Négatif", value: 0 },
  },
];

const calculatriceEdges: Edge[] = [
  ...bus8("e-a-alu-", "numA", "alu", "out", "a"),
  ...bus8("e-b-alu-", "numB", "alu", "out", "b"),
  wire("e-op0", "op0", "alu", "out", "op0"),
  wire("e-op1", "op1", "alu", "out", "op1"),
  wire("e-op2", "op2", "alu", "out", "op2"),
  ...bus8("e-alu-res-", "alu", "result", "r", "in"),
  wire("e-alu-z", "alu", "zeroLed", "zero", "in"),
  wire("e-alu-c", "alu", "carryLed", "carry", "in"),
  wire("e-alu-n", "alu", "negLed", "neg", "in"),
];

// ═══════════════════════════════════════════════════════════════
//  8. Multiplexeur — Aiguillage de données
//
//  Le MUX choisit entre deux sources de données.
//  Switch = 0 → Source A passe.  Switch = 1 → Source B passe.
//  C'est comme un aiguillage de train pour les données !
//
//   [Source A] ──→ ┌─────────┐
//                  │   MUX   │──→ [Sortie]
//   [Source B] ──→ └─────────┘
//   [Aiguillage] ──↗
// ═══════════════════════════════════════════════════════════════

const muxNodes: Node[] = [
  {
    id: "srcA",
    type: "inputNumber",
    position: { x: 0, y: 0 },
    data: { label: "Source A", value: 42 },
  },
  {
    id: "srcB",
    type: "inputNumber",
    position: { x: 0, y: 350 },
    data: { label: "Source B", value: 99 },
  },
  {
    id: "sel",
    type: "input",
    position: { x: 250, y: 500 },
    data: { label: "Aiguillage (0=A, 1=B)", value: 0 },
  },
  {
    id: "mux",
    type: "mux8",
    position: { x: 400, y: 80 },
    data: {
      label: "MUX",
      sel: 0,
      outVal: 0,
      out: [0, 0, 0, 0, 0, 0, 0, 0],
    },
  },
  {
    id: "out",
    type: "outputNumber",
    position: { x: 750, y: 120 },
    data: { label: "Sortie", value: 0 },
  },
];

const muxEdges: Edge[] = [
  ...bus8("e-a-mux-", "srcA", "mux", "out", "a"),
  ...bus8("e-b-mux-", "srcB", "mux", "out", "b"),
  wire("e-sel-mux", "sel", "mux", "out", "sel"),
  ...bus8("e-mux-out-", "mux", "out", "out", "in"),
];

// ╔═══════════════════════════════════════════════════════════════╗
// ║                                                               ║
// ║   NIVEAU 3 — SYSTÈMES                                         ║
// ║   Des circuits qui « font quelque chose » tout seuls           ║
// ║                                                               ║
// ╚═══════════════════════════════════════════════════════════════╝

// ═══════════════════════════════════════════════════════════════
//  9. Accumulateur
//
//  L'ALU additionne un pas constant au registre chaque tick.
//  Le registre reboucle vers l'ALU : c'est une boucle !
//  Le nombre grandit tout seul à chaque coup d'horloge.
//
//   [CLK] ──→ [REG] ──→ [ALU +N] ──→ [Affichage]
//   [LOAD=1]──↗   ↑         │
//                  └─────────┘ (rebouclage)
//   [Pas N] ──→ ALU.b
// ═══════════════════════════════════════════════════════════════

const accumulateurNodes: Node[] = [
  {
    id: "clk",
    type: "clock",
    position: { x: 50, y: -100 },
    data: { label: "Horloge", value: 0, frequency: 1, tickCounter: 0 },
  },
  {
    id: "load",
    type: "input",
    position: { x: 50, y: 120 },
    data: { label: "Charger = 1", value: 1 },
  },
  {
    id: "rst",
    type: "input",
    position: { x: 50, y: 230 },
    data: { label: "Reset", value: 0 },
  },
  {
    id: "reg",
    type: "register8",
    position: { x: 250, y: 30 },
    data: {
      label: "Accumulateur",
      value: 0,
      q: [0, 0, 0, 0, 0, 0, 0, 0],
      prevClk: 0,
    },
  },
  {
    id: "alu",
    type: "alu8",
    position: { x: 600, y: 0 },
    data: {
      a: 0,
      b: 0,
      result: 0,
      r: [0, 0, 0, 0, 0, 0, 0, 0],
      zero: 0,
      carry: 0,
      negative: 0,
      opName: "ADD",
    },
  },
  {
    id: "step",
    type: "inputNumber",
    position: { x: 400, y: 350 },
    data: { label: "Pas (+N)", value: 3 },
  },
  {
    id: "display",
    type: "outputNumber",
    position: { x: 950, y: 60 },
    data: { label: "Valeur", value: 0 },
  },
];

const accumulateurEdges: Edge[] = [
  // Clock → register
  wire("e-clk-reg", "clk", "reg", "out", "clk"),
  wire("e-load-reg", "load", "reg", "out", "load"),
  wire("e-rst-reg", "rst", "reg", "out", "rst"),
  // Register → ALU input A (current value)
  ...bus8("e-reg-alu-a-", "reg", "alu", "q", "a"),
  // Step constant → ALU input B
  ...bus8("e-step-alu-b-", "step", "alu", "out", "b"),
  // ALU result → register data input (feedback loop)
  ...bus8("e-alu-reg-d-", "alu", "reg", "r", "d"),
  // Register → display
  ...bus8("e-reg-disp-", "reg", "display", "q", "in"),
];

// ═══════════════════════════════════════════════════════════════
//  10. Lecture séquentielle de la mémoire
//
//  Une horloge fait avancer un compteur (PC).
//  Le compteur lit la SRAM adresse par adresse.
//  La mémoire contient la suite de Fibonacci.
//
//   [CLK]──→[PC REG]──→[SRAM]──→[Valeur lue]
//   [LOAD=1]──↗  │
//                ↓
//             [ADD +1]──→ PC.d (rebouclage)
//   [CONST 1]──↗
// ═══════════════════════════════════════════════════════════════

const fibMemory = Array(1024).fill(0);
[1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233].forEach((v, i) => {
  fibMemory[i] = v;
});

const lectureMemNodes: Node[] = [
  {
    id: "clk",
    type: "clock",
    position: { x: 50, y: -120 },
    data: { label: "Horloge", value: 0, frequency: 1, tickCounter: 0 },
  },
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
  {
    id: "pcLoad",
    type: "input",
    position: { x: 50, y: 130 },
    data: { label: "Charger = 1", value: 1 },
  },
  {
    id: "rst",
    type: "input",
    position: { x: 50, y: 230 },
    data: { label: "Reset", value: 0 },
  },
  {
    id: "pcInc",
    type: "adder8",
    position: { x: 250, y: 380 },
    data: { sum: [0, 0, 0, 0, 0, 0, 0, 0], cout: 0 },
  },
  {
    id: "one",
    type: "inputNumber",
    position: { x: -80, y: 430 },
    data: { label: "Constante 1", value: 1 },
  },
  {
    id: "addrDisp",
    type: "outputNumber",
    position: { x: 550, y: 380 },
    data: { label: "Adresse actuelle", value: 0 },
  },
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
  {
    id: "output",
    type: "outputNumber",
    position: { x: 950, y: 100 },
    data: { label: "Valeur lue", value: 0 },
  },
];

const lectureMemEdges: Edge[] = [
  wire("e-clk-pc", "clk", "pc", "out", "clk"),
  wire("e-load-pc", "pcLoad", "pc", "out", "load"),
  wire("e-rst-pc", "rst", "pc", "out", "rst"),
  ...bus8("e-pc-sram-", "pc", "sram", "q", "a"),
  ...bus8("e-sram-out-", "sram", "output", "q", "in"),
  ...bus8("e-pc-inc-a-", "pc", "pcInc", "q", "a"),
  ...bus8("e-one-inc-b-", "one", "pcInc", "out", "b"),
  ...bus8("e-inc-pc-d-", "pcInc", "pc", "s", "d"),
  ...bus8("e-pc-addr-", "pc", "addrDisp", "q", "in"),
];

// ═══════════════════════════════════════════════════════════════
//  11. Écriture + Lecture mémoire
//
//  Choisissez une adresse, écrivez une valeur, puis relisez-la.
//  Le cycle complet : écriture → stockage → relecture.
//
//   [Adresse] ──→ ┌────────┐
//                 │  SRAM  │──→ [Valeur lue]
//   [Donnée] ──→  │        │
//                 └────────┘
//   [Écriture WE] ──↗
// ═══════════════════════════════════════════════════════════════

const rwMemNodes: Node[] = [
  {
    id: "addr",
    type: "inputNumber",
    position: { x: 0, y: 0 },
    data: { label: "Adresse (0-255)", value: 0 },
  },
  {
    id: "dataIn",
    type: "inputNumber",
    position: { x: 0, y: 300 },
    data: { label: "Donnée à écrire", value: 42 },
  },
  {
    id: "we",
    type: "input",
    position: { x: 300, y: 480 },
    data: { label: "Écriture (WE)", value: 0 },
  },
  {
    id: "sram",
    type: "sram8",
    position: { x: 450, y: 0 },
    data: {
      memory: Array(1024).fill(0),
      q: [0, 0, 0, 0, 0, 0, 0, 0],
      currentAddress: 0,
    },
  },
  {
    id: "readOut",
    type: "outputNumber",
    position: { x: 800, y: 100 },
    data: { label: "Valeur lue", value: 0 },
  },
];

const rwMemEdges: Edge[] = [
  ...bus8("e-addr-sram-", "addr", "sram", "out", "a"),
  ...bus8("e-data-sram-", "dataIn", "sram", "out", "d"),
  wire("e-we-sram", "we", "sram", "out", "we"),
  ...bus8("e-sram-read-", "sram", "readOut", "q", "in"),
];

// ═══════════════════════════════════════════════════════════════
//  12. Hello World — Console
//
//  La SRAM contient "Hello World!\n" en codes ASCII.
//  L'horloge fait avancer un compteur (PC) qui lit la mémoire
//  et envoie chaque caractère à la console automatiquement.
//
//   [CLK]──┬─→[PC]──→[SRAM]──→[CONSOLE]
//          │    ↑        "Hello World!"
//          │  [+1]
//          └─→ wr
// ═══════════════════════════════════════════════════════════════

// "Hello World!\n" in ASCII
const helloMem = Array(1024).fill(0);
[72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33, 10].forEach((v, i) => {
  helloMem[i] = v;
});

const helloWorldNodes: Node[] = [
  // Clock
  {
    id: "clk",
    type: "clock",
    position: { x: 50, y: -80 },
    data: { label: "Horloge", value: 0, frequency: 2, tickCounter: 0 },
  },
  // PC register
  {
    id: "pc",
    type: "register8",
    position: { x: 250, y: 20 },
    data: {
      label: "Compteur (PC)",
      value: 0,
      q: [0, 0, 0, 0, 0, 0, 0, 0],
      prevClk: 0,
    },
  },
  {
    id: "pcLoad",
    type: "input",
    position: { x: 50, y: 110 },
    data: { label: "Charger = 1", value: 1 },
  },
  {
    id: "rst",
    type: "input",
    position: { x: 50, y: 220 },
    data: { label: "Reset", value: 0 },
  },
  // PC + 1
  {
    id: "pcInc",
    type: "adder8",
    position: { x: 250, y: 320 },
    data: { sum: [0, 0, 0, 0, 0, 0, 0, 0], cout: 0 },
  },
  {
    id: "one",
    type: "inputNumber",
    position: { x: 0, y: 400 },
    data: { label: "Constante 1", value: 1 },
  },
  // SRAM with "Hello World!\n"
  {
    id: "sram",
    type: "sram8",
    position: { x: 600, y: 0 },
    data: {
      memory: [...helloMem],
      q: [0, 0, 0, 0, 0, 0, 0, 0],
      currentAddress: 0,
    },
  },
  // Address display
  {
    id: "addrDisp",
    type: "outputNumber",
    position: { x: 550, y: 350 },
    data: { label: "Adresse", value: 0 },
  },
  // Char code display
  {
    id: "charDisp",
    type: "outputNumber",
    position: { x: 900, y: 350 },
    data: { label: "Code ASCII", value: 0 },
  },
  // Console
  {
    id: "console",
    type: "console",
    position: { x: 1000, y: 0 },
    data: { label: "CONSOLE", text: "", lastChar: 0, prevWr: 0 },
  },
  // Clear console
  {
    id: "clr",
    type: "input",
    position: { x: 900, y: 450 },
    data: { label: "Effacer écran", value: 0 },
  },
];

const helloWorldEdges: Edge[] = [
  // PC counter
  wire("e-clk-pc", "clk", "pc", "out", "clk"),
  wire("e-load-pc", "pcLoad", "pc", "out", "load"),
  wire("e-rst-pc", "rst", "pc", "out", "rst"),
  ...bus8("e-pc-inc-a-", "pc", "pcInc", "q", "a"),
  ...bus8("e-one-inc-b-", "one", "pcInc", "out", "b"),
  ...bus8("e-inc-pc-d-", "pcInc", "pc", "s", "d"),
  // PC → SRAM address
  ...bus8("e-pc-sram-", "pc", "sram", "q", "a"),
  // SRAM → Console data
  ...bus8("e-sram-con-", "sram", "console", "q", "d"),
  // Clock → Console write strobe
  wire("e-clk-wr", "clk", "console", "out", "wr"),
  // Clear
  wire("e-clr-con", "clr", "console", "out", "clr"),
  // Displays
  ...bus8("e-pc-addr-", "pc", "addrDisp", "q", "in"),
  ...bus8("e-sram-char-", "sram", "charDisp", "q", "in"),
];

// ═══════════════════════════════════════════════════════════════
//  13. Console → Mémoire (clavier vers SRAM)
//
//  L'inverse du Hello World : tapez au clavier dans la console,
//  chaque caractère est écrit en SRAM à l'adresse suivante.
//  Le signal "avail" conditionne l'écriture et l'avancement du PC.
//
//   [CONSOLE]──q──→[SRAM]
//     │avail──────→ SRAM.we
//     │avail──────→ PC.load
//     │rd←──────── CLK
//
//   [CLK]──→ PC.clk
//   [PC]──→ SRAM.a
//   [PC+1]──→ PC.d
// ═══════════════════════════════════════════════════════════════

const consoleToMemNodes: Node[] = [
  // Console (keyboard input)
  {
    id: "console",
    type: "console",
    position: { x: 0, y: 0 },
    data: { label: "CLAVIER", text: "", lastChar: 0, prevWr: 0 },
  },
  // Clock
  {
    id: "clk",
    type: "clock",
    position: { x: 350, y: -120 },
    data: { label: "Horloge", value: 0, frequency: 2, tickCounter: 0 },
  },
  // PC register (write address)
  {
    id: "pc",
    type: "register8",
    position: { x: 500, y: 30 },
    data: {
      label: "Adresse d'écriture (PC)",
      value: 0,
      q: [0, 0, 0, 0, 0, 0, 0, 0],
      prevClk: 0,
    },
  },
  {
    id: "rst",
    type: "input",
    position: { x: 350, y: 220 },
    data: { label: "Reset", value: 0 },
  },
  // PC + 1
  {
    id: "pcInc",
    type: "adder8",
    position: { x: 500, y: 340 },
    data: { sum: [0, 0, 0, 0, 0, 0, 0, 0], cout: 0 },
  },
  {
    id: "one",
    type: "inputNumber",
    position: { x: 300, y: 420 },
    data: { label: "Constante 1", value: 1 },
  },
  // SRAM (stores typed characters)
  {
    id: "sram",
    type: "sram8",
    position: { x: 850, y: 0 },
    data: {
      memory: Array(1024).fill(0),
      q: [0, 0, 0, 0, 0, 0, 0, 0],
      currentAddress: 0,
    },
  },
  // Displays
  {
    id: "addrDisp",
    type: "outputNumber",
    position: { x: 750, y: 370 },
    data: { label: "Adresse", value: 0 },
  },
  {
    id: "charDisp",
    type: "outputNumber",
    position: { x: 1150, y: 370 },
    data: { label: "Dernier char écrit", value: 0 },
  },
  {
    id: "availLed",
    type: "output",
    position: { x: 350, y: 120 },
    data: { label: "Caractère dispo ?", value: 0 },
  },
];

const consoleToMemEdges: Edge[] = [
  // Clock → PC.clk
  wire("e-clk-pc", "clk", "pc", "out", "clk"),
  // Clock → Console.rd (read strobe — dequeues next char each tick)
  wire("e-clk-rd", "clk", "console", "out", "rd"),
  // Console.avail → PC.load (advance address only when char available)
  wire("e-avail-load", "console", "pc", "avail", "load"),
  // Console.avail → SRAM.we (write only when char available)
  wire("e-avail-we", "console", "sram", "avail", "we"),
  // Console.avail → LED
  wire("e-avail-led", "console", "availLed", "avail", "in"),
  // Reset → PC.rst
  wire("e-rst-pc", "rst", "pc", "out", "rst"),
  // PC + 1 loop
  ...bus8("e-pc-inc-a-", "pc", "pcInc", "q", "a"),
  ...bus8("e-one-inc-b-", "one", "pcInc", "out", "b"),
  ...bus8("e-inc-pc-d-", "pcInc", "pc", "s", "d"),
  // PC → SRAM address
  ...bus8("e-pc-sram-a-", "pc", "sram", "q", "a"),
  // Console.q → SRAM data (character to write)
  ...bus8("e-con-sram-d-", "console", "sram", "q", "d"),
  // Displays
  ...bus8("e-pc-addr-", "pc", "addrDisp", "q", "in"),
  ...bus8("e-sram-char-", "sram", "charDisp", "q", "in"),
];

// ═══════════════════════════════════════════════════════════════
//  14. Dessin au Plotter — Diagonale X = Y
//
//  Un seul compteur envoie la même valeur à X et Y.
//  Résultat : (0,0), (1,1), (2,2) … (255,255) = diagonale.
//
//   [CLK]──┬─→[Compteur]──┬──→ plotter.X
//          │      ↑        └──→ plotter.Y
//          │   [ADD +1]
//          └─→ draw
// ═══════════════════════════════════════════════════════════════

const plotterNodes: Node[] = [
  {
    id: "clk",
    type: "clock",
    position: { x: 50, y: -80 },
    data: { label: "Horloge", value: 0, frequency: 10, tickCounter: 0 },
  },
  {
    id: "load",
    type: "input",
    position: { x: 50, y: 110 },
    data: { label: "Charger = 1", value: 1 },
  },
  {
    id: "rst",
    type: "input",
    position: { x: 50, y: 220 },
    data: { label: "Reset", value: 0 },
  },
  {
    id: "counter",
    type: "register8",
    position: { x: 250, y: 20 },
    data: {
      label: "Compteur (X = Y)",
      value: 0,
      q: [0, 0, 0, 0, 0, 0, 0, 0],
      prevClk: 0,
    },
  },
  {
    id: "inc",
    type: "adder8",
    position: { x: 250, y: 320 },
    data: { sum: [0, 0, 0, 0, 0, 0, 0, 0], cout: 0 },
  },
  {
    id: "one",
    type: "inputNumber",
    position: { x: 0, y: 400 },
    data: { label: "Constante 1", value: 1 },
  },
  {
    id: "disp",
    type: "outputNumber",
    position: { x: 550, y: 350 },
    data: { label: "Position (X = Y)", value: 0 },
  },
  {
    id: "clr",
    type: "input",
    position: { x: 550, y: 450 },
    data: { label: "Effacer écran", value: 0 },
  },
  {
    id: "plotter",
    type: "plotter",
    position: { x: 650, y: 0 },
    data: { label: "PLOTTER", pixels: [], prevDraw: 0 },
  },
];

const plotterEdges: Edge[] = [
  // Counter
  wire("e-clk-ctr", "clk", "counter", "out", "clk"),
  wire("e-load-ctr", "load", "counter", "out", "load"),
  wire("e-rst-ctr", "rst", "counter", "out", "rst"),
  ...bus8("e-ctr-inc-a-", "counter", "inc", "q", "a"),
  ...bus8("e-one-inc-b-", "one", "inc", "out", "b"),
  ...bus8("e-inc-ctr-d-", "inc", "counter", "s", "d"),
  // Same counter → both X and Y
  ...bus8("e-ctr-plot-x-", "counter", "plotter", "q", "x"),
  ...bus8("e-ctr-plot-y-", "counter", "plotter", "q", "y"),
  // Clock → draw
  wire("e-clk-draw", "clk", "plotter", "out", "draw"),
  wire("e-clr-plot", "clr", "plotter", "out", "clr"),
  // Display
  ...bus8("e-ctr-disp-", "counter", "disp", "q", "in"),
];

// ═══════════════════════════════════════════════════════════════
//  15. Majuscules — Convertisseur ASCII uppercase
//
//  Tape du texte dans CLAVIER → apparaît en MAJUSCULES sur ÉCRAN.
//  Astuce : en ASCII, majuscule = minuscule avec bit 5 = 0.
//  'a' = 0b01100001 → 'A' = 0b01000001 (on force D5 à 0).
//
//  Phase 1 (CLK=1): AND(clk, avail) → RD lis un caractère
//                    Registre mémorise "donnée dispo"
//  Phase 2 (CLK=0): AND(¬clk, reg.q0) → WR écrit le caractère
//                    q0-q4,q6,q7 passent direct, d5 = 0 (= majuscule)
//
//   [CLAVIER]──avail──→[AND_RD]←──clk──→[NOT]──→[AND_WR]──→ wr
//       ↑ rd            ↓ load                       ↑
//       └──────────── [REG latch]──q0────────────────┘
//       q0-q7 ──→ d0-d4,d6,d7  | d5 ← [CONST 0]  ──→ [ÉCRAN]
// ═══════════════════════════════════════════════════════════════

const majusculesNodes: Node[] = [
  // ── Input console (keyboard) ──
  {
    id: "conIn",
    type: "console",
    position: { x: 0, y: 50 },
    data: {
      label: "CLAVIER",
      text: "",
      lastChar: 0,
      prevWr: 0,
      prevRd: 0,
      inputBuffer: [],
      q: [0, 0, 0, 0, 0, 0, 0, 0],
      avail: 0,
      inputBufferSize: 0,
    },
  },
  // ── Output console (display) ──
  {
    id: "conOut",
    type: "console",
    position: { x: 800, y: 50 },
    data: {
      label: "ÉCRAN (majuscules)",
      text: "",
      lastChar: 0,
      prevWr: 0,
      prevRd: 0,
      inputBuffer: [],
      q: [0, 0, 0, 0, 0, 0, 0, 0],
      avail: 0,
      inputBufferSize: 0,
    },
  },
  // ── Clock ──
  {
    id: "clk",
    type: "clock",
    position: { x: 300, y: -100 },
    data: { label: "Horloge", value: 0, frequency: 2, tickCounter: 0 },
  },
  // ── NOT gate (inverts clock for write phase) ──
  {
    id: "notClk",
    type: "gate",
    position: { x: 550, y: -100 },
    data: { type: "NOT", value: 0 },
  },
  // ── AND: clock ∧ avail → RD (read on rising edge when data available) ──
  {
    id: "andRd",
    type: "gate",
    position: { x: 300, y: 100 },
    data: { type: "AND", value: 0 },
  },
  // ── Register (1-bit latch: captures "avail" on clock edge) ──
  {
    id: "latch",
    type: "register8",
    position: { x: 380, y: 300 },
    data: {
      label: "Latch (mémorise avail)",
      value: 0,
      q: [0, 0, 0, 0, 0, 0, 0, 0],
      prevClk: 0,
    },
  },
  // ── AND: ¬clock ∧ latch.q0 → WR (write on falling edge if data was read) ──
  {
    id: "andWr",
    type: "gate",
    position: { x: 620, y: 200 },
    data: { type: "AND", value: 0 },
  },
  // ── Constant 0 (forces bit 5 = 0 → uppercase, and mode = char) ──
  {
    id: "const0",
    type: "input",
    position: { x: 620, y: 400 },
    data: { label: "Const 0 (bit5 = MAJ)", value: 0 },
  },
  // ── Constant 1 (register load = always) ──
  {
    id: "const1",
    type: "input",
    position: { x: 200, y: 420 },
    data: { label: "Const 1 (load=on)", value: 1 },
  },
  // ── Status LEDs ──
  {
    id: "availLed",
    type: "output",
    position: { x: 300, y: 0 },
    data: { label: "Char dispo ?", value: 0 },
  },
  {
    id: "charDisp",
    type: "outputNumber",
    position: { x: 620, y: -10 },
    data: { label: "Char lu (ASCII)", value: 0 },
  },
];

const majusculesEdges: Edge[] = [
  // ─── Clock distribution ───
  wire("e-clk-andRd-a", "clk", "andRd", "out", "a"),
  wire("e-clk-not", "clk", "notClk", "out", "in"),
  wire("e-clk-latch", "clk", "latch", "out", "clk"),

  // ─── Read gating: AND(clock, avail) → RD ───
  wire("e-avail-andRd-b", "conIn", "andRd", "avail", "b"),
  wire("e-andRd-rd", "andRd", "conIn", "out", "rd"),

  // ─── Latch: captures avail on clock edge ───
  wire("e-avail-latch-d0", "conIn", "latch", "avail", "d0"),
  wire("e-const1-latch-load", "const1", "latch", "out", "load"),

  // ─── Write gating: AND(¬clock, latch.q0) → WR ───
  wire("e-not-andWr-a", "notClk", "andWr", "out", "a"),
  wire("e-latch-andWr-b", "latch", "andWr", "q0", "b"),
  wire("e-andWr-wr", "andWr", "conOut", "out", "wr"),

  // ─── Data bus: conIn.q → conOut.d (with bit 5 forced to 0) ───
  wire("e-q0-d0", "conIn", "conOut", "q0", "d0"),
  wire("e-q1-d1", "conIn", "conOut", "q1", "d1"),
  wire("e-q2-d2", "conIn", "conOut", "q2", "d2"),
  wire("e-q3-d3", "conIn", "conOut", "q3", "d3"),
  wire("e-q4-d4", "conIn", "conOut", "q4", "d4"),
  wire("e-const0-d5", "const0", "conOut", "out", "d5"), // BIT 5 = 0 → UPPERCASE!
  wire("e-q6-d6", "conIn", "conOut", "q6", "d6"),
  wire("e-q7-d7", "conIn", "conOut", "q7", "d7"),

  // ─── Mode = 0 (char mode) ───
  wire("e-const0-mode", "const0", "conOut", "out", "mode"),

  // ─── Status displays ───
  wire("e-avail-led", "conIn", "availLed", "avail", "in"),
  ...bus8("e-q-disp-", "conIn", "charDisp", "q", "in"),
];

// ═══════════════════════════════════════════════════════════════
//  EXPORTS — Ordered by pedagogical progression
// ═══════════════════════════════════════════════════════════════

export const BUILTIN_PRESETS: ScenePreset[] = [
  // The full CPU (for advanced users / reference)
  {
    id: "__builtin_cpu8",
    name: "CPU 8-bit (complet)",
    nodes: initialNodes,
    edges: initialEdges,
    builtIn: true,
  },

  // ── Level 1: Logic Gates ──
  {
    id: "__builtin_vaevient",
    name: "1. Va-et-vient",
    nodes: vaEtVientNodes,
    edges: vaEtVientEdges,
    builtIn: true,
  },
  {
    id: "__builtin_halfadder",
    name: "2. Demi-additionneur",
    nodes: halfAdderNodes,
    edges: halfAdderEdges,
    builtIn: true,
  },
  {
    id: "__builtin_srlatch",
    name: "3. Mémoire 1-bit",
    nodes: srLatchNodes,
    edges: srLatchEdges,
    builtIn: true,
  },
  {
    id: "__builtin_binaire",
    name: "4. Binaire visuel",
    nodes: binaireNodes,
    edges: binaireEdges,
    builtIn: true,
  },

  // ── Level 2: Components ──
  {
    id: "__builtin_additionneur",
    name: "5. Additionneur",
    nodes: additionneurNodes,
    edges: additionneurEdges,
    builtIn: true,
  },
  {
    id: "__builtin_comparateur",
    name: "6. Comparateur",
    nodes: comparateurNodes,
    edges: comparateurEdges,
    builtIn: true,
  },
  {
    id: "__builtin_calculatrice",
    name: "7. Calculatrice",
    nodes: calculatriceNodes,
    edges: calculatriceEdges,
    builtIn: true,
  },
  {
    id: "__builtin_mux",
    name: "8. Multiplexeur",
    nodes: muxNodes,
    edges: muxEdges,
    builtIn: true,
  },

  // ── Level 3: Systems ──
  {
    id: "__builtin_accumulateur",
    name: "9. Accumulateur",
    nodes: accumulateurNodes,
    edges: accumulateurEdges,
    builtIn: true,
  },
  {
    id: "__builtin_lecture_mem",
    name: "10. Lecture mémoire",
    nodes: lectureMemNodes,
    edges: lectureMemEdges,
    builtIn: true,
  },
  {
    id: "__builtin_rw_mem",
    name: "11. Écriture mémoire",
    nodes: rwMemNodes,
    edges: rwMemEdges,
    builtIn: true,
  },
  {
    id: "__builtin_hello",
    name: "12. Hello World",
    nodes: helloWorldNodes,
    edges: helloWorldEdges,
    builtIn: true,
  },
  {
    id: "__builtin_console_to_mem",
    name: "13. Clavier → Mémoire",
    nodes: consoleToMemNodes,
    edges: consoleToMemEdges,
    builtIn: true,
  },
  {
    id: "__builtin_plotter",
    name: "14. Dessin (Plotter)",
    nodes: plotterNodes,
    edges: plotterEdges,
    builtIn: true,
  },
  {
    id: "__builtin_majuscules",
    name: "15. Majuscules",
    nodes: majusculesNodes,
    edges: majusculesEdges,
    builtIn: true,
  },

  // Empty canvas
  {
    id: "__builtin_empty",
    name: "Vide (canvas libre)",
    nodes: [],
    edges: [],
    builtIn: true,
  },
];
