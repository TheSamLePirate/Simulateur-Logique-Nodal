/**
 * Unit tests for all C example programs.
 *
 * Tests the full pipeline: C source → compile → assemble → CPU execution.
 * Verifies: compilation, code size, memory layout, output, and halting.
 */

import { describe, it, expect } from "vitest";
import { compile } from "../compiler";
import { assemble } from "../assembler";
import { CPU } from "../cpu";
import { C_EXAMPLES } from "../cexamples";
import { CODE_SIZE, MEMORY_SIZE } from "../isa";

// ─── Test helpers ───

interface RunResult {
  output: string;
  halted: boolean;
  cycles: number;
  cpu: CPU;
  codeSize: number;
  memoryLayout: {
    globals: number;
    scratch: number;
    locals: number;
    stackSize: number;
  };
}

/**
 * Compile, assemble, and run a C program.
 * Optionally feed console input characters before running.
 */
function compileAndRun(
  source: string,
  options: { maxCycles?: number; input?: string; keyState?: number[] } = {},
): RunResult {
  const { maxCycles = 500_000, input, keyState } = options;

  // Compile C → ASM
  const cr = compile(source);
  if (!cr.success) {
    throw new Error(
      `Compile failed:\n${cr.errors.map((e) => `  [${e.phase}] L${e.line}: ${e.message}`).join("\n")}`,
    );
  }

  // Assemble ASM → bytes
  const ar = assemble(cr.assembly);
  if (!ar.success) {
    throw new Error(
      `Assemble failed:\n${ar.errors.map((e) => `  L${e.line}: ${e.message}`).join("\n")}`,
    );
  }

  // Run on CPU
  const cpu = new CPU();
  cpu.loadProgram(ar.bytes);

  // Set keyboard state if provided
  if (keyState) {
    cpu.keyState = [...keyState];
  }

  // Feed input if provided
  if (input) {
    for (const ch of input) {
      cpu.pushInput(ch.charCodeAt(0));
    }
  }

  cpu.run(maxCycles);

  return {
    output: cpu.consoleOutput.join(""),
    halted: cpu.state.halted,
    cycles: cpu.state.cycles,
    cpu,
    codeSize: ar.bytes.length,
    memoryLayout: cr.memoryLayout!,
  };
}

/**
 * Compile a C source and return compile + assemble results without running.
 */
function compileOnly(source: string) {
  const cr = compile(source);
  let asmResult = null;
  if (cr.success) {
    asmResult = assemble(cr.assembly);
  }
  return { compile: cr, asm: asmResult };
}

// ═══════════════════════════════════════════════════════════
//  Test suite: All C examples compile and run
// ═══════════════════════════════════════════════════════════

describe("C Examples — Compilation", () => {
  for (const example of C_EXAMPLES) {
    it(`"${example.name}" compiles without errors`, () => {
      const { compile: cr, asm: ar } = compileOnly(example.code);

      expect(cr.success).toBe(true);
      expect(cr.errors).toHaveLength(0);
      expect(cr.assembly).toBeTruthy();
      expect(cr.memoryLayout).toBeDefined();

      // Assembly should also succeed
      expect(ar).not.toBeNull();
      expect(ar!.success).toBe(true);
      expect(ar!.errors).toHaveLength(0);
    });

    it(`"${example.name}" code fits in ${CODE_SIZE} bytes`, () => {
      const { asm: ar } = compileOnly(example.code);
      expect(ar!.bytes.length).toBeLessThanOrEqual(CODE_SIZE);
    });
  }
});

describe("C Examples — Memory Layout", () => {
  for (const example of C_EXAMPLES) {
    it(`"${example.name}" memory layout is valid`, () => {
      const { compile: cr } = compileOnly(example.code);
      const ml = cr.memoryLayout!;

      // Globals: 0-16
      expect(ml.globals).toBeGreaterThanOrEqual(0);
      expect(ml.globals).toBeLessThanOrEqual(16);

      // Scratch: always 8
      expect(ml.scratch).toBe(8);

      // Locals: 0-488
      expect(ml.locals).toBeGreaterThanOrEqual(0);
      expect(ml.locals).toBeLessThanOrEqual(488);

      // Stack: always 512
      expect(ml.stackSize).toBe(512);

      // Data area (globals + scratch + locals) fits in 512 bytes
      const dataUsed = ml.globals + ml.scratch + ml.locals;
      expect(dataUsed).toBeLessThanOrEqual(512);
    });
  }
});

// ═══════════════════════════════════════════════════════════
//  Test suite: Specific program outputs
// ═══════════════════════════════════════════════════════════

describe("C Examples — Output Verification", () => {
  it('"Hello World" outputs correct text', () => {
    const r = compileAndRun(C_EXAMPLES[0].code);
    expect(r.output).toBe("Hello World!");
    expect(r.halted).toBe(true);
  });

  it('"Compteur" outputs digits 0-9', () => {
    const r = compileAndRun(C_EXAMPLES[1].code);
    expect(r.output).toBe("0123456789");
    expect(r.halted).toBe(true);
  });

  it('"Fibonacci" outputs first 10 Fibonacci numbers', () => {
    const r = compileAndRun(C_EXAMPLES[2].code);
    // 0 1 1 2 3 5 8 13 21 34
    expect(r.output).toBe("0 1 1 2 3 5 8 13 21 34 ");
    expect(r.halted).toBe(true);
  });

  it('"Factorielle" computes 5! = 120', () => {
    const r = compileAndRun(C_EXAMPLES[3].code);
    expect(r.output).toBe("5! = 120");
    expect(r.halted).toBe(true);
  });

  it('"Calcul" shows correct arithmetic results', () => {
    const r = compileAndRun(C_EXAMPLES[4].code);
    const lines = r.output.split("\n").filter(Boolean);
    expect(lines).toEqual([
      "x = 10",
      "y = 3",
      "x+y = 13",
      "x-y = 7",
      "x*y = 30",
      "x/y = 3",
      "x%y = 1",
    ]);
    expect(r.halted).toBe(true);
  });

  it('"Plotter" draws pixels and halts', () => {
    const r = compileAndRun(C_EXAMPLES[5].code);
    expect(r.halted).toBe(true);
    // Should have drawn diagonal + frame pixels
    expect(r.cpu.plotterPixels.size).toBeGreaterThan(100);
    // Check diagonal: pixel at (0,0) and (79,79)
    expect(r.cpu.plotterPixels.has((0 << 8) | 0)).toBe(true); // (0,0)
    expect(r.cpu.plotterPixels.has((79 << 8) | 79)).toBe(true); // (79,79)
    // Check frame corners
    expect(r.cpu.plotterPixels.has((0 << 8) | 0)).toBe(true); // top-left
    expect(r.cpu.plotterPixels.has((0 << 8) | 99)).toBe(true); // top-right
    expect(r.cpu.plotterPixels.has((99 << 8) | 0)).toBe(true); // bottom-left
    expect(r.cpu.plotterPixels.has((99 << 8) | 99)).toBe(true); // bottom-right
  });

  it('"Courbe" draws parabolic wave on plotter', () => {
    const r = compileAndRun(C_EXAMPLES[6].code, { maxCycles: 50_000_000 });
    expect(r.halted).toBe(true);
    // Should have drawn ~255 pixels (one per x)
    expect(r.cpu.plotterPixels.size).toBeGreaterThan(200);
    // Pixel key = (y << 8) | x  (DRAW stores (B << 8) | A, draw(x,y) → A=x, B=y)
    // Endpoints at y=128 (t=0 → h=0 → y=128)
    expect(r.cpu.plotterPixels.has((128 << 8) | 0)).toBe(true); // draw(0, 128)
    // Wave should reach above y=128 in first half (x<128)
    // At x=64 (midpoint of first arch), t=64, h=(16*15)=240, y=128-(120)=8
    const hasUpperWave = Array.from(r.cpu.plotterPixels).some((key) => {
      const x = key & 0xff;
      const y = (key >> 8) & 0xff;
      return x < 128 && y < 100;
    });
    expect(hasUpperWave).toBe(true);
    // Wave should reach below y=128 in second half (x>=128)
    const hasLowerWave = Array.from(r.cpu.plotterPixels).some((key) => {
      const x = key & 0xff;
      const y = (key >> 8) & 0xff;
      return x >= 128 && y > 156;
    });
    expect(hasLowerWave).toBe(true);
  });

  it('"Echo" echoes input back', () => {
    const r = compileAndRun(C_EXAMPLES[7].code, {
      input: "Hi\n",
      maxCycles: 100_000,
    });
    // The output starts with "Tapez: " then echoes "Hi\n"
    expect(r.output).toContain("Tapez: ");
    expect(r.output).toContain("H");
    expect(r.output).toContain("i");
  });

  it('"Compteur de lettres" counts characters', () => {
    const r = compileAndRun(C_EXAMPLES[8].code, {
      input: "abc\n",
      maxCycles: 100_000,
    });
    expect(r.output).toContain("> ");
    expect(r.output).toContain("abc");
    expect(r.output).toContain("Longueur: 3");
  });

  it('"Calculatrice" computes 3+5=8', () => {
    const r = compileAndRun(C_EXAMPLES[9].code, {
      input: "3+5\n",
      maxCycles: 100_000,
    });
    expect(r.output).toContain("3+5");
    expect(r.output).toContain("= 8");
  });

  it('"Calculatrice" computes 9*7=63', () => {
    const r = compileAndRun(C_EXAMPLES[9].code, {
      input: "9*7\n",
      maxCycles: 500_000,
    });
    expect(r.output).toContain("= 63");
  });

  it('"Traceur de droite" plots y=2x (a=2, b=1, c=0) with DDA', () => {
    const r = compileAndRun(C_EXAMPLES[10].code, {
      input: "210",
      maxCycles: 50_000_000,
    });
    expect(r.halted).toBe(true);
    // Should have drawn ~255 pixels (one per x)
    expect(r.cpu.plotterPixels.size).toBeGreaterThan(200);
    // Pixel key = (y << 8) | x  (DRAW stores (B << 8) | A, draw(x,y) → A=x, B=y)
    // DDA: y increments by 2 each step (a=2, b=1)
    // x=1: y=2 → draw(1, 2) → key = (2 << 8) | 1
    expect(r.cpu.plotterPixels.has((2 << 8) | 1)).toBe(true);
    // x=10: y=20 → draw(10, 20) → key = (20 << 8) | 10
    expect(r.cpu.plotterPixels.has((20 << 8) | 10)).toBe(true);
    // x=200: y = (2*200) mod 256 = 144 → draw(200, 144)
    // DDA wraps smoothly through 255→0 (no jump discontinuity at x=128)
    expect(r.cpu.plotterPixels.has((144 << 8) | 200)).toBe(true);
  });

  it('"Traceur de droite" handles b=0 error', () => {
    const r = compileAndRun(C_EXAMPLES[10].code, {
      input: "10",
      maxCycles: 100_000,
    });
    expect(r.halted).toBe(true);
    expect(r.output).toContain("Err: b=0");
    // Should NOT have drawn any pixels (program exits before clear/draw)
    expect(r.cpu.plotterPixels.size).toBe(0);
  });

  it('"Cercle" draws a circle ring on plotter', () => {
    const r = compileAndRun(C_EXAMPLES[11].code, { maxCycles: 50_000_000 });
    expect(r.halted).toBe(true);
    // Should have drawn many pixels forming a ring
    expect(r.cpu.plotterPixels.size).toBeGreaterThan(200);
    // Center area (128,128) should NOT be drawn (d ≈ 0, not in 12..20 range)
    expect(r.cpu.plotterPixels.has((128 << 8) | 128)).toBe(false);
  }, 15_000);

  it('"Clavier" draws triangle + laser with arrow keys', () => {
    // Simulate pressing RIGHT + ENTER — triangle moves, laser fires
    const r = compileAndRun(C_EXAMPLES[12].code, {
      maxCycles: 500_000,
      keyState: [0, 1, 0, 0, 1],
    });
    // while(1) loop — never halts
    expect(r.halted).toBe(false);
    // clear() each frame: triangle (4px) + laser (2px) = 6 max
    expect(r.cpu.plotterPixels.size).toBeLessThanOrEqual(6);
  });

  it('"Horloge" starts at 00:00 and increments', () => {
    const r = compileAndRun(C_EXAMPLES[13].code, { maxCycles: 50_000_000 });
    const lines = r.output.split("\n").filter(Boolean);
    expect(lines[0]).toBe("00:00");
    expect(lines[1]).toBe("00:01");
    expect(lines[59]).toBe("00:59");
    expect(lines[60]).toBe("01:00");
    // Total: 60 minutes × 60 seconds = 3600 lines
    expect(lines).toHaveLength(3600);
    expect(r.halted).toBe(true);
  });

  it('"Spirale" draws spiral pixels and halts', () => {
    const r = compileAndRun(C_EXAMPLES[14].code);
    expect(r.halted).toBe(true);
    // Should have drawn many pixels
    expect(r.cpu.plotterPixels.size).toBeGreaterThan(500);
    // Starting point at (128, 128) should be drawn
    expect(r.cpu.plotterPixels.has((128 << 8) | 128)).toBe(true);
  });

  it('"Tableau de nombres premiers" finds 25 primes up to 100', () => {
    const r = compileAndRun(C_EXAMPLES[15].code);
    expect(r.output).toContain("Nombres premiers:");
    expect(r.output).toContain("Total: 25");
    // Check a few known primes are present
    expect(r.output).toContain("2 ");
    expect(r.output).toContain("3 ");
    expect(r.output).toContain("97 ");
    expect(r.halted).toBe(true);
  });

  it('"Étoiles" draws random stars with break', () => {
    const r = compileAndRun(C_EXAMPLES[16].code, { maxCycles: 5_000_000 });
    expect(r.halted).toBe(true);
    expect(r.output).toContain("Stars: ");
    // Should have drawn pixels (random positions, some skipped by continue)
    expect(r.cpu.plotterPixels.size).toBeGreaterThan(0);
    expect(r.cpu.plotterPixels.size).toBeLessThanOrEqual(64);
  });

  it('"Test Mémoire 2K" fills all 2048 bytes and passes', () => {
    const r = compileAndRun(C_EXAMPLES[17].code);

    // Verify output
    expect(r.output).toContain("=MEM 2K=");
    expect(r.output).toContain("g0=42");
    expect(r.output).toContain("gf=15");
    expect(r.output).toContain("r1=57");
    expect(r.output).toContain("r2=5");
    expect(r.output).toContain("PASS");
    expect(r.output).not.toContain("FAIL");
    expect(r.halted).toBe(true);

    // Verify memory layout — ALL regions filled
    const ml = r.memoryLayout;
    expect(ml.globals).toBe(16); // all 16 global slots
    expect(ml.locals).toBe(488); // all 488 local slots (19×25 + 2 + 11)
    expect(ml.scratch).toBe(8); // scratch always 8
    expect(ml.stackSize).toBe(512); // stack always 512

    // Data area fully used: 16 + 8 + 488 = 512
    expect(ml.globals + ml.scratch + ml.locals).toBe(512);

    // Code should fill most of the 1024-byte code area
    expect(r.codeSize).toBeGreaterThan(1000);
    expect(r.codeSize).toBeLessThanOrEqual(1024);

    // Verify actual memory values after execution
    expect(r.cpu.state.memory[0x400]).toBe(42); // g0
    expect(r.cpu.state.memory[0x40f]).toBe(15); // gf
    expect(r.cpu.state.sp).toBe(MEMORY_SIZE - 1); // stack restored (0x7FF)
  });

  it('"Tableau (Tri)" sorts 8 elements correctly', () => {
    const r = compileAndRun(C_EXAMPLES[18].code, { maxCycles: 5_000_000 });
    expect(r.halted).toBe(true);
    expect(r.output).toContain("Avant: 64 25 12 22 11 90 33 44");
    expect(r.output).toContain("Apres: 11 12 22 25 33 44 64 90");
  });

  it('"Pong" runs game loop with plotter output', () => {
    // Simulate pressing DOWN key — player paddle moves
    const r = compileAndRun(C_EXAMPLES[19].code, {
      maxCycles: 500_000,
      keyState: [0, 0, 0, 1, 0],
    });
    // Game loop runs continuously — does not halt in limited cycles
    expect(r.halted).toBe(false);
    // Should have drawn pixels (paddles + ball)
    expect(r.cpu.plotterPixels.size).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════
//  Test suite: Compiler edge cases
// ═══════════════════════════════════════════════════════════

describe("Compiler — Edge Cases", () => {
  it("empty main halts immediately", () => {
    const r = compileAndRun(`int main() { return 0; }`);
    expect(r.output).toBe("");
    expect(r.halted).toBe(true);
  });

  it("global variable initialization", () => {
    const r = compileAndRun(`
      int x = 42;
      int main() {
        print_num(x);
        return 0;
      }
    `);
    expect(r.output).toBe("42");
    expect(r.halted).toBe(true);
  });

  it("function with multiple return paths", () => {
    const r = compileAndRun(`
      int abs(int x) {
        if (x < 128) { return x; }
        return 0 - x;
      }
      int main() {
        print_num(abs(5));
        putchar(32);
        print_num(abs(250));
        return 0;
      }
    `);
    expect(r.output).toBe("5 6");
    expect(r.halted).toBe(true);
  });

  it("nested function calls", () => {
    const r = compileAndRun(`
      int double(int x) { return x + x; }
      int quad(int x) { return double(double(x)); }
      int main() {
        print_num(quad(3));
        return 0;
      }
    `);
    expect(r.output).toBe("12");
    expect(r.halted).toBe(true);
  });

  it("recursion works correctly", () => {
    const r = compileAndRun(`
      int sum(int n) {
        if (n <= 0) { return 0; }
        return n + sum(n - 1);
      }
      int main() {
        print_num(sum(10));
        return 0;
      }
    `);
    // 1+2+...+10 = 55
    expect(r.output).toBe("55");
    expect(r.halted).toBe(true);
  });

  it("while loop with break condition", () => {
    const r = compileAndRun(`
      int main() {
        int x = 1;
        while (x < 100) {
          x = x + x;
        }
        print_num(x);
        return 0;
      }
    `);
    // 1→2→4→8→16→32→64→128 (128 >= 100, exits loop)
    expect(r.output).toBe("128");
    expect(r.halted).toBe(true);
  });

  it("for loop counts correctly", () => {
    const r = compileAndRun(`
      int main() {
        int i;
        int sum = 0;
        for (i = 1; i <= 5; i++) {
          sum = sum + i;
        }
        print_num(sum);
        return 0;
      }
    `);
    // 1+2+3+4+5 = 15
    expect(r.output).toBe("15");
    expect(r.halted).toBe(true);
  });

  it("compound assignment operators", () => {
    const r = compileAndRun(`
      int main() {
        int x = 10;
        x += 5;
        print_num(x);
        putchar(32);
        x -= 3;
        print_num(x);
        return 0;
      }
    `);
    expect(r.output).toBe("15 12");
    expect(r.halted).toBe(true);
  });

  it("postfix increment/decrement", () => {
    const r = compileAndRun(`
      int main() {
        int x = 5;
        print_num(x++);
        putchar(32);
        print_num(x);
        putchar(32);
        print_num(x--);
        putchar(32);
        print_num(x);
        return 0;
      }
    `);
    expect(r.output).toBe("5 6 6 5");
    expect(r.halted).toBe(true);
  });

  it("logical AND/OR operators", () => {
    const r = compileAndRun(`
      int main() {
        int a = 1;
        int b = 0;
        if (a && b) { putchar('Y'); } else { putchar('N'); }
        if (a || b) { putchar('Y'); } else { putchar('N'); }
        if (!a)     { putchar('Y'); } else { putchar('N'); }
        if (!b)     { putchar('Y'); } else { putchar('N'); }
        return 0;
      }
    `);
    expect(r.output).toBe("NYNY");
    expect(r.halted).toBe(true);
  });

  it(">= and > comparison operators", () => {
    const r = compileAndRun(`
      int main() {
        int x = 5;
        if (x >= 5)  { putchar('Y'); } else { putchar('N'); }
        if (x >= 3)  { putchar('Y'); } else { putchar('N'); }
        if (x >= 10) { putchar('Y'); } else { putchar('N'); }
        if (x > 3)   { putchar('Y'); } else { putchar('N'); }
        if (x > 5)   { putchar('Y'); } else { putchar('N'); }
        if (x > 10)  { putchar('Y'); } else { putchar('N'); }
        return 0;
      }
    `);
    // >= : 5>=5=Y, 5>=3=Y, 5>=10=N | > : 5>3=Y, 5>5=N, 5>10=N
    expect(r.output).toBe("YYNYNN");
    expect(r.halted).toBe(true);
  });

  it("<= and < comparison operators", () => {
    const r = compileAndRun(`
      int main() {
        int x = 5;
        if (x <= 5)  { putchar('Y'); } else { putchar('N'); }
        if (x <= 10) { putchar('Y'); } else { putchar('N'); }
        if (x <= 3)  { putchar('Y'); } else { putchar('N'); }
        if (x < 10)  { putchar('Y'); } else { putchar('N'); }
        if (x < 5)   { putchar('Y'); } else { putchar('N'); }
        return 0;
      }
    `);
    // <= : Y, Y, N | < : Y, N
    expect(r.output).toBe("YYNYN");
    expect(r.halted).toBe(true);
  });

  it("multiply and divide", () => {
    const r = compileAndRun(`
      int main() {
        print_num(7 * 8);
        putchar(32);
        print_num(100 / 7);
        putchar(32);
        print_num(100 % 7);
        return 0;
      }
    `);
    expect(r.output).toBe("56 14 2");
    expect(r.halted).toBe(true);
  });

  it("unsigned division with large dividends (>= 128)", () => {
    // Bug fix: JN→JC in emitDivMod — JN treated results >= 128 as negative
    const r = compileAndRun(`
      int main() {
        print_num(130 / 2);   // 65: was returning 0 (130-2=128, bit7 set → JN fired)
        putchar(32);
        print_num(200 / 4);   // 50
        putchar(32);
        print_num(255 / 5);   // 51
        putchar(32);
        print_num(128 / 1);   // 128
        putchar(32);
        print_num(200 % 3);   // 2 (200 = 66*3 + 2)
        return 0;
      }
    `);
    expect(r.output).toBe("65 50 51 128 2");
    expect(r.halted).toBe(true);
  });

  it("#define preprocessor works", () => {
    const r = compileAndRun(`
      #define VAL 42
      #define MSG "hello"
      int main() {
        print_num(VAL);
        putchar(32);
        print(MSG);
        return 0;
      }
    `);
    expect(r.output).toBe("42 hello");
    expect(r.halted).toBe(true);
  });

  it("char literals work", () => {
    const r = compileAndRun(`
      int main() {
        putchar('A');
        putchar('B');
        putchar('C');
        return 0;
      }
    `);
    expect(r.output).toBe("ABC");
    expect(r.halted).toBe(true);
  });

  it("getchar reads input correctly", () => {
    const r = compileAndRun(
      `
      int main() {
        int c;
        c = getchar();
        putchar(c);
        c = getchar();
        putchar(c);
        return 0;
      }
    `,
      { input: "XY" },
    );
    expect(r.output).toBe("XY");
    expect(r.halted).toBe(true);
  });

  it("getKey returns 0 when no key pressed", () => {
    const r = compileAndRun(`
      int main() {
        int k;
        k = getKey(0);
        print_num(k);
        putchar(32);
        k = getKey(4);
        print_num(k);
        return 0;
      }
    `);
    expect(r.output).toBe("0 0");
    expect(r.halted).toBe(true);
  });

  it("getKey returns 1 when key is pressed", () => {
    const r = compileAndRun(
      `
      int main() {
        int k;
        k = getKey(0);
        print_num(k);
        putchar(32);
        k = getKey(2);
        print_num(k);
        return 0;
      }
    `,
      { keyState: [1, 0, 1, 0, 0] },
    );
    expect(r.output).toBe("1 1");
    expect(r.halted).toBe(true);
  });

  it("stack pointer is restored after function calls", () => {
    const r = compileAndRun(`
      int add(int a, int b) { return a + b; }
      int main() {
        int x;
        x = add(1, 2);
        x = add(3, 4);
        x = add(5, 6);
        print_num(x);
        return 0;
      }
    `);
    expect(r.output).toBe("11");
    expect(r.halted).toBe(true);
    // SP should be back to 0x7FF (empty stack)
    expect(r.cpu.state.sp).toBe(MEMORY_SIZE - 1);
  });

  it("16 globals are allowed", () => {
    const source = `
      int a;int b;int c;int d;int e;int f;int g;int h;
      int i;int j;int k;int l;int m;int n;int o;int p;
      int main() {
        a=1;b=2;c=3;d=4;e=5;f=6;g=7;h=8;
        i=9;j=10;k=11;l=12;m=13;n=14;o=15;p=16;
        print_num(a+p);
        return 0;
      }
    `;
    const r = compileAndRun(source);
    expect(r.output).toBe("17");
    expect(r.halted).toBe(true);
    expect(r.memoryLayout.globals).toBe(16);
  });

  it("17th global produces an error", () => {
    const source = `
      int a;int b;int c;int d;int e;int f;int g;int h;
      int i;int j;int k;int l;int m;int n;int o;int p;
      int q;
      int main() { return 0; }
    `;
    const cr = compile(source);
    expect(cr.success).toBe(false);
    expect(cr.errors.some((e) => e.message.includes("max 16"))).toBe(true);
  });

  it("break exits while loop early", () => {
    const r = compileAndRun(`
      int main() {
        int i = 0;
        while (1) {
          if (i >= 5) { break; }
          i = i + 1;
        }
        print_num(i);
        return 0;
      }
    `);
    expect(r.output).toBe("5");
    expect(r.halted).toBe(true);
  });

  it("break exits for loop early", () => {
    const r = compileAndRun(`
      int main() {
        int i;
        int sum = 0;
        for (i = 0; i < 100; i++) {
          if (i >= 5) { break; }
          sum = sum + i;
        }
        print_num(sum);
        putchar(32);
        print_num(i);
        return 0;
      }
    `);
    // sum = 0+1+2+3+4 = 10, i = 5 when break fires
    expect(r.output).toBe("10 5");
    expect(r.halted).toBe(true);
  });

  it("continue skips to next iteration in while loop", () => {
    const r = compileAndRun(`
      int main() {
        int i = 0;
        int sum = 0;
        while (i < 10) {
          i = i + 1;
          if (i == 3) { continue; }
          if (i == 7) { continue; }
          sum = sum + i;
        }
        print_num(sum);
        return 0;
      }
    `);
    // 1+2+4+5+6+8+9+10 = 45 (skipped 3 and 7)
    expect(r.output).toBe("45");
    expect(r.halted).toBe(true);
  });

  it("continue in for loop jumps to update", () => {
    const r = compileAndRun(`
      int main() {
        int i;
        int sum = 0;
        for (i = 0; i < 10; i++) {
          if (i == 3) { continue; }
          if (i == 7) { continue; }
          sum = sum + i;
        }
        print_num(sum);
        return 0;
      }
    `);
    // 0+1+2+4+5+6+8+9 = 35 (skipped 3 and 7)
    expect(r.output).toBe("35");
    expect(r.halted).toBe(true);
  });

  it("nested break only exits inner loop", () => {
    const r = compileAndRun(`
      int main() {
        int i = 0;
        int j;
        int count = 0;
        while (i < 3) {
          j = 0;
          while (1) {
            if (j >= 2) { break; }
            count = count + 1;
            j = j + 1;
          }
          i = i + 1;
        }
        print_num(count);
        return 0;
      }
    `);
    // 3 outer iterations × 2 inner iterations = 6
    expect(r.output).toBe("6");
    expect(r.halted).toBe(true);
  });

  it("break outside loop produces error", () => {
    const cr = compile(`
      int main() {
        break;
        return 0;
      }
    `);
    expect(cr.success).toBe(false);
    expect(cr.errors.some((e) => e.message.includes("boucle"))).toBe(true);
  });

  it("continue outside loop produces error", () => {
    const cr = compile(`
      int main() {
        continue;
        return 0;
      }
    `);
    expect(cr.success).toBe(false);
    expect(cr.errors.some((e) => e.message.includes("boucle"))).toBe(true);
  });

  it("rand() returns pseudo-random values", () => {
    const r = compileAndRun(`
      int main() {
        int a;
        int b;
        int c;
        a = rand();
        b = rand();
        c = rand();
        // All three should be different (LFSR sequence)
        if (a != b) { putchar('Y'); } else { putchar('N'); }
        if (b != c) { putchar('Y'); } else { putchar('N'); }
        if (a != c) { putchar('Y'); } else { putchar('N'); }
        return 0;
      }
    `);
    expect(r.output).toBe("YYY");
    expect(r.halted).toBe(true);
  });

  it("rand() values are in 0-255 range", () => {
    const r = compileAndRun(`
      int main() {
        int i;
        int v;
        int ok = 1;
        for (i = 0; i < 20; i++) {
          v = rand();
          if (v > 255) { ok = 0; }
        }
        if (ok) { putchar('Y'); } else { putchar('N'); }
        return 0;
      }
    `);
    expect(r.output).toBe("Y");
    expect(r.halted).toBe(true);
  });

  it("sleep() delays execution by N cycles", () => {
    // Run two programs: one with sleep, one without, compare cycle counts
    const r1 = compileAndRun(`
      int main() {
        return 0;
      }
    `);
    const r2 = compileAndRun(`
      int main() {
        sleep(100);
        return 0;
      }
    `);
    // sleep(100) should add ~100 cycles
    expect(r2.cycles - r1.cycles).toBeGreaterThanOrEqual(100);
    expect(r2.halted).toBe(true);
  });

  it("code size overflow is detected", () => {
    // Generate a program that's way too big (lots of print statements)
    let code = "int main() {\n";
    for (let i = 0; i < 60; i++) {
      code += `  print("AAAAAAAAAA");\n`; // 10 chars × 3 bytes = 30 bytes each
    }
    code += "  return 0;\n}";

    const cr = compile(code);
    expect(cr.success).toBe(true); // compile succeeds

    const ar = assemble(cr.assembly);
    expect(ar.success).toBe(false); // but assembly catches overflow
    expect(ar.errors.some((e) => e.message.includes("trop grand"))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
//  Test suite: Arrays
// ═══════════════════════════════════════════════════════════

describe("Compiler — Arrays", () => {
  it("basic array write and read", () => {
    const r = compileAndRun(`
      int main() {
        int a[3];
        a[0] = 10;
        a[1] = 20;
        a[2] = 30;
        print_num(a[0]);
        putchar(32);
        print_num(a[1]);
        putchar(32);
        print_num(a[2]);
        return 0;
      }
    `);
    expect(r.output).toBe("10 20 30");
    expect(r.halted).toBe(true);
  });

  it("array fill and read in loop", () => {
    const r = compileAndRun(`
      int main() {
        int arr[5];
        int i;
        for (i = 0; i < 5; i++) {
          arr[i] = i * 3;
        }
        for (i = 0; i < 5; i++) {
          print_num(arr[i]);
          putchar(32);
        }
        return 0;
      }
    `);
    expect(r.output).toBe("0 3 6 9 12 ");
    expect(r.halted).toBe(true);
  });

  it("complex index expression arr[j+1]", () => {
    const r = compileAndRun(`
      int main() {
        int a[4];
        int j;
        a[0] = 10;
        a[1] = 20;
        a[2] = 30;
        a[3] = 40;
        for (j = 0; j < 3; j++) {
          print_num(a[j + 1]);
          putchar(32);
        }
        return 0;
      }
    `);
    expect(r.output).toBe("20 30 40 ");
    expect(r.halted).toBe(true);
  });

  it("global array", () => {
    const r = compileAndRun(`
      int g[3];
      int main() {
        g[0] = 100;
        g[1] = 200;
        g[2] = 50;
        print_num(g[0]);
        putchar(32);
        print_num(g[1]);
        putchar(32);
        print_num(g[2]);
        return 0;
      }
    `);
    expect(r.output).toBe("100 200 50");
    expect(r.halted).toBe(true);
  });

  it("local array in function", () => {
    const r = compileAndRun(`
      int sum3(int x, int y, int z) {
        int buf[3];
        buf[0] = x;
        buf[1] = y;
        buf[2] = z;
        return buf[0] + buf[1] + buf[2];
      }
      int main() {
        print_num(sum3(10, 20, 30));
        return 0;
      }
    `);
    expect(r.output).toBe("60");
    expect(r.halted).toBe(true);
  });

  it("global array accessed from function", () => {
    const r = compileAndRun(`
      int data[3];
      void fill() {
        data[0] = 5;
        data[1] = 10;
        data[2] = 15;
      }
      int main() {
        fill();
        print_num(data[0] + data[1] + data[2]);
        return 0;
      }
    `);
    expect(r.output).toBe("30");
    expect(r.halted).toBe(true);
  });

  it("swap via array (bubble sort pattern)", () => {
    const r = compileAndRun(`
      int main() {
        int a[2];
        int tmp;
        a[0] = 99;
        a[1] = 11;
        if (a[0] > a[1]) {
          tmp = a[0];
          a[0] = a[1];
          a[1] = tmp;
        }
        print_num(a[0]);
        putchar(32);
        print_num(a[1]);
        return 0;
      }
    `);
    expect(r.output).toBe("11 99");
    expect(r.halted).toBe(true);
  });

  // ─── Error cases ───

  it("array size 0 is rejected", () => {
    const cr = compile(`
      int main() {
        int a[0];
        return 0;
      }
    `);
    expect(cr.success).toBe(false);
    expect(cr.errors.some((e) => e.message.includes("taille"))).toBe(true);
  });

  it("global array too large is rejected", () => {
    const cr = compile(`
      int big[17];
      int main() { return 0; }
    `);
    expect(cr.success).toBe(false);
    expect(cr.errors.some((e) => e.message.includes("globale"))).toBe(true);
  });

  it("array name without index is rejected", () => {
    const cr = compile(`
      int main() {
        int a[3];
        int x;
        x = a;
        return 0;
      }
    `);
    expect(cr.success).toBe(false);
    expect(cr.errors.some((e) => e.message.includes("tableau"))).toBe(true);
  });

  it("index on non-array variable is rejected", () => {
    const cr = compile(`
      int main() {
        int x;
        x = 5;
        print_num(x[0]);
        return 0;
      }
    `);
    expect(cr.success).toBe(false);
    expect(
      cr.errors.some(
        (e) => e.message.includes("tableau") || e.message.includes("Tableau"),
      ),
    ).toBe(true);
  });

  it("array initializer is rejected", () => {
    const cr = compile(`
      int main() {
        int a[3] = {1, 2, 3};
        return 0;
      }
    `);
    expect(cr.success).toBe(false);
    expect(cr.errors.some((e) => e.message.includes("Initialisation"))).toBe(
      true,
    );
  });
});

// ═══════════════════════════════════════════════════════════
//  Test suite: CPU execution properties
// ═══════════════════════════════════════════════════════════

describe("C Examples — Execution Properties", () => {
  // Programs that should halt (not input-dependent)
  const haltingExamples = [
    "Hello World",
    "Compteur",
    "Fibonacci",
    "Factorielle",
    "Calcul",
    "Plotter",
    "Courbe",
    "Cercle",
    "Horloge",
    "Spirale",
    "Tableau de nombres premiers",
    "Étoiles",
    "Test Mémoire 2K",
    "Tableau (Tri)",
  ];

  for (const name of haltingExamples) {
    const example = C_EXAMPLES.find((e) => e.name === name)!;

    it(`"${name}" halts within reasonable cycles`, () => {
      const r = compileAndRun(example.code, { maxCycles: 50_000_000 });
      expect(r.halted).toBe(true);
    }, 15_000);
  }

  // Programs that need input (won't halt without it)
  const inputExamples = [
    "Echo (Saisie)",
    "Compteur de lettres",
    "Calculatrice",
    "Traceur de droite",
  ];

  for (const name of inputExamples) {
    const example = C_EXAMPLES.find((e) => e.name === name)!;

    it(`"${name}" waits for input (does not halt without it)`, () => {
      const r = compileAndRun(example.code, { maxCycles: 10_000 });
      // These programs loop waiting for input, should not halt
      expect(r.halted).toBe(false);
    });
  }
});
