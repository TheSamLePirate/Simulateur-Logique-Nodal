import type { Bit } from "../types";

export const add8 = (a: Bit[], b: Bit[], cin: Bit = 0) => {
  let carry: Bit = cin;
  const sum: Bit[] = Array(8).fill(0);

  for (let i = 0; i < 8; i++) {
    const bitA = a[i];
    const bitB = b[i];
    const ha1Sum = (bitA ^ bitB) as Bit;
    const ha1Carry = (bitA & bitB) as Bit;
    const ha2Sum = (ha1Sum ^ carry) as Bit;
    const ha2Carry = (ha1Sum & carry) as Bit;
    const cout = (ha1Carry | ha2Carry) as Bit;

    sum[i] = ha2Sum;
    carry = cout;
  }
  return { sum, cout: carry };
};
