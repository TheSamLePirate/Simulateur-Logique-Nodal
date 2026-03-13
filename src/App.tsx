import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Handle,
  Position,
  Node,
  Edge,
  Connection,
  NodeChange,
  EdgeChange,
  Panel,
  useNodesState,
  useEdgesState
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import { Cpu, MemoryStick, Plus, Trash2, Play, Square, Circle, Maximize2, X } from 'lucide-react';

type Bit = 0 | 1;

// --- Logic Functions ---
const logicGates = {
  AND: (a: Bit, b: Bit) => (a & b) as Bit,
  OR: (a: Bit, b: Bit) => (a | b) as Bit,
  XOR: (a: Bit, b: Bit) => (a ^ b) as Bit,
  NAND: (a: Bit, b: Bit) => (!(a & b) ? 1 : 0) as Bit,
  NOR: (a: Bit, b: Bit) => (!(a | b) ? 1 : 0) as Bit,
  NOT: (a: Bit) => (a ? 0 : 1) as Bit,
};

const add8 = (a: Bit[], b: Bit[], cin: Bit = 0) => {
  let carry: Bit = cin;
  const sum: Bit[] = Array(8).fill(0);
  const carries: Bit[] = Array(8).fill(0);

  for (let i = 0; i < 8; i++) {
    const bitA = a[i];
    const bitB = b[i];
    const ha1Sum = (bitA ^ bitB) as Bit;
    const ha1Carry = (bitA & bitB) as Bit;
    const ha2Sum = (ha1Sum ^ carry) as Bit;
    const ha2Carry = (ha1Sum & carry) as Bit;
    const cout = (ha1Carry | ha2Carry) as Bit;

    sum[i] = ha2Sum;
    carries[i] = cout;
    carry = cout;
  }
  return { sum, cout: carry };
};

// --- Custom Nodes ---

// 1. Input Node (Switch)
const InputNode = ({ data, id }: any) => {
  return (
    <div className="bg-slate-800 border-2 border-slate-600 rounded-md p-2 min-w-[80px] text-center shadow-lg">
      <div className="text-xs font-bold text-slate-400 mb-2 uppercase">{data.label || 'Input'}</div>
      <button
        className={`w-12 h-12 rounded-full font-mono text-xl font-bold transition-all ${data.value ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.6)]' : 'bg-slate-700 text-slate-500'}`}
        onClick={() => data.onChange(id, data.value ? 0 : 1)}
      >
        {data.value || 0}
      </button>
      <Handle type="source" position={Position.Right} id="out" className="w-3 h-3 bg-blue-400" />
    </div>
  );
};

// 2. Output Node (LED)
const OutputNode = ({ data }: any) => {
  return (
    <div className="bg-slate-800 border-2 border-slate-600 rounded-md p-2 min-w-[80px] text-center shadow-lg">
      <Handle type="target" position={Position.Left} id="in" className="w-3 h-3 bg-slate-400" />
      <div className="text-xs font-bold text-slate-400 mb-2 uppercase">{data.label || 'Output'}</div>
      <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center font-mono text-xl font-bold transition-all ${data.value ? 'bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.8)]' : 'bg-slate-700 text-slate-500'}`}>
        {data.value || 0}
      </div>
    </div>
  );
};

// 3. Logic Gate Node
const GateNode = ({ data }: any) => {
  const isNot = data.type === 'NOT';
  return (
    <div className="bg-slate-800 border-2 border-slate-600 rounded-md p-2 min-w-[100px] text-center shadow-lg">
      {!isNot && <Handle type="target" position={Position.Left} id="a" style={{ top: '30%' }} className="w-2 h-2 bg-slate-400" />}
      {!isNot && <Handle type="target" position={Position.Left} id="b" style={{ top: '70%' }} className="w-2 h-2 bg-slate-400" />}
      {isNot && <Handle type="target" position={Position.Left} id="in" className="w-2 h-2 bg-slate-400" />}
      
      <div className="font-mono font-bold text-lg text-white py-2">{data.type}</div>
      
      <Handle type="source" position={Position.Right} id="out" className={`w-3 h-3 ${data.value ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]' : 'bg-slate-600'}`} />
    </div>
  );
};

// 4. 8-bit Adder Node
const Adder8Node = ({ data }: any) => {
  return (
    <div className="bg-slate-800 border-2 border-blue-600 rounded-md p-3 min-w-[150px] shadow-lg relative">
      <button 
        onClick={() => window.dispatchEvent(new CustomEvent('inspect-node', { detail: 'adder8' }))} 
        className="absolute top-2 right-2 text-slate-400 hover:text-white transition-colors" 
        title="Voir le circuit interne"
      >
        <Maximize2 size={14} />
      </button>
      <div className="flex items-center justify-center gap-2 mb-4 border-b border-slate-700 pb-2">
        <Cpu size={16} className="text-blue-400" />
        <span className="font-bold text-white">Adder 8-bit</span>
      </div>
      
      <div className="flex justify-between">
        {/* Inputs */}
        <div className="flex flex-col gap-1">
          <div className="text-[10px] text-slate-500 font-mono mb-1">A [0..7]</div>
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
            <div key={`a${i}`} className="relative h-4 flex items-center">
              <Handle type="target" position={Position.Left} id={`a${i}`} className="w-2 h-2 bg-slate-400 -ml-4" />
              <span className="text-[8px] text-slate-400 font-mono ml-1">A{i}</span>
            </div>
          ))}
          <div className="text-[10px] text-slate-500 font-mono mt-2 mb-1">B [0..7]</div>
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
            <div key={`b${i}`} className="relative h-4 flex items-center">
              <Handle type="target" position={Position.Left} id={`b${i}`} className="w-2 h-2 bg-slate-400 -ml-4" />
              <span className="text-[8px] text-slate-400 font-mono ml-1">B{i}</span>
            </div>
          ))}
          <div className="relative h-4 flex items-center mt-2">
            <Handle type="target" position={Position.Left} id="cin" className="w-2 h-2 bg-red-400 -ml-4" />
            <span className="text-[8px] text-red-400 font-mono ml-1">Cin</span>
          </div>
        </div>

        {/* Outputs */}
        <div className="flex flex-col gap-1 items-end">
          <div className="text-[10px] text-slate-500 font-mono mb-1">Sum [0..7]</div>
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
            <div key={`s${i}`} className="relative h-4 flex items-center justify-end">
              <span className="text-[8px] text-slate-400 font-mono mr-1">S{i}</span>
              <Handle type="source" position={Position.Right} id={`s${i}`} className={`w-2 h-2 -mr-4 ${data.sum?.[i] ? 'bg-green-400' : 'bg-slate-600'}`} />
            </div>
          ))}
          <div className="relative h-4 flex items-center justify-end mt-2">
            <span className="text-[8px] text-red-400 font-mono mr-1">Cout</span>
            <Handle type="source" position={Position.Right} id="cout" className={`w-2 h-2 -mr-4 ${data.cout ? 'bg-red-400' : 'bg-slate-600'}`} />
          </div>
        </div>
      </div>
    </div>
  );
};

// 5. 8-bit SRAM Node (256x8)
const SRAM8Node = ({ data }: any) => {
  const addr = data.currentAddress || 0;
  const val = data.memory ? data.memory[addr] : 0;
  
  return (
    <div className="bg-slate-800 border-2 border-amber-600 rounded-md p-2 min-w-[150px] shadow-lg flex flex-col relative">
      <button 
        onClick={() => window.dispatchEvent(new CustomEvent('inspect-node', { detail: 'sram8' }))} 
        className="absolute top-2 right-2 text-slate-400 hover:text-white transition-colors" 
        title="Voir le circuit interne"
      >
        <Maximize2 size={14} />
      </button>
      <div className="flex items-center justify-center gap-2 mb-2 border-b border-slate-700 pb-2">
        <MemoryStick size={14} className="text-amber-400" />
        <span className="text-[10px] font-bold text-white uppercase">SRAM 256x8</span>
      </div>
      
      <div className="bg-slate-900 rounded p-1 mb-2 text-center border border-slate-700">
        <div className="text-[10px] text-slate-400 font-mono">ADDR: 0x{addr.toString(16).padStart(2, '0').toUpperCase()}</div>
        <div className="text-[10px] text-green-400 font-mono">DATA: 0x{val.toString(16).padStart(2, '0').toUpperCase()}</div>
      </div>

      <div className="flex justify-between">
        {/* Left side: A0-A7, D0-D7, WE */}
        <div className="flex flex-col gap-1">
          <div className="text-[8px] text-yellow-500 font-bold">ADDR</div>
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
            <div key={`a${i}`} className="relative h-3 flex items-center">
              <Handle type="target" position={Position.Left} id={`a${i}`} className="w-2 h-2 bg-yellow-400 -ml-3" />
              <span className="text-[8px] text-slate-500 font-mono ml-1">A{i}</span>
            </div>
          ))}
          <div className="text-[8px] text-blue-400 font-bold mt-1">DATA IN</div>
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
            <div key={`d${i}`} className="relative h-3 flex items-center">
              <Handle type="target" position={Position.Left} id={`d${i}`} className="w-2 h-2 bg-blue-400 -ml-3" />
              <span className="text-[8px] text-slate-500 font-mono ml-1">D{i}</span>
            </div>
          ))}
          <div className="relative h-3 flex items-center mt-2">
            <Handle type="target" position={Position.Left} id="we" className="w-2 h-2 bg-red-400 -ml-3" />
            <span className="text-[8px] text-red-400 font-mono ml-1 font-bold">WE</span>
          </div>
        </div>

        {/* Right side: Q0-Q7 */}
        <div className="flex flex-col gap-1 items-end mt-4">
          <div className="text-[8px] text-green-400 font-bold">DATA OUT</div>
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i => {
            const bitVal = (val & (1 << i)) ? 1 : 0;
            return (
              <div key={`q${i}`} className="relative h-3 flex items-center justify-end w-full">
                <span className="text-[8px] text-slate-500 font-mono mr-1">Q{i}</span>
                <Handle type="source" position={Position.Right} id={`q${i}`} className={`w-2 h-2 -mr-3 ${bitVal ? 'bg-green-400' : 'bg-slate-600'}`} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// 6. 8-bit Bus Node
const Bus8Node = ({ data }: any) => {
  return (
    <div className="bg-slate-800 border-2 border-slate-500 rounded-md p-2 min-w-[60px] shadow-lg flex flex-col items-center">
      <div className="text-[10px] font-bold text-slate-300 mb-2 uppercase">8-bit Bus</div>
      <div className="flex justify-between w-full gap-4">
        <div className="flex flex-col gap-1">
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
            <div key={`in${i}`} className="relative h-4 flex items-center">
              <Handle type="target" position={Position.Left} id={`in${i}`} className="w-2 h-2 bg-slate-400 -ml-3" />
              <span className="text-[8px] text-slate-500 font-mono ml-1">{i}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1 items-end">
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
            <div key={`out${i}`} className="relative h-4 flex items-center justify-end">
              <span className="text-[8px] text-slate-500 font-mono mr-1">{i}</span>
              <Handle type="source" position={Position.Right} id={`out${i}`} className={`w-2 h-2 -mr-3 ${data.val?.[i] ? 'bg-blue-400' : 'bg-slate-600'}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 7. Input Number Node (8-bit)
const InputNumberNode = ({ data, id }: any) => {
  const val = data.value || 0;
  return (
    <div className="bg-slate-800 border-2 border-slate-600 rounded-md p-2 min-w-[100px] shadow-lg flex flex-col">
      <div className="text-[10px] font-bold text-slate-400 mb-1 text-center uppercase">{data.label || 'Num In'}</div>
      <input
        type="number"
        min="0"
        max="255"
        value={val}
        onChange={(e) => {
          let v = parseInt(e.target.value, 10);
          if (isNaN(v)) v = 0;
          if (v < 0) v = 0;
          if (v > 255) v = 255;
          data.onChange(id, v);
        }}
        className="w-full bg-slate-900 text-white text-center font-mono text-lg rounded border border-slate-700 nodrag"
      />
      <div className="flex flex-col gap-1 mt-2 items-end">
        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => {
          const bitVal = (val & (1 << i)) ? 1 : 0;
          return (
            <div key={`out${i}`} className="relative h-3 flex items-center justify-end w-full">
              <span className="text-[8px] text-slate-500 font-mono mr-1">Bit {i}</span>
              <Handle type="source" position={Position.Right} id={`out${i}`} className={`w-2 h-2 -mr-3 ${bitVal ? 'bg-blue-400' : 'bg-slate-600'}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 8. Output Number Node (8-bit)
const OutputNumberNode = ({ data }: any) => {
  const val = data.value || 0;
  return (
    <div className="bg-slate-800 border-2 border-slate-600 rounded-md p-2 min-w-[100px] shadow-lg flex flex-col">
      <div className="text-[10px] font-bold text-slate-400 mb-1 text-center uppercase">{data.label || 'Num Out'}</div>
      <div className="w-full bg-slate-900 text-green-400 text-center font-mono text-xl rounded border border-slate-700 p-1 shadow-[0_0_10px_rgba(34,197,94,0.2)]">
        {val}
      </div>
      <div className="flex flex-col gap-1 mt-2">
        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
          <div key={`in${i}`} className="relative h-3 flex items-center w-full">
            <Handle type="target" position={Position.Left} id={`in${i}`} className="w-2 h-2 bg-slate-400 -ml-3" />
            <span className="text-[8px] text-slate-500 font-mono ml-1">Bit {i}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const nodeTypes = {
  input: InputNode,
  output: OutputNode,
  gate: GateNode,
  adder8: Adder8Node,
  sram8: SRAM8Node,
  bus8: Bus8Node,
  inputNumber: InputNumberNode,
  outputNumber: OutputNumberNode,
};

const initialNodes: Node[] = [
  // Input A (Value 5)
  { id: 'inA', type: 'inputNumber', position: { x: 50, y: 150 }, data: { label: 'A', value: 5 } },
  // Input B (Value 3)
  { id: 'inB', type: 'inputNumber', position: { x: 50, y: 350 }, data: { label: 'B', value: 3 } },
  // Address Input
  { id: 'inAddr', type: 'inputNumber', position: { x: 350, y: 350 }, data: { label: 'ADDR', value: 0 } },
  // Adder
  { id: 'adder1', type: 'adder8', position: { x: 350, y: 150 }, data: { sum: Array(8).fill(0), cout: 0 } },
  // WE
  { id: 'we1', type: 'input', position: { x: 450, y: 500 }, data: { label: 'WE', value: 0 } },
  // SRAM
  { id: 'sram1', type: 'sram8', position: { x: 600, y: 150 }, data: { memory: Array(256).fill(0), q: Array(8).fill(0), currentAddress: 0 } },
  // Output Q
  { id: 'outQ', type: 'outputNumber', position: { x: 850, y: 150 }, data: { label: 'Q', value: 0 } }
];

const initialEdges: Edge[] = [
  // A to Adder
  ...Array.from({ length: 8 }).map((_, i) => ({
    id: `e-a${i}`, source: 'inA', target: 'adder1', sourceHandle: `out${i}`, targetHandle: `a${i}`, animated: false
  })),
  // B to Adder
  ...Array.from({ length: 8 }).map((_, i) => ({
    id: `e-b${i}`, source: 'inB', target: 'adder1', sourceHandle: `out${i}`, targetHandle: `b${i}`, animated: false
  })),
  // Addr to SRAM
  ...Array.from({ length: 8 }).map((_, i) => ({
    id: `e-addr${i}`, source: 'inAddr', target: 'sram1', sourceHandle: `out${i}`, targetHandle: `a${i}`, animated: false
  })),
  // Adder to SRAM
  ...Array.from({ length: 8 }).map((_, i) => ({
    id: `e-sum${i}`, source: 'adder1', target: 'sram1', sourceHandle: `s${i}`, targetHandle: `d${i}`, animated: false
  })),
  // WE to SRAM
  { id: 'e-we', source: 'we1', target: 'sram1', sourceHandle: 'out', targetHandle: 'we', animated: false },
  // SRAM to Output
  ...Array.from({ length: 8 }).map((_, i) => ({
    id: `e-out${i}`, source: 'sram1', target: 'outQ', sourceHandle: `q${i}`, targetHandle: `in${i}`, animated: false
  }))
];

const adderNodes: Node[] = [
  { id: 'inA', type: 'input', position: { x: 50, y: 100 }, data: { label: 'A', value: 0 } },
  { id: 'inB', type: 'input', position: { x: 50, y: 200 }, data: { label: 'B', value: 0 } },
  { id: 'inCin', type: 'input', position: { x: 50, y: 300 }, data: { label: 'Cin', value: 0 } },
  { id: 'xor1', type: 'gate', position: { x: 250, y: 150 }, data: { type: 'XOR', value: 0 } },
  { id: 'xor2', type: 'gate', position: { x: 450, y: 200 }, data: { type: 'XOR', value: 0 } },
  { id: 'and1', type: 'gate', position: { x: 250, y: 350 }, data: { type: 'AND', value: 0 } },
  { id: 'and2', type: 'gate', position: { x: 450, y: 300 }, data: { type: 'AND', value: 0 } },
  { id: 'or1', type: 'gate', position: { x: 650, y: 325 }, data: { type: 'OR', value: 0 } },
  { id: 'outSum', type: 'output', position: { x: 650, y: 200 }, data: { label: 'Sum', value: 0 } },
  { id: 'outCout', type: 'output', position: { x: 850, y: 325 }, data: { label: 'Cout', value: 0 } },
];

const adderEdges: Edge[] = [
  { id: 'e1', source: 'inA', target: 'xor1', sourceHandle: 'out', targetHandle: 'a', animated: false },
  { id: 'e2', source: 'inB', target: 'xor1', sourceHandle: 'out', targetHandle: 'b', animated: false },
  { id: 'e3', source: 'xor1', target: 'xor2', sourceHandle: 'out', targetHandle: 'a', animated: false },
  { id: 'e4', source: 'inCin', target: 'xor2', sourceHandle: 'out', targetHandle: 'b', animated: false },
  { id: 'e5', source: 'xor2', target: 'outSum', sourceHandle: 'out', targetHandle: 'in', animated: false },
  { id: 'e6', source: 'inA', target: 'and1', sourceHandle: 'out', targetHandle: 'a', animated: false },
  { id: 'e7', source: 'inB', target: 'and1', sourceHandle: 'out', targetHandle: 'b', animated: false },
  { id: 'e8', source: 'xor1', target: 'and2', sourceHandle: 'out', targetHandle: 'a', animated: false },
  { id: 'e9', source: 'inCin', target: 'and2', sourceHandle: 'out', targetHandle: 'b', animated: false },
  { id: 'e10', source: 'and1', target: 'or1', sourceHandle: 'out', targetHandle: 'a', animated: false },
  { id: 'e11', source: 'and2', target: 'or1', sourceHandle: 'out', targetHandle: 'b', animated: false },
  { id: 'e12', source: 'or1', target: 'outCout', sourceHandle: 'out', targetHandle: 'in', animated: false },
];

const sramNodes: Node[] = [
  { id: 'inD', type: 'input', position: { x: 50, y: 100 }, data: { label: 'Data (D)', value: 0 } },
  { id: 'inWE', type: 'input', position: { x: 50, y: 250 }, data: { label: 'Write (WE)', value: 0 } },
  { id: 'not1', type: 'gate', position: { x: 200, y: 150 }, data: { type: 'NOT', value: 0 } },
  { id: 'and1', type: 'gate', position: { x: 350, y: 80 }, data: { type: 'AND', value: 0 } },
  { id: 'and2', type: 'gate', position: { x: 350, y: 200 }, data: { type: 'AND', value: 0 } },
  { id: 'nor1', type: 'gate', position: { x: 550, y: 100 }, data: { type: 'NOR', value: 0 } },
  { id: 'nor2', type: 'gate', position: { x: 550, y: 250 }, data: { type: 'NOR', value: 0 } },
  { id: 'outQ', type: 'output', position: { x: 750, y: 100 }, data: { label: 'Q', value: 0 } },
];

const sramEdges: Edge[] = [
  { id: 'e1', source: 'inD', target: 'and1', sourceHandle: 'out', targetHandle: 'a', animated: false },
  { id: 'e2', source: 'inWE', target: 'and1', sourceHandle: 'out', targetHandle: 'b', animated: false },
  { id: 'e3', source: 'inD', target: 'not1', sourceHandle: 'out', targetHandle: 'in', animated: false },
  { id: 'e4', source: 'not1', target: 'and2', sourceHandle: 'out', targetHandle: 'a', animated: false },
  { id: 'e5', source: 'inWE', target: 'and2', sourceHandle: 'out', targetHandle: 'b', animated: false },
  { id: 'e6', source: 'and2', target: 'nor1', sourceHandle: 'out', targetHandle: 'a', animated: false },
  { id: 'e7', source: 'nor2', target: 'nor1', sourceHandle: 'out', targetHandle: 'b', animated: false },
  { id: 'e8', source: 'and1', target: 'nor2', sourceHandle: 'out', targetHandle: 'a', animated: false },
  { id: 'e9', source: 'nor1', target: 'nor2', sourceHandle: 'out', targetHandle: 'b', animated: false },
  { id: 'e10', source: 'nor1', target: 'outQ', sourceHandle: 'out', targetHandle: 'in', animated: false },
];

const MiniSim = ({ type, onClose }: { type: string, onClose: () => void }) => {
  const initNodes = type === 'adder8' ? adderNodes : sramNodes;
  const initEdges = type === 'adder8' ? adderEdges : sramEdges;

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);

  // Bind onChange to inputs
  useEffect(() => {
    const handleNodeChange = (id: string, val: number) => {
      setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, value: val } } : n));
    };
    setNodes(nds => nds.map(n => n.type === 'input' ? { ...n, data: { ...n.data, onChange: handleNodeChange } } : n));
  }, [setNodes]);

  useEffect(() => {
    const simulate = () => {
      let changed = false;
      const newNodes = [...nodes];

      const getInputValue = (targetId: string, targetHandle: string) => {
        const edge = edges.find(e => e.target === targetId && e.targetHandle === targetHandle);
        if (!edge) return 0;
        const sourceNode = newNodes.find(n => n.id === edge.source);
        if (!sourceNode) return 0;
        return sourceNode.data.value || 0;
      };

      newNodes.forEach((node, index) => {
        if (node.type === 'output') {
          const val = getInputValue(node.id, 'in');
          if (node.data.value !== val) {
            newNodes[index] = { ...node, data: { ...node.data, value: val } };
            changed = true;
          }
        } else if (node.type === 'gate') {
          const gateType = node.data.type as keyof typeof logicGates;
          let val: Bit = 0;
          if (gateType === 'NOT') {
            val = logicGates.NOT(getInputValue(node.id, 'in') as Bit);
          } else {
            val = logicGates[gateType](getInputValue(node.id, 'a') as Bit, getInputValue(node.id, 'b') as Bit);
          }
          if (node.data.value !== val) {
            newNodes[index] = { ...node, data: { ...node.data, value: val } };
            changed = true;
          }
        }
      });

      if (changed) setNodes(newNodes);

      setEdges(eds => eds.map(edge => {
        const sourceNode = newNodes.find(n => n.id === edge.source);
        const isActive = sourceNode?.data.value === 1;
        const strokeColor = isActive ? '#60a5fa' : '#475569';
        if (edge.animated !== isActive || edge.style?.stroke !== strokeColor) {
          return { ...edge, animated: isActive, style: { ...edge.style, stroke: strokeColor, strokeWidth: isActive ? 3 : 2 } };
        }
        return edge;
      }));
    };

    const interval = setInterval(simulate, 50);
    return () => clearInterval(interval);
  }, [nodes, edges, setNodes, setEdges]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-8">
      <div className="bg-slate-900 w-full h-full max-w-6xl max-h-[800px] rounded-xl border border-slate-700 flex flex-col overflow-hidden shadow-2xl relative">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            {type === 'adder8' ? <><Plus size={20} className="text-blue-400"/> Circuit Interne : Full Adder (1-bit)</> : <><MemoryStick size={20} className="text-amber-400"/> Circuit Interne : Cellule SRAM (D-Latch 1-bit)</>}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors">
            <X size={24} />
          </button>
        </div>
        <div className="flex-1 relative bg-slate-950">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background color="#334155" gap={16} />
            <Controls className="bg-slate-800 border-slate-700 fill-white" />
          </ReactFlow>
        </div>
        <div className="p-4 bg-slate-800 border-t border-slate-700 text-sm text-slate-300">
          {type === 'adder8' 
            ? "Un additionneur 8-bit est composé de 8 blocs comme celui-ci (Full Adder) chaînés ensemble. La retenue sortante (Cout) de l'un est connectée à la retenue entrante (Cin) du suivant."
            : "Une mémoire SRAM 256x8 contient 2048 cellules comme celle-ci (D-Latch), organisées en grille. Un décodeur d'adresse active le signal WE (Write Enable) uniquement pour les 8 cellules correspondant à l'adresse sélectionnée."}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isRunning, setIsRunning] = useState(true);
  const [inspecting, setInspecting] = useState<string | null>(null);

  useEffect(() => {
    const handleInspect = (e: any) => setInspecting(e.detail);
    window.addEventListener('inspect-node', handleInspect);
    return () => window.removeEventListener('inspect-node', handleInspect);
  }, []);

  // --- Simulation Engine ---
  useEffect(() => {
    if (!isRunning) return;

    const simulate = () => {
      setNodes((nds) => {
        const newNodes = [...nds];
        let changed = false;

        // Helper to get value from a connected source
        const getInputValue = (targetNodeId: string, targetHandleId: string): Bit => {
          const edge = edges.find(e => e.target === targetNodeId && e.targetHandle === targetHandleId);
          if (!edge) return 0;
          
          const sourceNode = newNodes.find(n => n.id === edge.source);
          if (!sourceNode) return 0;

          if (sourceNode.type === 'input') return sourceNode.data.value as Bit;
          if (sourceNode.type === 'gate') return sourceNode.data.value as Bit;
          if (sourceNode.type === 'adder8') {
            if (edge.sourceHandle === 'cout') return sourceNode.data.cout as Bit;
            if (edge.sourceHandle?.startsWith('s')) {
              const idx = parseInt(edge.sourceHandle.replace('s', ''));
              return (sourceNode.data.sum?.[idx] || 0) as Bit;
            }
          }
          if (sourceNode.type === 'sram8') {
            if (edge.sourceHandle?.startsWith('q')) {
              const idx = parseInt(edge.sourceHandle.replace('q', ''));
              return (sourceNode.data.q?.[idx] || 0) as Bit;
            }
          }
          if (sourceNode.type === 'bus8') {
            if (edge.sourceHandle?.startsWith('out')) {
              const idx = parseInt(edge.sourceHandle.replace('out', ''));
              return (sourceNode.data.val?.[idx] || 0) as Bit;
            }
          }
          if (sourceNode.type === 'inputNumber') {
            if (edge.sourceHandle?.startsWith('out')) {
              const idx = parseInt(edge.sourceHandle.replace('out', ''));
              return ((sourceNode.data.value || 0) & (1 << idx)) ? 1 : 0;
            }
          }
          return 0;
        };

        // Update each node based on its inputs
        newNodes.forEach((node, index) => {
          if (node.type === 'output') {
            const val = getInputValue(node.id, 'in');
            if (node.data.value !== val) {
              newNodes[index] = { ...node, data: { ...node.data, value: val } };
              changed = true;
            }
          } 
          else if (node.type === 'gate') {
            const type = node.data.type as keyof typeof logicGates;
            let val: Bit = 0;
            if (type === 'NOT') {
              val = logicGates.NOT(getInputValue(node.id, 'in'));
            } else {
              val = logicGates[type](getInputValue(node.id, 'a'), getInputValue(node.id, 'b'));
            }
            if (node.data.value !== val) {
              newNodes[index] = { ...node, data: { ...node.data, value: val } };
              changed = true;
            }
          }
          else if (node.type === 'adder8') {
            const a: Bit[] = Array(8).fill(0).map((_, i) => getInputValue(node.id, `a${i}`));
            const b: Bit[] = Array(8).fill(0).map((_, i) => getInputValue(node.id, `b${i}`));
            const cin = getInputValue(node.id, 'cin');
            
            const { sum, cout } = add8(a, b, cin);
            
            // Check if changed
            const sumChanged = sum.some((s, i) => s !== node.data.sum?.[i]);
            if (sumChanged || cout !== node.data.cout) {
              newNodes[index] = { ...node, data: { ...node.data, sum, cout } };
              changed = true;
            }
          }
          else if (node.type === 'sram8') {
            let addr = 0;
            for (let i = 0; i < 8; i++) {
              if (getInputValue(node.id, `a${i}`)) addr |= (1 << i);
            }
            
            let dataIn = 0;
            for (let i = 0; i < 8; i++) {
              if (getInputValue(node.id, `d${i}`)) dataIn |= (1 << i);
            }
            
            const we = getInputValue(node.id, 'we');
            
            const memory = node.data.memory ? [...node.data.memory] : Array(256).fill(0);
            let memChanged = false;
            
            if (we === 1) {
              if (memory[addr] !== dataIn) {
                memory[addr] = dataIn;
                memChanged = true;
              }
            }
            
            const currentQ = memory[addr];
            const qArr = Array(8).fill(0).map((_, i) => (currentQ & (1 << i)) ? 1 : 0);
            
            const qChanged = node.data.q?.some((v: Bit, i: number) => v !== qArr[i]) || !node.data.q;
            const addrChanged = node.data.currentAddress !== addr;
            
            if (memChanged || qChanged || addrChanged) {
              newNodes[index] = { 
                ...node, 
                data: { ...node.data, memory, q: qArr, currentAddress: addr } 
              };
              changed = true;
            }
          }
          else if (node.type === 'bus8') {
            const val: Bit[] = Array(8).fill(0).map((_, i) => getInputValue(node.id, `in${i}`));
            const valChanged = val.some((v, i) => v !== node.data.val?.[i]);
            if (valChanged) {
              newNodes[index] = { ...node, data: { ...node.data, val } };
              changed = true;
            }
          }
          else if (node.type === 'outputNumber') {
            let val = 0;
            for (let i = 0; i < 8; i++) {
              if (getInputValue(node.id, `in${i}`)) {
                val |= (1 << i);
              }
            }
            if (node.data.value !== val) {
              newNodes[index] = { ...node, data: { ...node.data, value: val } };
              changed = true;
            }
          }
        });

        return changed ? newNodes : nds;
      });

      // Update edge animations based on state
      setEdges((eds) => 
        eds.map(edge => {
          const sourceNode = nodes.find(n => n.id === edge.source);
          let isActive = false;
          
          if (sourceNode) {
            if (sourceNode.type === 'input' || sourceNode.type === 'gate') {
              isActive = sourceNode.data.value === 1;
            } else if (sourceNode.type === 'adder8') {
              if (edge.sourceHandle === 'cout') isActive = sourceNode.data.cout === 1;
              if (edge.sourceHandle?.startsWith('s')) {
                const idx = parseInt(edge.sourceHandle.replace('s', ''));
                isActive = sourceNode.data.sum?.[idx] === 1;
              }
            } else if (sourceNode.type === 'sram8') {
              if (edge.sourceHandle?.startsWith('q')) {
                const idx = parseInt(edge.sourceHandle.replace('q', ''));
                isActive = sourceNode.data.q?.[idx] === 1;
              }
            } else if (sourceNode.type === 'bus8') {
              if (edge.sourceHandle?.startsWith('out')) {
                const idx = parseInt(edge.sourceHandle.replace('out', ''));
                isActive = sourceNode.data.val?.[idx] === 1;
              }
            } else if (sourceNode.type === 'inputNumber') {
              if (edge.sourceHandle?.startsWith('out')) {
                const idx = parseInt(edge.sourceHandle.replace('out', ''));
                const val = Number(sourceNode.data.value) || 0;
                isActive = (val & (1 << idx)) !== 0;
              }
            }
          }

          const strokeColor = isActive ? '#60a5fa' : '#475569'; // blue-400 : slate-600
          
          if (edge.animated !== isActive || edge.style?.stroke !== strokeColor) {
            return { 
              ...edge, 
              animated: isActive,
              style: { ...edge.style, stroke: strokeColor, strokeWidth: isActive ? 3 : 2 }
            };
          }
          return edge;
        })
      );
    };

    const interval = setInterval(simulate, 50); // 20Hz simulation
    return () => clearInterval(interval);
  }, [edges, nodes, isRunning]);

  // --- Handlers ---
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: false, style: { stroke: '#475569', strokeWidth: 2 } } as Edge, eds)),
    [setEdges],
  );

  const handleInputChange = useCallback((id: string, newValue: Bit) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, value: newValue } };
        }
        return node;
      })
    );
  }, [setNodes]);

  // Inject the onChange handler into input nodes
  const nodesWithHandlers = useMemo(() => {
    return nodes.map(node => {
      if (node.type === 'input' || node.type === 'inputNumber') {
        return { ...node, data: { ...node.data, onChange: handleInputChange } };
      }
      return node;
    });
  }, [nodes, handleInputChange]);

  const addNode = (type: string, specificType?: string) => {
    const id = uuidv4();
    const position = { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 };
    
    let newNode: Node;
    
    switch (type) {
      case 'input':
        newNode = { id, type, position, data: { label: `IN_${id.slice(0,4)}`, value: 0 } };
        break;
      case 'output':
        newNode = { id, type, position, data: { label: `OUT_${id.slice(0,4)}`, value: 0 } };
        break;
      case 'gate':
        newNode = { id, type, position, data: { type: specificType, value: 0 } };
        break;
      case 'adder8':
        newNode = { id, type, position, data: { sum: Array(8).fill(0), cout: 0 } };
        break;
      case 'sram8':
        newNode = { id, type, position, data: { memory: Array(256).fill(0), q: Array(8).fill(0), currentAddress: 0 } };
        break;
      case 'bus8':
        newNode = { id, type, position, data: { val: Array(8).fill(0) } };
        break;
      case 'inputNumber':
        newNode = { id, type, position, data: { label: `NUM_IN`, value: 0 } };
        break;
      case 'outputNumber':
        newNode = { id, type, position, data: { label: `NUM_OUT`, value: 0 } };
        break;
      default:
        return;
    }
    
    setNodes((nds) => [...nds, newNode]);
  };

  const clearCanvas = () => {
    setNodes([]);
    setEdges([]);
  };

  return (
    <div className="h-screen w-full flex flex-col bg-slate-950 text-slate-200 font-sans">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 h-14 flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
            <Cpu size={20} className="text-white" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-white">Logique & Systèmes</h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsRunning(!isRunning)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${isRunning ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
          >
            {isRunning ? <><Play size={16} /> En cours</> : <><Square size={16} /> En pause</>}
          </button>
          <button onClick={clearCanvas} className="text-slate-400 hover:text-red-400 transition-colors" title="Tout effacer">
            <Trash2 size={18} />
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex relative">
        {inspecting && <MiniSim type={inspecting} onClose={() => setInspecting(null)} />}
        {/* Sidebar / Toolbar */}
        <div className="w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col gap-6 overflow-y-auto z-10">
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">I/O Simples</h3>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => addNode('input')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded p-2 text-sm flex flex-col items-center gap-1 transition-colors">
                <Square size={16} className="text-blue-400" /> Switch
              </button>
              <button onClick={() => addNode('output')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded p-2 text-sm flex flex-col items-center gap-1 transition-colors">
                <Circle size={16} className="text-green-400" /> LED
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">I/O 8-bit</h3>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => addNode('inputNumber')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded p-2 text-sm flex flex-col items-center gap-1 transition-colors">
                <span className="font-mono text-blue-400 font-bold text-lg leading-none">123</span>
                <span className="text-[10px]">Num In</span>
              </button>
              <button onClick={() => addNode('outputNumber')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded p-2 text-sm flex flex-col items-center gap-1 transition-colors">
                <span className="font-mono text-green-400 font-bold text-lg leading-none">123</span>
                <span className="text-[10px]">Num Out</span>
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Portes Logiques</h3>
            <div className="grid grid-cols-2 gap-2">
              {['AND', 'OR', 'XOR', 'NAND', 'NOR', 'NOT'].map(gate => (
                <button 
                  key={gate}
                  onClick={() => addNode('gate', gate)} 
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded p-2 text-sm font-mono font-bold transition-colors"
                >
                  {gate}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Modules Complexes</h3>
            <div className="flex flex-col gap-2">
              <button onClick={() => addNode('adder8')} className="bg-slate-800 hover:bg-slate-700 border border-blue-900/50 rounded p-3 text-sm flex items-center gap-3 transition-colors">
                <Cpu size={18} className="text-blue-400" /> 
                <span className="font-bold">Additionneur 8-bit</span>
              </button>
              <button onClick={() => addNode('sram8')} className="bg-slate-800 hover:bg-slate-700 border border-amber-900/50 rounded p-3 text-sm flex items-center gap-3 transition-colors">
                <MemoryStick size={18} className="text-amber-400" /> 
                <span className="font-bold">SRAM 8-bit</span>
              </button>
              <button onClick={() => addNode('bus8')} className="bg-slate-800 hover:bg-slate-700 border border-slate-500/50 rounded p-3 text-sm flex items-center gap-3 transition-colors">
                <div className="flex flex-col gap-[2px]">
                  {[1,2,3].map(i => <div key={i} className="w-4 h-[2px] bg-slate-400"></div>)}
                </div>
                <span className="font-bold">Bus 8-bit</span>
              </button>
            </div>
          </div>
          
          <div className="mt-auto pt-4 border-t border-slate-800">
             <p className="text-xs text-slate-500 leading-relaxed">
               Glissez pour connecter les points. Cliquez sur un fil puis appuyez sur Retour Arrière pour le supprimer.
             </p>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 h-full bg-slate-950">
          <ReactFlow
            nodes={nodesWithHandlers}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            className="bg-slate-950"
            colorMode="dark"
          >
            <Background color="#334155" gap={20} size={1} />
            <Controls className="bg-slate-800 border-slate-700 fill-slate-300" />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

