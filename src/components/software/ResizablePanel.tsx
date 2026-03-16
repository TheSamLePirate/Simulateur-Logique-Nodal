import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

interface ResizablePanelProps {
  direction: "horizontal" | "vertical";
  initialRatio?: number;
  minRatio?: number;
  maxRatio?: number;
  first: ReactNode;
  second: ReactNode;
  className?: string;
}

export function ResizablePanel({
  direction,
  initialRatio = 0.5,
  minRatio = 0.15,
  maxRatio = 0.85,
  first,
  second,
  className = "",
}: ResizablePanelProps) {
  const [ratio, setRatio] = useState(initialRatio);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const isHorizontal = direction === "horizontal";

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      document.body.style.cursor = isHorizontal ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    },
    [isHorizontal],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      let newRatio: number;
      if (isHorizontal) {
        newRatio = (e.clientX - rect.left) / rect.width;
      } else {
        newRatio = (e.clientY - rect.top) / rect.height;
      }
      newRatio = Math.max(minRatio, Math.min(maxRatio, newRatio));
      setRatio(newRatio);
    };

    const handleMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isHorizontal, minRatio, maxRatio]);

  const firstStyle = isHorizontal
    ? { width: `${ratio * 100}%`, height: "100%" }
    : { height: `${ratio * 100}%`, width: "100%" };

  return (
    <div
      ref={containerRef}
      className={`flex ${isHorizontal ? "flex-row" : "flex-col"} ${className}`}
      style={{ overflow: "hidden" }}
    >
      {/* First panel */}
      <div className="overflow-hidden" style={{ ...firstStyle, flexShrink: 0 }}>
        {first}
      </div>

      {/* Drag handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`shrink-0 flex items-center justify-center group ${
          isHorizontal
            ? "w-1.5 cursor-col-resize hover:bg-blue-500/20"
            : "h-1.5 cursor-row-resize hover:bg-blue-500/20"
        } transition-colors`}
      >
        <div
          className={`rounded-full bg-slate-700 group-hover:bg-blue-400 transition-colors ${
            isHorizontal ? "w-0.5 h-8" : "h-0.5 w-8"
          }`}
        />
      </div>

      {/* Second panel */}
      <div className="flex-1 overflow-hidden min-w-0 min-h-0">{second}</div>
    </div>
  );
}
