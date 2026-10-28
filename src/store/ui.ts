import { Store } from "@tanstack/store";
import { themeSchema, uiStateSchema, type UiState } from "../schema/ui";
import { loadTheme, saveTheme } from "../storage";

export type { UiState };

export const uiStore = new Store<UiState>(
  uiStateSchema.parse({
    theme: typeof window === "undefined" ? "dark" : loadTheme(),
    historyOpen: false,
    infoOpen: false,
    toast: null,
  }),
);

export function patchUi(partial: Partial<UiState>) {
  uiStore.setState((state) => {
    const next = uiStateSchema.parse({ ...state, ...partial });
    if (partial.theme) saveTheme(themeSchema.parse(partial.theme));
    return next;
  });
}

export function toggleHistory() {
  uiStore.setState((state) =>
    uiStateSchema.parse({
      ...state,
      historyOpen: !state.historyOpen,
      infoOpen: false,
    }),
  );
}

export function toggleInfo() {
  uiStore.setState((state) =>
    uiStateSchema.parse({
      ...state,
      infoOpen: !state.infoOpen,
      historyOpen: false,
    }),
  );
}

export function showToast(message: string) {
  uiStore.setState((state) => uiStateSchema.parse({ ...state, toast: message }));
  window.setTimeout(() => {
    uiStore.setState((state) =>
      state.toast === message ? uiStateSchema.parse({ ...state, toast: null }) : state,
    );
  }, 2400);
}
