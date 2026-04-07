import { createClient } from "@supabase/supabase-js";

// Supabase project URL (not sensitive — safe to hardcode)
const url = "https://lugfeobnitcuksouuwia.supabase.co";

// Service role key — kept in Replit Secrets as SUPABASE_SERVICE_ROLE_KEY
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!key) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY must be set in Replit Secrets");
}

// Diagnostic: log which project we're connecting to (URL is not sensitive)
const keyRef = (() => {
  try {
    return JSON.parse(Buffer.from(key.split(".")[1]!, "base64url").toString()).ref ?? "unknown";
  } catch { return "unreadable"; }
})();
console.log(`[Supabase] Connecting to: ${url}`);
console.log(`[Supabase] Key belongs to project ref: ${keyRef}`);
if (keyRef !== "lugfeobnitcuksouuwia") {
  console.warn(`[Supabase] WARNING: Key project ref (${keyRef}) does not match URL project. Requests will fail!`);
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
