# How the Computer Works

A complete guide to the 8-bit computer built inside this simulator.

---

## Table of Contents

1. [The Big Picture](#1-the-big-picture)
2. [The CPU — Brain of the Computer](#2-the-cpu--brain-of-the-computer)
3. [Memory — 8192 Bytes of RAM](#3-memory--8192-bytes-of-ram)
4. [The Instruction Set (ISA)](#4-the-instruction-set-isa)
5. [The Assembler — Text to Bytes](#5-the-assembler--text-to-bytes)
6. [The C Compiler — High Level to ASM](#6-the-c-compiler--high-level-to-asm)
7. [Putting It All Together](#7-putting-it-all-together)
8. [Walkthrough Examples](#8-walkthrough-examples)
9. [Testing](#9-testing)

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
  +-----------+     +------------+     +-----------+     +--------+
  | Your Code | --> | Assembler  | --> | CPU       | --> | Output |
  | (ASM or C)|     | (text->hex)|     | (executes)|     | (text) |
  +-----------+     +------------+     +-----------+     +--------+
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
- Memory addresses are **13-bit** (0 to 8191), so **8192 bytes** total
- It processes **one instruction at a time**

### The Registers

Registers are tiny storage slots **inside** the CPU. They are much faster than memory. Our CPU has:

| Register | Name          | What it does                                           |
|----------|---------------|--------------------------------------------------------|
| **A**    | Accumulator   | The main register. All math happens here.              |
| **B**    | Secondary     | Helper register for two-operand operations.            |
| **PC**   | Program Counter | Points to the next instruction to execute (16-bit, masked to 13 bits). |
| **SP**   | Stack Pointer | Points to the top of the stack (starts at 0x1FFF).     |

### The Flags

Flags are **single bits** that remember the result of the last operation:

| Flag | Name     | When is it set?                                |
|------|----------|------------------------------------------------|
| **Z** | Zero    | The result was exactly 0                        |
| **C** | Carry   | The result overflowed past 255 (or below 0)     |
| **N** | Negative | Bit 7 of the result is 1 (value >= 128)        |

Flags are used by **conditional jumps** (JZ, JNZ, JC, JNC, JN) to make decisions.

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
- **CALL** pushes the 16-bit return address (2 bytes), then jumps to a function
- **RET** pops the 16-bit return address and jumps back

```
Memory addresses:    Stack grows DOWNWARD

  0x1FFD [empty]          <-- SP after 3 pushes
  0x1FFE [value 2]
  0x1FFF [value 1]        <-- where SP started
```

---

## 3. Memory — 8192 Bytes of RAM

The entire computer has **8192 bytes** of memory (13-bit address space, 0x0000–0x1FFF). Everything lives here: code, variables, the stack. Here's how it's organized:

```
  Address           What's there
  ---------------   -------------------------------------------
  0x0000-0x0FFF     CODE: Your program (instructions, 4096 bytes max)
  0x1000-0x100F     GLOBALS: Global variables (C compiler, 16 max)
  0x1010-0x1015     SCRATCH: Compiler temps / runtime helper state
  0x1017            SCRATCH: Return value save
  0x1018-0x17FF     FRAMES: Reusable function params, locals, arrays
  0x1800-0x1FFF     STACK: Grows downward from 0x1FFF (2048 bytes)
```

The important compiler detail is that **locals are no longer globally unique forever**. The compiler now packs variables into reusable **function frames** and reuses block-local slots when their scopes do not overlap. Two unrelated functions can share the same RAM addresses if they can never be active at the same time.

### Important Rules

- **Code starts at address 0x0000.** The PC starts here when the CPU boots.
- **The stack grows downward.** SP starts at 0x1FFF and decreases with each PUSH.
- **STA does NOT update flags.** This is critical for writing correct ASM.
- **POP, LDM, DEC, INC all DO update flags.** Be careful when using them between a comparison and a conditional jump!

---

## 4. The Instruction Set (ISA)

ISA = "Instruction Set Architecture" — the complete list of things the CPU can do.

### Encoding: How Instructions Become Bytes

Instructions are **variable length**:

- **1-byte instructions** (opcode 0x00-0x7F): Just the opcode, no data
- **3-byte instructions** (opcode 0x80-0xFF): Opcode + 16-bit little-endian operand (2 data bytes)

```
  1-byte: [ opcode ]                        Example: INC = 0x01
  3-byte: [ opcode ] [ low byte ] [ high byte ]  Example: LDA 42 = 0x80 0x2A 0x00
```

### Complete Instruction Reference

#### Control

| ASM     | Opcode | Bytes | What it does              |
|---------|--------|-------|---------------------------|
| `NOP`   | 0x00   | 1     | Do nothing                |
| `HLT`   | 0x0F   | 1     | Stop the CPU              |

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
| `ANDB`  | 0x13   | 1     | A = A AND B               |
| `ORB`   | 0x14   | 1     | A = A OR B                |
| `XORB`  | 0x15   | 1     | A = A XOR B               |
| `CMPB`  | 0x16   | 1     | Set flags for A - B       |
| `MULB`  | 0x17   | 1     | A = A * B                 |
| `DIVB`  | 0x18   | 1     | A = A / B                 |
| `MODB`  | 0x19   | 1     | A = A % B                 |

#### Input

| ASM     | Opcode | Bytes | What it does                                    |
|---------|--------|-------|-------------------------------------------------|
| `INA`   | 0x0A   | 1     | A = next char from input buffer (0 if empty, sets Z) |
| `GETKEY`| 0x0B   | 1     | A = keyboard state for key index in A           |
| `RAND`  | 0x0C   | 1     | A = pseudo-random 8-bit value                   |
| `SLEEP` | 0x0D   | 1     | Pause execution for A cycles                    |

`INA` is **non-blocking**: if the input buffer is empty, A is set to 0 and the Zero flag is set. Programs typically busy-wait:

```asm
wait:
  INA          ; read from buffer
  CMP 0        ; empty?
  JZ wait      ; yes → keep waiting
  ; A now contains the character
```

#### Stack

| ASM     | Opcode | Bytes | What it does                    |
|---------|--------|-------|---------------------------------|
| `PUSH`  | 0x11   | 1     | Push A onto the stack           |
| `POP`   | 0x12   | 1     | Pop stack into A                |
| `CALL`  | 0xB0   | 3     | Push 16-bit return addr, jump   |
| `RET`   | 0x10   | 1     | Pop 16-bit return addr, jump back |

#### Output (Console & Plotter)

| ASM       | Opcode | Bytes | What it does                     |
|-----------|--------|-------|----------------------------------|
| `OUTA`    | 0x20   | 1     | Print A as an ASCII character    |
| `OUTD`    | 0x21   | 1     | Print A as a decimal number      |
| `COLR`    | 0x1A   | 1     | Set plotter red channel from A   |
| `COLG`    | 0x1B   | 1     | Set plotter green channel from A |
| `COLB`    | 0x1C   | 1     | Set plotter blue channel from A  |
| `HTTPIN`  | 0x1D   | 1     | A = next byte from the HTTP response buffer |
| `DRAW`    | 0x22   | 1     | Plot pixel at (A, B) in current plotter color |
| `CLR`     | 0x23   | 1     | Clear all pixels on plotter      |
| `DRVRD`   | 0x24   | 1     | A = external_drive[(page<<8) + A] |
| `DRVWR`   | 0x25   | 1     | external_drive[(page<<8) + A] = B |
| `DRVCLR`  | 0x26   | 1     | Clear the external drive         |
| `DRVPG`   | 0x27   | 1     | Select the current external drive page |
| `OUT imm` | 0xC0   | 3     | Print immediate as ASCII char    |

#### External Drive I/O

The CPU has a built-in **8 KB external drive** that acts like a tiny persistent storage device.

- `DRVPG` selects one of `32` drive pages
- `DRVRD` uses the current page plus the current value of `A` as the drive address and replaces `A` with the byte stored there
- `DRVWR` uses the current page plus `A` as the drive address and writes the current value of `B`
- `DRVCLR` fills all `8192` drive bytes with `0`

Unlike normal RAM, the external drive contents are **not erased by CPU reset**. This makes it useful for tiny file systems and saved state between runs.

Example:

```asm
  LDA 1
  DRVPG         ; select page 1
  LDA 10        ; offset 10 inside that page
  LDB 65        ; ASCII 'A'
  DRVWR         ; drive[0x010A] = 65

  LDA 10
  DRVRD         ; A = drive[0x010A]
  OUTA          ; prints A
```

#### Arithmetic / Logic with Immediate

| ASM       | Opcode | Bytes | What it does              |
|-----------|--------|-------|---------------------------|
| `LDA imm` | 0x80  | 3     | A = immediate value       |
| `LDB imm` | 0x81  | 3     | B = immediate value       |
| `ADD imm` | 0x82  | 3     | A = A + immediate         |
| `SUB imm` | 0x83  | 3     | A = A - immediate         |
| `AND imm` | 0x84  | 3     | A = A AND immediate       |
| `OR imm`  | 0x85  | 3     | A = A OR immediate        |
| `XOR imm` | 0x86  | 3     | A = A XOR immediate       |
| `CMP imm` | 0x87  | 3     | Set flags for A - immediate (don't store result) |

#### Load / Store (Memory)

| ASM        | Opcode | Bytes | What it does              |
|------------|--------|-------|---------------------------|
| `STA addr` | 0x90  | 3     | MEM[addr] = A             |
| `LDM addr` | 0x91  | 3     | A = MEM[addr]             |
| `STB addr` | 0x92  | 3     | MEM[addr] = B             |
| `LBM addr` | 0x93  | 3     | B = MEM[addr]             |
| `LDAI addr`| 0x94  | 3     | A = MEM[addr + A] (indexed load)  |
| `STAI addr`| 0x95  | 3     | MEM[addr + B] = A (indexed store) |
| `HTTPGET addr` | 0x96 | 3  | Start HTTP GET using a zero-terminated URL string in memory |
| `HTTPPOST addr`| 0x97 | 3  | Start HTTP POST using `url\0body\0` data in memory |

#### Host Network I/O

The simulator can also bridge to the browser's JavaScript `fetch()` API.

- `HTTPGET addr` reads a zero-terminated URL string from memory and starts a `GET`
- `HTTPPOST addr` reads `url\0body\0` from memory and starts a `POST`
- `HTTPIN` returns the next byte of the response body
- while a request is still pending and no byte is ready yet, `HTTPIN` sets the Carry flag

On the hardware tab, these instructions are mirrored by the **network controller** node, which shows pending state and exposes response bytes on `Q0-Q7`.

That Carry-while-pending behavior is what lets the C built-in `gethttpchar()` block without confusing "still waiting" with "end of response".

#### Jumps (Conditional & Unconditional)

| ASM        | Opcode | Bytes | What it does              |
|------------|--------|-------|---------------------------|
| `JMP addr` | 0xA0  | 3     | Always jump to addr       |
| `JZ addr`  | 0xA1  | 3     | Jump if Zero flag is set  |
| `JNZ addr` | 0xA2  | 3     | Jump if Zero flag is NOT set |
| `JC addr`  | 0xA3  | 3     | Jump if Carry flag is set |
| `JNC addr` | 0xA4  | 3     | Jump if Carry is NOT set  |
| `JN addr`  | 0xA5  | 3     | Jump if Negative flag     |

### Flag Behavior — What You MUST Know

This is the #1 source of bugs. Some instructions update flags, some don't:

| Updates flags?  | Instructions                             |
|-----------------|------------------------------------------|
| **YES**         | INC, DEC, NOT, SHL, SHR, TBA, ADDB, SUBB, ANDB, ORB, XORB, CMPB, MULB, DIVB, MODB, INA, GETKEY, RAND, POP, LDA, ADD, SUB, AND, OR, XOR, CMP, LDM, LDAI, HTTPIN |
| **NO**          | TAB, PUSH, STA, STB, LDB, LBM, STAI, HTTPGET, HTTPPOST, JMP, JZ, JNZ, JC, JNC, JN, CALL, RET, OUT, OUTA, OUTD, COLR, COLG, COLB, DRAW, CLR, SLEEP, NOP, HLT |

**Critical rule:** Never put a flag-modifying instruction between a comparison (CMP) and a conditional jump (JZ/JNZ). Example of a **bug**:

```asm
  CMP 0       ; sets Z flag
  POP         ; DESTROYS Z flag! (POP updates flags)
  JZ done     ; checks the WRONG Z flag!
```

**Correct pattern:**

```asm
  DEC         ; sets Z flag when result is 0
  STA 0x1000  ; saves A (STA does NOT touch flags)
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
  LDA 0        ; 3 bytes → address 0x000
loop:            ; label "loop" = address 0x003
  ADD 48       ; 3 bytes → address 0x003
  OUTA         ; 1 byte  → address 0x006
  JMP loop     ; 3 bytes → address 0x007
```

After pass 1, the assembler knows: `loop = 0x003`.

#### Pass 2: Emit Bytes

Now it goes through again and converts each instruction to bytes. When it sees a label reference (like `JMP loop`), it replaces it with the address from pass 1.

```
  LDA 0    →  0x80 0x00 0x00
  ADD 48   →  0x82 0x30 0x00
  OUTA     →  0x20
  JMP loop →  0xA0 0x03 0x00    (loop was at address 0x003)
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

If you want a practical "how to write programs" guide, read [docs/c-language-guide.md](/Users/olivierveinand/Downloads/Simulateur%20Logique%20Nodal%20%281%29/docs/c-language-guide.md). This section focuses on how the compiler works internally.

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

Since the CPU has no stack-relative addressing, every variable still gets a **fixed memory address while it is active**, but the compiler now reuses those addresses aggressively:

```
  Global variables:  0x1000, 0x1001, 0x1002, ... (up to 16)
  Arithmetic temps:  0x1010-0x1015               (compiler/runtime helper scratch)
  Return value save: 0x1017
  Function frames:   0x1018, 0x1019, 0x101A, ... (reused across scopes/functions)
  Stack:             0x1800-0x1FFF               (grows downward from 0x1FFF)
```

The code generator builds a small call graph, detects recursive functions, and packs frames so that:

- different blocks in one function can reuse the same slot
- unrelated non-recursive functions can reuse the same addresses
- recursive functions still work by saving their current frame on the stack before the recursive call

#### How Expressions Are Compiled

The result of any expression always ends up in **register A**:

For example, `x + 5` can compile directly to:

```asm
  LDM 0x1018     ; A = x
  ADD 5          ; A = x + 5
```

And `x + y` still uses both registers:

```asm
  LDM 0x1018     ; A = x
  PUSH
  LDM 0x1019     ; A = y
  TAB            ; B = y
  POP            ; A = x
  ADDB           ; A = x + y
```

The compiler also performs small optimizations before emitting ASM:

- constant folding: `2 + 3` becomes `LDA 5`
- dead branch removal: `if (0) { ... }` disappears
- immediate specialization: `x & 1`, `x + 3`, `x == 0` use immediate opcodes
- tiny peephole cleanup: useless jumps like `JMP next_label` are removed

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
  LDM 0x1018     ; A = x
  ...           ; comparison → A = 0 or 1
  CMP 0
  JZ __L1       ; if false, jump to else

  ; then branch
  ...
  JMP __L2      ; skip else branch

__L1:           ; else branch
  ...

__L2:           ; continue
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
  LDM 0x1018
  ...          ; comparison
  CMP 0
  JZ __L1      ; if false, exit loop

  ; loop body
  LDM 0x1018
  DEC
  STA 0x1018

  JMP __L0     ; back to loop start
__L1:          ; loop end
```

#### How Function Calls Work

This is the trickiest part. The compiler now uses **two calling strategies**:

- **non-recursive / frame-disjoint calls:** just evaluate args, write them into the callee frame, `CALL`, and continue
- **recursive calls:** save the current frame to the stack first, then restore it after `RET`

```c
int fact(int n) {
  if (n <= 1) return 1;
  return n * fact(n - 1);
}
```

For a recursive call, the compiler does:

```
  1. SAVE caller's current frame to the stack
  2. Evaluate arguments, push to stack
  3. Pop arguments into callee frame addresses
  4. CALL the function
  5. RESTORE caller's frame from stack
```

For a non-recursive helper call, steps 1 and 5 are skipped completely. That makes ordinary helper functions much cheaper in both code size and stack usage.

This means stack use is now mostly:
`recursive frame size + number of args + 2 (16-bit return address)`

With 2048 bytes of stack (0x1800-0x1FFF), recursion is still supported, but ordinary helper-heavy programs are much lighter than before.

#### How Arithmetic and Bitwise Ops Work Now

The ISA now has direct register-register arithmetic and logic instructions:

- `ANDB`, `ORB`, `XORB`, `CMPB`
- `MULB`, `DIVB`, `MODB`

So operations like `x * y`, `x % y`, and `x ^ y` no longer need large inline loops in generated assembly.

Example:

```asm
  LDM 0x1018     ; A = x
  PUSH
  LDM 0x1019     ; A = y
  TAB            ; B = y
  POP            ; A = x
  MULB           ; A = x * y
```

Variable shifts still need loops, but the compiler now emits **shared runtime helpers** like `__rt_shl` and `__rt_shr` only if the program actually uses them. That avoids duplicating the same shift loop everywhere.

#### How Arrays Work (Indirect Addressing)

Arrays use two special opcodes for **indexed memory access**:

- `LDAI base` — Indexed load: `A ← MEM[base + A]` (index in A)
- `STAI base` — Indexed store: `MEM[base + B] ← A` (index in B, value in A)

Arrays are allocated as contiguous bytes in the same memory regions as scalars (globals at 0x1000+, locals at 0x1018+).

**Reading** `x = arr[i]`:

```asm
  ; compute index → A
  LDM 0x101A      ; A = i
  LDAI 0x1018     ; A = MEM[0x1018 + A]  (arr[i])
  STA 0x101B      ; x = result
```

**Writing** `arr[i] = expr`:

```asm
  ; compute value → A
  LDM 0x101B      ; A = value
  PUSH            ; save value on stack
  ; compute index → A
  LDM 0x101A      ; A = i
  TAB             ; B = index
  POP             ; A = value (restored)
  STAI 0x1018     ; MEM[0x1018 + B] = A  (arr[i] = value)
```

**Complex index** `arr[j+1]` works because the index expression is fully evaluated into A before the LDAI/STAI instruction.

Local arrays live inside the same reusable frames as scalars. For recursive calls, the current frame is saved first, so **recursion with arrays** still works correctly.

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
| Arrays | `int arr[10]; arr[i] = x; x = arr[i];` | Indexed via LDAI/STAI |
| Output | `putchar(65)`, `print_num(42)`, `print("hello")` | Built-in functions |
| Input | `getchar()`, `getKey(0)`, `get("...")`, `post("...", "...")`, `gethttpchar()` | Console, keyboard, and HTTP built-ins |
| Plotter | `color(r, g, b)`, `draw(x, y)`, `clear()` | RGB drawing built-ins |
| External drive | `drive_read(a)`, `drive_write(a, v)`, `drive_clear()`, `drive_set_page(p)`, `drive_read_at(p, a)`, `drive_write_at(p, a, v)` | 8 KB persistent storage |
| Constants | `#define MAX 100` | Preprocessor |

### Console Input in C

The `getchar()` built-in reads a single character from the console input buffer. It **blocks** (busy-waits) until a character is available:

```c
int main() {
  int c;
  while (1) {
    c = getchar();     // waits for a character
    putchar(c);        // echoes it back
  }
  return 0;
}
```

### HTTP Input in C

The compiler also exposes the host browser's `fetch()` API through three built-ins:

- `get("url")` starts a `GET`
- `post("url", "body")` starts a `POST`
- `gethttpchar()` blocks until the next response byte is ready, then returns `0` at end-of-response

Example:

```c
int main() {
  int c;
  get("https://jsonplaceholder.typicode.com/todos/1");
  while ((c = gethttpchar()) != 0) {
    putchar(c);
  }
  return 0;
}
```

Right now these functions only accept string literals, because this tiny C dialect does not yet support normal pointer-based strings.

Under the hood, `getchar()` compiles to a busy-wait loop:

```asm
__wait:
  INA           ; read from input buffer
  CMP 0         ; empty?
  JZ __wait     ; yes → keep waiting
  ; A now contains the character
```

### External Drive in C

The compiler exposes the external drive with page-aware built-ins:

- `drive_read(addr)` returns the byte stored at drive address `addr`
- `drive_write(addr, value)` writes one byte and evaluates to `value`
- `drive_clear()` fills the whole drive with `0`
- `drive_set_page(page)` selects the active page for subsequent `drive_read` / `drive_write`
- `drive_read_at(page, addr)` reads directly from any page
- `drive_write_at(page, addr, value)` writes directly to any page

The drive is **8192 bytes total** and survives `reset()`, so it can be used as a tiny persistent disk.

```c
int main() {
  drive_clear();
  drive_set_page(1);
  drive_write(10, 65);
  putchar(drive_read(10));
  putchar(drive_read_at(1, 10));
  return 0;
}
```

One of the bundled C examples, `FS Disque Externe`, builds a shared disk file system on top of these operations. The bootloader shell uses the same on-disk format, so programs compiled to disk from the software view are visible there too.

### Bootloader and Disk Programs

The software view now has an optional **bootloader mode**.

- **Use bootloader** switches the software CPU to a shell-based boot flow
- **Compile** still compiles the current ASM or C source, but in bootloader mode it prepares the program artifact without interrupting a shell that is already running
- **Run** and **Step** automatically load the boot shell into high memory if needed
- **Compile to Disk** stores the currently compiled program onto the external drive in the bootloader's disk format without stopping the live shell
- the boot shell can then `ls`, `run x`, `cat x`, `free`, and `help`

The bootloader lives in upper RAM and copies a selected disk program down to address `0x0000` before jumping to it. That means disk-loaded programs can use the normal code budget instead of a reduced boot-only limit.

When a disk-loaded C or ASM program executes `HLT` while bootloader mode is active, the software CPU does **not** stay dead. The software view reloads the shell and returns to the `unix$ ` prompt automatically, with a newline inserted before the resumed prompt.

### Shared Disk Format

The bootloader shell and the `FS Disque Externe` example now use the **same disk layout**.

- Disk byte `0` = magic marker
- Disk byte `1` = filesystem version
- The directory begins at byte `0x10`
- Each directory entry stores:
  name, type, start page, page count, size
- Type `1` = normal text file
- Type `2` = runnable program

That means:

- programs compiled with **Compile to Disk** appear in `FS Disque Externe`
- text files created by `FS Disque Externe` appear in the boot shell `ls`
- the boot shell refuses to `run` text files, and `FS Disque Externe` refuses to overwrite program entries

### NOT Supported

Pointers, structs, strings as values, switch/case, float, sizeof, array initializers, 2D arrays.

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
  bootloader.ts       Bootable disk format + Unix-like shell image
  compiler/
    lexer.ts          Tokenizer (text → tokens)
    parser.ts         Parser (tokens → AST)
    codegen.ts        Code generator (AST → ASM text)
    index.ts          Compiler entry point (chains all phases)
  __tests__/
    cexamples.test.ts Unit tests for C examples and compiler behavior
    bootloader.test.ts Disk bootloader and shared filesystem tests

src/components/software/
  SoftwareView.tsx    Main view with controls (assemble, step, run, reset)
  ASMEditor.tsx       Code editor with syntax highlighting
  CPUState.tsx        Register and flag display
  MemoryView.tsx      2048-byte memory hex viewer
  ConsolePanel.tsx    Text output console with keyboard input field
                     Also includes disk import/export, bootloader toggle,
                     and "Compile to Disk"

src/components/nodes/
  DriveNode.tsx       External 8 KB drive with read/write/clear controls
```

### The Full Pipeline

```
  1. You write code in the editor (ASM or C tab)
  2. Click "Assembler" (or "Compiler" for C)
  3. If C: Compiler produces ASM text → shown in ASM tab
  4. Assembler converts ASM text → machine bytes
  5. If bootloader mode is OFF: bytes are loaded at address 0x000
  6. If bootloader mode is ON: compile updates the generated program artifact, and the boot shell is loaded on demand by Run/Step if it is not already active
  7. "Compile to Disk" can store the compiled program on the external drive without interrupting the running shell
  8. The boot shell can then run that program from disk
  9. If a disk program halts, the software view returns automatically to the boot shell prompt
  10. Click "Step" to execute one instruction at a time
     or "Run" to execute continuously
  11. CPU state (registers, memory, flags) updates in real time
  12. Output appears in the console panel
  13. Input is typed in the console input field and submitted with Enter
  14. In direct mode, CPU halts when it executes HLT; in bootloader mode, halted disk programs return to the shell
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

This compiles to 16 bytes (each OUT is 3 bytes, HLT is 1 byte):

```
  0xC0 0x48 0x00   OUT 'H'   (0x48 = ASCII for 'H')
  0xC0 0x45 0x00   OUT 'E'
  0xC0 0x4C 0x00   OUT 'L'
  0xC0 0x4C 0x00   OUT 'L'
  0xC0 0x4F 0x00   OUT 'O'
  0x0F             HLT
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

### Example 3: Echo (ASM — Console Input)

```asm
; Echo - reads characters and echoes them back
  OUT 'T'
  OUT 'a'
  OUT 'p'
  OUT 'e'
  OUT 'z'
  OUT ':'
  OUT ' '

loop:
  INA          ; read a character from buffer
  CMP 0        ; buffer empty?
  JZ loop      ; yes → wait
  CMP 10       ; newline?
  JZ newline
  OUTA         ; echo the character
  JMP loop

newline:
  OUT 10       ; print newline
  JMP loop
```

Key concept: **INA** sets A=0 and Z=1 when the input buffer is empty. The `INA; CMP 0; JZ loop` pattern creates a busy-wait loop.

### Example 4: Factorial (C)

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

1. Compiler allocates address 0x1018 for `fact`'s parameter `n`
2. `fact(5)` → saves main's vars to stack, writes 5 to 0x1018, calls `__fact`
3. Inside `fact`: checks `n <= 1`? No. Computes `n - 1 = 4`.
4. Calls `fact(4)` → saves current `n` (5) to stack, writes 4 to 0x1018, calls `__fact` again
5. This repeats until `n = 1`, which returns 1
6. Unwinding: `fact(2)` computes `2 * 1 = 2`, `fact(3)` computes `3 * 2 = 6`, etc.
7. Final result: `fact(5) = 120`

Each level of recursion uses stack space for variable saves + temp saves + return address. With 2048 bytes of stack space (0x1800-0x1FFF), that's enough for many levels.

### Example 5: Character Counter (C — Console Input)

```c
int main() {
  int c;
  int count;

  while (1) {
    count = 0;
    print("> ");

    c = getchar();
    while (c != 10) {
      count += 1;
      putchar(c);
      c = getchar();
    }

    putchar(10);
    print("Longueur: ");
    print_num(count);
    putchar(10);
  }
  return 0;
}
```

This program reads a line of text, echoes each character, then displays the character count. `getchar()` busy-waits until a character is available, and the newline character (ASCII 10) marks the end of a line.

### Example 6: Bubble Sort (C — Arrays)

```c
int main() {
  int t[8];
  int i;
  int j;
  int tmp;

  t[0] = 64; t[1] = 25; t[2] = 12; t[3] = 22;
  t[4] = 11; t[5] = 90; t[6] = 33; t[7] = 44;

  // Bubble sort
  for (i = 0; i < 7; i++) {
    for (j = 0; j < 7 - i; j++) {
      if (t[j] > t[j + 1]) {
        tmp = t[j];
        t[j] = t[j + 1];
        t[j + 1] = tmp;
      }
    }
  }

  for (i = 0; i < 8; i++) {
    print_num(t[i]);
    putchar(32);
  }
  return 0;
}
```

What happens under the hood:

1. `int t[8]` allocates 8 contiguous bytes starting at address 0x1018
2. `t[0] = 64` compiles to: `LDA 64; STAI 0x1018` (with B=0, from index expression)
3. `t[j]` compiles to: load `j` into A → `LDAI 0x1018` (A = MEM[0x1018 + j])
4. `t[j+1] = tmp` compiles to: load `tmp` → PUSH → load `j+1` → TAB → POP → `STAI 0x1018`
5. The comparison `t[j] > t[j+1]` evaluates both indexed reads, compares, and branches

The LDAI/STAI opcodes make array access efficient — each read or write is a single 3-byte instruction, with the index register doing the address arithmetic in hardware.

---

## Glossary

| Term | Definition |
|------|-----------|
| **Accumulator** | Register A — where all math results end up |
| **AST** | Abstract Syntax Tree — tree representation of parsed code |
| **Carry flag** | Set when a result goes past 255 or below 0 |
| **Fetch-Execute** | The fundamental cycle: read instruction → do it → repeat |
| **Indexed addressing** | Memory access where the address = base + register (LDAI, STAI) |
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

---

## 9. Testing

The compiler and CPU are covered by a comprehensive test suite using **Vitest**. The tests exercise the full pipeline: C source → compile → assemble → CPU execution → output verification.

**File:** `src/cpu/__tests__/cexamples.test.ts`

### Running Tests

```bash
# Run all tests once
npm test

# Watch mode (re-runs on file changes)
npm run test:watch

# Run a specific test by name
npx vitest run -t "Fibonacci"
```

### What Is Tested

The exact count changes over time, but the suite currently covers more than 150 end-to-end compiler/CPU checks.

#### Compilation

Every C example program is compiled and assembled. This catches regressions in the lexer, parser, code generator, optimizer, and assembler.

```
For each C example:
  ✓ C compilation succeeds (no errors)
  ✓ ASM assembly succeeds when code fits in the 4096-byte code area
  ✓ Oversized programs are rejected by the assembler with a clear overflow error
```

#### Memory Layout

Validates the memory allocation for every example:

```
For each example:
  ✓ globals ∈ [0, 16]
  ✓ scratch = 8 (always)
  ✓ locals stay within the reusable frame region
  ✓ stack = 2048 (always)
  ✓ globals + scratch + locals fit in the 0x1000-0x17FF data area
  ✓ frame packing keeps local RAM much smaller than the old per-function-unique layout
```

#### Output Verification

Runs each program and checks exact output. Examples:

```
  "Hello World"     → "Hello World!"
  "Fibonacci"       → "0 1 1 2 3 5 8 13 21 34 "
  "Factorielle"     → "5! = 120"
  "Horloge"         → 3600 lines from "00:00" to "59:59"
  "Nombres premiers" → "Total: 25", includes "2 " and "97 "
  "Test Mémoire"    → "PASS" with globals and reusable local frames validated
  "Tableau (Tri)"   → "Avant: 64 25 12 22 11 90 33 44" + "Apres: 11 12 22 25 33 44 64 90"
```

Programs that require console input are tested with simulated input fed before execution.

#### Compiler Edge Cases

Individual feature tests:

```
  ✓ Empty main halts immediately
  ✓ Global variable initialization
  ✓ Multiple return paths
  ✓ Nested function calls: quad(3) = double(double(3)) = 12
  ✓ Recursion: sum(10) = 55
  ✓ While/for loops
  ✓ Compound assignment (+=, -=)
  ✓ Postfix increment/decrement
  ✓ Logical AND/OR operators
  ✓ All 6 comparison operators (==, !=, <, >, <=, >=)
  ✓ Multiply/divide/modulo with register-register ISA ops
  ✓ #define preprocessor
  ✓ Char literals
  ✓ getchar() with simulated input
  ✓ Stack pointer restoration after function calls (SP = 0x1FFF)
  ✓ Frame reuse across unrelated functions
  ✓ Block-local slot reuse across branches
  ✓ Bitwise expressions using shared lowering / direct ISA ops
  ✓ 16 globals allowed, 17th rejected
  ✓ Code size overflow detected (> 4096 bytes)
```

#### Arrays

Array-specific tests using the `LDAI`/`STAI` indexed addressing opcodes:

```
  ✓ Basic array write and read (a[0]=10, a[1]=20, a[2]=30)
  ✓ Array fill and read in loop (arr[i] = i*3)
  ✓ Complex index expression arr[j+1]
  ✓ Global array
  ✓ Local array in function (buf[0]+buf[1]+buf[2])
  ✓ Global array accessed from function
  ✓ Swap via array (bubble sort pattern)
  ✓ Array size 0 rejected
  ✓ Global array too large rejected
  ✓ Array name without index rejected
  ✓ Array initializer rejected
```

#### Execution Properties

```
  ✓ 14 programs halt within 50M cycles
  ✓ 8 input-dependent programs do NOT halt without input
  ✓ 10 interactive programs halt cleanly when `@` is entered
```

### Adding a New Test

To test a new C program, use the `compileAndRun` helper:

```typescript
it("my new program works", () => {
  const r = compileAndRun(`
    int main() {
      print_num(2 + 3);
      return 0;
    }
  `);
  expect(r.output).toBe("5");
  expect(r.halted).toBe(true);
});
```

For programs that need console input:

```typescript
it("reads input correctly", () => {
  const r = compileAndRun(`
    int main() {
      int c = getchar();
      putchar(c);
      return 0;
    }
  `, { input: "A" });
  expect(r.output).toBe("A");
});
```

For compile-only checks (no execution):

```typescript
it("too many globals is rejected", () => {
  const { compile: cr } = compileOnly(`
    int a; int b; ... int q; // 17 globals
    int main() { return 0; }
  `);
  expect(cr.success).toBe(false);
  expect(cr.errors[0].message).toContain("globales");
});
```

### Bugs Found by Tests

The test suite discovered compiler bugs:

1. **`>=` and `>` always returned true** — The code generator's false-path jumped over `LDA 0`, leaving garbage in register A. Fixed by adding intermediate skip labels. (See `docs/compiler-bugfixes-and-tests.md` for full analysis.)

2. **16th global variable rejected** — Off-by-one: overflow check fired after allocating the 16th global. Fixed by moving the check before allocation.
