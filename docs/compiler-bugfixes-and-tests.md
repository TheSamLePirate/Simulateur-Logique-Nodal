# Compiler Bug Fixes & Test Suite

This document covers the bugs found, the fixes applied, and the comprehensive test suite for the C compiler.

---

## Table of Contents

1. [Bug Fix: `>=` and `>` Comparison Operators](#1-bug-fix--and--comparison-operators)
2. [Bug Fix: Global Variables Off-by-One](#2-bug-fix-global-variables-off-by-one)
3. [Bug Fix: Scratch Register Conflicts in Nested Expressions](#3-bug-fix-scratch-register-conflicts-in-nested-expressions)
4. [Bug Fix: Unsigned Division with Large Dividends](#4-bug-fix-unsigned-division-with-large-dividends)
5. [Keyboard Controller (`getKey`)](#5-keyboard-controller-getkey)
6. [Test Suite Overview](#6-test-suite-overview)
7. [Running Tests](#7-running-tests)
8. [Memory Audit Summary](#8-memory-audit-summary)

---

## 1. Bug Fix: `>=` and `>` Comparison Operators

**File:** `src/cpu/compiler/codegen.ts` — `emitComparison()`

### The Bug

The `>=` and `>` operators were broken: they always returned a truthy value when the comparison was false. For example, `1 >= 60` evaluated as **true**.

**Impact:** Any program using `>=` or `>` produced incorrect results. The "Horloge" (clock) example output `00:00, 01:00, 02:00...` instead of `00:00, 00:01, 00:02...` because `s >= 60` was always true when `s = 1`.

### Root Cause

The comparison code generator uses this pattern for all 6 operators:

```asm
  SUBB               ; A = left - right, sets flags
  [case-specific conditional jumps]
  LDA 0              ; ← false result
  JMP endLabel
trueLabel:
  LDA 1              ; ← true result
endLabel:
```

The `==`, `!=`, `<`, and `<=` cases jump to `trueLabel` when the condition is true, and **fall through** to `LDA 0` when false. This is correct.

But `>=` and `>` had their false cases jump directly to `endLabel`, **skipping `LDA 0`**:

```
BEFORE (buggy):

  case ">=":
    JC endLabel       ; if carry → SKIPS LDA 0 → A still has SUBB garbage (truthy!)
    JMP trueLabel     ; if no carry → correct

  case ">":
    JZ endLabel       ; if zero → SKIPS LDA 0 → same bug
    JC endLabel       ; if carry → SKIPS LDA 0 → same bug
    JMP trueLabel     ; otherwise → correct
```

When `JC endLabel` (or `JZ endLabel`) was taken, it jumped past both `LDA 0` and `LDA 1`, leaving register A with the raw SUBB result (e.g., `1 - 60 = 197` in unsigned 8-bit). Since 197 is non-zero, it was interpreted as "true".

### The Fix

Introduce local skip labels so the false path correctly falls through to `LDA 0`:

```
AFTER (fixed):

  case ">=":
    JC skipGte        ; if carry → skip to fall-through
    JMP trueLabel     ; if no carry → true
  skipGte:            ; ← falls through to LDA 0 below ✓

  case ">":
    JZ skipGt         ; if zero → skip to fall-through
    JC skipGt         ; if carry → skip to fall-through
    JMP trueLabel     ; otherwise → true
  skipGt:             ; ← falls through to LDA 0 below ✓
```

The skip labels land right before `LDA 0`, so the false path now correctly sets A = 0.

### Why Only `>=` and `>` Were Affected

The 6 operators split into two groups:

| Operator | True condition | False → must reach `LDA 0` |
|----------|----------------|----------------------------|
| `==`     | `JZ trueLabel` | Falls through ✓ |
| `!=`     | `JNZ trueLabel` | Falls through ✓ |
| `<`      | `JC trueLabel` | Falls through ✓ |
| `<=`     | `JZ trueLabel` + `JC trueLabel` | Falls through ✓ |
| `>`      | Fall through is false | Used `JZ endLabel` + `JC endLabel` ✗ |
| `>=`     | Fall through is false | Used `JC endLabel` ✗ |

The first four jump to `trueLabel` on the true condition, and naturally fall through to `LDA 0` on the false condition. The last two need to jump on the true condition but have no `JNC` (Jump if No Carry) instruction, so they use the inverse approach — but incorrectly jumped to `endLabel` instead of falling through.

---

## 2. Bug Fix: Global Variables Off-by-One

**File:** `src/cpu/compiler/codegen.ts` — global allocation loop

### The Bug

The 16th global variable (at address `0x100F`) was rejected with "Trop de variables globales (max 16)". Only 15 globals could be used.

### Root Cause

The overflow check was placed **after** allocation:

```typescript
// BEFORE (buggy):
globals.set(g.name, globalAddr);
globalAddr++;                     // 0x100F → 0x1010
if (globalAddr > 0x100F) {        // 0x1010 > 0x100F → TRUE → rejects the 16th!
  errors.push({ ... });
}
```

### The Fix

Move the check **before** allocation, and `continue` to skip:

```typescript
// AFTER (fixed):
if (globalAddr > 0x100F) {        // only triggers on the 17th global
  errors.push({ ... });
  continue;                       // skip allocation
}
globals.set(g.name, globalAddr);
globalAddr++;
```

---

## 3. Bug Fix: Scratch Register Conflicts in Nested Expressions

**File:** `src/cpu/compiler/codegen.ts` — `emitMultiply()`, `emitDivMod()`, `emitBitwiseOp()`

### The Bug

Expressions like `(a >> 2) * (b >> 2)` produced completely wrong results. For example, `(0 >> 2) * ((127 - 0) >> 2)` returned **193** instead of **0**.

**Impact:** Any program combining `*`, `/`, `%`, `&`, `|`, or `^` with nested shift or arithmetic subexpressions produced incorrect results. The "Courbe" (wave) example drew garbage instead of a smooth parabolic curve.

### Root Cause

The code generators for multiply, divide/modulo, and bitwise operations all followed this pattern:

```typescript
// BEFORE (buggy):
emitExpr(expr.left, ctx);     // evaluate left → result in A
emit(`  STA ${fmt(t1)}`);     // save left at TEMP_BASE
emitExpr(expr.right, ctx);    // evaluate right → ⚠️ CLOBBERS TEMP_BASE!
emit(`  STA ${fmt(t2)}`);     // save right at TEMP_BASE+1
```

The problem: evaluating the right operand can itself use TEMP_BASE (e.g., if it contains a `>>` shift, which stores intermediate values at TEMP_BASE). This **overwrites** the left operand saved at TEMP_BASE.

### Concrete Example

For `(t >> 2) * ((127 - t) >> 2)` with `t = 0`:

1. Evaluate left `(0 >> 2)`: shift loop runs, result = 0 in A
2. `STA TEMP_BASE` → TEMP_BASE = 0 (left saved)
3. Evaluate right `((127 - 0) >> 2)`: shift loop stores 127 → TEMP_BASE, then shifts → **TEMP_BASE = 31** (left overwritten!)
4. Multiply loop uses TEMP_BASE (now 31) × TEMP_BASE+1 (31) = 31 × 31 = 961 → **193** (mod 256)

### The Fix

Use `PUSH`/`POP` (the stack) to save the left operand before evaluating the right side:

```typescript
// AFTER (fixed):
emitExpr(expr.left, ctx);     // evaluate left → result in A
emit(`  PUSH`);               // save left ON STACK (safe from subexpressions)
emitExpr(expr.right, ctx);    // evaluate right → can safely use TEMP_BASE
emit(`  STA ${fmt(t2)}`);     // save right
emit(`  POP`);                // recover left from stack
emit(`  STA ${fmt(t1)}`);     // save left at TEMP_BASE (now safe)
```

The stack is immune to scratch register conflicts because each operation that uses the stack properly balances `PUSH`/`POP`. This fix was applied to all three affected functions:
- `emitMultiply()` — `*` operator
- `emitDivMod()` — `/` and `%` operators
- `emitBitwiseOp()` — `&`, `|`, `^` operators

### Why Other Operators Were Not Affected

The standard binary operators (`+`, `-`, `<<`, `>>`) already used the safe pattern:

```typescript
emitExpr(expr.left, ctx);
emit(`  PUSH`);               // ← already using stack!
emitExpr(expr.right, ctx);
emit(`  TAB`);
emit(`  POP`);
```

Only the "complex" operations (multiply, divide, bitwise) that use TEMP_BASE for their loop variables had this bug, because they were also saving operands to TEMP_BASE before the loop.

---

## 4. Bug Fix: Unsigned Division with Large Dividends

**File:** `src/cpu/compiler/codegen.ts` — `emitDivMod()`

### The Bug

Division and modulo returned **0** for any dividend ≥ 128. For example, `130 / 2` returned **0** instead of **65**, and `200 % 3` returned **200** instead of **2**.

**Impact:** Any program dividing a value ≥ 128 got wrong results. The "Traceur de droite" example plotted `y = 0` for all x ≥ 128 because the intermediate value `a * x` (e.g., `2 * 128 = 256 → 0 mod 256` but even when avoiding overflow via DDA, division of accumulated values ≥ 128 failed).

### Root Cause

The division loop used `JN` (Jump if Negative = sign bit set) to detect when the dividend was exhausted:

```asm
; BEFORE (buggy):
  LDM dividend        ; A = dividend
  LBM divisor         ; B = divisor
  SUBB                ; A = dividend - divisor
  JN endLabel          ; if "negative" → done   ← BUG!
  STA dividend        ; dividend -= divisor
  ; quotient++
  JMP loopLabel
```

`JN` checks bit 7 of the result. In unsigned 8-bit arithmetic, any result ≥ 128 has bit 7 set. So `130 - 2 = 128` was treated as "negative" because `128 & 0x80 = 1`, and the loop exited immediately with quotient = 0.

The correct check for unsigned "less than" is the **carry flag** (borrow), not the sign bit.

### The Fix

Replace `JN` with `JC` (Jump if Carry = unsigned borrow):

```asm
; AFTER (fixed):
  LDM dividend
  LBM divisor
  SUBB
  JC endLabel          ; unsigned: if borrow (dividend < divisor) → done  ✓
  STA dividend
  ; quotient++
  JMP loopLabel
```

`JC` fires when `dividend < divisor` (subtraction produces a borrow), which is the correct unsigned exit condition.

### Concrete Example

For `130 / 2`:

| Iteration | dividend | dividend - divisor | Bit 7? | Borrow? | JN exits? | JC exits? |
|-----------|----------|-------------------|--------|---------|-----------|-----------|
| 1 | 130 | 128 | **YES** | No | **YES** ✗ | No ✓ |
| 2 | 128 | 126 | No | No | No | No |
| ... | ... | ... | ... | ... | ... | ... |
| 65 | 2 | 0 | No | No | No | No |
| 66 | 0 | -2 (254) | YES | **YES** | YES | **YES** ✓ |

With `JN`: exits at iteration 1, quotient = 0. **Wrong.**
With `JC`: exits at iteration 66, quotient = 65. **Correct.**

### Why Comparisons Were Not Affected

The comparison operators (`<`, `>`, `<=`, `>=`) in `emitComparison()` already used `JC` for unsigned logic, having been fixed earlier (see Bug #1). Only `emitDivMod()` still used the signed `JN` instruction.

---

## 5. Keyboard Controller (`getKey`)

### Overview

A non-blocking keyboard peripheral that lets C programs poll 5 keys: 4 arrow keys + Enter.

```c
int k = getKey(0);  // 0=Left, 1=Right, 2=Up, 3=Down, 4=Enter
// Returns 1 if pressed, 0 if released (no blocking/waiting)
```

### Architecture

```
┌──────────────┐    keydown/keyup     ┌──────────────┐
│   Browser    │ ──────────────────── │ KeyboardNode │  (hardware view)
│   Window     │    keyboard-state    │   or         │
│  Events      │ ──────────────────── │ SoftwareView │  (software view)
└──────┬───────┘     custom event     └──────┬───────┘
       │                                      │
       │         cpu.keyState[index] = 0|1    │
       │                                      ▼
       │                              ┌──────────────┐
       │                              │   CPU        │
       │                              │  keyState[]  │──── GETKEY opcode
       │                              │  [5 keys]    │     A ← keyState[A]
       │                              └──────────────┘
```

### Files Modified

| File | Change |
|------|--------|
| `src/cpu/isa.ts` | `GETKEY: 0x0b` opcode (1-byte, after INA) |
| `src/cpu/cpu.ts` | `keyState: number[5]` property, GETKEY case in `step()` |
| `src/cpu/compiler/codegen.ts` | `getKey(n)` built-in → emits `GETKEY` |
| `src/components/nodes/KeyboardNode.tsx` | New node: 5-key visual + keydown/keyup listeners |
| `src/components/nodes/index.ts` | Registered `keyboard` node type |
| `src/App.tsx` | `keyboard-state` event → `hwCpuRef.current.keyState`, control signals, UI menu |
| `src/components/software/SoftwareView.tsx` | keydown/keyup listeners → `cpuRef.current.keyState` |
| `src/data/initialScene.ts` | KeyboardNode + keyRd signal in CPU scene |

### ISA Details

```
Opcode:   GETKEY (0x0b)
Size:     1 byte
Effect:   A ← keyState[A]    (A = key index 0..4, result = 0 or 1)
Flags:    Z and N updated based on result
```

### Key Mapping

| Index | Key | `getKey()` call |
|-------|-----|-----------------|
| 0 | ← Arrow Left | `getKey(0)` |
| 1 | → Arrow Right | `getKey(1)` |
| 2 | ↑ Arrow Up | `getKey(2)` |
| 3 | ↓ Arrow Down | `getKey(3)` |
| 4 | ↵ Enter | `getKey(4)` |

### Input Wiring (both views)

**Hardware view** (`App.tsx`): The `KeyboardNode` component listens to window `keydown`/`keyup` events and dispatches a `keyboard-state` custom event. A `useEffect` in App catches this event and updates `hwCpuRef.current.keyState[index]`.

**Software view** (`SoftwareView.tsx`): A `useEffect` directly listens to window `keydown`/`keyup` events and updates `cpuRef.current.keyState[index]`. No intermediate custom event needed since the component owns the CPU ref.

### C Example: "Clavier" (Space Shooter)

A triangle spaceship that moves with arrows and fires a laser projectile on Enter:

```c
int main() {
  int x; int y;
  int x1; int x2; int y1;
  int lx; int ly; int lf;   // laser position + active flag

  x = 127; y = 200; lf = 0;

  while (1) {
    clear();

    // Move with arrows
    if (getKey(0)) { if (x > 0)   { x = x - 1; } }
    if (getKey(1)) { if (x < 252) { x = x + 1; } }
    if (getKey(2)) { if (y > 2)   { y = y - 1; } }
    if (getKey(3)) { if (y < 253) { y = y + 1; } }

    x1 = x + 1; x2 = x + 2; y1 = y + 1;

    // Triangle (tip up)       ▲
    draw(x1, y);            //  ▲▲▲
    draw(x, y1); draw(x1, y1); draw(x2, y1);

    // Fire laser on Enter
    if (lf == 0) {
      if (getKey(4)) { lf = 1; lx = x1; ly = y - 1; }
    }

    // Laser moves up each frame, disappears at y=0
    if (lf) {
      draw(lx, ly); draw(lx, ly + 1);
      if (ly > 0) { ly = ly - 1; } else { lf = 0; }
    }
  }
}
```

### Tests

```
✓ "getKey returns 0 when no key pressed"     — compiles + runs, output "0 0"
✓ "getKey returns 1 when key is pressed"      — cpu.keyState set, output "1 1"
✓ "Clavier draws triangle + laser"            — plotter pixels ≤ 6 (4 triangle + 2 laser)
```

---

## 6. Test Suite Overview

**File:** `src/cpu/__tests__/cexamples.test.ts`
**Framework:** Vitest 4.1
**Status as of March 18, 2026:** `npm test` runs **314 tests across 4 suites**, all green

### Test Architecture

Two helper functions abstract the full pipeline:

```typescript
compileAndRun(source, options?)  // compile → assemble → run CPU, returns output
compileOnly(source)              // compile → assemble without running
```

`compileAndRun` throws on compile or assembly failure with full error details, making tests fail-fast with clear diagnostics.

The project now uses four coordinated Vitest suites:

- `src/cpu/__tests__/cexamples.test.ts`
- `src/cpu/__tests__/bootloader.test.ts`
- `src/cpu/__tests__/examples.test.ts`
- `src/components/software/runningKeyboard.test.ts`

The C suite is still the largest compiler-focused suite, but the total `npm test` coverage also includes bootloader/userland behavior, ASM examples, and direct keyboard routing.

At the moment the full test run covers `11` test files and `513` passing checks.

### Test Suites

#### 6.1 — C Examples: Compilation (all bundled examples)

Tests that **every** bundled C example compiles without errors and assembles within 4096 bytes.

```
For each bundled C example:
  ✓ C compilation succeeds
  ✓ ASM assembly succeeds when the optimized program still fits
  ✓ oversize failures stay explicit and testable
```

#### 6.2 — C Examples: Memory Layout (all bundled examples)

Validates the `MemoryLayout` structure for every example:

- `globals` is in range [0, 16]
- `scratch` is always 8 (6 arithmetic temps + 1 return save + 1 padding)
- `locals` is in range [0, 2024]
- `stackSize` is always 2048
- Total data (`globals + scratch + locals`) never exceeds 2048

#### 6.3 — C Examples: Output Verification (20 programs)

Runs each program and verifies exact output:

| Example | Verified Output |
|---------|-----------------|
| Hello World | `"Hello World!"` |
| Compteur | `"0123456789"` |
| Fibonacci | `"0 1 1 2 3 5 8 13 21 34 "` |
| Factorielle | `"5! = 120"` |
| Calcul | 7 lines of arithmetic (`3+5=8`, `10-3=7`, etc.) |
| Plotter | > 100 pixels, diagonal (0,0)→(79,79), frame corners |
| Courbe | > 200 pixels, upper wave (y<100 for x<128), lower wave (y>156 for x≥128) |
| Echo | Echoes `"Hi"` with console input |
| Compteur de lettres | `"Longueur: 3"` for input `"abc\n"` |
| Calculatrice | `"= 8"` for `"3+5\n"`, `"= 63"` for `"9*7\n"` |
| Traceur de droite | DDA plot y=2x (input "210"), b=0 error (input "10"), wraps past x=128 |
| Cercle | > 200 pixels forming ring, center (128,128) NOT drawn |
| Clavier | Triangle (4px) + laser (2px), ≤ 6 pixels per frame |
| Horloge | 3600 lines from `"00:00"` to `"59:59"` |
| Spirale | > 500 pixels, starts at (128,128) |
| Nombres premiers | Contains `"Total: 25"`, `"2 "`, `"97 "` |
| Étoiles | Random star pixels, count output, break/continue |
| Test Mémoire | `"PASS"`, 16 globals, 488 locals, memory[0x1000]=42 verified |
| Tableau (Tri) | `"Avant: 64 25 12 22 11 90 33 44"` + `"Apres: 11 12 22 25 33 44 64 90"` |

#### 6.4 — Compiler Edge Cases (20 tests)

Fine-grained tests for individual compiler features:

| Test | What it verifies |
|------|-----------------|
| Empty main | `int main() { return 0; }` halts with no output |
| Global init | `int x = 42;` correctly stored and readable |
| Multiple returns | Different code paths in a function |
| Nested calls | `quad(3) = double(double(3)) = 12` |
| Recursion | `sum(10) = 55` (1+2+...+10) |
| While loop | `x = 1; while (x < 100) x *= 2;` → 128 |
| For loop | `sum(1..5) = 15` |
| Compound assignment | `x += 5; x -= 3;` |
| Postfix increment | `x++ returns old, ++x returns new` |
| Logical AND/OR | `1&&0=N, 1\|\|0=Y, !1=N, !0=Y` |
| **>= and > operators** | 6 cases: `5>=5=Y, 5>=3=Y, 5>=10=N, 5>3=Y, 5>5=N, 5>10=N` |
| **<= and < operators** | 5 cases: `5<=5=Y, 5<=10=Y, 5<=3=N, 5<10=Y, 5<5=N` |
| Multiply/divide | `7*8=56, 100/7=14, 100%7=2` |
| **Unsigned division (≥128)** | `130/2=65, 200/4=50, 255/5=51, 128/1=128, 200%3=2` |
| #define | `#define VAL 42` substitution |
| Char literals | `putchar('A')` → `"ABC"` |
| getchar | Input `"XY"` → output `"XY"` |
| Stack pointer restoration | SP = 0x1FFF after 3 function calls |
| 16 globals allowed | All 16 slots usable, `a+p = 17` |
| 17th global error | Correctly rejected with error |
| Code size overflow | 40 functions × 50 chars → compile error detected |
| **getKey (no key)** | `getKey(0)` and `getKey(4)` return 0 when no key pressed |
| **getKey (key pressed)** | `getKey(0)` returns 1 when `keyState[0] = 1` |

#### 6.5 — Arrays (11 tests)

Tests for array support using `LDAI`/`STAI` indexed addressing:

| Test | What it verifies |
|------|-----------------|
| Basic write/read | `a[0]=10, a[1]=20, a[2]=30` → `"10 20 30"` |
| Loop fill/read | `arr[i] = i*3` → `"0 3 6 9 12 "` |
| Complex index `arr[j+1]` | Arithmetic in index expression → `"20 30 40 "` |
| Global array | `g[0]=100, g[1]=200, g[2]=50` → `"100 200 50"` |
| Local array in function | `buf[0]+buf[1]+buf[2]` via function params → `"60"` |
| Global from function | `fill()` sets `data[]`, `main()` reads → `"30"` |
| Swap via array | Bubble sort swap pattern → `"11 99"` |
| **Size 0 error** | `int a[0]` → compile error with "taille" |
| **Too large error** | `int big[17]` (global) → compile error with "globale" |
| **No index error** | `x = a` (array without `[]`) → compile error with "tableau" |
| **Initializer error** | `int a[3] = {1,2,3}` → compile error with "Initialisation" |

#### 6.6 — Execution Properties (22 programs + interactive halt coverage)

Verifies runtime behavior:

- **14 halting programs**: Finish within 50M cycles (Hello World, Compteur, Fibonacci, Factorielle, Calcul, Plotter, Courbe, Cercle, Horloge, Spirale, Nombres premiers, Étoiles, Test Mémoire, Tableau (Tri))
- **8 input-waiting programs**: Do NOT halt without input within 10K cycles (Echo, Compteur de lettres, Calculatrice, Traceur de droite, Démo Ultime, Calculatrice Graphique, Mini Shell, FS Disque Externe)
- **Interactive halt coverage**: `@` cleanly stops 10 interactive examples, including console apps and real-time plotter or keyboard loops

---

### 6.7 — Bootloader / Linux Userland (`bootloader.test.ts`)

This suite covers the bootable disk image and Linux-like userland:

- disk directory storage and entry parsing
- shell commands such as `ls`, `cat`, `run`, `free`, and `help`
- bundled userland programs including `wget`, `cp`, `mv`, `grep`, `jsonp`, `glxsh`, and `glxnano`
- preinstalled binary assets such as `DIGITS` and `LETTERS`
- `wget` fetching `https://jsonplaceholder.typicode.com/todos/1` and writing the response to `result`
- `glxnano` render/save/edit/zoom behavior with plotter snapshots

### 6.8 — ASM Examples (`examples.test.ts`)

This suite validates the bundled ASM examples:

- assembly success for shipped examples
- bootloader-oriented programs stored and launched from the shared disk format
- plotter-oriented ASM examples producing visible output frames

### 6.9 — Immediate Keyboard Routing (`runningKeyboard.test.ts`)

This suite verifies the UI-to-CPU live key path used by interactive software:

- arrow keys update `cpu.keyState` immediately
- Enter updates `keyState` and queues a newline byte
- printable keys, Backspace, and Tab are forwarded immediately while a program is running

---

## 7. Running Tests

```bash
# Run all tests once
npm test

# Watch mode (re-run on file changes)
npm run test:watch

# Bootloader / disk / glxnano tests
npm test -- --run src/cpu/__tests__/bootloader.test.ts

# Run a specific test by name
npx vitest run -t "Horloge"

# Verbose output
npx vitest run --reporter verbose
```

Typical output:

```
 Test Files  4 passed (4)
      Tests  314 passed (314)
```

After the run, the generated visual report lives in:

```text
report/index.html
```

### Plotter Snapshot Helper

When a plotter regression is easier to inspect visually than through raw pixel counts, the helper `src/cpu/__tests__/plotterImage.ts` exports the framebuffer to **PNG** images and builds a combined HTML dashboard.

The generated report:

- lives in the project at `report/index.html`
- includes one dropdown per suite
- groups output by program
- embeds captured console output
- shows animated viewers when a program has multiple frames

This is especially useful for debugging bootloader userland tools such as `glxnano`, or animated C examples where a frame may be "technically non-empty" but still visually wrong.

---

## 8. Memory Audit Summary

A full audit was performed tracing memory usage from the ISA through the CPU, assembler, and code generator. Key findings:

### Memory Map (8192 bytes total)

```
  Address           Region      Size    Source of truth
  ──────────────    ──────      ────    ──────────────
  0x0000-0x0FFF     Code        4096    CODE_SIZE in isa.ts
  0x1000-0x100F     Globals     16      codegen.ts (GLOBAL_BASE → 0x1000+)
  0x1010-0x1017     Scratch     8       codegen.ts (TEMP_BASE 0x1010, RET_SAVE 0x1017)
  0x1018-0x17FF     Locals      2024    codegen.ts (LOCAL_BASE → 0x1018+)
  0x1800-0x1FFF     Stack       2048    cpu.ts (SP starts at MEMORY_SIZE-1)
```

All 5 regions are contiguous, non-overlapping, and sum to exactly 8192.

### Boundary Protection

| Boundary | Protected? | How |
|----------|-----------|-----|
| Code overflow | Yes | Assembler: `bytes.length > CODE_SIZE` |
| Globals overflow | Yes | Codegen: `globalAddr > 0x100F` (after fix) |
| Locals overflow | Yes | Codegen: `varAddr >= STACK_BASE` (0x1800) |
| Stack overflow | No | By design — SP wraps via `& ADDR_MASK` |
| Stack into data | No | By design — 8-bit CPU simplicity |

Stack overflow is intentionally unprotected. Real 8-bit CPUs (6502, Z80) also lack stack protection. The practical recursion limit is **not one fixed number**: it depends heavily on the local frame size, temporary saves, and array copies used by each call. Recent tests confirmed that very deep simple recursion can still complete correctly, while very deep recursion with large local arrays can corrupt the stack and output before halting.

### Memory Test Program

The "Test Mémoire" example (`src/cpu/cexamples.ts`) is a stress test that exercises memory zones:

```
  Globals:  16/16 slots   (g0 through gf)
  Locals:   488 slots used (19 padding functions × 25 + add(2) + main(11))
  Code:     ~1022 bytes
  Stack:    2048 reserved (exercised with 2 function calls, 17 saves each)
```

It initializes 16 globals, uses 11 local variables in main, makes 2 function calls (`add(g0,gf)=57`, `add(g2,g3)=5`) exercising the stack (11 vars + 6 temps saved/restored per call), verifies all results, and outputs "PASS" or "FAIL".

### Code Size Costs

| Operation | Bytes generated |
|-----------|----------------|
| `putchar(c)` | ~6 bytes |
| `print_num(n)` | ~3 bytes (OUTD) |
| `if/else` block | ~12-20 bytes |
| Multiply `a * b` | ~25 bytes (inline loop) |
| Divide `a / b` | ~30 bytes (inline loop) |
| Function call overhead | ~40-80 bytes (save/restore locals + scratch) |
| `int x;` (uninit local) | 0 bytes (just allocates address) |
| `int x = 5;` (init local) | ~6 bytes (LDA + STA) |
| `int arr[N]` (array decl) | 0 bytes code (allocates N contiguous addresses) |
| `x = arr[i]` (indexed read) | ~6 bytes (load index + LDAI base) |
| `arr[i] = x` (indexed write) | ~12 bytes (load value + PUSH + load index + TAB + POP + STAI base) |

### Semantic Boundaries Confirmed By Tests

The newer edge-case suites also document a few important truths about the language:

- array parameters use copy-in / copy-back semantics, not normal C pointer aliasing
- only declared arrays may be passed to fixed-size array parameters; expressions like `data + 1` are rejected
- `array_len(buf)` reports storage capacity, while `string_len(buf)` reports visible bytes up to the first `0`
- unterminated buffers can leak neighboring memory through `print(buf)` and `string_len(buf)`
- local and global out-of-bounds writes can corrupt nearby values
- division by zero and modulo by zero currently return `0`, matching the CPU runtime semantics
- `++` / `--` on non-simple lvalues are rejected explicitly so they do not silently miscompile
