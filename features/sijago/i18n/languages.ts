/** UI locales that have a selectable bundle. The bundles may fall back to English per key. */
export const APP_LANGUAGES = [
  { code: "id", labelKey: "language.indonesian" },
  { code: "en", labelKey: "language.english" },
  { code: "zh", labelKey: "language.chinese" },
  { code: "fr", labelKey: "language.french" },
  { code: "uk", labelKey: "language.ukrainian" },
] as const;

export type AppLanguage = (typeof APP_LANGUAGES)[number]["code"];

/** The locale a browser with no stored choice falls back to. */
export const DEFAULT_APP_LANGUAGE: AppLanguage = "id";

const SUPPORTED_CODES: ReadonlySet<string> = new Set(
  APP_LANGUAGES.map(({ code }) => code),
);

export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === "string" && SUPPORTED_CODES.has(value);
}

export function normalizeLanguage(value: unknown): AppLanguage {
  if (typeof value !== "string") return DEFAULT_APP_LANGUAGE;
  const code = value.trim().toLowerCase().replaceAll("_", "-");
  const base = code.split("-", 1)[0];
  if (base === "id" || code === "indonesian" || code === "bahasa")
    return "id";
  if (base === "zh" || base === "cn" || code === "chinese") return "zh";
  if (base === "fr" || code === "french") return "fr";
  if (base === "uk" || base === "ua" || code === "ukrainian") return "uk";
  if (base === "en" || code === "english") return "en";
  // An unrecognized code is not a preference: fall back to the default locale,
  // the same way the backend's `_normalize_language` does.
  return DEFAULT_APP_LANGUAGE;
}
