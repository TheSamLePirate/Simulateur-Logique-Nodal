import type { CPU } from "../../cpu/cpu";

interface KeyboardTargetLike {
  tagName?: string | null;
  isContentEditable?: boolean | null;
}

interface RunningKeyboardEventLike {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  target?: KeyboardTargetLike | null;
}

const KEY_INDEX: Record<string, number> = {
  ArrowLeft: 0,
  ArrowRight: 1,
  ArrowUp: 2,
  ArrowDown: 3,
  Enter: 4,
};

const IMMEDIATE_INPUT_KEYS: Record<string, number> = {
  Backspace: 8,
  Tab: 9,
  Escape: 27,
  Delete: 127,
};

function isEditableTarget(target?: KeyboardTargetLike | null): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName?.toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function handleRunningKeyboardDown(
  cpu: CPU,
  event: RunningKeyboardEventLike,
): boolean {
  if (isEditableTarget(event.target)) {
    return false;
  }

  const index = KEY_INDEX[event.key];
  if (index !== undefined) {
    cpu.keyState[index] = 1;
    if (event.key === "Enter") {
      cpu.pushInput(10);
    }
    return true;
  }

  if (event.altKey || event.ctrlKey || event.metaKey) {
    return false;
  }

  const immediateInput = IMMEDIATE_INPUT_KEYS[event.key];
  if (immediateInput !== undefined) {
    cpu.pushInput(immediateInput);
    return true;
  }

  if (event.key.length === 1) {
    cpu.pushInput(event.key.charCodeAt(0));
    return true;
  }

  return false;
}

export function handleRunningKeyboardUp(
  cpu: CPU,
  event: Pick<RunningKeyboardEventLike, "key">,
): boolean {
  const index = KEY_INDEX[event.key];
  if (index === undefined) {
    return false;
  }
  cpu.keyState[index] = 0;
  return true;
}
