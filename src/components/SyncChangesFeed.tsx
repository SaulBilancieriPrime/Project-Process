import { useMemo, useState } from "react";
import { useStore } from "@tanstack/react-store";
import { discardOutbox, outboxStore, retryOutbox, type OutboxEntry } from "../store/outbox";
import {
  clearSyncFeed,
  markSyncFeedRead,
  markSyncItemRead,
  setSyncFeedOpen,
  syncFeedStore,
  unreadCount,
  type SyncFeedItem,
} from "../store/syncFeed";
import { chip, chipOn, cx, ghostBtn, historyKind, primaryBtn, toolBtn } from "../styles";

type Props = {
  onJumpNode: (id: string) => void;
  onJumpLink: (id: string) => void;
};

type Filter = "all" | "add" | "update" | "remove" | "alerts";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "add", label: "Added" },
  { id: "update", label: "Updated" },
  { id: "remove", label: "Removed" },
  { id: "alerts", label: "Alerts" },
];

function formatWhen(at: number) {
  const date = new Date(at);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" });
  if (sameDay) return time;
  return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${time}`;
}

function matchesFilter(item: SyncFeedItem, filter: Filter) {
  if (filter === "all") return true;
  if (filter === "alerts") return Boolean(item.alert);
  return !item.alert && item.kind === filter;
}

function ChangeCard({ item, onJump }: { item: SyncFeedItem; onJump?: () => void }) {
  const tone = item.alert ? "border-l-[3px] border-l-amber-500" : historyKind(item.kind);
  return (
    <div
      className={cx(
        "rounded-lg border border-[var(--line)] px-2.5 py-2",
        item.read ? "bg-[var(--card)]" : "bg-[var(--hover)]",
        tone,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <strong className="flex items-center gap-1.5 text-xs">
          {!item.read ? <span aria-label="Unread" className="size-1.5 shrink-0 rounded-full bg-[var(--accent)]" /> : null}
          {item.title}
        </strong>
        {onJump ? (
          <button
            type="button"
            className={cx(ghostBtn, "shrink-0 px-1.5 py-0.5 text-[10px]")}
            onClick={onJump}
            aria-label={`Show ${item.target === "link" ? "connection" : "node"} on the map`}
          >
            Show
          </button>
        ) : null}
      </div>
      {item.detail ? <p className="mt-1 mb-0 text-[11px] leading-snug text-[var(--muted)]">{item.detail}</p> : null}
    </div>
  );
}

function QueueStatus({ entries }: { entries: OutboxEntry[] }) {
  const head = entries[0];
  if (!head) return null;
  const held = head.status === "held";
  const retrying = head.status === "retrying";
  const count = entries.length;
  const summary = `${count} change${count === 1 ? "" : "s"} not saved yet`;
  const detail = held
    ? `Saving failed after several tries${head.error ? `: ${head.error}` : ""}.`
    : retrying
      ? `Retrying${head.retryAt ? ` at ${new Date(head.retryAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" })}` : ""}${head.error ? ` · ${head.error}` : ""}`
      : "Saving…";
  return (
    <div
      className={cx(
        "pointer-events-auto w-full rounded-[12px] border bg-[var(--card)] px-3 py-2 shadow-[var(--shadow)]",
        held ? "border-amber-500" : "border-[var(--line)]",
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-2">
        <strong className="text-xs">{summary}</strong>
        {held || retrying ? (
          <div className="flex shrink-0 gap-1">
            <button type="button" className={cx(ghostBtn, "px-2 py-0.5 text-[11px]")} onClick={discardOutbox}>
              Discard
            </button>
            <button type="button" className={cx(primaryBtn, "px-2 py-0.5 text-[11px]")} onClick={retryOutbox}>
              Retry now
            </button>
          </div>
        ) : null}
      </div>
      <p className="mt-0.5 mb-0 text-[11px] leading-snug text-[var(--muted)]">{detail}</p>
      {count > 1 ? (
        <p className="mt-0.5 mb-0 truncate text-[10px] text-[var(--muted)]">
          Queued: {entries.map((e) => e.label).slice(0, 4).join(" · ")}
          {count > 4 ? ` · +${count - 4} more` : ""}
        </p>
      ) : null}
    </div>
  );
}

export default function SyncChangesFeed({ onJumpNode, onJumpLink }: Props) {
  const items = useStore(syncFeedStore, (s) => s.items);
  const unread = useStore(syncFeedStore, unreadCount);
  const expanded = useStore(syncFeedStore, (s) => s.open);
  const queue = useStore(outboxStore, (s) => s.entries);
  const [filter, setFilter] = useState<Filter>("all");
  const badge = unread > 99 ? "99+" : String(unread);

  const batches = useMemo(() => {
    const visible = items.filter((item) => matchesFilter(item, filter));
    const groups: { batch: string; at: number; by?: string; items: SyncFeedItem[] }[] = [];
    for (let i = visible.length - 1; i >= 0; i -= 1) {
      const item = visible[i];
      const last = groups[groups.length - 1];
      if (last?.batch === item.batch) last.items.push(item);
      else groups.push({ batch: item.batch, at: item.at, by: item.by, items: [item] });
    }
    return groups;
  }, [items, filter]);

  const jumpFor = (item: SyncFeedItem) => {
    if (!item.targetId || item.kind === "remove") return undefined;
    const id = item.targetId;
    return () => {
      markSyncItemRead(item.id);
      if (item.target === "link") onJumpLink(id);
      else onJumpNode(id);
    };
  };

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[120] flex max-h-[50vh] w-[min(380px,calc(100vw-32px))] flex-col items-end justify-end gap-2">
      <QueueStatus entries={queue} />

      {expanded ? (
        <div className="pointer-events-auto flex max-h-[50vh] w-full flex-col overflow-hidden rounded-[14px] border border-[var(--line)] bg-[var(--card)] shadow-[var(--shadow)]">
          <div className="flex shrink-0 items-start justify-between gap-2 border-b border-[var(--line)] px-3.5 py-2.5">
            <div>
              <h2 className="m-0 text-sm font-semibold text-[var(--accent)]">Sync changes</h2>
              <p className="m-0 mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
                This session · {items.length} update{items.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button type="button" className={cx(toolBtn, "px-2 py-1 text-[11px]")} onClick={markSyncFeedRead} disabled={!unread}>
                Mark all read
              </button>
              <button type="button" className={cx(toolBtn, "px-2 py-1 text-[11px]")} onClick={clearSyncFeed} disabled={!items.length}>
                Clear
              </button>
              <button
                type="button"
                className={cx(toolBtn, "px-2 py-1 text-[11px]")}
                onClick={() => setSyncFeedOpen(false)}
                aria-label="Collapse sync panel"
              >
                Hide
              </button>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1 px-3 pt-2" role="group" aria-label="Filter sync changes">
            {FILTERS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={cx(chip, filter === id && chipOn)}
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <ul className="m-0 flex list-none flex-col gap-3 overflow-auto p-3 pt-2">
            {batches.length ? (
              batches.map((group) => (
                <li key={group.batch} className="list-none">
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-[10px] text-[var(--muted)]">
                    <span className="truncate font-semibold">{group.by ? `By ${group.by}` : group.items[0].alert ? "This tab" : "Another editor"}</span>
                    <time className="shrink-0" dateTime={new Date(group.at).toISOString()}>
                      {formatWhen(group.at)}
                    </time>
                  </div>
                  <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                    {group.items.map((item) => (
                      <li key={item.id} className="list-none">
                        <ChangeCard item={item} onJump={jumpFor(item)} />
                      </li>
                    ))}
                  </ul>
                </li>
              ))
            ) : (
              <li className="list-none px-1 py-3 text-[12px] text-[var(--muted)]">
                {items.length ? "Nothing matches this filter." : "No sync updates this session."}
              </li>
            )}
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        className={cx(
          toolBtn,
          "pointer-events-auto relative flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--card)] p-0 text-lg shadow-[var(--shadow)]",
          expanded && "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--graph-bg)]",
        )}
        aria-label={expanded ? "Collapse sync notifications" : `Open sync notification history${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={expanded}
        onClick={() => setSyncFeedOpen(!expanded)}
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-none text-[var(--text)]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-semibold text-white">
            {badge}
          </span>
        ) : null}
      </button>
    </div>
  );
}
