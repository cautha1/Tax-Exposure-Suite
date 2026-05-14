import { createClient } from "@supabase/supabase-js";

function requiredEnv(primary: string, fallback?: string): string {
  const value = process.env[primary] ?? (fallback ? process.env[fallback] : undefined);
  if (!value) {
    throw new Error(
      `${primary}${fallback ? ` or ${fallback}` : ""} must be set in the API server environment`,
    );
  }
  return value;
}

const SUPABASE_URL = requiredEnv("TAXINTEL_DB_URL", "SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requiredEnv(
  "TAXINTEL_DB_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
);

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function toCamel<T = Record<string, unknown>>(obj: unknown): T {
  if (Array.isArray(obj))
    return obj.map((item) => toCamel(item)) as unknown as T;
  if (obj !== null && typeof obj === "object") {
    return Object.entries(obj as Record<string, unknown>).reduce(
      (acc, [k, v]) => {
        const camelKey = k.replace(/_([a-z])/g, (_, c: string) =>
          c.toUpperCase(),
        );
        (acc as Record<string, unknown>)[camelKey] = toCamel(v);
        return acc;
      },
      {} as T,
    );
  }
  return obj as T;
}

export function sbErr(
  error: { message: string } | null,
  context?: string,
): void {
  if (error)
    throw new Error(`${context ? context + ": " : ""}${error.message}`);
}

export function isSchemaDriftError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes("schema cache") ||
    message.includes("Could not find the") ||
    message.includes("column") && message.includes("does not exist")
  );
}
