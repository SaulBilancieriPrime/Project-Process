type Props = { open: boolean; onClose: () => void };

export default function InfoPanel({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <aside className="info-panel" role="dialog" aria-labelledby="infoTitle">
      <div className="info-head">
        <h2 id="infoTitle">How to use Project Process</h2>
        <button type="button" className="info-close" onClick={onClose}>Close</button>
      </div>
      <div className="info-body">
        <h3>Graph</h3>
        <p>This is an editable Obsidian-style graph. Scroll to zoom. Drag empty canvas to box-select nodes, then drag a selected node or the box to move them together. Hold Space or Alt and drag to pan. Drag a single node to move it — nearby nodes settle with force physics.</p>
        <h3>Edit</h3>
        <p>Click a node or a line to get Edit and Delete beside it. Edit opens the same settings as a double-click. Delete removes that node or connection. The + in the top left starts Add node (click the canvas to place it) or a link — none, one, or two arrowheads. After the first node, the link follows your cursor until the second click or Esc. Right-click a node for child, link, pin, collapse, recolor, and resize.</p>
        <h3>Zoom</h3>
        <p>The graph always stays dots. Labels stay a standard size. Turn on Cards in the bottom right and zoom in — cards appear on their own as you get closer. Enlarge in the panel scales type and bubbles.</p>
        <h3>Save</h3>
        <p>The graph writes itself to this browser as you work. Save snapshots on demand. Export / Import JSON to move a graph between machines. Sample reloads the five-level project process.</p>
      </div>
    </aside>
  );
}
