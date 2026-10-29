import { Store } from "@tanstack/store";

type DraftEntry = { label: string; save: () => void; reset: () => void };

const drafts = new Map<string, DraftEntry>();

/** Labels of text fields that hold unsaved edits. */
export const draftStore = new Store<{ labels: string[] }>({ labels: [] });

function publish() {
  draftStore.setState(() => ({ labels: [...drafts.values()].map((d) => d.label) }));
}

export function registerDraft(key: string, entry: DraftEntry | null) {
  if (entry) drafts.set(key, entry);
  else if (!drafts.delete(key)) return;
  publish();
}

export function hasDrafts() {
  return drafts.size > 0;
}

export function saveDrafts() {
  for (const entry of [...drafts.values()]) entry.save();
}

export function discardDrafts() {
  for (const entry of [...drafts.values()]) entry.reset();
}
