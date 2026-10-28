import { useEffect, useState } from "react";
import { uiStore } from "./ui";

function DevtoolPanel() {
  const [state, setState] = useState(uiStore.state);
  useEffect(() => {
    const sub = uiStore.subscribe(() => setState(uiStore.state));
    return () => {
      sub.unsubscribe();
    };
  }, []);
  return (
    <div className="grid grid-cols-[1fr_2fr] gap-2 p-3 text-xs">
      <strong>theme</strong>
      <span>{state.theme}</span>
      <strong>historyOpen</strong>
      <span>{String(state.historyOpen)}</span>
      <strong>infoOpen</strong>
      <span>{String(state.infoOpen)}</span>
      <strong>toast</strong>
      <span>{state.toast ?? "—"}</span>
    </div>
  );
}

export default {
  name: "TanStack Store",
  render: <DevtoolPanel />,
};
