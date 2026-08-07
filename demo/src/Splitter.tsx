import { useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";

const MIN = 15;
const MAX = 85;

const clamp = (percent: number) => Math.min(MAX, Math.max(MIN, percent));

export interface SplitterProps {
  /** `col` moves the vertical divider, `row` the horizontal one. */
  axis: "col" | "row";
  /** Current position, as a percentage of the container. */
  value: number;
  onChange: (next: number) => void;
  containerRef: RefObject<HTMLDivElement | null>;
}

/**
 * A draggable edge between panels. Also focusable: arrow keys nudge it,
 * shift+arrow moves in bigger steps, and a double click recentres it.
 */
export function Splitter({ axis, value, onChange, containerRef }: SplitterProps) {
  const [dragging, setDragging] = useState(false);

  const moveTo = (event: PointerEvent<HTMLDivElement>) => {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return;

    const percent =
      axis === "col"
        ? ((event.clientX - box.left) / box.width) * 100
        : ((event.clientY - box.top) / box.height) * 100;

    onChange(clamp(percent));
  };

  const start = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add("is-resizing");
    setDragging(true);
  };

  const stop = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    document.body.classList.remove("is-resizing");
    setDragging(false);
  };

  const nudge = (event: KeyboardEvent<HTMLDivElement>) => {
    const [back, forward] =
      axis === "col" ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
    if (event.key !== back && event.key !== forward) return;

    event.preventDefault();
    const step = (event.shiftKey ? 10 : 2) * (event.key === back ? -1 : 1);
    onChange(clamp(value + step));
  };

  return (
    <div
      className={`splitter splitter--${axis}${dragging ? " is-dragging" : ""}`}
      role="separator"
      aria-orientation={axis === "col" ? "vertical" : "horizontal"}
      aria-label={axis === "col" ? "Resize columns" : "Resize rows"}
      aria-valuenow={Math.round(value)}
      aria-valuemin={MIN}
      aria-valuemax={MAX}
      tabIndex={0}
      onPointerDown={start}
      onPointerMove={(event) => dragging && moveTo(event)}
      onPointerUp={stop}
      onPointerCancel={stop}
      onDoubleClick={() => onChange(50)}
      onKeyDown={nudge}
    />
  );
}
