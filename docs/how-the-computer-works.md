# How the Computer Works

A complete guide to the 8-bit computer built inside this simulator.

---

## Table of Contents

1. [The Big Picture](#1-the-big-picture)
2. [The CPU — Brain of the Computer](#2-the-cpu--brain-of-the-computer)
3. [Memory — 256 Bytes of RAM](#3-memory--256-bytes-of-ram)
4. [The Instruction Set (ISA)](#4-the-instruction-set-isa)
5. [The Assembler — Text to Bytes](#5-the-assembler--text-to-bytes)
6. [The C Compiler — High Level to ASM](#6-the-c-compiler--high-level-to-asm)
7. [Putting It All Together](#7-putting-it-all-together)
8. [Walkthrough Examples](#8-walkthrough-examples)

---

## 1. The Big Picture

This project is a **complete computer**, from logic gates to a C compiler. There are two layers:

```
Layer 2: SOFTWARE (this document)
  You write code (ASM or C) --> it runs on a simulated CPU

Layer 1: HARDWARE (the node editor)
  Logic gates --> Adders --> ALU --> Registers --> Full CPU
```

The software layer works like this:

```
  +-----------+     +------------+     +-----------+     +-------+
  | Your Code | --> | Assembler  | --> | CPU       | --> | Output|
  | (ASM or C)|     | (text->hex)|     | (executes)|     | (text)|
  +-----------+     +------------+     +-----------+     +-------+
```

If you write **C code**, there's one extra step:

```
  +--------+     +----------+     +-----------+     +-----+     +--------+
  | C Code | --> | Compiler | --> | ASM Code  | --> | ... | --> | Output |
  +--------+     +----------+     +-----------+     +-----+     +--------+
```

---

## 2. The CPU — Brain of the Computer

### What is it?

The CPU is the part that actually **runs** your program. It reads instructions from memory one by one and executes them. Our CPU is very simple — it's an **8-bit** CPU, which means:

- All numbers are between **0 and 255**
- Memory addresses are between **0 and 255** (so 256 bytes total)
- It processes **one instruction at a time**

### The Registers

Registers are tiny storage slots **inside** the CPU. They are much faster than memory. Our CPU has:

| Register | Name          | What it does                                           |
|----------|---------------|--------------------------------------------------------|
| **A**    | Accumulator   | The main register. All math happens here.              |
| **B**    | Secondary     | Helper register for two-operand operations.            |
| **PC**   | Program Counter | Points to the next instruction to execute.           |
| **SP**   | Stack Pointer | Points to the top of the stack (starts at 0xFF).       |

### The Flags

Flags are **single bits** that remember the result of the last operation:

| Flag | Name     | When is it set?                                |
|------|----------|------------------------------------------------|
| **Z** | Zero    | The result was exactly 0                        |
| **C** | Carry   | The result overflowed past 255 (or below 0)     |
| **N** | Negative | Bit 7 of the result is 1 (value >= 128)        |

Flags are used by **conditional jumps** (JZ, JNZ, JC, JN) to make decisions.

### The Fetch-Execute Cycle

Every CPU in the world does the same loop:

```
  1. FETCH:   Read the instruction at address PC
  2. DECODE:  Figure out what instruction it is
  3. EXECUTE: Do the operation (add, jump, store, etc.)
  4. REPEAT:  Move PC to the next instruction, go to step 1
```

Our CPU does this in the `step()` method of `src/cpu/cpu.ts`. Each call to `step()` executes exactly one instruction.

### The Stack

The stack is a region of memory used for **temporary storage**. Think of it like a pile of plates:

- **PUSH** puts a value on top (writes to SP, then SP goes down by 1)
- **POP** takes the top value off (SP goes up by 1, then reads)
- **CALL** pushes the return address, then jumps to a function
- **RET** pops the return address and jumps back

```
Memory addresses:    Stack grows DOWNWARD

  0xFD  [empty]          <-- SP after 3 pushes
  0xFE  [value 2]
  0xFF  [value 1]        <-- where SP started
```

---

## 3. Memory — 256 Bytes of RAM

The entire computer has **256 bytes** of memory. Everything lives here: code, variables, the stack. Here's how it's organized:

```
  Address     What's there
  --------    -------------------------------------------
  0x00-0x7F   CODE: Your program (instructions)
  0x80-0x8F   GLOBALS: Global variables (C compiler)
  0x90-0x97   SCRATCH: Temp values for multiply/divide
  0x98-0xBF   LOCALS: Function parameters & local vars
  0xC0-0xFF   STACK: Grows downward from 0xFF
```

### Important Rules

- **Code starts at address 0x00.** The PC starts here when the CPU boots.
- **The stack grows downward.** SP starts at 0xFF and decreases with each PUSH.
- **STA does NOT update flags.** This is critical for writing correct ASM.
- **POP, LDM, DEC, INC all DO update flags.** Be careful when using them between a comparison and a conditional jump!

---

## 4. The Instruction Set (ISA)

ISA = "Instruction Set Architecture" — the complete list of things the CPU can do.

### Encoding: How Instructions Become Bytes

Instructions are **variable length**:

- **1-byte instructions** (opcode 0x00-0x7F): Just the opcode, no data
- **2-byte instructions** (opcode 0x80-0xFF): Opcode + one byte of data

```
  1-byte: [ opcode ]           Example: INC = 0x01
  2-byte: [ opcode ] [ data ]  Example: LDA 42 = 0x80 0x2A
```

### Complete Instruction Reference

#### Control

| ASM     | Opcode | Bytes | What it does              |
|---------|--------|-------|---------------------------|
| `NOP`   | 0x00   | 1     | Do nothing                |
| `HLT`   | 0xFF   | 1     | Stop the CPU              |

#### Register Operations

| ASM     | Opcode | Bytes | What it does              |
|---------|--------|-------|---------------------------|
| `INC`   | 0x01   | 1     | A = A + 1                 |
| `DEC`   | 0x02   | 1     | A = A - 1                 |
| `NOT`   | 0x03   | 1     | A = bitwise NOT A         |
| `SHL`   | 0x04   | 1     | A = A shifted left by 1   |
| `SHR`   | 0x05   | 1     | A = A shifted right by 1  |
| `TAB`   | 0x06   | 1     | B = A (copy A into B)     |
| `TBA`   | 0x07   | 1     | A = B (copy B into A)     |
| `ADDB`  | 0x08   | 1     | A = A + B                 |
| `SUBB`  | 0x09   | 1     | A = A - B                 |

#### Stack

| ASM     | Opcode | Bytes | What it does              |
|---------|--------|-------|---------------------------|
| `PUSH`  | 0x11   | 1     | Push A onto the stack     |
| `POP`   | 0x12   | 1     | Pop stack into A          |
| `CALL`  | 0xB0   | 2     | Push return addr, jump    |
| `RET`   | 0x10   | 1     | Pop return addr, jump back|

#### Output (Console)

| ASM       | Opcode | Bytes | What it does                     |
|-----------|--------|-------|----------------------------------|
| `OUTA`    | 0x20   | 1     | Print A as an ASCII character    |
| `OUTD`    | 0x21   | 1     | Print A as a decimal number      |
| `OUT imm` | 0xC0   | 2     | Print immediate as ASCII char    |

#### Load / Store (Immediate Values)

| ASM       | Opcode | Bytes | What it does              |
|-----------|--------|-------|---------------------------|
| `LDA imm` | 0x80  | 2     | A = immediate value       |
| `LDB imm` | 0x81  | 2     | B = immediate value       |
| `ADD imm` | 0x82  | 2     | A = A + immediate         |
| `SUB imm` | 0x83  | 2     | A = A - immediate         |
| `AND imm` | 0x84  | 2     | A = A AND immediate       |
| `OR imm`  | 0x85  | 2     | A = A OR immediate        |
| `XOR imm` | 0x86  | 2     | A = A XOR immediate       |
| `CMP imm` | 0x87  | 2     | Set flags for A - immediate (don't store result) |

#### Load / Store (Memory)

| ASM        | Opcode | Bytes | What it does              |
|------------|--------|-------|---------------------------|
| `STA addr` | 0x90  | 2     | MEM[addr] = A             |
| `LDM addr` | 0x91  | 2     | A = MEM[addr]             |
| `STB addr` | 0x92  | 2     | MEM[addr] = B             |
| `LBM addr` | 0x93  | 2     | B = MEM[addr]             |

#### Jumps (Conditional & Unconditional)

| ASM        | Opcode | Bytes | What it does              |
|------------|--------|-------|---------------------------|
| `JMP addr` | 0xA0  | 2     | Always jump to addr       |
| `JZ addr`  | 0xA1  | 2     | Jump if Zero flag is set  |
| `JNZ addr` | 0xA2  | 2     | Jump if Zero flag is NOT set |
| `JC addr`  | 0xA3  | 2     | Jump if Carry flag is set |
| `JNC addr` | 0xA4  | 2     | Jump if Carry is NOT set  |
| `JN addr`  | 0xA5  | 2     | Jump if Negative flag     |

### Flag Behavior — What You MUST Know

This is the #1 source of bugs. Some instructions update flags, some don't:

| Updates flags?  | Instructions                             |
|-----------------|------------------------------------------|
| **YES**         | INC, DEC, NOT, SHL, SHR, TBA, ADDB, SUBB, POP, LDA, ADD, SUB, AND, OR, XOR, CMP, LDM |
| **NO**          | TAB, PUSH, STA, STB, LDB, LBM, JMP, JZ, JNZ, JC, JNC, JN, CALL, RET, OUT, OUTA, OUTD, NOP, HLT |

**Critical rule:** Never put a flag-modifying instruction between a comparison (CMP) and a conditional jump (JZ/JNZ). Example of a **bug**:

```asm
  CMP 0       ; sets Z flag
  POP         ; DESTROYS Z flag! (POP updates flags)
  JZ done     ; checks the WRONG Z flag!
```

**Correct pattern:**

```asm
  DEC         ; sets Z flag when result is 0
  STA 0xF0   ; saves A (STA does NOT touch flags)
  JZ done     ; Z flag from DEC is still valid!
```

---

## 5. The Assembler — Text to Bytes

The assembler converts human-readable ASM text into machine bytes the CPU can execute.

**File:** `src/cpu/assembler.ts`

### How It Works: Two Passes

#### Pass 1: Collect Labels

The assembler reads every line and notes where each **label** is (its byte address). It also counts how many bytes each instruction will need.

```asm
  LDA 0        ; 2 bytes → address 0x00
loop:            ; label "loop" = address 0x02
  ADD 48       ; 2 bytes → address 0x02
  OUTA         ; 1 byte  → address 0x04
  JMP loop     ; 2 bytes → address 0x05
```

After pass 1, the assembler knows: `loop = 0x02`.

#### Pass 2: Emit Bytes

Now it goes through again and converts each instruction to bytes. When it sees a label reference (like `JMP loop`), it replaces it with the address from pass 1.

```
  LDA 0    →  0x80 0x00
  ADD 48   →  0x82 0x30
  OUTA     →  0x20
  JMP loop →  0xA0 0x02    (loop was at address 0x02)
```

### ASM Syntax

```asm
  ; This is a comment (everything after ; is ignored)

label:           ; Label definition (ends with colon)
  LDA 42        ; Instruction with decimal operand
  LDA 0x2A      ; Instruction with hex operand
  LDA 0b101010  ; Instruction with binary operand
  OUT 'A'       ; Instruction with char literal (= 65)
  JMP label     ; Instruction with label reference
  .db 0x48      ; Raw byte data directive
```

### Source Map

The assembler also produces a **source map**: a table that maps each memory address back to the original line number. This is how the editor highlights the current line when you step through code.

---

## 6. The C Compiler — High Level to ASM

The C compiler lets you write programs in a simplified version of the C language. It translates C into ASM text, which is then passed to the assembler.

**Files:** `src/cpu/compiler/` directory

### The Compilation Pipeline

```
  C source code
       |
       v
  1. PREPROCESSOR  ──  handles #define (text substitution)
       |
       v
  2. LEXER         ──  splits text into tokens (words, numbers, symbols)
       |
       v
  3. PARSER        ──  builds an Abstract Syntax Tree (AST)
       |
       v
  4. CODE GENERATOR ── walks the AST and emits ASM instructions
       |
       v
  ASM text  ──>  [assembler]  ──>  machine bytes  ──>  [CPU]
```

### Step 1: Preprocessor (`index.ts`)

Simple text substitution for `#define`:

```c
#define MAX 10          // before
int x = MAX;            // → int x = 10;
```

### Step 2: Lexer / Tokenizer (`lexer.ts`)

Breaks the source text into meaningful pieces called **tokens**:

```c
int x = 42;
```

Becomes:

```
[KEYWORD:int] [IDENTIFIER:x] [EQUALS] [NUMBER:42] [SEMICOLON]
```

The lexer handles: numbers (decimal, hex), char literals (`'A'`), string literals (`"hello"`), keywords, identifiers, operators, and comments.

### Step 3: Parser (`parser.ts`)

Builds a **tree** that represents the structure of the program. This is called an AST (Abstract Syntax Tree).

```c
if (x > 5) {
  x = x + 1;
}
```

Becomes:

```
IfStmt
  condition: BinaryExpr(>)
    left:  Identifier("x")
    right: NumberLiteral(5)
  thenBranch: Block
    AssignExpr("x")
      value: BinaryExpr(+)
        left:  Identifier("x")
        right: NumberLiteral(1)
```

The parser uses **recursive descent** with operator precedence:

```
Lowest priority:   ||
                   &&
                   |
                   ^
                   &
                   == !=
                   < > <= >=
                   << >>
                   + -
Highest priority:  * / %
                   unary (! ~ - ++ --)
```

### Step 4: Code Generator (`codegen.ts`)

Walks the AST and produces ASM instructions. This is the most complex part.

#### Variable Storage

Since the CPU has no stack-relative addressing, every variable gets a **fixed memory address**:

```
  Global variables:  0x80, 0x81, 0x82, ...   (up to 16)
  Function locals:   0x98, 0x99, 0x9A, ...   (per function)
  Arithmetic temps:  0x90-0x95               (for multiply, divide, etc.)
```

#### How Expressions Are Compiled

The result of any expression always ends up in **register A**:

```c
x + y
```

Generates:

```asm
  LDM 0x98     ; A = x (load from memory)
  PUSH         ; save x on stack
  LDM 0x99     ; A = y
  TAB          ; B = y
  POP          ; A = x
  ADDB         ; A = x + y
```

#### How If/Else Works

```c
if (x > 0) {
  // then
} else {
  // else
}
```

Generates:

```asm
  ; evaluate condition (result in A: 0 or 1)
  LDM 0x98     ; A = x
  ...          ; comparison → A = 0 or 1
  CMP 0
  JZ __L1      ; if false, jump to else

  ; then branch
  ...
  JMP __L2     ; skip else branch

__L1:          ; else branch
  ...

__L2:          ; continue
```

#### How Loops Work

```c
while (x > 0) {
  x--;
}
```

Generates:

```asm
__L0:          ; loop start
  ; evaluate condition
  LDM 0x98
  ...          ; comparison
  CMP 0
  JZ __L1      ; if false, exit loop

  ; loop body
  LDM 0x98
  DEC
  STA 0x98

  JMP __L0     ; back to loop start
__L1:          ; loop end
```

#### How Function Calls Work

This is the trickiest part. Since every variable has a fixed address, we need to **save and restore** them for recursion to work.

```c
int fact(int n) {
  if (n <= 1) return 1;
  return n * fact(n - 1);
}
```

When calling a function, the compiler does:

```
  1. SAVE caller's variables to the stack  (so recursion doesn't break)
  2. SAVE arithmetic temps to the stack    (so nested multiply works)
  3. Evaluate arguments, push to stack
  4. Pop arguments into callee's param addresses
  5. CALL the function
  6. RESTORE arithmetic temps from stack
  7. RESTORE caller's variables from stack
```

This means each function call uses stack space proportional to:
`(number of variables) + 6 (temps) + (number of args) + 1 (return address)`

With 64 bytes of stack, that's enough for about 5-7 levels of recursion.

#### How Multiply Works (No MUL Instruction!)

Our CPU has no multiply instruction. The compiler generates an inline **addition loop**:

```
  a * b  =  a + a + a + ... (b times)
```

In ASM:

```asm
  ; t1 = left value, t2 = counter, t3 = result
  STA 0x90       ; t1 = left
  STA 0x91       ; t2 = right (counter)
  LDA 0
  STA 0x92       ; t3 = 0 (result)

__loop:
  LDM 0x91       ; A = counter
  CMP 0
  JZ __done      ; if counter == 0, done
  LDM 0x92       ; A = result
  LBM 0x90       ; B = left value
  ADDB           ; A = result + left
  STA 0x92       ; result = A
  LDM 0x91       ; A = counter
  DEC            ; counter--
  STA 0x91
  JMP __loop

__done:
  LDM 0x92       ; A = final result
```

#### How Division Works

Similar loop, but using **repeated subtraction**:

```
  a / b  →  count how many times b fits into a
```

### Supported C Features

| Feature | Example | Notes |
|---------|---------|-------|
| Types | `int`, `void` | int = 8-bit (0-255) |
| Variables | `int x = 5;` | Global or local |
| Functions | `int add(int a, int b) { return a + b; }` | With recursion |
| If/else | `if (x > 0) { ... } else { ... }` | |
| While | `while (x > 0) { ... }` | |
| For | `for (i = 0; i < 10; i++) { ... }` | |
| Arithmetic | `+ - * / %` | `* / %` use loops |
| Bitwise | `& \| ^ ~ << >>` | |
| Comparison | `== != < > <= >=` | Returns 0 or 1 |
| Logical | `&& \|\|` | Short-circuit |
| Assignment | `= += -=` | |
| Unary | `! ~ ++ --` | Prefix and postfix |
| I/O | `putchar(65)`, `print_num(42)`, `print("hello")` | Built-in functions |
| Constants | `#define MAX 100` | Preprocessor |

### NOT Supported

Arrays, pointers, structs, strings as values, switch/case, float, sizeof.

---

## 7. Putting It All Together

### File Structure

```
src/cpu/
  isa.ts              The instruction set definition (opcodes, registers, flags)
  cpu.ts              The CPU simulator (fetch-execute loop)
  assembler.ts        Two-pass assembler (ASM text → bytes)
  examples.ts         Example ASM programs
  cexamples.ts        Example C programs
  compiler/
    lexer.ts          Tokenizer (text → tokens)
    parser.ts         Parser (tokens → AST)
    codegen.ts        Code generator (AST → ASM text)
    index.ts          Compiler entry point (chains all phases)

src/components/software/
  SoftwareView.tsx    Main view with controls (assemble, step, run, reset)
  ASMEditor.tsx       Code editor with syntax highlighting
  CPUState.tsx        Register and flag display
  MemoryView.tsx      256-byte memory hex viewer
  ConsolePanel.tsx    Text output console
```

### The Full Pipeline

```
  1. You write code in the editor (ASM or C tab)
  2. Click "Assembler" (or "Compiler" for C)
  3. If C: Compiler produces ASM text → shown in ASM tab
  4. Assembler converts ASM text → machine bytes
  5. Bytes are loaded into CPU memory starting at address 0x00
  6. PC is set to 0x00
  7. Click "Step" to execute one instruction at a time
     or "Run" to execute continuously
  8. CPU state (registers, memory, flags) updates in real time
  9. Output appears in the console panel
  10. CPU halts when it executes HLT
```

---

## 8. Walkthrough Examples

### Example 1: Hello World (ASM)

```asm
  OUT 'H'     ; Print H
  OUT 'E'     ; Print E
  OUT 'L'     ; Print L
  OUT 'L'     ; Print L
  OUT 'O'     ; Print O
  HLT         ; Stop
```

This compiles to just 11 bytes:

```
  0xC0 0x48   OUT 'H'   (0x48 = ASCII for 'H')
  0xC0 0x45   OUT 'E'
  0xC0 0x4C   OUT 'L'
  0xC0 0x4C   OUT 'L'
  0xC0 0x4F   OUT 'O'
  0xFF        HLT
```

### Example 2: Counter 0-9 (ASM)

```asm
  LDA 0        ; Start with 0
loop:
  ADD 48       ; Add ASCII offset for '0' (48)
  OUTA         ; Print as character
  SUB 48       ; Remove ASCII offset
  INC          ; Next number
  CMP 10       ; Compare with 10
  JNZ loop     ; If not 10, loop again
  HLT          ; Done
```

Key concept: The loop uses **CMP** to set flags, then **JNZ** to check them. This works because there is no flag-modifying instruction between CMP and JNZ.

### Example 3: Factorial (C)

```c
int fact(int n) {
  if (n <= 1) {
    return 1;
  }
  return n * fact(n - 1);
}

int main() {
  print("5! = ");
  print_num(fact(5));
  return 0;
}
```

What happens under the hood:

1. Compiler allocates address 0x98 for `fact`'s parameter `n`
2. `fact(5)` → saves main's vars to stack, writes 5 to 0x98, calls `__fact`
3. Inside `fact`: checks `n <= 1`? No. Computes `n - 1 = 4`.
4. Calls `fact(4)` → saves current `n` (5) to stack, writes 4 to 0x98, calls `__fact` again
5. This repeats until `n = 1`, which returns 1
6. Unwinding: `fact(2)` computes `2 * 1 = 2`, `fact(3)` computes `3 * 2 = 6`, etc.
7. Final result: `fact(5) = 120`

Each level of recursion uses ~9 bytes of stack. With 64 bytes of stack space (0xC0-0xFF), that's enough for ~7 levels.

---

## Glossary

| Term | Definition |
|------|-----------|
| **Accumulator** | Register A — where all math results end up |
| **AST** | Abstract Syntax Tree — tree representation of parsed code |
| **Carry flag** | Set when a result goes past 255 or below 0 |
| **Fetch-Execute** | The fundamental cycle: read instruction → do it → repeat |
| **ISA** | Instruction Set Architecture — all the CPU's instructions |
| **Label** | A name for a memory address (e.g., `loop:`) |
| **Lexer** | Tokenizer — breaks text into words, numbers, symbols |
| **Mnemonic** | Human-readable name for an instruction (e.g., `ADD`) |
| **Opcode** | The numeric code for an instruction (e.g., `0x82` = ADD) |
| **Operand** | The data that goes with an instruction (e.g., the `42` in `ADD 42`) |
| **Parser** | Builds a tree structure from tokens |
| **PC** | Program Counter — address of the next instruction |
| **SP** | Stack Pointer — address of the top of the stack |
| **Two-pass** | Assembler reads the code twice: once for labels, once to emit bytes |
