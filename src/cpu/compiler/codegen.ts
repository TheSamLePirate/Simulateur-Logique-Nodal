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
 *   0x1018..0x101F = bootloader argument block
 *   0x1020..0x17FF = reusable function frames (locals/params, packed by call graph)
 *   0x1800..0x1FFF = stack (2048 bytes, grows downward from 0x1FFF)
 *
 * Calling convention:
 *   - Caller writes args directly to callee's frame slots
 *   - Non-recursive callers use disjoint frames and skip saves
 *   - Recursive callers save their current frame before CALL
 *   - CALL pushes return address
 *   - Return value in A
 *   - After RET, recursive callers restore their saved frame
 */

import type {
  Program,
  FunctionDecl,
  ParamDecl,
  Stmt,
  Expr,
  Block,
} from "./parser";
import {
  BOOT_ARG_COUNT_ADDR,
  BOOT_ARG0_DIR_OFFSET_ADDR,
  BOOT_ARG0_DIR_PAGE_ADDR,
  BOOT_ARG0_INDEX_ADDR,
  BOOT_ARG0_PAGE_COUNT_ADDR,
  BOOT_ARG0_SIZE_ADDR,
  BOOT_ARG0_START_PAGE_ADDR,
  BOOT_ARG0_TYPE_ADDR,
} from "../bootArgs";

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
  name: string;
  isMain: boolean;
  recursive: boolean;
  params: FuncParamInfo[];
  paramAddrs: Map<string, number>; // param name → memory address
  localAddrs: Map<string, number>; // local name → memory address
  frameAddrs: number[]; // reusable frame slots actually reserved for this function
  arrays: Map<string, ArrayInfo>; // array name → base address + size
}

interface FuncParamInfo {
  name: string;
  arraySize: number | null;
  addr?: number;
  baseAddr?: number;
}

// Scratch memory constants
const TEMP_BASE = 0x1010; // 0x1010-0x1015 for arithmetic
const TEMP_RETVAL = 0x1017; // save return value around POPs
const LOCAL_BASE = 0x1020;
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
  let maxLocalEnd = LOCAL_BASE;

  const globals = new Map<string, number>(); // name → address
  const globalArrays = new Map<string, ArrayInfo>(); // array name → info
  const funcTable = new Map<string, FuncInfo>();
  const runtimeHelpersUsed = new Set<string>();
  const constantData: { label: string; bytes: number[] }[] = [];
  const cStringPool = new Map<string, string>();
  const httpPostPool = new Map<string, string>();
  let dataLabelCounter = 0;
  const builtins = new Set([
    "putchar",
    "print_num",
    "print",
    "console_clear",
    "color",
    "draw",
    "clear",
    "getchar",
    "getchar_nb",
    "getKey",
    "rand",
    "sleep",
    "drive_read",
    "drive_write",
    "drive_clear",
    "drive_set_page",
    "drive_read_at",
    "drive_write_at",
    "boot_argc",
    "boot_arg_page",
    "boot_arg_offset",
    "boot_arg_type",
    "boot_arg_start_page",
    "boot_arg_page_count",
    "boot_arg_size",
    "boot_arg_index",
    "boot_file_read",
    "get",
    "post",
    "gethttpchar",
  ]);

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

  function emitCopyBytes(srcBase: number, destBase: number, size: number) {
    if (size <= 0) return;

    if (srcBase < destBase && srcBase + size > destBase) {
      for (let i = size - 1; i >= 0; i--) {
        emit(`  LDM ${fmt(srcBase + i)}`);
        emit(`  STA ${fmt(destBase + i)}`);
      }
      return;
    }

    for (let i = 0; i < size; i++) {
      emit(`  LDM ${fmt(srcBase + i)}`);
      emit(`  STA ${fmt(destBase + i)}`);
    }
  }

  function bytesForString(value: string): number[] {
    return [...value].map((ch) => ch.charCodeAt(0) & 0xff);
  }

  function reserveCString(value: string): string {
    const existing = cStringPool.get(value);
    if (existing) return existing;

    const label = `__str_${dataLabelCounter++}`;
    cStringPool.set(value, label);
    constantData.push({
      label,
      bytes: [...bytesForString(value), 0],
    });
    return label;
  }

  function reserveHttpPostData(url: string, body: string): string {
    const key = `${url}\0${body}`;
    const existing = httpPostPool.get(key);
    if (existing) return existing;

    const label = `__http_post_${dataLabelCounter++}`;
    httpPostPool.set(key, label);
    constantData.push({
      label,
      bytes: [...bytesForString(url), 0, ...bytesForString(body), 0],
    });
    return label;
  }

  interface PlannedArrayInfo {
    baseSlot: number;
    size: number;
  }

  interface PlannedFunc {
    name: string;
    isMain: boolean;
    recursive: boolean;
    params: ParamDecl[];
    paramSlots: Map<string, number>;
    localSlots: Map<string, number>;
    arrays: Map<string, PlannedArrayInfo>;
    frameSize: number;
    frameBase: number;
    directCallees: Set<string>;
  }

  function scanExprForCallees(expr: Expr, out: Set<string>) {
    switch (expr.kind) {
      case "BinaryExpr":
        scanExprForCallees(expr.left, out);
        scanExprForCallees(expr.right, out);
        break;
      case "UnaryExpr":
      case "PostfixExpr":
        scanExprForCallees(expr.operand, out);
        break;
      case "AssignExpr":
      case "CompoundAssignExpr":
        scanExprForCallees(expr.value, out);
        break;
      case "IndexExpr":
        scanExprForCallees(expr.index, out);
        break;
      case "IndexAssignExpr":
        scanExprForCallees(expr.index, out);
        scanExprForCallees(expr.value, out);
        break;
      case "CallExpr":
        if (!builtins.has(expr.name)) out.add(expr.name);
        for (const arg of expr.args) scanExprForCallees(arg, out);
        break;
      default:
        break;
    }
  }

  function scanStmtForCallees(stmt: Stmt, out: Set<string>) {
    switch (stmt.kind) {
      case "VarDecl":
        if (stmt.initializer) scanExprForCallees(stmt.initializer, out);
        break;
      case "VarDeclList":
        for (const decl of stmt.declarations) {
          if (decl.initializer) scanExprForCallees(decl.initializer, out);
        }
        break;
      case "ExprStmt":
        scanExprForCallees(stmt.expression, out);
        break;
      case "ReturnStmt":
        if (stmt.value) scanExprForCallees(stmt.value, out);
        break;
      case "IfStmt":
        scanExprForCallees(stmt.condition, out);
        scanStmtForCallees(stmt.thenBranch, out);
        if (stmt.elseBranch) scanStmtForCallees(stmt.elseBranch, out);
        break;
      case "WhileStmt":
        scanExprForCallees(stmt.condition, out);
        scanStmtForCallees(stmt.body, out);
        break;
      case "ForStmt":
        if (stmt.init) scanStmtForCallees(stmt.init, out);
        if (stmt.condition) scanExprForCallees(stmt.condition, out);
        if (stmt.update) scanExprForCallees(stmt.update, out);
        scanStmtForCallees(stmt.body, out);
        break;
      case "Block":
        for (const inner of stmt.statements) scanStmtForCallees(inner, out);
        break;
      default:
        break;
    }
  }

  function planFunction(fn: FunctionDecl): PlannedFunc {
    const paramSlots = new Map<string, number>();
    const localSlots = new Map<string, number>();
    const arrays = new Map<string, PlannedArrayInfo>();
    const directCallees = new Set<string>();
    const occupied: boolean[] = [];
    let maxSlots = 0;

    function allocSlots(size: number): number {
      let base = 0;
      while (true) {
        let ok = true;
        for (let i = 0; i < size; i++) {
          if (occupied[base + i]) {
            ok = false;
            base += i + 1;
            break;
          }
        }
        if (ok) break;
      }
      for (let i = 0; i < size; i++) occupied[base + i] = true;
      maxSlots = Math.max(maxSlots, base + size);
      return base;
    }

    function freeSlots(base: number, size: number) {
      for (let i = 0; i < size; i++) occupied[base + i] = false;
    }

    function allocDecl(name: string, arraySize: number | null, releases: { base: number; size: number }[]) {
      if (paramSlots.has(name) || localSlots.has(name) || arrays.has(name)) {
        return;
      }
      const size = arraySize ?? 1;
      const base = allocSlots(size);
      if (arraySize !== null) arrays.set(name, { baseSlot: base, size: arraySize });
      else localSlots.set(name, base);
      releases.push({ base, size });
    }

    function planScopedStmt(stmt: Stmt) {
      if (stmt.kind === "Block") {
        planBlock(stmt);
        return;
      }
      if (stmt.kind === "IfStmt") {
        planScopedStmt(stmt.thenBranch);
        if (stmt.elseBranch) planScopedStmt(stmt.elseBranch);
        return;
      }
      if (stmt.kind === "WhileStmt") {
        planScopedStmt(stmt.body);
        return;
      }
      if (stmt.kind === "ForStmt") {
        const releases: { base: number; size: number }[] = [];
        if (stmt.init?.kind === "VarDecl") {
          allocDecl(stmt.init.name, stmt.init.arraySize, releases);
        } else if (stmt.init?.kind === "VarDeclList") {
          for (const decl of stmt.init.declarations) {
            allocDecl(decl.name, decl.arraySize, releases);
          }
        }
        planScopedStmt(stmt.body);
        for (let i = releases.length - 1; i >= 0; i--) {
          freeSlots(releases[i].base, releases[i].size);
        }
      }
    }

    function planBlock(block: Block) {
      const releases: { base: number; size: number }[] = [];
      for (const stmt of block.statements) {
        if (stmt.kind === "VarDecl") {
          allocDecl(stmt.name, stmt.arraySize, releases);
          continue;
        }
        if (stmt.kind === "VarDeclList") {
          for (const decl of stmt.declarations) {
            allocDecl(decl.name, decl.arraySize, releases);
          }
          continue;
        }
        planScopedStmt(stmt);
      }
      for (let i = releases.length - 1; i >= 0; i--) {
        freeSlots(releases[i].base, releases[i].size);
      }
    }

    for (const p of fn.params) {
      if (paramSlots.has(p.name)) continue;
      if (p.arraySize !== null) {
        arrays.set(p.name, {
          baseSlot: allocSlots(p.arraySize),
          size: p.arraySize,
        });
      } else {
        paramSlots.set(p.name, allocSlots(1));
      }
    }

    scanStmtForCallees(fn.body, directCallees);
    planBlock(fn.body);

    return {
      name: fn.name,
      isMain: fn.name === "main",
      recursive: false,
      params: fn.params,
      paramSlots,
      localSlots,
      arrays,
      frameSize: maxSlots,
      frameBase: -1,
      directCallees,
    };
  }

  function reaches(start: string, target: string, graph: Map<string, Set<string>>, seen = new Set<string>()): boolean {
    const next = graph.get(start);
    if (!next) return false;
    for (const callee of next) {
      if (callee === target) return true;
      if (seen.has(callee)) continue;
      seen.add(callee);
      if (reaches(callee, target, graph, seen)) return true;
    }
    return false;
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

  const plannedFuncs = program.functions.map(planFunction);
  const callGraph = new Map(plannedFuncs.map((fn) => [fn.name, fn.directCallees]));

  for (const fn of plannedFuncs) {
    fn.recursive = reaches(fn.name, fn.name, callGraph);
  }

  const sortedByFrame = [...plannedFuncs].sort((a, b) => b.frameSize - a.frameSize);
  for (const fn of sortedByFrame) {
    let base = LOCAL_BASE;
    while (true) {
      let conflict = false;
      for (const other of plannedFuncs) {
        if (other === fn || other.frameSize === 0 || other.frameBase < LOCAL_BASE) continue;
        if (
          !(
            reaches(fn.name, other.name, callGraph) ||
            reaches(other.name, fn.name, callGraph)
          )
        ) {
          continue;
        }
        const otherStart = other.frameBase;
        const otherEnd = other.frameBase + other.frameSize;
        const thisEnd = base + fn.frameSize;
        if (base < otherEnd && otherStart < thisEnd) {
          base = otherEnd;
          conflict = true;
          break;
        }
      }
      if (!conflict) break;
    }
    fn.frameBase = base;
    maxLocalEnd = Math.max(maxLocalEnd, base + fn.frameSize);
  }

  if (maxLocalEnd > STACK_BASE) {
    errors.push({
      line: 0,
      message: "Trop de variables locales (mémoire pleine)",
    });
  }

  for (const plan of plannedFuncs) {
    const params: FuncParamInfo[] = [];
    const paramAddrs = new Map<string, number>();
    for (const [name, slot] of plan.paramSlots) {
      paramAddrs.set(name, plan.frameBase + slot);
    }

    const localAddrs = new Map<string, number>();
    for (const [name, slot] of plan.localSlots) {
      localAddrs.set(name, plan.frameBase + slot);
    }

    const arrays = new Map<string, ArrayInfo>();
    for (const [name, info] of plan.arrays) {
      arrays.set(name, {
        baseAddr: plan.frameBase + info.baseSlot,
        size: info.size,
      });
    }

    for (const param of plan.params) {
      if (param.arraySize !== null) {
        params.push({
          name: param.name,
          arraySize: param.arraySize,
          baseAddr: arrays.get(param.name)?.baseAddr,
        });
      } else {
        params.push({
          name: param.name,
          arraySize: null,
          addr: paramAddrs.get(param.name),
        });
      }
    }

    funcTable.set(plan.name, {
      name: plan.name,
      isMain: plan.isMain,
      recursive: plan.recursive,
      params,
      paramAddrs,
      localAddrs,
      frameAddrs: Array.from({ length: plan.frameSize }, (_, i) => plan.frameBase + i),
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

  emitRuntimeHelpers();
  emitConstantData();

  if (!program.functions.find((f) => f.name === "main")) {
    errors.push({ line: 1, message: "Fonction 'main' requise" });
  }

  return {
    assembly: optimizeAssembly(lines).join("\n"),
    errors,
    memoryLayout: {
      globals: globalAddr - 0x1000,
      scratch: 8, // 0x1010-0x1017 always reserved
      locals: maxLocalEnd - LOCAL_BASE,
      stackSize: 2048, // 0x1800-0x1FFF always reserved
    },
  };

  // ═══════════════════════════════════════
  //  Function code generation
  // ═══════════════════════════════════════

  function optimizeAssembly(rawLines: string[]): string[] {
    const optimized: string[] = [];

    function nextSignificantLine(start: number): string | null {
      for (let i = start; i < rawLines.length; i++) {
        const trimmed = rawLines[i].trim();
        if (!trimmed || trimmed.startsWith(";")) continue;
        return trimmed;
      }
      return null;
    }

    for (let i = 0; i < rawLines.length; i++) {
      const trimmed = rawLines[i].trim();
      const jmp = trimmed.match(/^JMP\s+([A-Za-z_]\w*)$/);
      if (jmp) {
        const next = nextSignificantLine(i + 1);
        if (next === `${jmp[1]}:`) {
          continue;
        }
      }
      optimized.push(rawLines[i]);
    }

    return optimized;
  }

  function tryEvalConst(expr: Expr): number | null {
    switch (expr.kind) {
      case "NumberLiteral":
      case "CharLiteral":
        return expr.value & 0xff;
      case "UnaryExpr": {
        const v = tryEvalConst(expr.operand);
        if (v === null) return null;
        switch (expr.op) {
          case "-":
            return (-v) & 0xff;
          case "!":
            return v === 0 ? 1 : 0;
          case "~":
            return (~v) & 0xff;
          default:
            return null;
        }
      }
      case "BinaryExpr": {
        const left = tryEvalConst(expr.left);
        const right = tryEvalConst(expr.right);
        if (left === null || right === null) return null;
        switch (expr.op) {
          case "+":
            return (left + right) & 0xff;
          case "-":
            return (left - right) & 0xff;
          case "*":
            return (left * right) & 0xff;
          case "/":
            return right === 0 ? null : Math.floor(left / right) & 0xff;
          case "%":
            return right === 0 ? null : left % right;
          case "&":
            return left & right;
          case "|":
            return left | right;
          case "^":
            return left ^ right;
          case "<<":
            return (left << right) & 0xff;
          case ">>":
            return (left >> right) & 0xff;
          case "==":
            return left === right ? 1 : 0;
          case "!=":
            return left !== right ? 1 : 0;
          case "<":
            return left < right ? 1 : 0;
          case ">":
            return left > right ? 1 : 0;
          case "<=":
            return left <= right ? 1 : 0;
          case ">=":
            return left >= right ? 1 : 0;
          case "&&":
            return left !== 0 && right !== 0 ? 1 : 0;
          case "||":
            return left !== 0 || right !== 0 ? 1 : 0;
          default:
            return null;
        }
      }
      default:
        return null;
    }
  }

  function emitRuntimeHelpers() {
    if (runtimeHelpersUsed.has("shl")) {
      emit("");
      emitComment("--- runtime helper __rt_shl ---");
      emit("__rt_shl:");
      emit(`  STA ${fmt(TEMP_BASE)}`);
      emit(`  TBA`);
      emit(`  STA ${fmt(TEMP_BASE + 1)}`);
      emit(`__rt_shl_loop:`);
      emit(`  LDM ${fmt(TEMP_BASE + 1)}`);
      emit(`  CMP 0`);
      emit(`  JZ __rt_shl_end`);
      emit(`  LDM ${fmt(TEMP_BASE)}`);
      emit(`  SHL`);
      emit(`  STA ${fmt(TEMP_BASE)}`);
      emit(`  LDM ${fmt(TEMP_BASE + 1)}`);
      emit(`  DEC`);
      emit(`  STA ${fmt(TEMP_BASE + 1)}`);
      emit(`  JMP __rt_shl_loop`);
      emit(`__rt_shl_end:`);
      emit(`  LDM ${fmt(TEMP_BASE)}`);
      emit(`  RET`);
    }

    if (runtimeHelpersUsed.has("shr")) {
      emit("");
      emitComment("--- runtime helper __rt_shr ---");
      emit("__rt_shr:");
      emit(`  STA ${fmt(TEMP_BASE)}`);
      emit(`  TBA`);
      emit(`  STA ${fmt(TEMP_BASE + 1)}`);
      emit(`__rt_shr_loop:`);
      emit(`  LDM ${fmt(TEMP_BASE + 1)}`);
      emit(`  CMP 0`);
      emit(`  JZ __rt_shr_end`);
      emit(`  LDM ${fmt(TEMP_BASE)}`);
      emit(`  SHR`);
      emit(`  STA ${fmt(TEMP_BASE)}`);
      emit(`  LDM ${fmt(TEMP_BASE + 1)}`);
      emit(`  DEC`);
      emit(`  STA ${fmt(TEMP_BASE + 1)}`);
      emit(`  JMP __rt_shr_loop`);
      emit(`__rt_shr_end:`);
      emit(`  LDM ${fmt(TEMP_BASE)}`);
      emit(`  RET`);
    }
  }

  function emitConstantData() {
    if (constantData.length === 0) return;

    emit("");
    emitComment("--- constant data ---");
    for (const block of constantData) {
      emit(`${block.label}:`);
      for (let i = 0; i < block.bytes.length; i += 16) {
        emit(`  .db ${block.bytes.slice(i, i + 16).join(", ")}`);
      }
    }
  }

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

  function emitVarDecl(stmt: { initializer: Expr | null; name: string }, ctx: FuncInfo) {
    if (stmt.initializer) {
      emitExpr(stmt.initializer, ctx);
      storeVar(stmt.name, ctx);
    }
  }

  function emitStmt(stmt: Stmt, ctx: FuncInfo) {
    switch (stmt.kind) {
      case "VarDecl":
        emitVarDecl(stmt, ctx);
        break;
      case "VarDeclList":
        for (const decl of stmt.declarations) {
          emitVarDecl(decl, ctx);
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
    const constCond = tryEvalConst(stmt.condition);
    if (constCond !== null) {
      if (constCond !== 0) emitStmt(stmt.thenBranch, ctx);
      else if (stmt.elseBranch) emitStmt(stmt.elseBranch, ctx);
      return;
    }

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
    const constCond = tryEvalConst(stmt.condition);
    if (constCond === 0) {
      return;
    }

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

    const constCond = stmt.condition ? tryEvalConst(stmt.condition) : null;
    if (constCond === 0) {
      return;
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
        {
          const folded = tryEvalConst(expr);
          if (folded !== null) emit(`  LDA ${folded}`);
          else emitBinaryExpr(expr, ctx);
        }
        break;

      case "UnaryExpr":
        {
          const folded = tryEvalConst(expr);
          if (folded !== null) emit(`  LDA ${folded}`);
          else emitUnaryExpr(expr, ctx);
        }
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
    const leftConst = tryEvalConst(expr.left);
    const rightConst = tryEvalConst(expr.right);

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

    if (op === "+" && rightConst !== null) {
      emitExpr(expr.left, ctx);
      if (rightConst !== 0) emit(`  ADD ${rightConst}`);
      return;
    }
    if (op === "+" && leftConst !== null) {
      emitExpr(expr.right, ctx);
      if (leftConst !== 0) emit(`  ADD ${leftConst}`);
      return;
    }
    if (op === "-" && rightConst !== null) {
      emitExpr(expr.left, ctx);
      if (rightConst !== 0) emit(`  SUB ${rightConst}`);
      return;
    }
    if ((op === "&" || op === "|" || op === "^") && rightConst !== null) {
      emitExpr(expr.left, ctx);
      if (op === "&") emit(`  AND ${rightConst}`);
      else if (op === "|") emit(`  OR ${rightConst}`);
      else emit(`  XOR ${rightConst}`);
      return;
    }
    if ((op === "&" || op === "|" || op === "^") && leftConst !== null) {
      emitExpr(expr.right, ctx);
      if (op === "&") emit(`  AND ${leftConst}`);
      else if (op === "|") emit(`  OR ${leftConst}`);
      else emit(`  XOR ${leftConst}`);
      return;
    }

    if (op === "*") {
      if (rightConst === 0 || leftConst === 0) {
        emit(`  LDA 0`);
        return;
      }
      if (rightConst === 1) {
        emitExpr(expr.left, ctx);
        return;
      }
      if (leftConst === 1) {
        emitExpr(expr.right, ctx);
        return;
      }
      if (rightConst !== null) {
        emitExpr(expr.left, ctx);
        emit(`  LDB ${rightConst}`);
        emit(`  MULB`);
        return;
      }
      if (leftConst !== null) {
        emitExpr(expr.right, ctx);
        emit(`  LDB ${leftConst}`);
        emit(`  MULB`);
        return;
      }
    }

    if (op === "/" || op === "%") {
      if (op === "/" && rightConst === 1) {
        emitExpr(expr.left, ctx);
        return;
      }
      if (op === "%" && rightConst === 1) {
        emit(`  LDA 0`);
        return;
      }
      if (rightConst !== null) {
        emitExpr(expr.left, ctx);
        emit(`  LDB ${rightConst}`);
        emit(op === "/" ? `  DIVB` : `  MODB`);
        return;
      }
    }

    if (op === "<<" || op === ">>") {
      if (rightConst === 0) {
        emitExpr(expr.left, ctx);
        return;
      }
      if (rightConst !== null && rightConst <= 4) {
        emitExpr(expr.left, ctx);
        for (let i = 0; i < rightConst; i++) {
          emit(op === "<<" ? `  SHL` : `  SHR`);
        }
        return;
      }
      emitExpr(expr.left, ctx);
      if (rightConst !== null) {
        emit(`  LDB ${rightConst}`);
      } else {
        emit(`  PUSH`);
        emitExpr(expr.right, ctx);
        emit(`  TAB`);
        emit(`  POP`);
      }
      emitShiftLoop(op === "<<" ? "SHL" : "SHR");
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
      case "&":
        emit(`  ANDB`);
        break;
      case "|":
        emit(`  ORB`);
        break;
      case "^":
        emit(`  XORB`);
        break;
      case "*":
        emit(`  MULB`);
        break;
      case "/":
        emit(`  DIVB`);
        break;
      case "%":
        emit(`  MODB`);
        break;
    }
  }

  // ─── Comparison: result in A (0 or 1) ───

  function emitComparison(expr: Expr & { kind: "BinaryExpr" }, ctx: FuncInfo) {
    const trueLabel = newLabel();
    const endLabel = newLabel();
    const rightConst = tryEvalConst(expr.right);

    if (rightConst !== null) {
      emitExpr(expr.left, ctx);
      emit(`  CMP ${rightConst}`);
    } else {
      emitExpr(expr.left, ctx);
      emit(`  PUSH`);
      emitExpr(expr.right, ctx);
      emit(`  TAB`); // B = right
      emit(`  POP`); // A = left
      emit(`  CMPB`);
    }

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

  function _emitMultiply(expr: Expr & { kind: "BinaryExpr" }, ctx: FuncInfo) {
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

  function _emitDivMod(
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

  function _emitBitwiseOp(
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
    runtimeHelpersUsed.add(shiftOp === "SHL" ? "shl" : "shr");
    emit(`  CALL ${shiftOp === "SHL" ? "__rt_shl" : "__rt_shr"}`);
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
    if (expr.name === "color") {
      if (expr.args.length >= 1) {
        emitExpr(expr.args[0], ctx);
        emit(`  COLR`);
      }
      if (expr.args.length >= 2) {
        emitExpr(expr.args[1], ctx);
        emit(`  COLG`);
      }
      if (expr.args.length >= 3) {
        emitExpr(expr.args[2], ctx);
        emit(`  COLB`);
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

    // ── Built-in: console_clear() ──
    if (expr.name === "console_clear") {
      emit(`  CLCON`);
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

    // ── Built-in: getchar_nb() — read one char from console input (non-blocking) ──
    if (expr.name === "getchar_nb") {
      emit(`  INA`);
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

    // ── Built-in: drive_read(addr) — A ← external_drive[addr] ──
    if (expr.name === "drive_read") {
      if (expr.args.length >= 1) {
        emitExpr(expr.args[0], ctx); // addr → A
        emit(`  DRVRD`);
      }
      return;
    }

    // ── Built-in: drive_write(addr, value) — external_drive[addr] ← value ──
    if (expr.name === "drive_write") {
      if (expr.args.length >= 2) {
        emitExpr(expr.args[0], ctx); // addr → A
        emit(`  PUSH`);
        emitExpr(expr.args[1], ctx); // value → A
        emit(`  TAB`); // value → B
        emit(`  POP`); // addr → A
        emit(`  DRVWR`);
        emit(`  TBA`); // expression result = written value
      }
      return;
    }

    // ── Built-in: drive_clear() — clear external drive ──
    if (expr.name === "drive_clear") {
      emit(`  DRVCLR`);
      return;
    }

    // ── Built-in: drive_set_page(page) — select one of 256 external drive pages ──
    if (expr.name === "drive_set_page") {
      if (expr.args.length >= 1) {
        emitExpr(expr.args[0], ctx); // page → A
        emit(`  DRVPG`);
      }
      return;
    }

    // ── Built-in: drive_read_at(page, offset) — A ← external_drive[(page<<8)|offset] ──
    if (expr.name === "drive_read_at") {
      if (expr.args.length >= 2) {
        emitExpr(expr.args[0], ctx); // page → A
        emit(`  DRVPG`);
        emitExpr(expr.args[1], ctx); // offset → A
        emit(`  DRVRD`);
      }
      return;
    }

    // ── Built-in: drive_write_at(page, offset, value) — write one byte to any drive page ──
    if (expr.name === "drive_write_at") {
      if (expr.args.length >= 3) {
        emitExpr(expr.args[0], ctx); // page → A
        emit(`  DRVPG`);
        emitExpr(expr.args[1], ctx); // offset → A
        emit(`  PUSH`);
        emitExpr(expr.args[2], ctx); // value → A
        emit(`  TAB`); // value → B
        emit(`  POP`); // offset → A
        emit(`  DRVWR`);
        emit(`  TBA`); // expression result = written value
      }
      return;
    }

    // ── Built-ins: bootloader argument block ──
    if (expr.name === "boot_argc") {
      emit(`  LDM ${fmt(BOOT_ARG_COUNT_ADDR)}`);
      return;
    }

    if (expr.name === "boot_arg_page") {
      emit(`  LDM ${fmt(BOOT_ARG0_DIR_PAGE_ADDR)}`);
      return;
    }

    if (expr.name === "boot_arg_offset") {
      emit(`  LDM ${fmt(BOOT_ARG0_DIR_OFFSET_ADDR)}`);
      return;
    }

    if (expr.name === "boot_arg_type") {
      emit(`  LDM ${fmt(BOOT_ARG0_TYPE_ADDR)}`);
      return;
    }

    if (expr.name === "boot_arg_start_page") {
      emit(`  LDM ${fmt(BOOT_ARG0_START_PAGE_ADDR)}`);
      return;
    }

    if (expr.name === "boot_arg_page_count") {
      emit(`  LDM ${fmt(BOOT_ARG0_PAGE_COUNT_ADDR)}`);
      return;
    }

    if (expr.name === "boot_arg_size") {
      emit(`  LDM ${fmt(BOOT_ARG0_SIZE_ADDR)}`);
      return;
    }

    if (expr.name === "boot_arg_index") {
      emit(`  LDM ${fmt(BOOT_ARG0_INDEX_ADDR)}`);
      return;
    }

    if (expr.name === "boot_file_read") {
      if (expr.args.length >= 1) {
        emit(`  LDM ${fmt(BOOT_ARG0_START_PAGE_ADDR)}`);
        emit(`  DRVPG`);
        emitExpr(expr.args[0], ctx);
        emit(`  DRVRD`);
      }
      return;
    }

    // ── Built-in: get("url") — start an HTTP GET request ──
    if (expr.name === "get") {
      if (expr.args.length >= 1) {
        if (expr.args[0].kind === "StringLiteral") {
          emit(`  HTTPGET ${reserveCString(expr.args[0].value)}`);
        } else {
          errors.push({
            line: expr.line,
            message: 'get() attend une URL sous forme de chaine litterale',
          });
        }
      }
      return;
    }

    // ── Built-in: post("url", "body") — start an HTTP POST request ──
    if (expr.name === "post") {
      if (expr.args.length >= 2) {
        if (
          expr.args[0].kind === "StringLiteral" &&
          expr.args[1].kind === "StringLiteral"
        ) {
          emit(
            `  HTTPPOST ${reserveHttpPostData(
              expr.args[0].value,
              expr.args[1].value,
            )}`,
          );
        } else {
          errors.push({
            line: expr.line,
            message:
              'post() attend une URL et un corps sous forme de chaines litterales',
          });
        }
      }
      return;
    }

    // ── Built-in: gethttpchar() — wait for next HTTP byte, return 0 at EOF ──
    if (expr.name === "gethttpchar") {
      const waitLabel = newLabel();
      emit(`${waitLabel}:`);
      emit(`  HTTPIN`);
      emit(`  JC ${waitLabel}`);
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

    const saveCallerFrame = ctx.recursive && ctx.frameAddrs.length > 0;
    const scalarParamTargets: number[] = [];
    const arrayCopyBacks: { srcBase: number; destBase: number; size: number }[] =
      [];
    const skippedRestoreAddrs = new Set<number>();

    // 1. Save current function's frame only for recursive callers
    if (saveCallerFrame) {
      emitComment(`save ${ctx.frameAddrs.length} frame slot(s) before recursive call`);
      for (const addr of ctx.frameAddrs) {
        emit(`  LDM ${fmt(addr)}`);
        emit(`  PUSH`);
      }
    }

    // 2. Evaluate args left-to-right.
    for (let i = 0; i < expr.args.length; i++) {
      const arg = expr.args[i];
      const param = calleeInfo.params[i];

      if (!param) {
        emitExpr(arg, ctx);
        continue;
      }

      if (param.arraySize !== null) {
        if (arg.kind !== "Identifier") {
          errors.push({
            line: arg.line,
            message:
              "Un argument de tableau doit être le nom d'un tableau déclaré",
          });
          continue;
        }
        if (!isArray(arg.name, ctx)) {
          errors.push({
            line: arg.line,
            message:
              "Un argument de tableau doit être le nom d'un tableau déclaré",
          });
          continue;
        }

        const sourceInfo = resolveArrayInfo(arg.name, ctx, arg.line);
        if (!sourceInfo || param.baseAddr === undefined) {
          continue;
        }
        if (sourceInfo.size < param.arraySize) {
          errors.push({
            line: arg.line,
            message: `Le tableau "${arg.name}" est trop petit pour le paramètre "${param.name}"`,
          });
          continue;
        }

        emitCopyBytes(sourceInfo.baseAddr, param.baseAddr, param.arraySize);
        arrayCopyBacks.push({
          srcBase: param.baseAddr,
          destBase: sourceInfo.baseAddr,
          size: param.arraySize,
        });

        if (saveCallerFrame && ctx.arrays.has(arg.name)) {
          for (let offset = 0; offset < param.arraySize; offset++) {
            skippedRestoreAddrs.add(sourceInfo.baseAddr + offset);
          }
        }
        continue;
      }

      emitExpr(arg, ctx);
      emit(`  PUSH`);
      if (param.addr !== undefined) {
        scalarParamTargets.push(param.addr);
      }
    }

    // 3. Pop scalar args into callee scalar param addresses
    for (let i = scalarParamTargets.length - 1; i >= 0; i--) {
      emit(`  POP`);
      emit(`  STA ${fmt(scalarParamTargets[i])}`);
    }

    // 4. CALL
    emit(`  CALL __${expr.name}`);

    if (arrayCopyBacks.length > 0 || saveCallerFrame) {
      emit(`  STA ${fmt(TEMP_RETVAL)}`); // preserve return value across copies/restores
    }

    for (const copy of arrayCopyBacks) {
      emitCopyBytes(copy.srcBase, copy.destBase, copy.size);
    }

    // 5. Restore current function's frame
    if (saveCallerFrame) {
      for (let i = ctx.frameAddrs.length - 1; i >= 0; i--) {
        emit(`  POP`);
        if (!skippedRestoreAddrs.has(ctx.frameAddrs[i])) {
          emit(`  STA ${fmt(ctx.frameAddrs[i])}`);
        }
      }
    }

    if (arrayCopyBacks.length > 0 || saveCallerFrame) {
      emit(`  LDM ${fmt(TEMP_RETVAL)}`); // restore return value to A
    }
  }

  // ─── Array access helpers ───

  function resolveArrayInfo(
    name: string,
    ctx: FuncInfo,
    line: number,
  ): ArrayInfo | null {
    const localArr = ctx.arrays.get(name);
    if (localArr) return localArr;
    const globalArr = globalArrays.get(name);
    if (globalArr) return globalArr;
    errors.push({ line, message: `Tableau non défini: "${name}"` });
    return null;
  }

  function isArray(name: string, ctx: FuncInfo): boolean {
    return ctx.arrays.has(name) || globalArrays.has(name);
  }

  function resolveArray(
    name: string,
    ctx: FuncInfo,
    line: number,
  ): number | null {
    return resolveArrayInfo(name, ctx, line)?.baseAddr ?? null;
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
