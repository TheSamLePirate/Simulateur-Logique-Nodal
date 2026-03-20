# How the Hardware Works

A complete guide to the hardware simulation layer: from basic logic gates to a working 8-bit computer.

If you want the quick, beginner-friendly overview first, start with `docs/userguide.md`.

---

## Table of Contents

1. [The Big Picture](#1-the-big-picture)
2. [Transistors and Logic Gates — The Foundation](#2-transistors-and-logic-gates--the-foundation)
3. [The Simulation Engine](#3-the-simulation-engine)
4. [Building Blocks — Simple I/O](#4-building-blocks--simple-io)
5. [8-bit Components](#5-8-bit-components)
6. [The ALU — Arithmetic Logic Unit](#6-the-alu--arithmetic-logic-unit)
7. [Memory — SRAM and Registers](#7-memory--sram-and-registers)
8. [The Clock](#8-the-clock)
9. [Grouping — Making Your Own Modules](#9-grouping--making-your-own-modules)
10. [Prebuilt Modules](#10-prebuilt-modules)
11. [The Default Scene — A Working Computer](#11-the-default-scene--a-working-computer)
12. [How Signals Propagate](#12-how-signals-propagate)

---

## 1. The Big Picture

The hardware simulator is a **visual node editor** where you connect components with wires. It works just like a real breadboard, but on screen.

```
  +---------+         +---------+         +----------+
  | Input A |---wire-->|         |         |          |
  +---------+         |  AND    |---wire-->|  Output  |
  +---------+         |  Gate   |         |  (LED)   |
  | Input B |---wire-->|         |         +----------+
  +---------+         +---------+
```

Every component is a **node** in the graph. Wires are **edges**. The simulation runs at **20 ticks per second** and propagates signals through the entire circuit.

### The Component Hierarchy

Everything in the simulator is built from simple transistors and gates upward:

```
  Level 0:  BITS          0 and 1 — that's it
  Level 1:  TRANSISTORS   Simple controlled switches
  Level 2:  GATES         AND, OR, XOR, NAND, NOR, NOT
  Level 3:  ADDERS        Full Adder (1-bit), Ripple Carry Adder (8-bit)
  Level 4:  MEMORY        D-Latch (1-bit), Register (8-bit), SRAM (1024x8)
  Level 5:  ALU           8 operations (ADD, SUB, AND, OR, XOR, NOT, SHL, SHR)
  Level 6:  PERIPHERALS   Console, Plotter, Drive, Network host bridge
  Level 7:  COMPUTER      ALU + Registers + SRAM + Clock + Peripherals = working CPU
```

The HTTP network interface is still a **software-host bridge**, not a gate-level implementation of TCP/IP. In the hardware editor it appears as a dedicated **network controller node**: you configure the URL/body in the node UI, trigger GET/POST with wires, and read the response back as bytes through `Q0-Q7`.

---

## 2. Transistors and Logic Gates — The Foundation

### Transistor Module (Simple On/Off)

The simulator now includes a **transistor** node modeled as a simple controlled switch:

```text
OUT = IN, if GATE = 1
OUT = 0,  if GATE = 0
```

That makes it useful for showing the core idea behind transistor logic:

- One transistor can act like a **controlled buffer**
- Two transistors in **series** behave like an `AND`
- Two transistors in **parallel** behave like an `OR`

There is a built-in hardware scene called **"4 bis. Transistors -> portes"** that demonstrates these patterns.

A logic gate takes 1 or 2 input bits and produces 1 output bit. These are the next layer up from transistors, and they are the **atoms** of the rest of the digital circuit.

### The 6 Gate Types

#### AND Gate
Both inputs must be 1 to output 1.

```
  A  B  │  OUT
  ──────┼──────
  0  0  │   0
  0  1  │   0
  1  0  │   0
  1  1  │   1       ← only when BOTH are 1
```

#### OR Gate
At least one input must be 1 to output 1.

```
  A  B  │  OUT
  ──────┼──────
  0  0  │   0
  0  1  │   1
  1  0  │   1
  1  1  │   1       ← when EITHER (or both) is 1
```

#### XOR Gate (Exclusive OR)
Exactly one input must be 1 to output 1.

```
  A  B  │  OUT
  ──────┼──────
  0  0  │   0
  0  1  │   1
  1  0  │   1
  1  1  │   0       ← both 1 = OFF (that's the "exclusive" part)
```

#### NAND Gate (NOT AND)
Opposite of AND. Output is 0 only when both inputs are 1.

```
  A  B  │  OUT
  ──────┼──────
  0  0  │   1
  0  1  │   1
  1  0  │   1
  1  1  │   0       ← only 0 when both are 1
```

NAND is special: **any other gate can be built from NAND gates alone**. This makes it "universal".

#### NOR Gate (NOT OR)
Opposite of OR. Output is 1 only when both inputs are 0.

```
  A  B  │  OUT
  ──────┼──────
  0  0  │   1       ← only 1 when both are 0
  0  1  │   0
  1  0  │   0
  1  1  │   0
```

#### NOT Gate (Inverter)
Only 1 input. Flips the bit.

```
  IN │  OUT
  ───┼──────
   0 │   1
   1 │   0
```

### In the Code

All gates are defined in `src/logic/gates.ts`:

```typescript
const logicGates = {
  AND:  (a, b) => (a & b),
  OR:   (a, b) => (a | b),
  XOR:  (a, b) => (a ^ b),
  NAND: (a, b) => (!(a & b) ? 1 : 0),
  NOR:  (a, b) => (!(a | b) ? 1 : 0),
  NOT:  (a)    => (a ? 0 : 1),
};
```

### Visual Feedback

In the node editor:
- Gate nodes glow **blue** when their output is 1
- Wires turn **blue and animated** when carrying a 1 signal
- Wires stay **gray** when carrying a 0

---

## 3. The Simulation Engine

**File:** `src/logic/simulation.ts`

The simulation engine is the heart of the hardware layer. It runs **20 times per second** (every 50ms) and does two things:

### Step 1: Simulate All Nodes

The function `simulateNodes(nodes, edges)` visits every node in the circuit and computes its output based on its inputs:

```
  For each node in the circuit:
    1. Look at what wires connect TO this node's inputs
    2. Trace each wire back to the SOURCE node
    3. Read the source node's output value
    4. Compute this node's output based on its type
    5. Store the new output in the node's data
```

**Note:** When a program is loaded from the Software tab onto the hardware CPU (`hwCpuLoaded=true`), `simulateNodes` is **skipped** for the CPU-driven hardware scene — instead, a dedicated `syncHwCpuToNodes` path mirrors the software CPU into the hardware nodes. The React callback still lives in `src/App.tsx`, but the heavy node-mapping logic now lives in `src/app/hardwareSync.ts`. Only `updateEdgeStyles` still runs to color/animate the wires.

This is also how the hardware page mirrors the software bootloader flow:

- the hardware CPU receives the bootloader image when the software view boots it
- console text, plotter pixels, registers, flags, RAM state, and external drive contents are mirrored live from the software CPU
- if a disk program halts and the software view returns to `unix$ `, the hardware page follows that resumed bootloader state too

That includes the bundled Linux-like userland disk installed from the software view. When you click **Install Linux Disk**, the mirrored external drive on the hardware page is replaced with the same prepared filesystem image, including its sample files, bundled userland programs, and `DIGITS` / `LETTERS` font files for `glxsh` and `glxnano`. If one of those bundled programs changes in source, reinstalling the Linux disk is what refreshes the hardware-side drive contents too.

### Step 2: Update Wire Colors

The function `updateEdgeStyles(nodes, edges)` colors each wire based on the signal it carries:

| Signal | Wire Color | Width | Animation |
|--------|-----------|-------|-----------|
| 1 (active) | Blue (#60a5fa) | 3px | Animated dash |
| 0 (inactive) | Gray (#475569) | 2px | None |

### How Input Values Are Resolved

When a node needs to know what's on one of its input wires, the engine traces backward:

```
  Node C input "a"
    ← Edge connects from Node B output "out"
      ← Node B's data.output = 1
        → so Node C receives 1 on input "a"
```

For 8-bit components, individual bits are extracted:

```
  ALU input "a3"
    ← Edge connects from Register output "q3"
      ← Register's data.value has bit 3 set
        → so ALU receives 1 on input "a3"
```

---

## 4. Building Blocks — Simple I/O

### Input Node (1-bit Switch)

The simplest component. A toggle switch that outputs 0 or 1.

```
  ┌─────────┐
  │ [0 / 1] │──── out
  └─────────┘
     click to toggle
```

- **Click** the button to flip between 0 and 1
- Glows blue when set to 1
- The output handle also glows when active

### Output Node (1-bit LED)

A simple indicator light. It reads one input bit and shows if it's 0 or 1.

```
         ┌─────┐
  in ────│  ●  │     ● = green when 1, dark when 0
         └─────┘
```

### InputNumber Node (8-bit Input)

Lets you type a number from 0 to 255. Splits it into 8 individual output bits.

```
  ┌──────────┐
  │   [42]   │──── out0 (bit 0 = 0)
  │          │──── out1 (bit 1 = 1)
  │ 00101010 │──── out2 (bit 2 = 0)
  │          │──── out3 (bit 3 = 1)
  │          │──── out4 (bit 4 = 0)
  │          │──── out5 (bit 5 = 1)
  │          │──── out6 (bit 6 = 0)
  │          │──── out7 (bit 7 = 0)
  └──────────┘
     42 = 0b00101010
```

### OutputNumber Node (8-bit Display)

Collects 8 input bits and shows the combined value as a number.

```
  in0 ────┐
  in1 ────┤ ┌──────────┐
  in2 ────┤ │          │
  in3 ────┼─│   42     │
  in4 ────┤ │          │
  in5 ────┤ └──────────┘
  in6 ────┤
  in7 ────┘
```

---

## 5. 8-bit Components

### 8-bit Adder

Adds two 8-bit numbers together. Built from 8 cascaded full adders (one per bit).

```
  a0-a7 ────┐
            ├──── s0-s7 (sum bits)
  b0-b7 ────┤
            ├──── cout (carry out: 1 if result > 255)
  cin ──────┘
```

**How a Full Adder Works (1 bit):**

A full adder adds 3 single bits: A, B, and Carry-In. It produces a Sum and a Carry-Out.

```
  A  B  Cin │ Sum  Cout
  ──────────┼───────────
  0  0   0  │  0    0
  0  0   1  │  1    0
  0  1   0  │  1    0
  0  1   1  │  0    1
  1  0   0  │  1    0
  1  0   1  │  0    1
  1  1   0  │  0    1
  1  1   1  │  1    1
```

The formulas:
```
  Sum  = A XOR B XOR Cin
  Cout = (A AND B) OR ((A XOR B) AND Cin)
```

**How the 8-bit Adder Chains Them:**

```
  Bit 0:  A0 + B0 + Cin  → S0, C0
  Bit 1:  A1 + B1 + C0   → S1, C1
  Bit 2:  A2 + B2 + C1   → S2, C2
  ...
  Bit 7:  A7 + B7 + C6   → S7, Cout
```

Each bit's carry output feeds into the next bit's carry input. This is called a **ripple carry adder** because the carry "ripples" from bit 0 to bit 7.

**In the code** (`src/logic/adder.ts`):

```typescript
function add8(a: Bit[], b: Bit[], cin: Bit = 0) {
  // For each bit: XOR for sum, AND/OR for carry
  // Carry ripples from LSB to MSB
  return { sum: [...], cout: carryOut };
}
```

### 8-bit MUX (Multiplexer)

A 2-to-1 multiplexer that selects between two 8-bit inputs based on a select signal.

```
  a0-a7 ────┐
            │
  b0-b7 ────┤── out0-out7
            │
  sel ──────┘
```

**Behavior:**
```
  sel = 0:  output = A inputs
  sel = 1:  output = B inputs
```

Used extensively in the default scene for address selection (PC vs operand), data selection (ALU vs memory), ALU B source (B register vs immediate), and PC source (PC+1 vs jump target).

### 8-bit Bus

A simple pass-through that bundles 8 individual bit wires into a group.

```
  in0 ──── out0
  in1 ──── out1
  in2 ──── out2
  in3 ──── out3
  in4 ──── out4
  in5 ──── out5
  in6 ──── out6
  in7 ──── out7
```

Useful for organizing wires and keeping the circuit clean.

---

## 6. The ALU — Arithmetic Logic Unit

The ALU is the **math brain** of the computer. It takes two 8-bit inputs and a 3-bit operation code, and produces an 8-bit result plus status flags.

```
  a0-a7 ────┐
            │         ┌──── r0-r7 (8-bit result)
  b0-b7 ────┼── ALU ──┼──── zero  (1 if result = 0)
            │         ├──── carry (overflow/borrow)
  op0-op2 ──┘         └──── neg   (1 if result >= 128)
```

### The 8 Operations

The 3-bit opcode selects which operation to perform:

| op2 | op1 | op0 | Operation | Formula | Description |
|-----|-----|-----|-----------|---------|-------------|
| 0 | 0 | 0 | **ADD** | A + B | Addition |
| 0 | 0 | 1 | **SUB** | A - B | Subtraction |
| 0 | 1 | 0 | **AND** | A & B | Bitwise AND |
| 0 | 1 | 1 | **OR** | A \| B | Bitwise OR |
| 1 | 0 | 0 | **XOR** | A ^ B | Bitwise XOR |
| 1 | 0 | 1 | **NOT** | ~A | Bitwise NOT (B ignored) |
| 1 | 1 | 0 | **SHL** | A << 1 | Shift left (multiply by 2) |
| 1 | 1 | 1 | **SHR** | A >> 1 | Shift right (divide by 2) |

### The Flags

After every operation, the ALU sets 3 status flags:

| Flag | Name | When is it 1? | Use |
|------|------|--------------|-----|
| **zero** | Zero | Result is exactly 0 | Loop termination, equality check |
| **carry** | Carry | ADD overflowed past 255, or SUB went below 0, or shifted-out bit | Overflow detection |
| **neg** | Negative | Bit 7 of result is 1 (value >= 128) | Sign detection |

### Example

```
  A = 200,  B = 100,  OP = ADD (000)

  200 + 100 = 300

  But 300 > 255, so:
    result = 300 - 256 = 44  (wraps around)
    carry  = 1               (overflow happened)
    zero   = 0               (44 is not 0)
    neg    = 0               (44 < 128)
```

### In the Code

The ALU is implemented in `src/components/nodes/ALU8Node.tsx` and simulated in `src/logic/simulation.ts`. The simulation reads the 3 opcode bits, converts them to a number (0-7), then runs the corresponding operation.

---

## 7. Memory — SRAM and Registers

### 8-bit Register (Edge-Triggered Flip-Flop)

A register **stores** an 8-bit value. It only updates on the **rising edge** of the clock (when clock goes from 0 to 1).

```
  d0-d7 ────┐
            │
  clk ──────┤ ┌── q0-q7 (stored value)
            ├─┤
  load ─────┤ └── (always outputs current value)
            │
  rst ──────┘
```

**Behavior:**

```
  Every clock tick (rising edge: clk goes 0→1):
    IF rst = 1:     value = 0            (clear/reset)
    ELSE IF load = 1: value = D inputs   (capture new value)
    ELSE:           value = unchanged    (hold)
```

The key concept is **rising edge detection**. The register remembers the previous clock value. It only acts when `prevClk = 0` AND `clk = 1`:

```
  Clock:  0  0  1  1  0  0  1  1  0
                ↑           ↑
            rising edge  rising edge
            (captures)   (captures)
```

Between rising edges, the register **holds** its value no matter what happens on the inputs.

### SRAM (Static Random Access Memory)

A 1024-byte memory array. You give it an address (0-1023) and it gives you the byte stored there. You can also write a byte to any address.

```
  a0-a7 ────┐ (8-bit address: which byte?)
            │
  d0-d7 ────┤ (8-bit data input: what to write?)
            ├── q0-q7 (8-bit data output: what's stored there?)
  we ───────┘ (write enable: save the data?)
```

**Note:** Although the address bus shown in hardware is 8-bit (a0-a7), the SRAM internally supports 1024 bytes (10-bit address space). When the software CPU is loaded, the full 10-bit addresses are used.

**Behavior:**

```
  ALWAYS: q outputs = memory[address]     (read is always active)

  IF we = 1:
    memory[address] = D inputs            (write the data)
```

**How it's organized internally:**

```
  Address 0x000: [8 bits]
  Address 0x001: [8 bits]
  Address 0x002: [8 bits]
  ...
  Address 0x3FF: [8 bits]

  Total: 1024 addresses x 8 bits = 1024 bytes = 8192 bits
```

The SRAM node displays the current address and the data at that address for debugging.

### Memory Hierarchy

```
  Fastest ──→ Slowest

  Registers       SRAM           (Real computers also have:
  (inside CPU)    (on chip)       L1 cache, L2 cache, RAM, SSD, HDD)
  8 bits each     1024 bytes
  1 per register  1 block
```

---

## 8. The Clock

The clock is a signal that **toggles between 0 and 1** at a regular frequency. It's the **heartbeat** of the computer.

```
  ┌──────────┐
  │  CLOCK   │──── out (0, 1, 0, 1, 0, 1, ...)
  │  2.0 Hz  │
  │  [- ] [+]│
  └──────────┘
```

**How it works:**

```
  Time:    0.0s  0.25s  0.5s  0.75s  1.0s  1.25s  1.5s
  Output:   0      1      0      1      0      1      0
                                                    (2 Hz = 2 toggles per second)
```

**Frequency range:** 0.5 Hz to 10 Hz (adjustable with +/- buttons)

The clock uses a **threshold-based tick counter**: it counts simulation ticks (at 20 Hz) and toggles when enough ticks have accumulated for the desired frequency.

**Why it matters:** Without a clock, a register would capture data continuously. The clock creates discrete **moments** where things happen, which makes the circuit predictable and synchronized.

**Hardware CPU speed:** When a program is loaded from the Software tab, the CPU run loop is paced by the clock node's frequency. Setting the clock to 2 Hz means the CPU executes instructions at 2 Hz (multiplied by the "i/tick" slider value). A speed indicator shows the effective instructions per second.

---

## 9. Grouping — Making Your Own Modules

One of the most powerful features. You can select several nodes, press **Ctrl+G**, and combine them into a single **group node** (a custom module).

The grouping / ungrouping flow is still orchestrated from `src/App.tsx`, but the actual graph transformation code now lives in `src/app/grouping.ts` so the behavior stays easier to read and maintain.

### How Grouping Works

1. **Select nodes** you want to group (drag a selection box)
2. Press **Ctrl+G** or click the group button
3. The system:
   - Identifies **internal edges** (both ends inside the group)
   - Identifies **boundary edges** (one end inside, one outside)
   - Creates **proxy I/O nodes** for each boundary connection
   - Wraps everything into a single group node
   - Connects external wires to the group's handles

```
  BEFORE:
    [Input A] ──→ [AND] ──→ [OR] ──→ [Output]
    [Input B] ──→ [AND]
    [Input C] ──────────→ [OR]

  SELECT: AND + OR

  AFTER:
    [Input A] ──→ ┌──────────┐ ──→ [Output]
    [Input B] ──→ │  My Gate │
    [Input C] ──→ └──────────┘
```

### Group Node Features

| Button | What it does |
|--------|-------------|
| **Inspect** | Opens a window showing the internal circuit |
| **Rename** | Change the label of the group |
| **Save** | Save as a reusable module (stored in browser localStorage) |
| **Ungroup** | Break the group back into its original nodes |

### Internal Simulation

When the simulation runs, group nodes are simulated **from the inside out**:

1. External input signals are fed to the group's internal I/O proxy nodes
2. The internal circuit is simulated (up to **10 passes** for convergence)
3. Internal output proxy nodes are read to get the group's output values

The multi-pass simulation handles chains of gates inside the group. If the group contains `A → B → C → D`, a single pass only propagates one level. Multiple passes let signals ripple through.

### Saving and Reusing Modules

When you save a group as a module:
- It appears in the sidebar under "Custom Modules"
- You can instantiate it multiple times (each gets unique IDs)
- Modules persist in localStorage (survive page refreshes)
- Each instance is independent (changing one doesn't affect others)

---

## 10. Prebuilt Modules

The simulator comes with 4 ready-to-use modules in `src/data/prebuiltModules.ts`:

### 1. Full Adder (1-bit)

Adds two bits plus a carry-in. The fundamental building block of addition.

```
  Inputs:  A, B, Cin
  Outputs: Sum, Cout
  Built from: 3 XOR + 2 AND + 1 OR = 6 gates
```

Internal circuit:
```
  A ──→ XOR ──→ XOR ──→ Sum
  B ──→ XOR     ↑
               Cin
  A ──→ AND ──→ OR ──→ Cout
  B ──→ AND     ↑
  XOR_out ─→ AND
  Cin ──────→ AND
```

### 2. Full Adder (8-bit)

Chains 8 copies of the 1-bit Full Adder with cascading carries.

```
  Inputs:  A[0..7], B[0..7], Cin
  Outputs: S[0..7], Cout
  Built from: 8 x Full Adder 1-bit = 48 gates total
```

### 3. Memory Cell (1-bit D-Latch)

Stores one bit. Built from NAND gates with cross-coupled feedback.

```
  Inputs:  D (data), WE (write enable)
  Output:  Q (stored bit)
  Built from: 1 NOT + 4 NAND = 5 gates
```

How it works:
```
  When WE = 1:  Q follows D (transparent)
  When WE = 0:  Q holds its last value (latched)
```

The cross-coupled NAND pair creates the memory effect:
```
  NAND1 output feeds into NAND2 input
  NAND2 output feeds into NAND1 input
  → creates a stable feedback loop that "remembers"
```

### 4. Memory (8-bit)

Stores one byte. 8 copies of the 1-bit D-Latch sharing one Write Enable.

```
  Inputs:  D[0..7], WE
  Outputs: Q[0..7]
  Built from: 8 x Memory 1-bit = 40 gates
```

---

## 11. The Default Scene — A Working Computer

When you open the simulator, you see a pre-built circuit that forms a **complete 8-bit von Neumann computer**. Here's what it contains:

The current default scene is laid out as a **left-to-right teaching flow** so you can read the machine by stages:

- **Fetch** on the left (`PC`, incrementer, `PC SRC MUX`)
- **Address selection** next (`ADDR MUX`, `SP/OP MUX`, `OPERAND`)
- **Memory** and **decode** in the middle (`SRAM`, `IR`)
- **Data path**, **registers**, **ALU**, and **flags** to the right
- **Peripherals** grouped below the CPU (`CONSOLE`, `PLOTTER`, `KEYBOARD`, `DRIVE`, `NETWORK`)

### Architecture

```
  FETCH          ADDRESS       MEMORY      DECODE       DATA PATH     REGISTERS      ALU         FLAGS
  PC ──────────→ ADDR MUX ──→ SRAM ──────→ IR          DATA MUX ──→  A (ACC) ────→ ALU ──────→ Z,C,N
  PC+1 ↻        SP/OP MUX ↗               IR_LOAD     sel           B             ALU B MUX
  PC SRC MUX     OPERAND                                             A_LOAD        OP0,OP1,OP2
                 SP                                                   B_LOAD

  I/O PERIPHERALS (below CPU):
  CONSOLE    PLOTTER    KEYBOARD    DRIVE    NETWORK
```

### Components

| Node | Type | Purpose |
|------|------|---------|
| **clk** | Clock (2 Hz) | Heartbeat of the system |
| **pc** | Register8 | Program Counter — next instruction address |
| **pcDisp** | OutputNumber | Shows PC value |
| **pcInc** | Adder8 | PC + 1 incrementer |
| **pcOne** | InputNumber (=1) | Constant 1 for PC increment |
| **pcSrcMux** | MUX8 | Selects PC source: PC+1 (sequential) or operand (jump) |
| **addrMux** | MUX8 | Selects memory address: PC (fetch) or the SP/operand address path |
| **addrSel** | Input | Address MUX select control |
| **operand** | InputNumber | Manual operand address / immediate value |
| **sram** | SRAM8 (2048×8 in the default scene) | Main memory node used by the hardware computer scene |
| **memWE** | Input | Memory write enable |
| **memDisp** | OutputNumber | Shows SRAM read value |
| **ir** | Register8 | Instruction Register — holds current opcode |
| **irLoad** | Input | IR load enable |
| **irDisp** | OutputNumber | Shows IR value |
| **dataMux** | MUX8 | Selects register data: ALU result or memory data |
| **dataSel** | Input | Data MUX select control |
| **aReg** | Register8 | Accumulator — main register |
| **aLoad** | Input | A register load enable |
| **aDisp** | OutputNumber | Shows accumulator value |
| **bReg** | Register8 | B register — secondary for ALU |
| **bLoad** | Input | B register load enable |
| **bDisp** | OutputNumber | Shows B register value |
| **alu** | ALU8 | Arithmetic Logic Unit (8 operations) |
| **op0, op1, op2** | Input (switches) | Select ALU operation (3-bit code) |
| **aluBMux** | MUX8 | ALU B source: B register or immediate |
| **aluImm** | Input | ALU immediate select |
| **flagZ, flagC, flagN** | Output (LEDs) | ALU status flags |
| **sp** | Register8 | Stack Pointer (starts at 0xFF/255) |
| **spLoad** | Input | SP load enable |
| **spDisp** | OutputNumber | Shows SP value |
| **spOpMux** | MUX8 | Address B source: operand or SP |
| **spSel** | Input | SP/Operand select |
| **pcJmp** | Input | PC jump select (sequential or jump target) |
| **rst** | Input | Global reset for all registers |

### I/O Peripherals

| Node | Type | Purpose |
|------|------|---------|
| **console** | Console | Text display + keyboard input |
| **consoleWr** | Input | Console write strobe |
| **consoleMode** | Input | Console mode: 0=ASCII, 1=decimal |
| **consoleClear** | Input | Clear console display |
| **consoleRd** | Input | Console read strobe (for INA instruction) |
| **plotter** | Plotter | 256×256 RGB pixel display |
| **plotDraw** | Input | Plotter draw strobe |
| **plotClear** | Input | Clear plotter display |
| **plotColorR/G/B** | InputNumber | 8-bit RGB color buses for the plotter |
| **keyboard** | Keyboard | Arrow-key + Enter input peripheral |
| **keyRd** | Input | Keyboard read strobe (for GETKEY instruction) |
| **drive** | Drive | 64 KB paged external storage peripheral |
| **driveRd** | Input | Drive read strobe |
| **driveWr** | Input | Drive write strobe |
| **driveClear** | Input | Clear the external drive |
| **network** | Network Controller | HTTP host bridge with byte output queue |
| **netGet / netPost** | Input | Start a GET or POST request |
| **netRd** | Input | Pop next response byte onto Q0-Q7 |
| **netClear** | Input | Clear queued response bytes |

### Console Node Details

The console node is a **bidirectional** peripheral with both input and output capabilities:

**Left side (inputs):**
- **D0-D7**: 8-bit data input bus (character to display)
- **WR**: Write strobe — on rising edge, displays the character on D0-D7
- **MODE**: 0 = ASCII character, 1 = decimal number
- **CLR**: Clear the display

**Right side (outputs + read strobe):**
- **Q0-Q7**: 8-bit data output bus (character read from input buffer)
- **AVAIL**: 1 if input buffer has data available, 0 if empty
- **RD**: Read strobe — on rising edge, pops next character from buffer

The console also has a **keyboard input field** at the bottom. Text typed there and submitted with Enter is queued in the input buffer. The CPU reads from this buffer using the INA instruction.

### Plotter Node Details

The plotter stores a full **RGB color** for each pixel.

- **X0-X7** and **Y0-Y7** select the pixel coordinate
- **R0-R7**, **G0-G7**, and **B0-B7** provide 8-bit red/green/blue color inputs
- **DRAW** plots one pixel on the rising edge
- **CLR** clears the whole screen
- In the default computer scene, `A` feeds `X`, `B` feeds `Y`, and the `plotColorR`, `plotColorG`, and `plotColorB` nodes drive the RGB buses directly
- When the software CPU is driving the hardware view, the current plotter color is latched by the `COLR`, `COLG`, and `COLB` instructions (these are what C `color(r, g, b)` compiles to)
- A later `DRAW` uses that latched color for the pixel it writes

If no RGB wires are attached, the plotter keeps its current color. That keeps older scenes compatible while letting hardware circuits drive colors directly.

### Keyboard Node Details

The keyboard node exposes five live key lines:

- **K0** = Left
- **K1** = Right
- **K2** = Up
- **K3** = Down
- **K4** = Enter
- **RD** is the read strobe used by the hardware-side `GETKEY` path

The node listens to your real keyboard while the hardware page is open, so it acts like a small directional controller wired straight into the scene.

### Network Controller Node Details

The network controller is a **hardware-usable host bridge**.

**Inside the node UI:**

- choose `GET` or `POST`
- enter the request URL
- optionally enter a POST body

**Left side (inputs):**

- **GET**: rising edge starts the configured `GET` request
- **POST**: rising edge starts the configured `POST` request
- **RD**: rising edge pops the next response byte onto `Q0-Q7`
- **CLR**: clears the queued response bytes and status

**Right side (outputs):**

- **Q0-Q7**: the last response byte read
- **AVAIL**: `1` when at least one unread byte is queued
- **PEND**: `1` while the HTTP request is still in flight

When the software CPU is driving the hardware view, `HTTPGET`, `HTTPPOST`, and `HTTPIN` update this node too, so the hardware tab mirrors the software network state live.

### External Drive Node Details

The external drive node is a **persistent 64 KB storage device** with **256-byte pages**. It is used both for raw byte access and for the bootloader's disk file system.

**Left side (inputs):**
- **A0-A15**: 16-bit address bus
- **D0-D7**: 8-bit data input bus for writes
- **RD**: Read strobe — on rising edge, loads the selected byte onto Q0-Q7
- **WR**: Write strobe — on rising edge, stores D0-D7 into the selected drive address
- **CLR**: Clear strobe — zeroes the whole drive

**Right side (outputs):**
- **Q0-Q7**: 8-bit data output bus containing the last byte read

The node shows the current absolute address, the current page preview, and the last read/write values, which makes it easier to debug the shared disk file system and bootloader programs visually.

In the default computer scene, only the low 8 address bits are wired directly from register `A`; larger addresses are reached through the drive page mechanism used by the software CPU.

In the software CPU, the matching instructions are:

- `DRVPG` to select the current drive page in the software CPU
- `DRVRD` to read `drive[(page << 8) + A]` into `A`
- `DRVWR` to write `B` into `drive[(page << 8) + A]`
- `DRVCLR` to erase the drive

The external drive is intentionally **not cleared by CPU reset**, so it behaves more like removable storage than normal RAM.

### How to Use It

1. **Follow the main data path visually:** Read the scene left to right: `PC` and `PC SRC MUX`, then `ADDR MUX`, then `SRAM`, then `IR`, `DATA MUX`, registers `A`/`B`, the ALU, and finally the flag outputs.

2. **Watch sequential execution:** Leave `pcJmp=0`, `addrSel=0`, and `pcLoad=1`, then tick the clock. `PC` will follow the `PC+1` path through `pcInc` and `pcSrcMux`.

3. **Experiment with jumps manually:** Change `operand` to a target address, set `pcJmp=1`, and tick with `pcLoad=1`. The next `PC` value will come from the operand path instead of `PC+1`.

4. **Switch memory addressing modes:** Use `addrSel` to choose between instruction fetch (`PC`) and the alternate address path. Then use `spSel` to decide whether that alternate path comes from `operand` or `SP`.

5. **Read and write memory:** Watch `memDisp` for the current SRAM output. To store a byte, place the value in `A`, select the target address path, and pulse `memWE`.

6. **Drive the plotter directly:** `A` already feeds plotter `X`, `B` feeds plotter `Y`, and the RGB number inputs feed the color buses. Pulse `DRAW` to place one pixel or `PLOT_CLR` to erase the image.

7. **Use live peripherals:** The console can be written or read by strobing its control pins, the keyboard reflects your arrow keys and Enter, the drive shows a paged byte preview, and the network node exposes host-backed `GET`/`POST` requests.

8. **Load a program from the Software tab:** Switch to the "Logiciel" (Software) tab, write or load an ASM/C program, assemble it, then switch back to Hardware. In direct mode the program is loaded normally. In bootloader mode, compile prepares the current program artifact, `Run` or `Step` loads the Unix-like shell if needed, and compiled programs can be stored on the external drive, listed, and launched from there without interrupting a live shell.

9. **Watch the bootloader lifecycle:** If a disk program halts, the software view automatically returns to the bootloader prompt and the Hardware page mirrors that change as well. The external drive node keeps its contents because the disk is persistent across reset.

10. **Inspect bootloader file arguments:** The shell now supports `run program file`. When you launch a program that way, the bootloader resolves the file entry first and writes its metadata to RAM at `0x1018..0x101F` before jumping to the program. That same RAM state is mirrored on the Hardware page, so you can watch a bootloader-launched ASM or C tool consume the already-resolved file pointer without doing its own directory scan.

---

## 12. How Signals Propagate

### Single Tick — What Happens

Every 50ms (20 Hz), the simulation engine runs one complete tick:

```
  1. Visit every node in order
  2. For each node:
     a. Look at all incoming edges
     b. Trace each edge to its source node
     c. Read the source's current output
     d. Compute new output based on node type
     e. Store the new output
  3. Update all edge colors
```

### Propagation Delay

In one tick, signals propagate through **one level** of nodes. A chain like:

```
  Input → Gate1 → Gate2 → Gate3 → Output
```

Takes **3 ticks** for a change at Input to reach Output. This is realistic — real circuits have propagation delays too.

### Edge Cases

**Feedback loops:** When a circuit feeds back into itself (like in a latch), the simulation converges over multiple ticks. For group nodes, the internal simulation runs up to **10 passes** per tick to ensure convergence.

**Race conditions:** Since all nodes are evaluated in order (not truly simultaneously), the evaluation order can matter for circuits with feedback. The multi-pass approach for groups mitigates this.

### Wire Colors Tell the Story

Watch the wire colors as you interact with the circuit:

| Color | Meaning |
|-------|---------|
| **Blue, animated** | Carrying a 1 signal (active) |
| **Gray, static** | Carrying a 0 signal (inactive) |

This makes it easy to visually trace signal flow through the circuit.

---

## File Structure

```
src/
  types/
    index.ts              Type definitions (Bit, GateType, GroupNodeData, etc.)

  logic/
    gates.ts              6 logic gate functions (AND, OR, XOR, NAND, NOR, NOT)
    adder.ts              8-bit ripple carry adder (add8)
    simulation.ts         Simulation engine (simulateNodes, updateEdgeStyles)

  components/nodes/
    index.ts              Node type registry (maps type names to components)
    GateNode.tsx           AND/OR/XOR/NAND/NOR/NOT gate display
    InputNode.tsx          1-bit toggle switch
    OutputNode.tsx         1-bit LED indicator
    InputNumberNode.tsx    8-bit number input (0-255)
    OutputNumberNode.tsx   8-bit number display
    Adder8Node.tsx         8-bit parallel adder
    MUX8Node.tsx           8-bit 2-to-1 multiplexer
    Bus8Node.tsx           8-bit wire bundler
    ALU8Node.tsx           8-operation ALU with flags
    SRAM8Node.tsx          1024x8 memory with address/data/WE
    Register8Node.tsx      8-bit edge-triggered register
    ClockNode.tsx          Programmable clock oscillator
    ConsoleNode.tsx        Text I/O peripheral (output + keyboard input)
    PlotterNode.tsx        256×256 pixel display peripheral
    GroupNode.tsx           Custom module container

  data/
    prebuiltModules.ts    4 ready-to-use modules (adders, latches)
    circuits.ts           Internal circuit diagrams for inspection
    initialScene.ts       Default scene (working 8-bit computer)

  app/
    grouping.ts          Pure grouping / ungrouping graph transforms
    hardwareSync.ts      Software CPU -> hardware node mirroring helpers
    nodeFactories.ts     Node and saved-module instantiation helpers
    useStoredState.ts    localStorage-backed React state helper

  App.tsx                 Main application shell (wires modules, state, UI)
```

---

## Glossary

| Term | Definition |
|------|-----------|
| **ALU** | Arithmetic Logic Unit — does math and logic operations |
| **Bit** | A single binary digit: 0 or 1 |
| **Bus** | A group of wires carrying related signals (e.g., 8 data bits) |
| **Clock** | A signal that alternates between 0 and 1 at a fixed rate |
| **Edge** | A wire connecting two nodes in the circuit |
| **Feedback** | When a circuit's output connects back to its own input |
| **Flag** | A single-bit status indicator (zero, carry, negative) |
| **Full Adder** | Circuit that adds 2 bits + carry, producing sum + carry |
| **Gate** | Basic logic component (AND, OR, XOR, NAND, NOR, NOT) |
| **Group** | Multiple nodes combined into a single reusable module |
| **Handle** | A connection point on a node (input or output) |
| **Latch** | A 1-bit memory element built from cross-coupled gates |
| **MUX** | Multiplexer — selects one of multiple inputs based on a select signal |
| **Node** | A component in the circuit (gate, register, ALU, etc.) |
| **Opcode** | A number that selects which operation to perform |
| **Register** | Fast storage that captures data on clock edge |
| **Ripple Carry** | Adder design where carry propagates bit by bit |
| **Rising Edge** | The moment a clock signal goes from 0 to 1 |
| **SRAM** | Static RAM — memory that holds data without refresh |
| **Tick** | One simulation cycle (50ms = 20 ticks per second) |
| **Universal Gate** | A gate type that can build any other gate (NAND, NOR) |
