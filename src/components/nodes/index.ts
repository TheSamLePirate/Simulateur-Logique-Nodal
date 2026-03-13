import { InputNode } from "./InputNode";
import { OutputNode } from "./OutputNode";
import { GateNode } from "./GateNode";
import { Adder8Node } from "./Adder8Node";
import { SRAM8Node } from "./SRAM8Node";
import { Bus8Node } from "./Bus8Node";
import { InputNumberNode } from "./InputNumberNode";
import { OutputNumberNode } from "./OutputNumberNode";
import { GroupNode } from "./GroupNode";

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
};
