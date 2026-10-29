export type PortaledMenuPos = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

const GAP = 4;
const PREFERRED_HEIGHT = 280;
const MIN_HEIGHT = 120;

function stackBelowOrAbove(trigger: DOMRect, preferred: number): PortaledMenuPos {
  const spaceBelow = window.innerHeight - trigger.bottom - GAP;
  const spaceAbove = trigger.top - GAP;
  const width = trigger.width;
  const left = trigger.left;

  if (spaceBelow >= preferred || spaceBelow >= spaceAbove) {
    const maxHeight = Math.min(preferred, Math.max(MIN_HEIGHT, spaceBelow));
    return { top: trigger.bottom + GAP, left, width, maxHeight };
  }

  const maxHeight = Math.min(preferred, Math.max(MIN_HEIGHT, spaceAbove));
  return {
    top: Math.max(GAP, trigger.top - maxHeight - GAP),
    left,
    width,
    maxHeight,
  };
}

/** Left-rail menus open to the right of the rail at the trigger's Y; others stack under/over the field. */
export function placePortaledMenu(triggerEl: HTMLElement, preferred = PREFERRED_HEIGHT): PortaledMenuPos {
  const trigger = triggerEl.getBoundingClientRect();
  const rail = triggerEl.closest(".site-left-rail")?.getBoundingClientRect();
  if (rail) {
    const left = rail.right + GAP;
    if (left + trigger.width <= window.innerWidth - GAP) {
      const spaceBelow = window.innerHeight - trigger.top - GAP;
      if (spaceBelow >= MIN_HEIGHT) {
        return {
          top: trigger.top,
          left,
          width: trigger.width,
          maxHeight: Math.min(preferred, spaceBelow),
        };
      }
      const maxHeight = Math.min(preferred, window.innerHeight - GAP * 2);
      return {
        top: Math.max(GAP, window.innerHeight - GAP - maxHeight),
        left,
        width: trigger.width,
        maxHeight,
      };
    }
  }
  return stackBelowOrAbove(trigger, preferred);
}

export const portaledMenuShellClass =
  "fixed z-[120] flex h-max flex-col overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--card)] shadow-[var(--shadow)]";

export const portaledMenuListClass = "m-0 max-h-44 min-h-0 list-none overflow-y-auto p-1";
