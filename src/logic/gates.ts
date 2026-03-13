import type { Bit } from "../types";

export const logicGates = {
  AND: (a: Bit, b: Bit) => (a & b) as Bit,
  OR: (a: Bit, b: Bit) => (a | b) as Bit,
  XOR: (a: Bit, b: Bit) => (a ^ b) as Bit,
  NAND: (a: Bit, b: Bit) => (!(a & b) ? 1 : 0) as Bit,
  NOR: (a: Bit, b: Bit) => (!(a | b) ? 1 : 0) as Bit,
  NOT: (a: Bit) => (a ? 0 : 1) as Bit,
};
