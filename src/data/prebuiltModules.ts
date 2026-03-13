import type { Node, Edge } from "@xyflow/react";
import type { Bit, GroupHandle, SavedModule } from "../types";

// ============================================================
//  Helpers
// ============================================================
const mkInput = (id: string, label: string, x: number, y: number): Node => ({
  id,
  type: "input",
  position: { x, y },
  data: { label, value: 0 },
});

const mkOutput = (id: string, label: string, x: number, y: number): Node => ({
  id,
  type: "output",
  position: { x, y },
  data: { label, value: 0 },
});

const mkGate = (id: string, gateType: string, x: number, y: number): Node => ({
  id,
  type: "gate",
  position: { x, y },
  data: { type: gateType, value: 0 },
});

const mkEdge = (
  id: string,
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle: string,
): Edge => ({
  id,
  source,
  sourceHandle,
  target,
  targetHandle,
  animated: false,
  style: { stroke: "#475569", strokeWidth: 2 },
});

const mkGroupNode = (
  id: string,
  label: string,
  x: number,
  y: number,
  circuit: { nodes: Node[]; edges: Edge[] },
  inputHandles: GroupHandle[],
  outputHandles: GroupHandle[],
): Node => ({
  id,
  type: "group",
  position: { x, y },
  data: {
    label,
    circuit,
    inputHandles,
    outputHandles,
    outputs: Object.fromEntries(
      outputHandles.map((h) => [h.handleId, 0 as Bit]),
    ),
    ungroupInfo: {
      nodeOffsets: {},
      groupPosition: { x: 0, y: 0 },
      rewiredEdges: [],
      proxyNodeIds: [],
      proxyEdgeIds: [],
    },
  },
});

// ============================================================
//  1-BIT FULL ADDER  (from XOR, AND, OR gates)
//
//  Sum  = A ⊕ B ⊕ Cin
//  Cout = (A·B) + (Cin · (A⊕B))
// ============================================================
function make1BitAdderCircuit(prefix = ""): {
  nodes: Node[];
  edges: Edge[];
} {
  const p = prefix;
  const nodes: Node[] = [
    mkInput(`${p}in_a`, "A", 0, 0),
    mkInput(`${p}in_b`, "B", 0, 120),
    mkInput(`${p}in_cin`, "Cin", 0, 240),
    mkGate(`${p}xor1`, "XOR", 200, 40),
    mkGate(`${p}xor2`, "XOR", 420, 80),
    mkGate(`${p}and1`, "AND", 200, 200),
    mkGate(`${p}and2`, "AND", 420, 240),
    mkGate(`${p}or1`, "OR", 620, 220),
    mkOutput(`${p}out_sum`, "Sum", 620, 80),
    mkOutput(`${p}out_cout`, "Cout", 820, 220),
  ];
  const edges: Edge[] = [
    mkEdge(`${p}e1`, `${p}in_a`, "out", `${p}xor1`, "a"),
    mkEdge(`${p}e2`, `${p}in_b`, "out", `${p}xor1`, "b"),
    mkEdge(`${p}e3`, `${p}xor1`, "out", `${p}xor2`, "a"),
    mkEdge(`${p}e4`, `${p}in_cin`, "out", `${p}xor2`, "b"),
    mkEdge(`${p}e5`, `${p}in_a`, "out", `${p}and1`, "a"),
    mkEdge(`${p}e6`, `${p}in_b`, "out", `${p}and1`, "b"),
    mkEdge(`${p}e7`, `${p}xor1`, "out", `${p}and2`, "a"),
    mkEdge(`${p}e8`, `${p}in_cin`, "out", `${p}and2`, "b"),
    mkEdge(`${p}e9`, `${p}and1`, "out", `${p}or1`, "a"),
    mkEdge(`${p}e10`, `${p}and2`, "out", `${p}or1`, "b"),
    mkEdge(`${p}e11`, `${p}xor2`, "out", `${p}out_sum`, "in"),
    mkEdge(`${p}e12`, `${p}or1`, "out", `${p}out_cout`, "in"),
  ];
  return { nodes, edges };
}

function make1BitAdderHandles(prefix = ""): {
  input: GroupHandle[];
  output: GroupHandle[];
} {
  const p = prefix;
  return {
    input: [
      {
        handleId: "grp_in_0",
        type: "target",
        label: "A",
        internalNodeId: `${p}in_a`,
        internalHandleId: "out",
      },
      {
        handleId: "grp_in_1",
        type: "target",
        label: "B",
        internalNodeId: `${p}in_b`,
        internalHandleId: "out",
      },
      {
        handleId: "grp_in_2",
        type: "target",
        label: "Cin",
        internalNodeId: `${p}in_cin`,
        internalHandleId: "out",
      },
    ],
    output: [
      {
        handleId: "grp_out_0",
        type: "source",
        label: "Sum",
        internalNodeId: `${p}out_sum`,
        internalHandleId: "in",
      },
      {
        handleId: "grp_out_1",
        type: "source",
        label: "Cout",
        internalNodeId: `${p}out_cout`,
        internalHandleId: "in",
      },
    ],
  };
}

const fullAdder1Bit: SavedModule = (() => {
  const circuit = make1BitAdderCircuit();
  const handles = make1BitAdderHandles();
  return {
    id: "__builtin_full_adder_1bit",
    label: "Additionneur 1-bit",
    circuit,
    inputHandles: handles.input,
    outputHandles: handles.output,
  };
})();

// ============================================================
//  8-BIT ADDER  (chain of 8 × 1-bit Full Adder group nodes)
//
//  Inputs:  A0..A7, B0..B7, Cin
//  Outputs: S0..S7, Cout
// ============================================================
const fullAdder8Bit: SavedModule = (() => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const inputHandles: GroupHandle[] = [];
  const outputHandles: GroupHandle[] = [];

  let inIdx = 0;
  let outIdx = 0;

  // ---- A0..A7 input nodes ----
  for (let i = 0; i < 8; i++) {
    nodes.push(mkInput(`in_a${i}`, `A${i}`, 0, i * 70));
    inputHandles.push({
      handleId: `grp_in_${inIdx++}`,
      type: "target",
      label: `A${i}`,
      internalNodeId: `in_a${i}`,
      internalHandleId: "out",
    });
  }

  // ---- B0..B7 input nodes ----
  for (let i = 0; i < 8; i++) {
    nodes.push(mkInput(`in_b${i}`, `B${i}`, 0, 600 + i * 70));
    inputHandles.push({
      handleId: `grp_in_${inIdx++}`,
      type: "target",
      label: `B${i}`,
      internalNodeId: `in_b${i}`,
      internalHandleId: "out",
    });
  }

  // ---- Cin input node ----
  nodes.push(mkInput("in_cin", "Cin", 0, 1200));
  inputHandles.push({
    handleId: `grp_in_${inIdx++}`,
    type: "target",
    label: "Cin",
    internalNodeId: "in_cin",
    internalHandleId: "out",
  });

  // ---- S0..S7 output nodes ----
  for (let i = 0; i < 8; i++) {
    nodes.push(mkOutput(`out_s${i}`, `S${i}`, 700, i * 70));
    outputHandles.push({
      handleId: `grp_out_${outIdx++}`,
      type: "source",
      label: `S${i}`,
      internalNodeId: `out_s${i}`,
      internalHandleId: "in",
    });
  }

  // ---- Cout output node ----
  nodes.push(mkOutput("out_cout", "Cout", 700, 600));
  outputHandles.push({
    handleId: `grp_out_${outIdx++}`,
    type: "source",
    label: "Cout",
    internalNodeId: "out_cout",
    internalHandleId: "in",
  });

  // ---- 8 × nested 1-bit Full Adder group nodes ----
  for (let i = 0; i < 8; i++) {
    const prefix = `fa${i}_`;
    const faCircuit = make1BitAdderCircuit(prefix);
    const faHandles = make1BitAdderHandles(prefix);

    nodes.push(
      mkGroupNode(
        `fa_${i}`,
        `FA${i}`,
        350,
        i * 70,
        faCircuit,
        faHandles.input,
        faHandles.output,
      ),
    );

    // A[i] → FA[i].A
    edges.push(mkEdge(`ea${i}`, `in_a${i}`, "out", `fa_${i}`, "grp_in_0"));
    // B[i] → FA[i].B
    edges.push(mkEdge(`eb${i}`, `in_b${i}`, "out", `fa_${i}`, "grp_in_1"));
    // Carry chain: Cin → FA0.Cin, FA[i-1].Cout → FA[i].Cin
    if (i === 0) {
      edges.push(mkEdge("ecin", "in_cin", "out", "fa_0", "grp_in_2"));
    } else {
      edges.push(
        mkEdge(`ecarry${i}`, `fa_${i - 1}`, "grp_out_1", `fa_${i}`, "grp_in_2"),
      );
    }
    // FA[i].Sum → S[i]
    edges.push(mkEdge(`es${i}`, `fa_${i}`, "grp_out_0", `out_s${i}`, "in"));
  }

  // Last carry → Cout
  edges.push(mkEdge("ecout", "fa_7", "grp_out_1", "out_cout", "in"));

  return {
    id: "__builtin_full_adder_8bit",
    label: "Additionneur 8-bit",
    circuit: { nodes, edges },
    inputHandles,
    outputHandles,
  };
})();

// ============================================================
//  1-BIT MEMORY  (D-Latch from NAND + NOT gates)
//
//  WE=1 → Q follows D
//  WE=0 → Q holds its value (feedback loop)
//
//  NAND1(D, WE)    = S̄
//  NOT(D)          = D̄
//  NAND2(D̄, WE)   = R̄
//  NAND3(S̄, Q̄)    = Q    ← SR latch
//  NAND4(R̄, Q)    = Q̄    ← SR latch
// ============================================================
function make1BitMemoryCircuit(prefix = ""): {
  nodes: Node[];
  edges: Edge[];
} {
  const p = prefix;
  const nodes: Node[] = [
    mkInput(`${p}in_d`, "D", 0, 0),
    mkInput(`${p}in_we`, "WE", 0, 160),
    mkGate(`${p}not1`, "NOT", 180, 100),
    mkGate(`${p}nand1`, "NAND", 320, 20),
    mkGate(`${p}nand2`, "NAND", 320, 160),
    mkGate(`${p}nand3`, "NAND", 520, 20),
    mkGate(`${p}nand4`, "NAND", 520, 160),
    mkOutput(`${p}out_q`, "Q", 720, 20),
  ];
  const edges: Edge[] = [
    // D → NAND1.a, D → NOT
    mkEdge(`${p}e1`, `${p}in_d`, "out", `${p}nand1`, "a"),
    mkEdge(`${p}e2`, `${p}in_d`, "out", `${p}not1`, "in"),
    // WE → NAND1.b, WE → NAND2.b
    mkEdge(`${p}e3`, `${p}in_we`, "out", `${p}nand1`, "b"),
    mkEdge(`${p}e4`, `${p}in_we`, "out", `${p}nand2`, "b"),
    // NOT → NAND2.a
    mkEdge(`${p}e5`, `${p}not1`, "out", `${p}nand2`, "a"),
    // SR latch: NAND1 → NAND3.a, NAND2 → NAND4.a
    mkEdge(`${p}e6`, `${p}nand1`, "out", `${p}nand3`, "a"),
    mkEdge(`${p}e7`, `${p}nand2`, "out", `${p}nand4`, "a"),
    // Feedback: NAND4.out (Q̄) → NAND3.b, NAND3.out (Q) → NAND4.b
    mkEdge(`${p}e8`, `${p}nand4`, "out", `${p}nand3`, "b"),
    mkEdge(`${p}e9`, `${p}nand3`, "out", `${p}nand4`, "b"),
    // Q output
    mkEdge(`${p}e10`, `${p}nand3`, "out", `${p}out_q`, "in"),
  ];
  return { nodes, edges };
}

function make1BitMemoryHandles(prefix = ""): {
  input: GroupHandle[];
  output: GroupHandle[];
} {
  const p = prefix;
  return {
    input: [
      {
        handleId: "grp_in_0",
        type: "target",
        label: "D",
        internalNodeId: `${p}in_d`,
        internalHandleId: "out",
      },
      {
        handleId: "grp_in_1",
        type: "target",
        label: "WE",
        internalNodeId: `${p}in_we`,
        internalHandleId: "out",
      },
    ],
    output: [
      {
        handleId: "grp_out_0",
        type: "source",
        label: "Q",
        internalNodeId: `${p}out_q`,
        internalHandleId: "in",
      },
    ],
  };
}

const memory1Bit: SavedModule = (() => {
  const circuit = make1BitMemoryCircuit();
  const handles = make1BitMemoryHandles();
  return {
    id: "__builtin_memory_1bit",
    label: "Mémoire 1-bit (D-Latch)",
    circuit,
    inputHandles: handles.input,
    outputHandles: handles.output,
  };
})();

// ============================================================
//  8-BIT MEMORY  (8 × 1-bit D-Latch, shared WE)
//
//  Inputs:  D0..D7, WE
//  Outputs: Q0..Q7
// ============================================================
const memory8Bit: SavedModule = (() => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const inputHandles: GroupHandle[] = [];
  const outputHandles: GroupHandle[] = [];

  let inIdx = 0;
  let outIdx = 0;

  // ---- D0..D7 input nodes ----
  for (let i = 0; i < 8; i++) {
    nodes.push(mkInput(`in_d${i}`, `D${i}`, 0, i * 80));
    inputHandles.push({
      handleId: `grp_in_${inIdx++}`,
      type: "target",
      label: `D${i}`,
      internalNodeId: `in_d${i}`,
      internalHandleId: "out",
    });
  }

  // ---- WE input node (shared) ----
  nodes.push(mkInput("in_we", "WE", 0, 680));
  inputHandles.push({
    handleId: `grp_in_${inIdx++}`,
    type: "target",
    label: "WE",
    internalNodeId: "in_we",
    internalHandleId: "out",
  });

  // ---- Q0..Q7 output nodes ----
  for (let i = 0; i < 8; i++) {
    nodes.push(mkOutput(`out_q${i}`, `Q${i}`, 650, i * 80));
    outputHandles.push({
      handleId: `grp_out_${outIdx++}`,
      type: "source",
      label: `Q${i}`,
      internalNodeId: `out_q${i}`,
      internalHandleId: "in",
    });
  }

  // ---- 8 × nested 1-bit Memory group nodes ----
  for (let i = 0; i < 8; i++) {
    const prefix = `mem${i}_`;
    const memCircuit = make1BitMemoryCircuit(prefix);
    const memHandles = make1BitMemoryHandles(prefix);

    nodes.push(
      mkGroupNode(
        `mem_${i}`,
        `M${i}`,
        320,
        i * 80,
        memCircuit,
        memHandles.input,
        memHandles.output,
      ),
    );

    // D[i] → Mem[i].D
    edges.push(mkEdge(`ed${i}`, `in_d${i}`, "out", `mem_${i}`, "grp_in_0"));
    // WE → Mem[i].WE  (shared)
    edges.push(mkEdge(`ewe${i}`, "in_we", "out", `mem_${i}`, "grp_in_1"));
    // Mem[i].Q → Q[i]
    edges.push(mkEdge(`eq${i}`, `mem_${i}`, "grp_out_0", `out_q${i}`, "in"));
  }

  return {
    id: "__builtin_memory_8bit",
    label: "Mémoire 8-bit",
    circuit: { nodes, edges },
    inputHandles,
    outputHandles,
  };
})();

// ============================================================
//  Export all built-in modules
// ============================================================
export const PREBUILT_MODULES: SavedModule[] = [
  fullAdder1Bit,
  fullAdder8Bit,
  memory1Bit,
  memory8Bit,
];
