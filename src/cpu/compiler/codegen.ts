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
 * Memory layout:
 *   0x00..0x7F  = code (program)
 *   0x80..0x8F  = global variables (16 max)
 *   0x90..0x95  = arithmetic scratch (multiply, divide, bitwise)
 *   0x96        = scratch: unused
 *   0x97        = scratch: return value save
 *   0x98..0xBF  = local variables and parameters (per-function, unique)
 *   0xC0..0xFF  = stack (64 bytes, grows downward from 0xFF)
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

interface FuncInfo {
  isMain: boolean;
  paramAddrs: Map<string, number>; // param name → memory address
  localAddrs: Map<string, number>; // local name → memory address
  allVarAddrs: number[]; // all param+local addresses (for save/restore)
}

// Scratch memory constants
const TEMP_BASE = 0x90; // 0x90-0x95 for arithmetic
const TEMP_COUNT = 6; // number of temp slots to save/restore
const TEMP_RETVAL = 0x97; // save return value around POPs
const STACK_BASE = 0xc0; // stack occupies 0xC0-0xFF

export function generate(program: Program): {
  assembly: string;
  errors: CodegenError[];
} {
  const errors: CodegenError[] = [];
  const lines: string[] = [];
  let labelCounter = 0;
  let globalAddr = 0x80;
  let varAddr = 0x98; // for locals and params (after scratch area)

  const globals = new Map<string, number>(); // name → address
  const funcTable = new Map<string, FuncInfo>();

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
    return "0x" + (addr & 0xff).toString(16).padStart(2, "0");
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

  // ─── Collect local variable names declared inside a block ───

  function collectLocals(block: Block): string[] {
    const names: string[] = [];
    function scan(stmts: Stmt[]) {
      for (const s of stmts) {
        if (s.kind === "VarDecl") names.push(s.name);
        if (s.kind === "Block") scan(s.statements);
        if (s.kind === "IfStmt") {
          if (s.thenBranch.kind === "Block") scan(s.thenBranch.statements);
          if (s.elseBranch?.kind === "Block") scan(s.elseBranch.statements);
        }
        if (s.kind === "WhileStmt" && s.body.kind === "Block")
          scan(s.body.statements);
        if (s.kind === "ForStmt") {
          if (s.init?.kind === "VarDecl") names.push(s.init.name);
          if (s.body.kind === "Block") scan(s.body.statements);
        }
      }
    }
    scan(block.statements);
    return names;
  }

  // ═══════════════════════════════════════
  //  Phase 1 — Allocate globals
  // ═══════════════════════════════════════

  for (const g of program.globals) {
    if (globals.has(g.name)) {
      errors.push({
        line: g.line,
        message: `Variable globale "${g.name}" déjà déclarée`,
      });
      continue;
    }
    globals.set(g.name, globalAddr);
    globalAddr++;
    if (globalAddr > 0x8f) {
      errors.push({
        line: g.line,
        message: "Trop de variables globales (max 16)",
      });
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

    const localNames = collectLocals(fn.body);
    const localAddrs = new Map<string, number>();
    for (const name of localNames) {
      if (!paramAddrs.has(name) && !localAddrs.has(name)) {
        localAddrs.set(name, allocVar());
      }
    }

    const allVarAddrs = [...paramAddrs.values(), ...localAddrs.values()];
    funcTable.set(fn.name, {
      isMain: fn.name === "main",
      paramAddrs,
      localAddrs,
      allVarAddrs,
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

  return { assembly: lines.join("\n"), errors };

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

    emitStmt(stmt.body, ctx);
    emit(`  JMP ${loopLabel}`);
    emit(`${endLabel}:`);
  }

  function emitForStmt(stmt: Stmt & { kind: "ForStmt" }, ctx: FuncInfo) {
    if (stmt.init) {
      emitStmt(stmt.init, ctx);
    }

    const loopLabel = newLabel();
    const endLabel = newLabel();

    emit(`${loopLabel}:`);

    if (stmt.condition) {
      emitExpr(stmt.condition, ctx);
      emit(`  CMP 0`);
      emit(`  JZ ${endLabel}`);
    }

    emitStmt(stmt.body, ctx);

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
        emit(`  JN ${trueLabel}`);
        break;
      case ">":
        // not zero AND not negative
        emit(`  JZ ${endLabel}`);
        emit(`  JN ${endLabel}`);
        emit(`  JMP ${trueLabel}`);
        break;
      case "<=":
        emit(`  JZ ${trueLabel}`);
        emit(`  JN ${trueLabel}`);
        break;
      case ">=":
        emit(`  JN ${endLabel}`);
        emit(`  JMP ${trueLabel}`);
        break;
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
    emit(`  STA ${fmt(t1)}`);
    emitExpr(expr.right, ctx);
    emit(`  STA ${fmt(t2)}`);
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
    emit(`  STA ${fmt(t1)}`);
    emitExpr(expr.right, ctx);
    emit(`  STA ${fmt(t2)}`);
    emit(`  LDA 0`);
    emit(`  STA ${fmt(t3)}`);

    emit(`${loopLabel}:`);
    // A = dividend - divisor
    emit(`  LDM ${fmt(t1)}`);
    emit(`  LBM ${fmt(t2)}`);
    emit(`  SUBB`);
    emit(`  JN ${endLabel}`); // if negative → done
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
    emit(`  STA ${fmt(t1)}`);
    emitExpr(expr.right, ctx);
    emit(`  STA ${fmt(t2)}`);
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

  // ─── Variable access helpers ───

  function loadVar(name: string, ctx: FuncInfo, line: number) {
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
    const addr =
      ctx.localAddrs.get(name) ?? ctx.paramAddrs.get(name) ?? globals.get(name);

    if (addr !== undefined) {
      emit(`  STA ${fmt(addr)}`);
    }
  }
}
