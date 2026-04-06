import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
}

export const supabase = createClient(url, key, {
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
