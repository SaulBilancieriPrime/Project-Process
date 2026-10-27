export default function HelpTab() {
  return (
    <div className="help-tab">
      <section>
        <h2>How to use this map</h2>
        <p>
          Project Process is an editable graph of workflows and activities. Move
          around the canvas, add or connect nodes, and save a snapshot when the
          structure is ready.
        </p>
      </section>

      <section>
        <h2>Navigate</h2>
        <figure className="help-figure">
          <svg viewBox="0 0 220 72" aria-hidden>
            <rect
              x="8"
              y="18"
              width="54"
              height="36"
              rx="8"
              fill="currentColor"
              opacity="0.12"
            />
            <text
              x="35"
              y="40"
              textAnchor="middle"
              fontSize="11"
              fill="currentColor"
            >
              Scroll
            </text>
            <path d="M72 36 H92" stroke="currentColor" strokeWidth="1.4" />
            <text
              x="155"
              y="28"
              textAnchor="middle"
              fontSize="11"
              fill="currentColor"
            >
              Zoom in / out
            </text>
            <text
              x="155"
              y="46"
              textAnchor="middle"
              fontSize="10"
              fill="currentColor"
              opacity="0.7"
            >
              Space or Alt + drag to pan
            </text>
          </svg>
          <figcaption>
            Scroll to zoom. Hold Space or Alt and drag empty canvas to pan.
            Middle-click drag also pans.
          </figcaption>
        </figure>
        <p>
          Drag empty canvas to box-select several nodes, then drag one of them
          or the box to move the group together.
        </p>
      </section>

      <section>
        <h2>Select and edit</h2>
        <ul className="help-list">
          <li>
            <strong>Click a node</strong> — select it. Shift-click adds or
            removes from the selection.
          </li>
          <li>
            <strong>Double-click a node</strong> — open the edit panel. Changes
            stay in the form until Save.
          </li>
          <li>
            <strong>Close / Save</strong> — Close if nothing changed; Save
            writes the form. While dirty, Cancel discards and the rest of the UI
            is locked.
          </li>
          <li>
            <strong>Delete</strong> — in the edit panel when there are no
            pending form changes. Keyboard Delete removes a selection only when
            you are not editing.
          </li>
          <li>
            <strong>Click a connection</strong> — select it. Double-click the
            line to edit arrows and type; Delete is in that panel.
          </li>
        </ul>
        <figure className="help-figure">
          <svg viewBox="0 0 220 78" aria-hidden>
            <circle cx="36" cy="38" r="12" fill="#5b9bd5" />
            <circle
              cx="36"
              cy="38"
              r="18"
              fill="none"
              stroke="#5b9bd5"
              strokeWidth="1.2"
              opacity="0.45"
            />
            <text
              x="36"
              y="70"
              textAnchor="middle"
              fontSize="9"
              fill="currentColor"
            >
              1× click
            </text>
            <circle cx="110" cy="38" r="12" fill="#e67e22" />
            <rect
              x="86"
              y="10"
              width="48"
              height="22"
              rx="6"
              fill="currentColor"
              opacity="0.1"
              stroke="currentColor"
            />
            <text
              x="110"
              y="25"
              textAnchor="middle"
              fontSize="8"
              fill="currentColor"
            >
              Edit node
            </text>
            <text
              x="110"
              y="70"
              textAnchor="middle"
              fontSize="9"
              fill="currentColor"
            >
              2× click
            </text>
            <path d="M160 38 H200" stroke="currentColor" strokeWidth="1.6" />
            <polygon points="200,38 193,34 193,42" fill="currentColor" />
            <text
              x="180"
              y="70"
              textAnchor="middle"
              fontSize="9"
              fill="currentColor"
            >
              Line click
            </text>
          </svg>
          <figcaption>
            Select with one click. Double-click a node or connection to open its
            edit panel.
          </figcaption>
        </figure>
      </section>

      <section>
        <h2>Add nodes and links</h2>
        <p>
          Use the <strong>+</strong> button (top left) or right-click empty
          canvas. Both open the same menu.
        </p>
        <ul className="help-list">
          <li>
            <strong>Add node</strong> — then click the canvas to place it. Esc
            cancels.
          </li>
          <li>
            <strong>No / one / two arrows</strong> — start a link, click the
            first node, then the second. The line follows the cursor after the
            first click.
          </li>
          <li>
            <strong>N</strong> — shortcut to start placing a node.
          </li>
          <li>
            <strong>Double-click empty space</strong> — shortcut to creating a node.
          </li>
        </ul>
      </section>

      <section>
        <h2>Right-click menus</h2>
        <figure className="help-figure">
          <svg viewBox="0 0 220 92" aria-hidden>
            <rect
              x="10"
              y="10"
              width="92"
              height="72"
              rx="8"
              fill="currentColor"
              opacity="0.08"
              stroke="currentColor"
            />
            <text
              x="56"
              y="28"
              textAnchor="middle"
              fontSize="9"
              fill="currentColor"
            >
              Node menu
            </text>
            <text x="22" y="46" fontSize="8" fill="currentColor">
              Add child
            </text>
            <text x="22" y="60" fontSize="8" fill="currentColor">
              Link ›
            </text>
            <text x="22" y="74" fontSize="8" fill="currentColor">
              Type ›
            </text>
            <rect
              x="118"
              y="10"
              width="92"
              height="72"
              rx="8"
              fill="currentColor"
              opacity="0.08"
              stroke="currentColor"
            />
            <text
              x="164"
              y="28"
              textAnchor="middle"
              fontSize="9"
              fill="currentColor"
            >
              Connection
            </text>
            <text x="130" y="50" fontSize="8" fill="currentColor">
              Insert node here
            </text>
            <text x="130" y="66" fontSize="8" fill="currentColor">
              Delete connection
            </text>
          </svg>
          <figcaption>
            Only one floating menu is open at a time. Hover Link or Type to open
            their flyouts.
          </figcaption>
        </figure>
        <ul className="help-list">
          <li>
            <strong>Node</strong> — add child, start a link, pin, collapse,
            type, color, size, delete, or delete branch.
          </li>
          <li>
            <strong>Connection</strong> — insert a node in the middle, or delete
            the link. Deleting a middle node with two through-links joins the
            neighbors again.
          </li>
          <li>
            <strong>Empty canvas</strong> — same add/link menu as +.
          </li>
        </ul>
      </section>

      <section>
        <h2>Filters and grouping</h2>
        <p>
          The Filter tab searches titles and descriptions, then narrows by
          level, type, and color. Color filters match the current grouping (by
          level, type, or custom).
        </p>
        <ul className="help-list">
          <li>
            Click chips or swatches to toggle. None selected means no
            constraint.
          </li>
          <li>
            <strong>Hide non-matches</strong> removes dimmed nodes instead of
            fading them.
          </li>
          <li>
            <strong>Enlarge</strong> scales labels and dots.{" "}
            <strong>Cards</strong> (bottom right) shows cards when you zoom in.
          </li>
        </ul>
      </section>

      <section>
        <h2>Physics and layout</h2>
        <ul className="help-list">
          <li>
            <strong>Fit / Reorg</strong> — frame the whole graph, or reheat the
            force layout.
          </li>
          <li>
            <strong>Physics</strong> — nearby nodes settle after you drag. Pin a
            node to hold its place.
          </li>
          <li>
            <strong>Radial branch</strong> — pulls levels into rings when
            physics is on.
          </li>
        </ul>
      </section>

      <section>
        <h2>Save, history, and files</h2>
        <ul className="help-list">
          <li>
            The graph still writes a recovery copy to this browser as you work.
          </li>
          <li>
            <strong>Save</strong> (header, toolbar, or Ctrl/Cmd+S) opens a
            confirmation of unsaved actions, then clears History.
          </li>
          <li>
            <strong>History</strong> groups each action. Undo restores the map
            to just before that action and removes later actions.
          </li>
          <li>
            <strong>Continue editing</strong> closes the dialog without
            committing the snapshot.
          </li>
          <li>
            <strong>Export / Import</strong> JSON to move a graph between
            machines.
          </li>
          <li>
            <strong>Sample</strong> reloads the PRIME PM activity workflow tree.
          </li>
        </ul>
      </section>

      <section>
        <h2>Keyboard</h2>
        <ul className="help-list">
          <li>
            <strong>Esc</strong> — close menus, cancel place/link, clear
            selection.
          </li>
          <li>
            <strong>Delete</strong> — remove selected node(s) or the picked
            connection.
          </li>
          <li>
            <strong>N</strong> — start Add node.
          </li>
          <li>
            <strong>Ctrl/Cmd + S</strong> — open the save confirmation.
          </li>
          <li>
            <strong>Space</strong> (hold) — pan mode.
          </li>
        </ul>
      </section>
    </div>
  );
}
