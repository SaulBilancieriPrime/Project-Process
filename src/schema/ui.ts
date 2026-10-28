import { z } from "zod";

export const themeSchema = z.enum(["light", "dark"]);

export const uiStateSchema = z.object({
  theme: themeSchema,
  historyOpen: z.boolean(),
  infoOpen: z.boolean(),
  toast: z.string().nullable(),
});

export type Theme = z.infer<typeof themeSchema>;
export type UiState = z.infer<typeof uiStateSchema>;
