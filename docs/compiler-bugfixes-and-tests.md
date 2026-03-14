# Compiler Bug Fixes & Test Suite

This document covers the bugs found, the fixes applied, and the comprehensive test suite for the C compiler.

---

## Table of Contents

1. [Bug Fix: `>=` and `>` Comparison Operators](#1-bug-fix--and--comparison-operators)
2. [Bug Fix: Global Variables Off-by-One](#2-bug-fix-global-variables-off-by-one)
3. [Bug Fix: Scratch Register Conflicts in Nested Expressions](#3-bug-fix-scratch-register-conflicts-in-nested-expressions)
4. [Bug Fix: Unsigned Division with Large Dividends](#4-bug-fix-unsigned-division-with-large-dividends)
5. [Test Suite Overview](#5-test-suite-overview)
6. [Running Tests](#6-running-tests)
7. [Memory Audit Summary](#7-memory-audit-summary)

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

The 16th global variable (at address `0x20F`) was rejected with "Trop de variables globales (max 16)". Only 15 globals could be used.

### Root Cause

The overflow check was placed **after** allocation:

```typescript
// BEFORE (buggy):
globals.set(g.name, globalAddr);
globalAddr++;                     // 0x20F → 0x210
if (globalAddr > 0x20F) {         // 0x210 > 0x20F → TRUE → rejects the 16th!
  errors.push({ ... });
}
```

### The Fix

Move the check **before** allocation, and `continue` to skip:

```typescript
// AFTER (fixed):
if (globalAddr > 0x20F) {         // only triggers on the 17th global
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

## 5. Test Suite Overview

**File:** `src/cpu/__tests__/cexamples.test.ts`
**Framework:** Vitest 4.1
**Total:** 103 tests, all green

### Test Architecture

Two helper functions abstract the full pipeline:

```typescript
compileAndRun(source, options?)  // compile → assemble → run CPU, returns output
compileOnly(source)              // compile → assemble without running
```

`compileAndRun` throws on compile or assembly failure with full error details, making tests fail-fast with clear diagnostics.

### Test Suites

#### 5.1 — C Examples: Compilation (16 examples)

Tests that **every** C example compiles without errors and assembles within 512 bytes.

```
"Hello World"               compiles → ✓  assembles → ✓
"Compteur"                  compiles → ✓  assembles → ✓
"Fibonacci"                 compiles → ✓  assembles → ✓
"Factorielle"               compiles → ✓  assembles → ✓
"Calcul"                    compiles → ✓  assembles → ✓
"Plotter"                   compiles → ✓  assembles → ✓
"Courbe"                    compiles → ✓  assembles → ✓
"Echo (Saisie)"             compiles → ✓  assembles → ✓
"Compteur de lettres"       compiles → ✓  assembles → ✓
"Calculatrice"              compiles → ✓  assembles → ✓
"Traceur de droite"         compiles → ✓  assembles → ✓
"Cercle"                    compiles → ✓  assembles → ✓
"Horloge"                   compiles → ✓  assembles → ✓
"Spirale"                   compiles → ✓  assembles → ✓
"Tableau de nombres premiers" compiles → ✓  assembles → ✓
"Test Mémoire"              compiles → ✓  assembles → ✓
```

#### 5.2 — C Examples: Memory Layout (16 examples)

Validates the `MemoryLayout` structure for every example:

- `globals` is in range [0, 16]
- `scratch` is always 8 (6 arithmetic temps + 1 return save + 1 padding)
- `locals` is in range [0, 232]
- `stackSize` is always 256
- Total data (`globals + scratch + locals`) never exceeds 256

#### 5.3 — C Examples: Output Verification (18 programs)

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
| Horloge | 3600 lines from `"00:00"` to `"59:59"` |
| Spirale | > 500 pixels, starts at (128,128) |
| Nombres premiers | Contains `"Total: 25"`, `"2 "`, `"97 "` |
| Test Mémoire | `"PASS"`, 16 globals, 232 locals, memory[0x200]=42 |

#### 5.4 — Compiler Edge Cases (18 tests)

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
| Stack pointer restoration | SP = 0x3FF after 3 function calls |
| 16 globals allowed | All 16 slots usable, `a+p = 17` |
| 17th global error | Correctly rejected with error |
| Code size overflow | 40 functions × 50 chars → compile error detected |

#### 5.5 — Execution Properties (16 programs)

Verifies runtime behavior:

- **12 halting programs**: Finish within 50M cycles (Hello World, Compteur, Fibonacci, Factorielle, Calcul, Plotter, Courbe, Cercle, Horloge, Spirale, Nombres premiers, Test Mémoire)
- **4 input-waiting programs**: Do NOT halt without input within 10K cycles (Echo, Compteur de lettres, Calculatrice, Traceur de droite)

---

## 6. Running Tests

```bash
# Run all tests once
npm test

# Watch mode (re-run on file changes)
npm run test:watch

# Run a specific test by name
npx vitest run -t "Horloge"

# Verbose output
npx vitest run --reporter verbose
```

Expected output:

```
 ✓ src/cpu/__tests__/cexamples.test.ts (103 tests) 10.9s

 Test Files  1 passed (1)
      Tests  103 passed (103)
```

---

## 7. Memory Audit Summary

A full audit was performed tracing memory usage from the ISA through the CPU, assembler, and code generator. Key findings:

### Memory Map (1024 bytes total)

```
  Address         Region      Size    Source of truth
  ──────────      ──────      ────    ──────────────
  0x000-0x1FF     Code        512     CODE_SIZE in isa.ts
  0x200-0x20F     Globals     16      codegen.ts (GLOBAL_BASE → 0x200+)
  0x210-0x217     Scratch     8       codegen.ts (TEMP_BASE 0x210, RET_SAVE 0x217)
  0x218-0x2FF     Locals      232     codegen.ts (LOCAL_BASE → 0x218+)
  0x300-0x3FF     Stack       256     cpu.ts (SP starts at MEMORY_SIZE-1)
```

All 5 regions are contiguous, non-overlapping, and sum to exactly 1024.

### Boundary Protection

| Boundary | Protected? | How |
|----------|-----------|-----|
| Code overflow | Yes | Assembler: `bytes.length > CODE_SIZE` |
| Globals overflow | Yes | Codegen: `globalAddr > 0x20F` (after fix) |
| Locals overflow | Yes | Codegen: implicit — 232 slots available |
| Stack overflow | No | By design — SP wraps via `& ADDR_MASK` |
| Stack into data | No | By design — 8-bit CPU simplicity |

Stack overflow is intentionally unprotected. Real 8-bit CPUs (6502, Z80) also lack stack protection. With 256 bytes and ~13 bytes per function call, max recursion depth is approximately 19 levels.

### Memory Test Program

The "Test Mémoire" example (`src/cpu/cexamples.ts`) is a stress test that fills every allocatable byte:

```
  Globals:  16/16 slots  (g0 through gf)
  Locals:   232/232 slots (via 9 padding functions with 25 uninit locals each)
  Code:     479/512 bytes
  Stack:    256/256 reserved
  Free:     0 bytes in data area
```

It writes `g0=42, gf=15`, calls `add(g0, gf)`, verifies the result is 57, and outputs "PASS" or "FAIL".

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
