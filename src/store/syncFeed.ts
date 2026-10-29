import { Store } from "@tanstack/store";
import type { ChangeItem } from "../graph/history";

export type SyncAlert = "conflict" | "error";

export type SyncFeedItem = Omit<ChangeItem, "targetId"> & {
  targetId?: string;
  at: number;
  batch: string;
  read: boolean;
  by?: string;
  alert?: SyncAlert;
};

type SyncFeedState = {
  items: SyncFeedItem[];
  open: boolean;
};

export const syncFeedStore = new Store<SyncFeedState>({ items: [], open: false });

export function unreadCount(state: SyncFeedState) {
  let n = 0;
  for (const item of state.items) if (!item.read) n += 1;
  return n;
}

export function appendSyncFeed(
  incoming: (Omit<ChangeItem, "targetId"> & { targetId?: string })[],
  meta: { by?: string; alert?: SyncAlert } = {},
) {
  if (!incoming.length) return;
  const at = Date.now();
  const batch = `${at}-${Math.random().toString(36).slice(2, 7)}`;
  const stamped = incoming.map((item, i) => ({ ...item, id: `${item.id}-${batch}-${i}`, at, batch, read: false, ...meta }));
  syncFeedStore.setState((s) => ({ ...s, items: [...s.items, ...stamped] }));
}

export function setSyncFeedOpen(open: boolean) {
  syncFeedStore.setState((s) => ({ ...s, open }));
}

export function markSyncFeedRead() {
  syncFeedStore.setState((s) => ({ ...s, items: s.items.map((item) => (item.read ? item : { ...item, read: true })) }));
}

export function markSyncItemRead(id: string) {
  syncFeedStore.setState((s) => ({ ...s, items: s.items.map((item) => (item.id === id && !item.read ? { ...item, read: true } : item)) }));
}

export function clearSyncFeed() {
  syncFeedStore.setState((s) => ({ ...s, items: [] }));
}
