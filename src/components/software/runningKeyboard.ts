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

  if (event.key === "Backspace") {
    cpu.pushInput(8);
    return true;
  }

  if (event.key === "Tab") {
    cpu.pushInput(9);
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
