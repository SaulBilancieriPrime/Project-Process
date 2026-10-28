import { DEFAULT_SETTINGS, graphSettingsSchema, type GraphSettings } from "../schema/graph";

export const VIEW_SETTING_KEYS = [
  "physics",
  "charge",
  "linkDistance",
  "collide",
  "radial",
  "colorBy",
  "cardInfo",
  "showText",
  "pulse",
  "pulseSpeed",
  "enlarge",
  "textScale",
  "cardScale",
] as const;

export type ViewSettingKey = (typeof VIEW_SETTING_KEYS)[number];

export function pickViewSettings(settings: GraphSettings): GraphSettings {
  const picked = {} as GraphSettings;
  for (const key of VIEW_SETTING_KEYS) {
    (picked as Record<ViewSettingKey, GraphSettings[ViewSettingKey]>)[key] = settings[key];
  }
  return graphSettingsSchema.parse({ ...DEFAULT_SETTINGS, ...picked });
}

export function mergeViewSettings(base: GraphSettings, view?: Partial<GraphSettings> | null): GraphSettings {
  if (!view) return graphSettingsSchema.parse(base);
  const next = { ...base };
  for (const key of VIEW_SETTING_KEYS) {
    if (view[key] !== undefined) {
      (next as Record<ViewSettingKey, GraphSettings[ViewSettingKey]>)[key] = view[key] as GraphSettings[ViewSettingKey];
    }
  }
  return graphSettingsSchema.parse(next);
}

export function sharedSettingsChanged(before: GraphSettings, after: GraphSettings) {
  const beforeKeys = Object.keys(before) as (keyof GraphSettings)[];
  return beforeKeys.some((key) => !VIEW_SETTING_KEYS.includes(key as ViewSettingKey) && before[key] !== after[key]);
}
