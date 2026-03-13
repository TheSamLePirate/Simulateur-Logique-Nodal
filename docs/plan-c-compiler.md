# Plan: Step 2 — Simple C Language & Compiler to ASM

## Context

Step 1 is complete: we have an ASM editor, two-pass assembler (`src/cpu/assembler.ts`), software CPU simulator (`src/cpu/cpu.ts`), and text console. The user now wants a **simple C language** and a **compiler** that generates ASM code compatible with our existing `assemble()` function. The compilation pipeline is:

```
C source → Lexer → Parser (AST) → Code Generator → ASM string → assemble() → bytes → CPU
```

The existing assembler, CPU, and hardware simulator are **untouched** — the C compiler simply produces ASM text that feeds into `assemble()`.

---

## Simple C Language Specification

### Constraints (8-bit CPU, 256 bytes RAM)
- All values are **8-bit unsigned** (0–255)
- Memory layout: code at 0x00+, globals at 0x80+, stack from 0xFF downward
- Two registers: A (accumulator), B (secondary)

### Supported Features

| Feature | Syntax | Notes |
|---------|--------|-------|
| Types | `int`, `void` | int = 8-bit unsigned (0–255) |
| Globals | `int x = 5;` | Stored at fixed addresses 0x80+ |
| Locals | `int y = 3;` | Stack-allocated |
| Functions | `int foo(int a) { return a+1; }` | With params, recursion |
| Entry point | `int main() { ... }` | Required |
| If/else | `if (x > 0) { ... } else { ... }` | |
| While | `while (x > 0) { x--; }` | |
| For | `for (int i=0; i<10; i++) { ... }` | |
| Arithmetic | `+`, `-`, `*`, `/`, `%` | `*`/`/`/`%` via loops |
| Bitwise | `&`, `\|`, `^`, `~`, `<<`, `>>` | Native ISA ops |
| Comparison | `==`, `!=`, `<`, `>`, `<=`, `>=` | Produce 0 or 1 |
| Assignment | `=`, `+=`, `-=` | |
| Unary | `!`, `~`, `++`, `--` | |
| Built-ins | `putchar(c)`, `print_num(n)`, `print("str")` | I/O |
| Comments | `//` and `/* */` | |
| Constants | `#define NAME value` | Preprocessed |

### NOT Supported
- Arrays, pointers, structs, strings as values, switch/case, float

---

## Files to Create (5 new files)

### 1. `src/cpu/compiler/lexer.ts` (~150 lines)
- Tokenizer with line/column tracking for error reporting
- Token types: NUMBER, CHAR_LITERAL, STRING_LITERAL, IDENTIFIER, keywords (`int`, `void`, `if`, `else`, `while`, `for`, `return`), operators, delimiters, EOF
- Handles: decimal `42`, hex `0x2A`, char `'A'`, strings `"hello"`, `//` and `/* */` comments
- Returns `Token[]` array

### 2. `src/cpu/compiler/parser.ts` (~400 lines)
- Recursive descent parser with operator precedence
- Precedence (low→high): `||` → `&&` → `|` → `^` → `&` → `==`/`!=` → `<`/`>`/`<=`/`>=` → `<<`/`>>` → `+`/`-` → `*`/`/`/`%` → unary
- AST node types:
  - `Program { defines, globals, functions }`
  - `FunctionDecl { name, params, returnType, body }`
  - `VarDecl { name, initializer? }`
  - `IfStmt`, `WhileStmt`, `ForStmt`, `ReturnStmt`, `ExprStmt`, `Block`
  - `BinaryExpr`, `UnaryExpr`, `CallExpr`, `AssignExpr`, `NumberLiteral`, `Identifier`, `StringLiteral`
- Error collection with source line numbers

### 3. `src/cpu/compiler/codegen.ts` (~350 lines)
- AST → ASM string generation
- **Symbol table**: globals at 0x80+, locals as SP offsets
- **Label generator**: `__L0`, `__L1`, ... for control flow jumps
- **Register strategy**: A = expression result, B = temporary for binary ops
- **Calling convention**: args pushed right-to-left, CALL, return value in A, caller pops args
- **Built-in recognition**: `putchar(expr)` → evaluate expr to A then `OUTA`, `print_num(expr)` → `OUTD`, `print("str")` → series of `OUT` instructions
- **Multiply/Divide**: emitted as inline ASM loops (no function call overhead)
- Emits `JMP __main` at start, function bodies with labels, `HLT` after main returns

### 4. `src/cpu/compiler/index.ts` (~40 lines)
- `compile(source: string): CompileResult` — main entry point
- Preprocesses `#define` constants (text substitution)
- Chains: tokenize → parse → codegen
- Aggregates errors from all phases
- Returns: `{ success, assembly, errors, generatedASM }`

### 5. `src/cpu/cexamples.ts` (~100 lines)
- `C_EXAMPLES: { name, description, code }[]`
- Examples:
  1. **"Hello World"** — `print("Hello World!");`
  2. **"Compteur"** — `for` loop 0→9 with `putchar`
  3. **"Fibonacci"** — compute + print fibonacci
  4. **"Factorielle"** — recursive `fact(n)` function
  5. **"Calcul"** — arithmetic with variables

---

## Files to Modify (2 files)

### 6. `src/components/software/ASMEditor.tsx`
- Add `language` prop: `"asm" | "c"`
- Add C keyword highlighting when `language === "c"`: keywords=purple (`int`, `void`, `if`, `else`, `while`, `for`, `return`), strings=amber, comments=gray, numbers=green, built-ins=cyan (`putchar`, `print_num`, `print`), operators=slate
- Switch example list based on language
- Keep ASM highlighting as default

### 7. `src/components/software/SoftwareView.tsx`
- Add `language` state: `"asm" | "c"`
- Add language toggle in control bar: two buttons "ASM" / "C"
- Import `compile` from compiler and `C_EXAMPLES`
- Modify `handleAssemble`:
  - If `language === "c"`: call `compile(code)` → if success, pass `result.assembly` to `assemble()` → store `generatedASM` for display
  - If `language === "asm"`: existing behavior
- Add collapsible "ASM Généré" panel below editor (shown only for C mode)
- Pass `language` prop to ASMEditor
- Switch examples based on language

---

## Implementation Order

1. `src/cpu/compiler/lexer.ts` — tokenizer (no deps)
2. `src/cpu/compiler/parser.ts` — parser (depends on lexer token types)
3. `src/cpu/compiler/codegen.ts` — code gen (depends on parser AST types)
4. `src/cpu/compiler/index.ts` — compile() entry point
5. `src/cpu/cexamples.ts` — C examples
6. `src/components/software/ASMEditor.tsx` — add language prop + C highlighting
7. `src/components/software/SoftwareView.tsx` — language toggle + compile pipeline

---

## Verification

1. `npm run build` — must pass with no errors
2. Open "Logiciel" tab → see "ASM" / "C" toggle buttons
3. Switch to "C" → C examples appear in dropdown
4. Select "Hello World" → click "Assembler" → console shows "Hello World!"
5. Select "Compteur" → Run → console shows "0123456789"
6. Select "Factorielle" → Step → see CALL/RET in action, result in console
7. View "ASM Généré" panel → shows generated assembly code
8. Write invalid C (`int x = ;`) → error with correct line number
9. Toggle back to "ASM" → ASM examples still work perfectly
10. Step through compiled C → current line highlights correctly in C source
