# Plan: Step 2 — Simple C Language & Compiler to ASM

## Context

Step 1 is complete: we have an ASM editor, two-pass assembler (`src/cpu/assembler.ts`), software CPU simulator (`src/cpu/cpu.ts`), and text console. The user now wants a **simple C language** and a **compiler** that generates ASM code compatible with our existing `assemble()` function. The compilation pipeline is:

```
C source → Lexer → Parser (AST) → Code Generator → ASM string → assemble() → bytes → CPU
```

The existing assembler, CPU, and hardware simulator are **untouched** — the C compiler simply produces ASM text that feeds into `assemble()`.

---

## Simple C Language Specification

### Constraints (8-bit CPU, 8192 bytes RAM)
- All values are **8-bit unsigned** (0–255)
- Memory layout: code at 0x0000+, globals at 0x1000+, locals at 0x1018+, stack from 0x1FFF downward
- Two registers: A (accumulator), B (secondary)

### Supported Features

| Feature | Syntax | Notes |
|---------|--------|-------|
| Types | `int`, `string`, `void` | `string` declares a zero-terminated character array |
| Globals | `int x = 5;`, `int a = 1, b = 2;` | Stored at fixed addresses 0x1000+; comma-separated declarations are supported |
| Locals | `int y = 3;`, `int i = 0, j = 3;` | Fixed addresses 0x1018+ (per function); comma-separated declarations are supported |
| Read-only data | `const int msg_len = 5;` | Local/global `const` data is initialized once and is read-only afterwards |
| Functions | `int foo(int a) { return a+1; }`, `int sum(int values[3]) { ... }` | With params, recursion, and fixed-size array arguments |
| Entry point | `int main() { ... }` | Required |
| If/else | `if (x > 0) { ... } else { ... }` | |
| While | `while (x > 0) { x--; }` | |
| For | `for (int i=0; i<10; i++) { ... }` | |
| Arithmetic | `+`, `-`, `*`, `/`, `%` | `*`/`/`/`%` via loops |
| Bitwise | `&`, `\|`, `^`, `~`, `<<`, `>>` | Native ISA ops |
| Comparison | `==`, `!=`, `<`, `>`, `<=`, `>=` | Produce 0 or 1 |
| Assignment | `=`, `+=`, `-=` | |
| Unary | `!`, `~`, `++`, `--` | |
| Built-in Output | `putchar(c)`, `print_num(n)`, `print("str")` | Console output |
| Built-in Input | `getchar()` | Reads one char (blocking busy-wait) |
| Arrays | `int arr[10] = {1, 2, 3}; arr[i] = x; x = arr[i];` | Indexed via LDAI/STAI opcodes; array initializers and fixed-size function arguments are supported |
| Built-in Plotter | `color(r, g, b)`, `draw(x, y)`, `clear()` | RGB pixel drawing |
| Comments | `//` and `/* */` | |
| Constants | `#define NAME value` | Preprocessed |

### Built-in Functions Reference

| Function | Description | Compiled to |
|----------|-------------|-------------|
| `putchar(expr)` | Output one ASCII character | Evaluate expr → A, then `OUTA` |
| `print_num(expr)` | Output a decimal number | Evaluate expr → A, then `OUTD` |
| `print("str")` | Output a string literal | Series of `OUT` instructions |
| `getchar()` | Read one char from input (blocks until available) | `INA; CMP 0; JZ wait` busy-wait loop |
| `color(r, g, b)` | Set current plotter RGB color | `r -> COLR`, `g -> COLG`, `b -> COLB` |
| `draw(x, y)` | Plot pixel at (x, y) on plotter | x → A, y → B, then `DRAW` |
| `clear()` | Clear all pixels on plotter | `CLR` |

### NOT Supported
- Pointers, structs, full pointer-style strings, switch/case, float, 2D arrays

---

## Files Created (5 files)

### 1. `src/cpu/compiler/lexer.ts` (~150 lines)
- Tokenizer with line/column tracking for error reporting
- Token types: NUMBER, CHAR_LITERAL, STRING_LITERAL, IDENTIFIER, keywords (`const`, `int`, `string`, `void`, `if`, `else`, `while`, `for`, `return`), operators, delimiters, EOF
- Handles: decimal `42`, hex `0x2A`, char `'A'`, strings `"hello"`, `//` and `/* */` comments
- Returns `Token[]` array

### 2. `src/cpu/compiler/parser.ts` (~400 lines)
- Recursive descent parser with operator precedence
- Precedence (low→high): `||` → `&&` → `|` → `^` → `&` → `==`/`!=` → `<`/`>`/`<=`/`>=` → `<<`/`>>` → `+`/`-` → `*`/`/`/`%` → unary
- AST node types:
  - `Program { defines, globals, functions }`
  - `FunctionDecl { name, params, returnType, body }`
  - `VarDecl { name, initializer?, arraySize?, isConst }`
  - `ArrayInitializer { elements }`
  - `IfStmt`, `WhileStmt`, `ForStmt`, `ReturnStmt`, `ExprStmt`, `Block`
  - `BinaryExpr`, `UnaryExpr`, `CallExpr`, `AssignExpr`, `NumberLiteral`, `Identifier`, `StringLiteral`
  - `IndexExpr { arrayName, index }` — array read: `arr[i]`
  - `IndexAssignExpr { arrayName, index, value }` — array write: `arr[i] = expr`
- Error collection with source line numbers

### 3. `src/cpu/compiler/codegen.ts` (~350 lines)
- AST → ASM string generation
- **Memory layout** (8192 bytes):
  - `0x0000-0x0FFF` = code (program, 4096 bytes max)
  - `0x1000-0x100F` = global variables (16 max)
  - `0x1010-0x1015` = arithmetic scratch (multiply, divide, bitwise)
  - `0x1017` = scratch: return value save
  - `0x1018-0x17FF` = local variables and parameters (per-function, unique)
  - `0x1800-0x1FFF` = stack (2048 bytes, grows downward from 0x1FFF)
- **Label generator**: `__L0`, `__L1`, ... for control flow jumps
- **Register strategy**: A = expression result, B = temporary for binary ops
- **Calling convention**: caller saves own vars + temps to stack, writes args to callee param addresses, CALL, return value in A, caller restores temps + vars
- **Built-in recognition**: `putchar(expr)` → `OUTA`, `print_num(expr)` → `OUTD`, `print("str")` → series of `OUT`, `getchar()` → `INA; CMP 0; JZ` busy-wait, `draw(x,y)` → `DRAW`, `clear()` → `CLR`
- **Multiply/Divide**: emitted as inline ASM loops (no function call overhead)
- **Arrays**: contiguous byte allocation in global/local regions, indexed via `LDAI` (read: A ← MEM[base+A]) and `STAI` (write: MEM[base+B] ← A)
- Emits `JMP __main` at start, function bodies with labels, `HLT` after main returns

### 4. `src/cpu/compiler/index.ts` (~40 lines)
- `compile(source: string): CompileResult` — main entry point
- Preprocesses `#define` constants (text substitution)
- Chains: tokenize → parse → codegen
- Aggregates errors from all phases
- Returns: `{ success, assembly, errors, generatedASM }`

### 5. `src/cpu/cexamples.ts` (~350 lines)
- `C_EXAMPLES: { name, description, code }[]`
- Examples:
  1. **"Hello World"** — `print("Hello World!");`
  2. **"Compteur"** — `for` loop 0→9 with `putchar`
  3. **"Fibonacci"** — compute + print fibonacci numbers
  4. **"Factorielle"** — recursive `fact(n)` function
  5. **"Calcul"** — arithmetic with variables and `#define`
  6. **"Plotter"** — draws diagonal and border on plotter
  7. **"Sinusoïdes"** — harmonic synthesis with parabolic wave approximation
  8. **"Echo (Saisie)"** — reads chars with `getchar()` and echoes them
  9. **"Compteur de lettres"** — counts characters per line of input
  10–18. *[additional examples: Calculatrice, Traceur, Cercle, Clavier, Horloge, Spirale, Nombres premiers, Étoiles, Test Mémoire 2K]*
  19. **"Tableau (Tri)"** — bubble sort of 8 elements using arrays and indexed addressing
  20. **"Tableau (Nouvelles Fonctionnalites)"** — fixed-size array arguments plus comma-separated declarations
  21. **"Const et String"** — const globals/locals, array initializers, and `string` declarations

---

## Files Modified (2 files)

### 6. `src/components/software/ASMEditor.tsx`
- Added `language` prop: `"asm" | "c"`
- Added C keyword highlighting when `language === "c"`: keywords=purple (`int`, `void`, `if`, `else`, `while`, `for`, `return`), strings=amber, comments=gray, numbers=green, built-ins=cyan (`putchar`, `print_num`, `print`, `getchar`, `draw`, `clear`), operators=slate
- Switches example list based on language
- Keeps ASM highlighting as default

### 7. `src/components/software/SoftwareView.tsx`
- Added `language` state: `"asm" | "c"`
- Added language toggle in control bar: two buttons "ASM" / "C"
- Imports `compile` from compiler and `C_EXAMPLES`
- Modified `handleAssemble`:
  - If `language === "c"`: call `compile(code)` → if success, pass `result.assembly` to `assemble()` → store `generatedASM` for display
  - If `language === "asm"`: existing behavior
- Added collapsible "ASM Généré" panel below editor (shown only for C mode)
- Passes `language` prop to ASMEditor
- Switches examples based on language
- Added `handleConsoleInput` callback: loops through text chars, calls `cpu.pushInput(charCode)`, appends newline (char 10)
- Passes `onInput={handleConsoleInput}` to ConsolePanel

---

## Verification

1. `npm run build` — must pass with no errors
2. Open "Logiciel" tab → see "ASM" / "C" toggle buttons
3. Switch to "C" → C examples appear in dropdown
4. Select "Hello World" → click "Assembler" → console shows "Hello World!"
5. Select "Compteur" → Run → console shows "0123456789"
6. Select "Factorielle" → Step → see CALL/RET in action, result in console
7. Select "Echo (Saisie)" → Run → type text in console input → chars echo back
8. View "ASM Généré" panel → shows generated assembly code
9. Write invalid C (`int x = ;`) → error with correct line number
10. Toggle back to "ASM" → ASM examples still work perfectly
11. Step through compiled C → current line highlights correctly in C source
