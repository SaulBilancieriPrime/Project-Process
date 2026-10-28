import type { WheelEvent } from "react";

/** Stop wheel from bubbling to the graph zoom trap (page scroll is disabled app-wide). */
export function handleOverlayWheel(event: WheelEvent<HTMLElement>) {
  event.stopPropagation();
}
