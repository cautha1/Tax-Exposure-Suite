import { createClient } from "@supabase/supabase-js";

// TaxIntel Supabase project — fixed credentials, do not change
const SUPABASE_URL = "https://wqkcnnstnrhbttcnhvne.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indxa2NubnN0bnJoYnR0Y25odm5lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg1MTM3MywiZXhwIjoyMDkwNDI3MzczfQ.ICVU3K4Gs3K5qgvGK7iINMRf8fvHc2HbEo5LjN2fbEI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function toCamel<T = Record<string, unknown>>(obj: unknown): T {
  if (Array.isArray(obj)) return obj.map((item) => toCamel(item)) as unknown as T;
  if (obj !== null && typeof obj === "object") {
    return Object.entries(obj as Record<string, unknown>).reduce((acc, [k, v]) => {
      const camelKey = k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
      (acc as Record<string, unknown>)[camelKey] = toCamel(v);
      return acc;
    }, {} as T);
  }
  return obj as T;
}

export function sbErr(error: { message: string } | null, context?: string): void {
  if (error) throw new Error(`${context ? context + ": " : ""}${error.message}`);
}
