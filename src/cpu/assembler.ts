/**
 * Two-pass assembler for the 8-bit CPU ISA.
 *
 * Pass 1: Collect labels and compute byte offsets.
 * Pass 2: Emit bytes and resolve label references.
 *
 * Syntax:
 *   label:          ; label definition (colon after name)
 *   MNEMONIC        ; 1-byte instruction
 *   MNEMONIC 42     ; 3-byte instruction with decimal operand (16-bit LE)
 *   MNEMONIC 0x2A   ; hex operand
 *   MNEMONIC 'A'    ; char literal operand
 *   MNEMONIC label  ; label reference (resolved to 16-bit address)
 *   .db 0x48        ; raw byte data directive (8-bit)
 *   ; comment       ; everything after semicolon is ignored
 */

import { MNEMONIC_TO_OPCODE, INSTRUCTION_INFO, isTwoByteOpcode } from "./isa";

export interface AssemblerError {
  line: number; // 1-based line number
  message: string;
}

export interface AssemblerResult {
  success: boolean;
  bytes: number[];
  errors: AssemblerError[];
  sourceMap: Map<number, number>; // byte address → source line (1-based)
  labels: Map<string, number>; // label name → byte address
}

interface ParsedLine {
  lineNum: number; // 1-based
  label?: string; // label defined on this line
  mnemonic?: string; // instruction mnemonic (uppercase)
  operandStr?: string; // raw operand string
  isDirective?: string; // e.g. ".db"
}

/**
 * Parse a single line of assembly source.
 */
function parseLine(raw: string, lineNum: number): ParsedLine {
  // Remove comments
  const commentIdx = raw.indexOf(";");
  let line = commentIdx >= 0 ? raw.substring(0, commentIdx) : raw;
  line = line.trim();

  if (!line) return { lineNum };

  const result: ParsedLine = { lineNum };

  // Check for label: "name:" at the start
  const labelMatch = line.match(/^([a-zA-Z_]\w*)\s*:/);
  if (labelMatch) {
    result.label = labelMatch[1].toUpperCase();
    line = line.substring(labelMatch[0].length).trim();
    if (!line) return result; // label-only line
  }

  // Check for directive (.db)
  if (line.toLowerCase().startsWith(".db")) {
    result.isDirective = ".db";
    result.operandStr = line.substring(3).trim();
    return result;
  }

  // Parse mnemonic + optional operand
  const parts = line.split(/\s+/);
  if (parts.length >= 1) {
    result.mnemonic = parts[0].toUpperCase();
    if (parts.length >= 2) {
      result.operandStr = parts.slice(1).join(" ").trim();
    }
  }

  return result;
}

/**
 * Parse an operand string to a numeric value.
 * Returns null if it's a label reference (to be resolved in pass 2).
 */
function parseOperandValue(
  operandStr: string,
): { value: number } | { label: string } | null {
  if (!operandStr) return null;

  const s = operandStr.trim();

  // Hex: 0x2A or 0X2A (allow 16-bit)
  if (/^0x[0-9a-fA-F]+$/i.test(s)) {
    return { value: parseInt(s, 16) & 0xffff };
  }

  // Binary: 0b01010101 (allow 16-bit)
  if (/^0b[01]+$/i.test(s)) {
    return { value: parseInt(s.substring(2), 2) & 0xffff };
  }

  // Char literal: 'A' (always 8-bit)
  if (/^'.'$/.test(s)) {
    return { value: s.charCodeAt(1) & 0xff };
  }

  // Decimal number (allow 16-bit)
  if (/^-?\d+$/.test(s)) {
    return { value: parseInt(s, 10) & 0xffff };
  }

  // Label reference
  if (/^[a-zA-Z_]\w*$/.test(s)) {
    return { label: s.toUpperCase() };
  }

  return null;
}

/**
 * Assemble source code into machine bytes.
 */
export function assemble(source: string): AssemblerResult {
  const lines = source.split("\n");
  const errors: AssemblerError[] = [];
  const labels = new Map<string, number>();
  const sourceMap = new Map<number, number>();

  // ─── Pass 1: Collect labels, compute byte offsets ───

  const parsedLines: ParsedLine[] = [];
  let byteOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const parsed = parseLine(lines[i], i + 1);
    parsedLines.push(parsed);

    // Register label at current byte offset
    if (parsed.label) {
      if (labels.has(parsed.label)) {
        errors.push({
          line: parsed.lineNum,
          message: `Label "${parsed.label}" déjà défini`,
        });
      } else {
        labels.set(parsed.label, byteOffset);
      }
    }

    // Count bytes this line will emit
    if (parsed.isDirective === ".db") {
      // .db emits 1 byte per comma-separated value
      if (parsed.operandStr) {
        const parts = parsed.operandStr.split(",").map((s) => s.trim());
        byteOffset += parts.length;
      }
    } else if (parsed.mnemonic) {
      const opcode = MNEMONIC_TO_OPCODE[parsed.mnemonic];
      if (opcode !== undefined) {
        const info = INSTRUCTION_INFO[opcode];
        byteOffset += info.size;
      } else {
        errors.push({
          line: parsed.lineNum,
          message: `Instruction inconnue: "${parsed.mnemonic}"`,
        });
      }
    }
  }

  // If there are errors from pass 1, bail
  if (errors.length > 0) {
    return { success: false, bytes: [], errors, sourceMap, labels };
  }

  // ─── Pass 2: Emit bytes ───

  const bytes: number[] = [];

  for (const parsed of parsedLines) {
    const currentAddr = bytes.length;

    // .db directive
    if (parsed.isDirective === ".db" && parsed.operandStr) {
      const parts = parsed.operandStr.split(",").map((s) => s.trim());
      for (const part of parts) {
        const val = parseOperandValue(part);
        if (val === null) {
          errors.push({
            line: parsed.lineNum,
            message: `Valeur invalide dans .db: "${part}"`,
          });
          bytes.push(0);
        } else if ("label" in val) {
          const addr = labels.get(val.label);
          if (addr === undefined) {
            errors.push({
              line: parsed.lineNum,
              message: `Label non défini: "${val.label}"`,
            });
            bytes.push(0);
          } else {
            bytes.push(addr & 0xff);
          }
        } else {
          bytes.push(val.value & 0xff);
        }
      }
      sourceMap.set(currentAddr, parsed.lineNum);
      continue;
    }

    // Instruction
    if (!parsed.mnemonic) continue;

    const opcode = MNEMONIC_TO_OPCODE[parsed.mnemonic];
    if (opcode === undefined) continue; // already reported in pass 1

    const info = INSTRUCTION_INFO[opcode];
    sourceMap.set(currentAddr, parsed.lineNum);
    bytes.push(opcode);

    // 3-byte instruction: emit 16-bit operand (little-endian)
    if (info.size === 3) {
      if (!parsed.operandStr) {
        errors.push({
          line: parsed.lineNum,
          message: `"${parsed.mnemonic}" nécessite un opérande`,
        });
        bytes.push(0, 0); // 2 placeholder bytes
      } else {
        const val = parseOperandValue(parsed.operandStr);
        if (val === null) {
          errors.push({
            line: parsed.lineNum,
            message: `Opérande invalide: "${parsed.operandStr}"`,
          });
          bytes.push(0, 0);
        } else if ("label" in val) {
          const addr = labels.get(val.label);
          if (addr === undefined) {
            errors.push({
              line: parsed.lineNum,
              message: `Label non défini: "${val.label}"`,
            });
            bytes.push(0, 0);
          } else {
            bytes.push(addr & 0xff); // low byte
            bytes.push((addr >> 8) & 0xff); // high byte
          }
        } else {
          bytes.push(val.value & 0xff); // low byte
          bytes.push((val.value >> 8) & 0xff); // high byte
        }
      }
    } else {
      // 1-byte instruction: warn if operand provided
      if (parsed.operandStr && isTwoByteOpcode(opcode)) {
        errors.push({
          line: parsed.lineNum,
          message: `"${parsed.mnemonic}" ne prend pas d'opérande`,
        });
      }
    }
  }

  return {
    success: errors.length === 0,
    bytes,
    errors,
    sourceMap,
    labels,
  };
}
