import { InputNode } from "./InputNode";
import { OutputNode } from "./OutputNode";
import { GateNode } from "./GateNode";
import { Adder8Node } from "./Adder8Node";
import { SRAM8Node } from "./SRAM8Node";
import { Bus8Node } from "./Bus8Node";
import { InputNumberNode } from "./InputNumberNode";
import { OutputNumberNode } from "./OutputNumberNode";
import { GroupNode } from "./GroupNode";
import { ClockNode } from "./ClockNode";
import { Register8Node } from "./Register8Node";
import { ALU8Node } from "./ALU8Node";

export {
  InputNode,
  OutputNode,
  GateNode,
  Adder8Node,
  SRAM8Node,
  Bus8Node,
  InputNumberNode,
  OutputNumberNode,
  GroupNode,
  ClockNode,
  Register8Node,
  ALU8Node,
};

export const nodeTypes = {
  input: InputNode,
  output: OutputNode,
  gate: GateNode,
  adder8: Adder8Node,
  sram8: SRAM8Node,
  bus8: Bus8Node,
  inputNumber: InputNumberNode,
  outputNumber: OutputNumberNode,
  group: GroupNode,
  clock: ClockNode,
  register8: Register8Node,
  alu8: ALU8Node,
};
