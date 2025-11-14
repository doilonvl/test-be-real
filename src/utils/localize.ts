export type Locale = "vi" | "en";
export const DEFAULT_LOCALE: Locale = "vi";

export function detectLocale(input?: string): Locale {
  if (!input) return DEFAULT_LOCALE;
  return /en/i.test(input) ? "en" : "vi";
}

type Doc = Record<string, any>;

export function localizeDoc(doc: Doc, locale: Locale, fields: string[]): Doc {
  const out: any = { ...doc };
  for (const f of fields) {
    const i18n = doc?.[`${f}_i18n`];
    out[f] = (i18n && (i18n[locale] || i18n[DEFAULT_LOCALE])) ?? doc?.[f] ?? "";
  }
  if (doc?.slug_i18n) {
    out.slug =
      doc.slug_i18n[locale] || doc.slug_i18n[DEFAULT_LOCALE] || doc.slug;
  }
  return out;
}

export function localizeList(docs: Doc[], locale: Locale, fields: string[]) {
  return docs.map((d) => localizeDoc(d, locale, fields));
}
