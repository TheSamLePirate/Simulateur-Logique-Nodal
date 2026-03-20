import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

export function useStoredState<T>(
  key: string,
  fallbackValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : fallbackValue;
    } catch {
      return fallbackValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or unavailable, ignore
    }
  }, [key, value]);

  return [value, setValue];
}
