/**
 * Code generator: AST → ASM string.
 *
 * Targeting the 8-bit ISA defined in src/cpu/isa.ts.
 * Emits assembly text compatible with our assembler.
 *
 * Register strategy:
 *   A = expression result / accumulator
 *   B = secondary register for binary ops
 *
 * Memory layout (8192 bytes):
 *   0x0000..0x0FFF = code (program, 4096 bytes)
 *   0x1000..0x100F = global variables (16 max)
 *   0x1010..0x1015 = arithmetic scratch (multiply, divide, bitwise)
 *   0x1016          = scratch: unused
 *   0x1017          = scratch: return value save
 *   0x1018..0x17FF = local variables and parameters (per-function, unique)
 *   0x1800..0x1FFF = stack (2048 bytes, grows downward from 0x1FFF)
 *
 * Calling convention:
 *   - Caller writes args directly to callee's param addresses
 *   - Before CALL, caller saves its own locals to the stack (recursion safety)
 *   - CALL pushes return address
 *   - Return value in A
 *   - After RET, caller restores its locals from the stack
 */

import type { Program, FunctionDecl, Stmt, Expr, Block } from "./parser";

export interface CodegenError {
  line: number;
  message: string;
}

export interface MemoryLayout {
  globals: number; // number of global variables
  scratch: number; // arithmetic scratch slots (fixed)
  locals: number; // number of local/param variables
  stackSize: number; // stack area size (fixed)
}

interface ArrayInfo {
  baseAddr: number;
  size: number;
}

interface FuncInfo {
  isMain: boolean;
  paramAddrs: Map<string, number>; // param name → memory address
  localAddrs: Map<string, number>; // local name → memory address
  allVarAddrs: number[]; // all param+local addresses (for save/restore)
  arrays: Map<string, ArrayInfo>; // array name → base address + size
}

// Scratch memory constants
const TEMP_BASE = 0x1010; // 0x1010-0x1015 for arithmetic
const TEMP_COUNT = 6; // number of temp slots to save/restore
const TEMP_RETVAL = 0x1017; // save return value around POPs
const STACK_BASE = 0x1800; // stack occupies 0x1800-0x1FFF

export function generate(program: Program): {
  assembly: string;
  errors: CodegenError[];
  memoryLayout: MemoryLayout;
} {
  const errors: CodegenError[] = [];
  const lines: string[] = [];
  let labelCounter = 0;
  let globalAddr = 0x1000;
  let varAddr = 0x1018; // for locals and params (after scratch area)

  const globals = new Map<string, number>(); // name → address
  const globalArrays = new Map<string, ArrayInfo>(); // array name → info
  const funcTable = new Map<string, FuncInfo>();

  // Loop context stack for break/continue
  const loopStack: { breakLabel: string; continueLabel: string }[] = [];

  // ─── Helpers ───

  function newLabel(): string {
    return `__L${labelCounter++}`;
  }

  function emit(line: string) {
    lines.push(line);
  }

  function emitComment(text: string) {
    lines.push(`; ${text}`);
  }

  function fmt(addr: number): string {
    return "0x" + (addr & 0xffff).toString(16).padStart(4, "0");
  }

  function allocVar(): number {
    if (varAddr >= STACK_BASE) {
      errors.push({
        line: 0,
        message: "Trop de variables locales (mémoire pleine)",
      });
      return STACK_BASE - 1;
    }
    return varAddr++;
  }

  // ─── Collect local variable info declared inside a block ───

  interface LocalInfo {
    name: string;
    arraySize: number | null; // null = scalar, N = array
  }

  function collectLocals(block: Block): LocalInfo[] {
    const infos: LocalInfo[] = [];
    function scan(stmts: Stmt[]) {
      for (const s of stmts) {
        if (s.kind === "VarDecl")
          infos.push({ name: s.name, arraySize: s.arraySize });
        if (s.kind === "Block") scan(s.statements);
        if (s.kind === "IfStmt") {
          if (s.thenBranch.kind === "Block") scan(s.thenBranch.statements);
          if (s.elseBranch?.kind === "Block") scan(s.elseBranch.statements);
        }
        if (s.kind === "WhileStmt" && s.body.kind === "Block")
          scan(s.body.statements);
        if (s.kind === "ForStmt") {
          if (s.init?.kind === "VarDecl")
            infos.push({ name: s.init.name, arraySize: s.init.arraySize });
          if (s.body.kind === "Block") scan(s.body.statements);
        }
      }
    }
    scan(block.statements);
    return infos;
  }

  // ═══════════════════════════════════════
  //  Phase 1 — Allocate globals
  // ═══════════════════════════════════════

  for (const g of program.globals) {
    if (globals.has(g.name) || globalArrays.has(g.name)) {
      errors.push({
        line: g.line,
        message: `Variable globale "${g.name}" déjà déclarée`,
      });
      continue;
    }
    if (g.arraySize !== null) {
      // Array: allocate contiguous bytes
      if (globalAddr + g.arraySize - 1 > 0x100f) {
        errors.push({
          line: g.line,
          message: `Tableau global "${g.name}" trop grand (dépasse la zone globale, max 16 octets)`,
        });
        continue;
      }
      globalArrays.set(g.name, { baseAddr: globalAddr, size: g.arraySize });
      globalAddr += g.arraySize;
    } else {
      // Scalar
      if (globalAddr > 0x100f) {
        errors.push({
          line: g.line,
          message: "Trop de variables globales (max 16)",
        });
        continue;
      }
      globals.set(g.name, globalAddr);
      globalAddr++;
    }
  }

  // ═══════════════════════════════════════
  //  Phase 2 — Allocate function locals/params
  // ═══════════════════════════════════════

  for (const fn of program.functions) {
    const paramAddrs = new Map<string, number>();
    for (const p of fn.params) {
      paramAddrs.set(p.name, allocVar());
    }

    const localInfos = collectLocals(fn.body);
    const localAddrs = new Map<string, number>();
    const arrays = new Map<string, ArrayInfo>();
    for (const info of localInfos) {
      if (
        paramAddrs.has(info.name) ||
        localAddrs.has(info.name) ||
        arrays.has(info.name)
      )
        continue;
      if (info.arraySize !== null) {
        // Array: allocate contiguous bytes
        const baseAddr = varAddr;
        for (let i = 0; i < info.arraySize; i++) {
          allocVar();
        }
        arrays.set(info.name, { baseAddr, size: info.arraySize });
      } else {
        localAddrs.set(info.name, allocVar());
      }
    }

    // allVarAddrs: scalars + all array element addresses (for save/restore)
    const allScalarAddrs = [...paramAddrs.values(), ...localAddrs.values()];
    const allArrayAddrs: number[] = [];
    for (const arrInfo of arrays.values()) {
      for (let i = 0; i < arrInfo.size; i++) {
        allArrayAddrs.push(arrInfo.baseAddr + i);
      }
    }
    const allVarAddrs = [...allScalarAddrs, ...allArrayAddrs];

    funcTable.set(fn.name, {
      isMain: fn.name === "main",
      paramAddrs,
      localAddrs,
      allVarAddrs,
      arrays,
    });
  }

  // ═══════════════════════════════════════
  //  Phase 3 — Emit code
  // ═══════════════════════════════════════

  emit("; === Programme compilé depuis C ===");
  emit("  JMP __main");

  for (const fn of program.functions) {
    emitFunction(fn);
  }

  if (!program.functions.find((f) => f.name === "main")) {
    errors.push({ line: 1, message: "Fonction 'main' requise" });
  }

  return {
    assembly: lines.join("\n"),
    errors,
    memoryLayout: {
      globals: globalAddr - 0x1000,
      scratch: 8, // 0x1010-0x1017 always reserved
      locals: varAddr - 0x1018,
      stackSize: 2048, // 0x1800-0x1FFF always reserved
    },
  };

  // ═══════════════════════════════════════
  //  Function code generation
  // ═══════════════════════════════════════

  function emitFunction(fn: FunctionDecl) {
    const ctx = funcTable.get(fn.name)!;
    const isMain = fn.name === "main";

    emit("");
    emitComment(`--- function ${fn.name} ---`);
    emit(`__${fn.name}:`);

    // For main: initialize globals
    if (isMain) {
      for (const g of program.globals) {
        if (g.initializer) {
          emitExpr(g.initializer, ctx);
          emit(`  STA ${fmt(globals.get(g.name)!)}`);
        }
      }
    }

    // Params are already written to their fixed addresses by the caller
    // (via emitCallExpr). Nothing to do here.

    // Emit body statements
    emitBlock(fn.body, ctx);

    // Default return
    if (isMain) {
      emit("  HLT");
    } else {
      emit("  RET");
    }
  }

  // ─── Statements ───

  function emitBlock(block: Block, ctx: FuncInfo) {
    for (const stmt of block.statements) {
      emitStmt(stmt, ctx);
    }
  }

  function emitStmt(stmt: Stmt, ctx: FuncInfo) {
    switch (stmt.kind) {
      case "VarDecl":
        if (stmt.initializer) {
          emitExpr(stmt.initializer, ctx);
          storeVar(stmt.name, ctx);
        }
        break;
      case "ExprStmt":
        emitExpr(stmt.expression, ctx);
        break;
      case "ReturnStmt":
        if (stmt.value) {
          emitExpr(stmt.value, ctx);
        }
        // main is entered via JMP (not CALL), so it must HLT, not RET
        emit(ctx.isMain ? "  HLT" : "  RET");
        break;
      case "IfStmt":
        emitIfStmt(stmt, ctx);
        break;
      case "WhileStmt":
        emitWhileStmt(stmt, ctx);
        break;
      case "ForStmt":
        emitForStmt(stmt, ctx);
        break;
      case "BreakStmt":
        if (loopStack.length === 0) {
          errors.push({
            line: stmt.line,
            message: "'break' en dehors d'une boucle",
          });
        } else {
          emit(`  JMP ${loopStack[loopStack.length - 1].breakLabel}`);
        }
        break;
      case "ContinueStmt":
        if (loopStack.length === 0) {
          errors.push({
            line: stmt.line,
            message: "'continue' en dehors d'une boucle",
          });
        } else {
          emit(`  JMP ${loopStack[loopStack.length - 1].continueLabel}`);
        }
        break;
      case "Block":
        emitBlock(stmt, ctx);
        break;
    }
  }

  function emitIfStmt(stmt: Stmt & { kind: "IfStmt" }, ctx: FuncInfo) {
    const elseLabel = newLabel();
    const endLabel = newLabel();

    emitExpr(stmt.condition, ctx);
    emit(`  CMP 0`);
    emit(`  JZ ${stmt.elseBranch ? elseLabel : endLabel}`);

    emitStmt(stmt.thenBranch, ctx);

    if (stmt.elseBranch) {
      emit(`  JMP ${endLabel}`);
      emit(`${elseLabel}:`);
      emitStmt(stmt.elseBranch, ctx);
    }

    emit(`${endLabel}:`);
  }

  function emitWhileStmt(stmt: Stmt & { kind: "WhileStmt" }, ctx: FuncInfo) {
    const loopLabel = newLabel();
    const endLabel = newLabel();

    emit(`${loopLabel}:`);
    emitExpr(stmt.condition, ctx);
    emit(`  CMP 0`);
    emit(`  JZ ${endLabel}`);

    loopStack.push({ breakLabel: endLabel, continueLabel: loopLabel });
    emitStmt(stmt.body, ctx);
    loopStack.pop();

    emit(`  JMP ${loopLabel}`);
    emit(`${endLabel}:`);
  }

  function emitForStmt(stmt: Stmt & { kind: "ForStmt" }, ctx: FuncInfo) {
    if (stmt.init) {
      emitStmt(stmt.init, ctx);
    }

    const loopLabel = newLabel();
    const updateLabel = newLabel();
    const endLabel = newLabel();

    emit(`${loopLabel}:`);

    if (stmt.condition) {
      emitExpr(stmt.condition, ctx);
      emit(`  CMP 0`);
      emit(`  JZ ${endLabel}`);
    }

    loopStack.push({ breakLabel: endLabel, continueLabel: updateLabel });
    emitStmt(stmt.body, ctx);
    loopStack.pop();

    emit(`${updateLabel}:`);
    if (stmt.update) {
      emitExpr(stmt.update, ctx);
    }

    emit(`  JMP ${loopLabel}`);
    emit(`${endLabel}:`);
  }

  // ─── Expression emission (result always in A) ───

  function emitExpr(expr: Expr, ctx: FuncInfo) {
    switch (expr.kind) {
      case "NumberLiteral":
        emit(`  LDA ${expr.value}`);
        break;

      case "CharLiteral":
        emit(`  LDA ${expr.value}`);
        break;

      case "StringLiteral":
        // Standalone string: emit each char via OUT
        for (const ch of expr.value) {
          emit(`  OUT ${ch.charCodeAt(0)}`);
        }
        break;

      case "Identifier":
        loadVar(expr.name, ctx, expr.line);
        break;

      case "AssignExpr":
        emitExpr(expr.value, ctx);
        storeVar(expr.name, ctx);
        break;

      case "CompoundAssignExpr": {
        // Load current value, compute RHS, combine
        emitExpr(expr.value, ctx);
        emit(`  STA ${fmt(TEMP_BASE)}`); // temp = RHS
        loadVar(expr.name, ctx, expr.line); // A = current value
        emit(`  LBM ${fmt(TEMP_BASE)}`); // B = RHS
        if (expr.op === "+=") emit(`  ADDB`);
        else emit(`  SUBB`);
        storeVar(expr.name, ctx);
        break;
      }

      case "BinaryExpr":
        emitBinaryExpr(expr, ctx);
        break;

      case "UnaryExpr":
        emitUnaryExpr(expr, ctx);
        break;

      case "PostfixExpr":
        emitPostfixExpr(expr, ctx);
        break;

      case "IndexExpr": {
        // arr[i] read: evaluate index → A, then LDAI base
        const base = resolveArray(expr.arrayName, ctx, expr.line);
        if (base !== null) {
          emitExpr(expr.index, ctx); // A = index
          emit(`  LDAI ${fmt(base)}`); // A = MEM[base + A]
        }
        break;
      }

      case "IndexAssignExpr": {
        // arr[i] = expr write:
        //   evaluate value → A, PUSH
        //   evaluate index → A, TAB (B = index)
        //   POP (A = value)
        //   STAI base (MEM[base + B] = A)
        const base2 = resolveArray(expr.arrayName, ctx, expr.line);
        if (base2 !== null) {
          emitExpr(expr.value, ctx); // A = value
          emit(`  PUSH`); // save value
          emitExpr(expr.index, ctx); // A = index
          emit(`  TAB`); // B = index
          emit(`  POP`); // A = value
          emit(`  STAI ${fmt(base2)}`); // MEM[base + B] = A
        }
        break;
      }

      case "CallExpr":
        emitCallExpr(expr, ctx);
        break;
    }
  }

  // ─── Binary expressions ───

  function emitBinaryExpr(expr: Expr & { kind: "BinaryExpr" }, ctx: FuncInfo) {
    const op = expr.op;

    // Comparisons → 0 or 1
    if (["==", "!=", "<", ">", "<=", ">="].includes(op)) {
      emitComparison(expr, ctx);
      return;
    }

    // Logical &&
    if (op === "&&") {
      const falseLabel = newLabel();
      const endLabel = newLabel();
      emitExpr(expr.left, ctx);
      emit(`  CMP 0`);
      emit(`  JZ ${falseLabel}`);
      emitExpr(expr.right, ctx);
      emit(`  CMP 0`);
      emit(`  JZ ${falseLabel}`);
      emit(`  LDA 1`);
      emit(`  JMP ${endLabel}`);
      emit(`${falseLabel}:`);
      emit(`  LDA 0`);
      emit(`${endLabel}:`);
      return;
    }

    // Logical ||
    if (op === "||") {
      const trueLabel = newLabel();
      const endLabel = newLabel();
      emitExpr(expr.left, ctx);
      emit(`  CMP 0`);
      emit(`  JNZ ${trueLabel}`);
      emitExpr(expr.right, ctx);
      emit(`  CMP 0`);
      emit(`  JNZ ${trueLabel}`);
      emit(`  LDA 0`);
      emit(`  JMP ${endLabel}`);
      emit(`${trueLabel}:`);
      emit(`  LDA 1`);
      emit(`${endLabel}:`);
      return;
    }

    // Multiply: inline loop
    if (op === "*") {
      emitMultiply(expr, ctx);
      return;
    }

    // Divide / Modulo: inline loop
    if (op === "/" || op === "%") {
      emitDivMod(expr, op, ctx);
      return;
    }

    // Bitwise: bit-by-bit loop (ISA only has immediate AND/OR/XOR)
    if (op === "&" || op === "|" || op === "^") {
      emitBitwiseOp(expr, op, ctx);
      return;
    }

    // Standard binary: evaluate left → save, evaluate right → B, then op
    emitExpr(expr.left, ctx);
    emit(`  PUSH`);
    emitExpr(expr.right, ctx);
    emit(`  TAB`); // B = right
    emit(`  POP`); // A = left

    switch (op) {
      case "+":
        emit(`  ADDB`);
        break;
      case "-":
        emit(`  SUBB`);
        break;
      case "<<":
        emitShiftLoop("SHL");
        break;
      case ">>":
        emitShiftLoop("SHR");
        break;
    }
  }

  // ─── Comparison: result in A (0 or 1) ───

  function emitComparison(expr: Expr & { kind: "BinaryExpr" }, ctx: FuncInfo) {
    const trueLabel = newLabel();
    const endLabel = newLabel();

    emitExpr(expr.left, ctx);
    emit(`  PUSH`);
    emitExpr(expr.right, ctx);
    emit(`  TAB`); // B = right
    emit(`  POP`); // A = left
    emit(`  SUBB`); // A = left - right (sets flags)

    switch (expr.op) {
      case "==":
        emit(`  JZ ${trueLabel}`);
        break;
      case "!=":
        emit(`  JNZ ${trueLabel}`);
        break;
      case "<":
        // unsigned: left < right ↔ borrow (carry) on left - right
        emit(`  JC ${trueLabel}`);
        break;
      case ">": {
        // unsigned: left > right ↔ no borrow AND not zero
        // If zero or carry, result is false → fall through to LDA 0
        const skipGt = newLabel();
        emit(`  JZ ${skipGt}`);
        emit(`  JC ${skipGt}`);
        emit(`  JMP ${trueLabel}`);
        emit(`${skipGt}:`);
        break;
      }
      case "<=":
        // unsigned: left <= right ↔ borrow OR zero
        emit(`  JZ ${trueLabel}`);
        emit(`  JC ${trueLabel}`);
        break;
      case ">=": {
        // unsigned: left >= right ↔ no borrow
        // If carry (borrow), result is false → fall through to LDA 0
        const skipGte = newLabel();
        emit(`  JC ${skipGte}`);
        emit(`  JMP ${trueLabel}`);
        emit(`${skipGte}:`);
        break;
      }
    }

    emit(`  LDA 0`);
    emit(`  JMP ${endLabel}`);
    emit(`${trueLabel}:`);
    emit(`  LDA 1`);
    emit(`${endLabel}:`);
  }

  // ─── Multiply: inline loop ───

  function emitMultiply(expr: Expr & { kind: "BinaryExpr" }, ctx: FuncInfo) {
    // result = 0; while (right > 0) { result += left; right--; }
    const loopLabel = newLabel();
    const endLabel = newLabel();
    const t1 = TEMP_BASE; // left value
    const t2 = TEMP_BASE + 1; // right counter
    const t3 = TEMP_BASE + 2; // result accumulator

    emitExpr(expr.left, ctx);
    emit(`  PUSH`); // save left on stack (safe from right-side evaluation)
    emitExpr(expr.right, ctx);
    emit(`  STA ${fmt(t2)}`);
    emit(`  POP`); // recover left
    emit(`  STA ${fmt(t1)}`);
    emit(`  LDA 0`);
    emit(`  STA ${fmt(t3)}`);

    emit(`${loopLabel}:`);
    emit(`  LDM ${fmt(t2)}`);
    emit(`  CMP 0`);
    emit(`  JZ ${endLabel}`);
    // result += left
    emit(`  LDM ${fmt(t3)}`);
    emit(`  LBM ${fmt(t1)}`);
    emit(`  ADDB`);
    emit(`  STA ${fmt(t3)}`);
    // right--
    emit(`  LDM ${fmt(t2)}`);
    emit(`  DEC`);
    emit(`  STA ${fmt(t2)}`);
    emit(`  JMP ${loopLabel}`);
    emit(`${endLabel}:`);
    emit(`  LDM ${fmt(t3)}`);
  }

  // ─── Divide / Modulo: inline loop ───

  function emitDivMod(
    expr: Expr & { kind: "BinaryExpr" },
    op: string,
    ctx: FuncInfo,
  ) {
    // quotient = 0; while (dividend >= divisor) { dividend -= divisor; quotient++; }
    const loopLabel = newLabel();
    const endLabel = newLabel();
    const t1 = TEMP_BASE; // dividend (decreasing)
    const t2 = TEMP_BASE + 1; // divisor
    const t3 = TEMP_BASE + 2; // quotient

    emitExpr(expr.left, ctx);
    emit(`  PUSH`); // save dividend on stack (safe from right-side evaluation)
    emitExpr(expr.right, ctx);
    emit(`  STA ${fmt(t2)}`);
    emit(`  POP`); // recover dividend
    emit(`  STA ${fmt(t1)}`);
    emit(`  LDA 0`);
    emit(`  STA ${fmt(t3)}`);

    emit(`${loopLabel}:`);
    // A = dividend - divisor
    emit(`  LDM ${fmt(t1)}`);
    emit(`  LBM ${fmt(t2)}`);
    emit(`  SUBB`);
    emit(`  JC ${endLabel}`); // unsigned: if borrow (dividend < divisor) → done
    // dividend = A (dividend - divisor)
    emit(`  STA ${fmt(t1)}`);
    // quotient++
    emit(`  LDM ${fmt(t3)}`);
    emit(`  INC`);
    emit(`  STA ${fmt(t3)}`);
    emit(`  JMP ${loopLabel}`);
    emit(`${endLabel}:`);

    if (op === "/") {
      emit(`  LDM ${fmt(t3)}`); // result = quotient
    } else {
      emit(`  LDM ${fmt(t1)}`); // result = remainder
    }
  }

  // ─── Bitwise AND/OR/XOR: bit-by-bit loop ───

  function emitBitwiseOp(
    expr: Expr & { kind: "BinaryExpr" },
    op: string,
    ctx: FuncInfo,
  ) {
    // ISA only has immediate AND/OR/XOR, so we iterate bit by bit
    const loopLabel = newLabel();
    const skipLabel = newLabel();
    const endLabel = newLabel();
    const t1 = TEMP_BASE; // left  (shifted right each iteration)
    const t2 = TEMP_BASE + 1; // right (shifted right each iteration)
    const t3 = TEMP_BASE + 2; // result
    const t4 = TEMP_BASE + 3; // mask (1, 2, 4, 8, ...)
    const t5 = TEMP_BASE + 4; // counter (8 → 0)

    emitExpr(expr.left, ctx);
    emit(`  PUSH`); // save left on stack (safe from right-side evaluation)
    emitExpr(expr.right, ctx);
    emit(`  STA ${fmt(t2)}`);
    emit(`  POP`); // recover left
    emit(`  STA ${fmt(t1)}`);
    emit(`  LDA 0`);
    emit(`  STA ${fmt(t3)}`); // result = 0
    emit(`  LDA 1`);
    emit(`  STA ${fmt(t4)}`); // mask = 1
    emit(`  LDA 8`);
    emit(`  STA ${fmt(t5)}`); // counter = 8

    emit(`${loopLabel}:`);
    emit(`  LDM ${fmt(t5)}`);
    emit(`  CMP 0`);
    emit(`  JZ ${endLabel}`);

    if (op === "&") {
      // AND: set result bit only if BOTH left and right have it
      emit(`  LDM ${fmt(t1)}`);
      emit(`  AND 1`);
      emit(`  CMP 0`);
      emit(`  JZ ${skipLabel}`);
      emit(`  LDM ${fmt(t2)}`);
      emit(`  AND 1`);
      emit(`  CMP 0`);
      emit(`  JZ ${skipLabel}`);
    } else if (op === "|") {
      // OR: set result bit if EITHER left or right has it
      const setLabel = newLabel();
      emit(`  LDM ${fmt(t1)}`);
      emit(`  AND 1`);
      emit(`  CMP 0`);
      emit(`  JNZ ${setLabel}`);
      emit(`  LDM ${fmt(t2)}`);
      emit(`  AND 1`);
      emit(`  CMP 0`);
      emit(`  JZ ${skipLabel}`);
      emit(`${setLabel}:`);
    } else {
      // XOR: set result bit if exactly one of left/right has it
      const t6 = TEMP_BASE + 5;
      emit(`  LDM ${fmt(t1)}`);
      emit(`  AND 1`);
      emit(`  STA ${fmt(t6)}`); // t6 = left bit
      emit(`  LDM ${fmt(t2)}`);
      emit(`  AND 1`);
      emit(`  LBM ${fmt(t6)}`); // B = left bit
      emit(`  ADDB`); // A = left_bit + right_bit (0, 1, or 2)
      emit(`  CMP 1`);
      emit(`  JNZ ${skipLabel}`); // only set if sum == 1
    }

    // Set bit: result += mask (safe since bit wasn't set before)
    emit(`  LDM ${fmt(t3)}`);
    emit(`  LBM ${fmt(t4)}`);
    emit(`  ADDB`);
    emit(`  STA ${fmt(t3)}`);

    emit(`${skipLabel}:`);
    // Shift left and right by 1
    emit(`  LDM ${fmt(t1)}`);
    emit(`  SHR`);
    emit(`  STA ${fmt(t1)}`);
    emit(`  LDM ${fmt(t2)}`);
    emit(`  SHR`);
    emit(`  STA ${fmt(t2)}`);
    // Shift mask left
    emit(`  LDM ${fmt(t4)}`);
    emit(`  SHL`);
    emit(`  STA ${fmt(t4)}`);
    // counter--
    emit(`  LDM ${fmt(t5)}`);
    emit(`  DEC`);
    emit(`  STA ${fmt(t5)}`);
    emit(`  JMP ${loopLabel}`);
    emit(`${endLabel}:`);
    emit(`  LDM ${fmt(t3)}`);
  }

  // ─── Shift by variable amount: loop ───

  function emitShiftLoop(shiftOp: string) {
    // At this point A = value, B = shift amount
    const loopLabel = newLabel();
    const endLabel = newLabel();
    const tVal = TEMP_BASE;
    const tCount = TEMP_BASE + 1;

    emit(`  STA ${fmt(tVal)}`); // save value
    emit(`  TBA`); // A = shift amount
    emit(`  STA ${fmt(tCount)}`);

    emit(`${loopLabel}:`);
    emit(`  LDM ${fmt(tCount)}`);
    emit(`  CMP 0`);
    emit(`  JZ ${endLabel}`);
    emit(`  LDM ${fmt(tVal)}`);
    emit(`  ${shiftOp}`);
    emit(`  STA ${fmt(tVal)}`);
    emit(`  LDM ${fmt(tCount)}`);
    emit(`  DEC`);
    emit(`  STA ${fmt(tCount)}`);
    emit(`  JMP ${loopLabel}`);
    emit(`${endLabel}:`);
    emit(`  LDM ${fmt(tVal)}`);
  }

  // ─── Unary expressions ───

  function emitUnaryExpr(expr: Expr & { kind: "UnaryExpr" }, ctx: FuncInfo) {
    if (expr.op === "++" || expr.op === "--") {
      // Prefix increment/decrement
      if (expr.operand.kind === "Identifier") {
        loadVar(expr.operand.name, ctx, expr.line);
        emit(expr.op === "++" ? "  INC" : "  DEC");
        storeVar(expr.operand.name, ctx);
      }
      return;
    }

    emitExpr(expr.operand, ctx);

    switch (expr.op) {
      case "-":
        // Negate: A = 0 - A
        emit(`  TAB`);
        emit(`  LDA 0`);
        emit(`  SUBB`);
        break;
      case "!": {
        // Logical NOT: A = (A == 0) ? 1 : 0
        const trueLabel = newLabel();
        const endLabel = newLabel();
        emit(`  CMP 0`);
        emit(`  JZ ${trueLabel}`);
        emit(`  LDA 0`);
        emit(`  JMP ${endLabel}`);
        emit(`${trueLabel}:`);
        emit(`  LDA 1`);
        emit(`${endLabel}:`);
        break;
      }
      case "~":
        emit(`  NOT`);
        break;
    }
  }

  // ─── Postfix expressions (x++, x--) ───

  function emitPostfixExpr(
    expr: Expr & { kind: "PostfixExpr" },
    ctx: FuncInfo,
  ) {
    if (expr.operand.kind === "Identifier") {
      // Return old value, then increment/decrement
      loadVar(expr.operand.name, ctx, expr.line);
      emit(`  PUSH`); // save old value as result
      emit(expr.op === "++" ? "  INC" : "  DEC");
      storeVar(expr.operand.name, ctx);
      emit(`  POP`); // restore old value as expression result
    }
  }

  // ─── Function calls ───

  function emitCallExpr(expr: Expr & { kind: "CallExpr" }, ctx: FuncInfo) {
    // ── Built-in: putchar(expr) ──
    if (expr.name === "putchar") {
      if (expr.args.length >= 1) {
        emitExpr(expr.args[0], ctx);
        emit(`  OUTA`);
      }
      return;
    }

    // ── Built-in: print_num(expr) ──
    if (expr.name === "print_num") {
      if (expr.args.length >= 1) {
        emitExpr(expr.args[0], ctx);
        emit(`  OUTD`);
      }
      return;
    }

    // ── Built-in: print("string") ──
    if (expr.name === "print") {
      if (expr.args.length >= 1 && expr.args[0].kind === "StringLiteral") {
        for (const ch of expr.args[0].value) {
          emit(`  OUT ${ch.charCodeAt(0)}`);
        }
      }
      return;
    }

    // ── Built-in: draw(x, y) ──
    if (expr.name === "draw") {
      if (expr.args.length >= 2) {
        emitExpr(expr.args[0], ctx); // x → A
        emit(`  PUSH`); // save x
        emitExpr(expr.args[1], ctx); // y → A
        emit(`  TAB`); // y → B
        emit(`  POP`); // x → A
        emit(`  DRAW`);
      }
      return;
    }

    // ── Built-in: clear() ──
    if (expr.name === "clear") {
      emit(`  CLR`);
      return;
    }

    // ── Built-in: getchar() — read one char from console input (blocking) ──
    if (expr.name === "getchar") {
      const waitLabel = newLabel();
      emit(`${waitLabel}:`);
      emit(`  INA`);
      emit(`  CMP 0`);
      emit(`  JZ ${waitLabel}`);
      return;
    }

    // ── Built-in: getKey(n) — read key state (non-blocking, 0=released 1=pressed) ──
    if (expr.name === "getKey") {
      if (expr.args.length >= 1) {
        emitExpr(expr.args[0], ctx); // key index → A
        emit(`  GETKEY`);
      }
      return;
    }

    // ── Built-in: rand() — pseudo-random 8-bit value (LFSR) ──
    if (expr.name === "rand") {
      emit(`  RAND`);
      return;
    }

    // ── Built-in: sleep(n) — pause for n CPU cycles ──
    if (expr.name === "sleep") {
      if (expr.args.length >= 1) {
        emitExpr(expr.args[0], ctx); // cycle count → A
        emit(`  SLEEP`);
      }
      return;
    }

    // ── User function call ──
    const calleeInfo = funcTable.get(expr.name);
    if (!calleeInfo) {
      errors.push({
        line: expr.line,
        message: `Fonction non définie: "${expr.name}"`,
      });
      return;
    }

    // 1. Save current function's locals/params to stack (recursion safety)
    if (ctx.allVarAddrs.length > 0) {
      emitComment(`save ${ctx.allVarAddrs.length} var(s) before call`);
      for (const addr of ctx.allVarAddrs) {
        emit(`  LDM ${fmt(addr)}`);
        emit(`  PUSH`);
      }
    }

    // 2. Save arithmetic scratch temps to stack (recursion safety)
    //    This prevents inner calls' multiply/divide/bitwise from clobbering
    //    temps used by the caller's in-progress arithmetic operations.
    emitComment(`save ${TEMP_COUNT} temp(s) before call`);
    for (let i = 0; i < TEMP_COUNT; i++) {
      emit(`  LDM ${fmt(TEMP_BASE + i)}`);
      emit(`  PUSH`);
    }

    // 3. Evaluate each arg and push to stack (so we don't clobber vars during eval)
    for (let i = 0; i < expr.args.length; i++) {
      emitExpr(expr.args[i], ctx);
      emit(`  PUSH`);
    }

    // 4. Pop args into callee's param addresses
    const calleeParamAddrs = [...calleeInfo.paramAddrs.values()];
    // Args were pushed left-to-right, so last arg is on top
    for (let i = expr.args.length - 1; i >= 0; i--) {
      emit(`  POP`);
      if (i < calleeParamAddrs.length) {
        emit(`  STA ${fmt(calleeParamAddrs[i])}`);
      }
    }

    // 5. CALL
    emit(`  CALL __${expr.name}`);

    // 6. Restore arithmetic scratch temps from stack
    emit(`  STA ${fmt(TEMP_RETVAL)}`); // save return value
    for (let i = TEMP_COUNT - 1; i >= 0; i--) {
      emit(`  POP`);
      emit(`  STA ${fmt(TEMP_BASE + i)}`);
    }

    // 7. Restore current function's locals/params from stack
    if (ctx.allVarAddrs.length > 0) {
      // Restore in reverse order (stack is LIFO)
      for (let i = ctx.allVarAddrs.length - 1; i >= 0; i--) {
        emit(`  POP`);
        emit(`  STA ${fmt(ctx.allVarAddrs[i])}`);
      }
    }
    emit(`  LDM ${fmt(TEMP_RETVAL)}`); // restore return value to A
  }

  // ─── Array access helpers ───

  function isArray(name: string, ctx: FuncInfo): boolean {
    return ctx.arrays.has(name) || globalArrays.has(name);
  }

  function resolveArray(
    name: string,
    ctx: FuncInfo,
    line: number,
  ): number | null {
    const localArr = ctx.arrays.get(name);
    if (localArr) return localArr.baseAddr;
    const globalArr = globalArrays.get(name);
    if (globalArr) return globalArr.baseAddr;
    errors.push({ line, message: `Tableau non défini: "${name}"` });
    return null;
  }

  // ─── Variable access helpers ───

  function loadVar(name: string, ctx: FuncInfo, line: number) {
    if (isArray(name, ctx)) {
      errors.push({
        line,
        message: `"${name}" est un tableau, utilisez ${name}[index]`,
      });
      emit(`  LDA 0`);
      return;
    }

    const addr =
      ctx.localAddrs.get(name) ?? ctx.paramAddrs.get(name) ?? globals.get(name);

    if (addr !== undefined) {
      emit(`  LDM ${fmt(addr)}`);
    } else {
      errors.push({ line, message: `Variable non définie: "${name}"` });
      emit(`  LDA 0`);
    }
  }

  function storeVar(name: string, ctx: FuncInfo) {
    if (isArray(name, ctx)) return;

    const addr =
      ctx.localAddrs.get(name) ?? ctx.paramAddrs.get(name) ?? globals.get(name);

    if (addr !== undefined) {
      emit(`  STA ${fmt(addr)}`);
    }
  }
}
