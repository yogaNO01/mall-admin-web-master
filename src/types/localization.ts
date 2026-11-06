export type ContentTranslations = { zh?: Record<string, string>; pt?: Record<string, string> }
export type TranslationField = { key: string; label: string; type?: 'textarea' | 'html' | 'image' | 'number'; hint?: string; maxlength?: number }
