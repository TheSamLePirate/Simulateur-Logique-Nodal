import {
  Calculator,
  ChevronDown,
  Circle,
  Clock,
  Cpu,
  Database,
  FolderOpen,
  GitFork,
  Globe,
  Grid3X3,
  HardDrive,
  Keyboard,
  Layout,
  MemoryStick,
  Package,
  Save,
  Square,
  Terminal,
  Trash2,
} from "lucide-react";

import { PREBUILT_MODULES } from "../../data/prebuiltModules";
import type { SavedModule, ScenePreset } from "../../types";
import type { AppNodeType } from "../../app/nodeFactories";

interface HardwareSidebarProps {
  scenesOpen: boolean;
  allScenes: ScenePreset[];
  savedModules: SavedModule[];
  onToggleScenes: () => void;
  onLoadScene: (scene: ScenePreset) => void;
  onDeleteScene: (sceneId: string) => void;
  onSaveScene: () => void;
  onAddNode: (type: AppNodeType, specificType?: string) => void;
  onInstantiateModule: (module: SavedModule) => void;
  onDeleteModule: (moduleId: string) => void;
}

export function HardwareSidebar({
  scenesOpen,
  allScenes,
  savedModules,
  onToggleScenes,
  onLoadScene,
  onDeleteScene,
  onSaveScene,
  onAddNode,
  onInstantiateModule,
  onDeleteModule,
}: HardwareSidebarProps) {
  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col gap-6 overflow-y-auto z-10">
      <div>
        <button
          onClick={onToggleScenes}
          className="w-full flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 hover:text-slate-300 transition-colors"
        >
          <span>
            <Layout size={12} className="inline mr-1.5 -mt-0.5" />
            Scènes
          </span>
          <ChevronDown
            size={14}
            className={`transition-transform ${scenesOpen ? "rotate-0" : "-rotate-90"}`}
          />
        </button>
        {scenesOpen && (
          <div className="flex flex-col gap-2 mt-2">
            {allScenes.map((scene) => (
              <div
                key={scene.id}
                className="bg-slate-800 hover:bg-slate-700 border border-yellow-900/50 rounded p-2.5 text-sm flex items-center gap-2 transition-colors group"
              >
                <FolderOpen size={14} className="text-yellow-400 shrink-0" />
                <button
                  onClick={() => onLoadScene(scene)}
                  className="font-bold truncate text-left flex-1"
                  title={`Charger « ${scene.name} »`}
                >
                  {scene.name}
                </button>
                {!scene.builtIn && (
                  <button
                    onClick={() => onDeleteScene(scene.id)}
                    className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    title="Supprimer cette scène"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={onSaveScene}
              className="bg-slate-800/50 hover:bg-slate-700 border border-dashed border-yellow-900/50 rounded p-2 text-xs flex items-center justify-center gap-1.5 transition-colors text-slate-400 hover:text-yellow-400"
            >
              <Save size={12} /> Sauvegarder la scène
            </button>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          I/O Simples
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onAddNode("input")}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded p-2 text-sm flex flex-col items-center gap-1 transition-colors"
          >
            <Square size={16} className="text-blue-400" /> Switch
          </button>
          <button
            onClick={() => onAddNode("output")}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded p-2 text-sm flex flex-col items-center gap-1 transition-colors"
          >
            <Circle size={16} className="text-green-400" /> LED
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          I/O 8-bit
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onAddNode("inputNumber")}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded p-2 text-sm flex flex-col items-center gap-1 transition-colors"
          >
            <span className="font-mono text-blue-400 font-bold text-lg leading-none">
              123
            </span>
            <span className="text-[10px]">Num In</span>
          </button>
          <button
            onClick={() => onAddNode("outputNumber")}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded p-2 text-sm flex flex-col items-center gap-1 transition-colors"
          >
            <span className="font-mono text-green-400 font-bold text-lg leading-none">
              123
            </span>
            <span className="text-[10px]">Num Out</span>
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Portes Logiques
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {["AND", "OR", "XOR", "NAND", "NOR", "NOT"].map((gate) => (
            <button
              key={gate}
              onClick={() => onAddNode("gate", gate)}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded p-2 text-sm font-mono font-bold transition-colors"
            >
              {gate}
            </button>
          ))}
          <button
            onClick={() => onAddNode("transistor", "nmos")}
            className="bg-slate-800 hover:bg-slate-700 border border-amber-900/50 rounded p-2 text-sm font-mono font-bold transition-colors"
            title="Transistor actif quand GATE = 1"
          >
            NMOS
          </button>
          <button
            onClick={() => onAddNode("transistor", "pmos")}
            className="bg-slate-800 hover:bg-slate-700 border border-rose-900/50 rounded p-2 text-sm font-mono font-bold transition-colors"
            title="Transistor actif quand GATE = 0"
          >
            PMOS
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Modules Intégrés
        </h3>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onAddNode("adder8")}
            className="bg-slate-800 hover:bg-slate-700 border border-blue-900/50 rounded p-3 text-sm flex items-center gap-3 transition-colors"
          >
            <Cpu size={18} className="text-blue-400" />
            <span className="font-bold">Additionneur 8-bit</span>
          </button>
          <button
            onClick={() => onAddNode("sram8")}
            className="bg-slate-800 hover:bg-slate-700 border border-amber-900/50 rounded p-3 text-sm flex items-center gap-3 transition-colors"
          >
            <MemoryStick size={18} className="text-amber-400" />
            <span className="font-bold">SRAM 8-bit</span>
          </button>
          <button
            onClick={() => onAddNode("bus8")}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-500/50 rounded p-3 text-sm flex items-center gap-3 transition-colors"
          >
            <div className="flex flex-col gap-[2px]">
              {[1, 2, 3].map((index) => (
                <div key={index} className="w-4 h-[2px] bg-slate-400"></div>
              ))}
            </div>
            <span className="font-bold">Bus 8-bit</span>
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Composants CPU
        </h3>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onAddNode("clock")}
            className="bg-slate-800 hover:bg-slate-700 border border-green-900/50 rounded p-3 text-sm flex items-center gap-3 transition-colors"
          >
            <Clock size={18} className="text-green-400" />
            <span className="font-bold">Horloge</span>
          </button>
          <button
            onClick={() => onAddNode("register8")}
            className="bg-slate-800 hover:bg-slate-700 border border-cyan-900/50 rounded p-3 text-sm flex items-center gap-3 transition-colors"
          >
            <Database size={18} className="text-cyan-400" />
            <span className="font-bold">Registre 8-bit</span>
          </button>
          <button
            onClick={() => onAddNode("alu8")}
            className="bg-slate-800 hover:bg-slate-700 border border-orange-900/50 rounded p-3 text-sm flex items-center gap-3 transition-colors"
          >
            <Calculator size={18} className="text-orange-400" />
            <span className="font-bold">ALU 8-bit</span>
          </button>
          <button
            onClick={() => onAddNode("mux8")}
            className="bg-slate-800 hover:bg-slate-700 border border-indigo-900/50 rounded p-3 text-sm flex items-center gap-3 transition-colors"
          >
            <GitFork size={18} className="text-indigo-400" />
            <span className="font-bold">MUX 8-bit</span>
          </button>
          <button
            onClick={() => onAddNode("console")}
            className="bg-slate-800 hover:bg-slate-700 border border-emerald-900/50 rounded p-3 text-sm flex items-center gap-3 transition-colors"
          >
            <Terminal size={18} className="text-emerald-400" />
            <span className="font-bold">Console</span>
          </button>
          <button
            onClick={() => onAddNode("plotter")}
            className="bg-slate-800 hover:bg-slate-700 border border-cyan-900/50 rounded p-3 text-sm flex items-center gap-3 transition-colors"
          >
            <Grid3X3 size={18} className="text-cyan-400" />
            <span className="font-bold">Plotter</span>
          </button>
          <button
            onClick={() => onAddNode("keyboard")}
            className="bg-slate-800 hover:bg-slate-700 border border-violet-900/50 rounded p-3 text-sm flex items-center gap-3 transition-colors"
          >
            <Keyboard size={18} className="text-violet-400" />
            <span className="font-bold">Keyboard</span>
          </button>
          <button
            onClick={() => onAddNode("drive")}
            className="bg-slate-800 hover:bg-slate-700 border border-amber-900/50 rounded p-3 text-sm flex items-center gap-3 transition-colors"
          >
            <HardDrive size={18} className="text-amber-400" />
            <span className="font-bold">External Drive</span>
          </button>
          <button
            onClick={() => onAddNode("network")}
            className="bg-slate-800 hover:bg-slate-700 border border-sky-900/50 rounded p-3 text-sm flex items-center gap-3 transition-colors"
          >
            <Globe size={18} className="text-sky-400" />
            <span className="font-bold">Network Controller</span>
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Modules Logiques
        </h3>
        <div className="flex flex-col gap-2">
          {PREBUILT_MODULES.map((module) => (
            <button
              key={module.id}
              onClick={() => onInstantiateModule(module)}
              className="bg-slate-800 hover:bg-slate-700 border border-purple-900/50 rounded p-3 text-sm flex items-center gap-3 transition-colors"
              title={`Ajouter un ${module.label}`}
            >
              <Package size={16} className="text-purple-400" />
              <span className="font-bold text-left truncate">{module.label}</span>
            </button>
          ))}
        </div>
      </div>

      {savedModules.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            Mes Modules
          </h3>
          <div className="flex flex-col gap-2">
            {savedModules.map((module) => (
              <div
                key={module.id}
                className="bg-slate-800 hover:bg-slate-700 border border-purple-900/50 rounded p-3 text-sm flex items-center gap-2 transition-colors group"
              >
                <Package size={16} className="text-purple-400 shrink-0" />
                <button
                  onClick={() => onInstantiateModule(module)}
                  className="font-bold truncate text-left flex-1"
                  title={`Ajouter un ${module.label}`}
                >
                  {module.label}
                </button>
                <button
                  onClick={() => onDeleteModule(module.id)}
                  className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                  title="Supprimer ce module"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto pt-4 border-t border-slate-800">
        <p className="text-xs text-slate-500 leading-relaxed">
          Glissez pour connecter les points. Cliquez sur un fil puis appuyez sur
          Retour Arrière pour le supprimer. Sélectionnez des noeuds et appuyez
          sur Ctrl+G pour grouper.
        </p>
      </div>
    </div>
  );
}
