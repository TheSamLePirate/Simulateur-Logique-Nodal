/**
 * C Compiler entry point.
 *
 * Pipeline: C source → preprocess → tokenize → parse → codegen → ASM string
 *
 * The resulting ASM string can be passed to assemble() from the assembler.
 */

import { tokenize, type LexerError } from "./lexer";
import { parse, type ParseError } from "./parser";
import { generate, type CodegenError, type MemoryLayout } from "./codegen";

export interface CompileError {
  phase: "preprocess" | "lexer" | "parser" | "codegen";
  line: number;
  message: string;
}

export type { MemoryLayout } from "./codegen";

export interface CompileResult {
  success: boolean;
  assembly: string; // generated ASM text (even if errors, for debugging)
  errors: CompileError[];
  memoryLayout?: MemoryLayout;
}

/**
 * Preprocess: handle `#define NAME value` directives.
 * Simple text substitution (no macro functions).
 */
function preprocess(source: string): {
  processed: string;
  errors: CompileError[];
} {
  const errors: CompileError[] = [];
  const defines = new Map<string, string>();
  const outputLines: string[] = [];

  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("#define")) {
      const match = trimmed.match(/^#define\s+([A-Za-z_]\w*)\s+(.+)$/);
      if (match) {
        defines.set(match[1], match[2].trim());
        outputLines.push(""); // keep line numbering consistent
      } else {
        errors.push({
          phase: "preprocess",
          line: i + 1,
          message: "Directive #define invalide",
        });
        outputLines.push("");
      }
    } else if (trimmed.startsWith("#")) {
      // Skip other preprocessor directives
      outputLines.push("");
    } else {
      // Substitute defines in this line
      let processed = line;
      for (const [name, value] of defines) {
        // Replace whole-word occurrences only
        const regex = new RegExp(`\\b${name}\\b`, "g");
        processed = processed.replace(regex, value);
      }
      outputLines.push(processed);
    }
  }

  return { processed: outputLines.join("\n"), errors };
}

/**
 * Compile C source to ASM text.
 */
export function compile(source: string): CompileResult {
  const allErrors: CompileError[] = [];

  // 1. Preprocess
  const { processed, errors: ppErrors } = preprocess(source);
  allErrors.push(...ppErrors);

  // 2. Tokenize
  const { tokens, errors: lexErrors } = tokenize(processed);
  for (const e of lexErrors) {
    allErrors.push({
      phase: "lexer",
      line: (e as LexerError).line,
      message: (e as LexerError).message,
    });
  }

  if (tokens.length === 0 || lexErrors.length > 0) {
    return { success: false, assembly: "", errors: allErrors };
  }

  // 3. Parse
  const { program, errors: parseErrors } = parse(tokens);
  for (const e of parseErrors) {
    allErrors.push({
      phase: "parser",
      line: (e as ParseError).line,
      message: (e as ParseError).message,
    });
  }

  if (parseErrors.length > 0) {
    return { success: false, assembly: "", errors: allErrors };
  }

  // 4. Code generation
  const { assembly, errors: codegenErrors, memoryLayout } = generate(program);
  for (const e of codegenErrors) {
    allErrors.push({
      phase: "codegen",
      line: (e as CodegenError).line,
      message: (e as CodegenError).message,
    });
  }

  if (codegenErrors.length > 0) {
    return { success: false, assembly, errors: allErrors, memoryLayout };
  }

  return { success: true, assembly, errors: [], memoryLayout };
}
