import type { Request, Response } from "express";
import { supabase, sbErr } from "./supabase.js";
import type { AuthenticatedUser } from "../middleware/auth.js";

const COMPANY_MANAGER_ROLES = new Set(["admin", "owner", "advisor", "manager"]);

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function currentUser(req: Request, res: Response): AuthenticatedUser | null {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return req.user;
}

export function isPlatformAdmin(user: AuthenticatedUser): boolean {
  return user.role === "admin";
}

export function canCreateCompany(user: AuthenticatedUser): boolean {
  return user.role === "admin" || user.role === "advisor";
}

export async function getVisibleCompanyIds(
  user: AuthenticatedUser,
): Promise<string[] | null> {
  if (isPlatformAdmin(user)) return null;

  const { data, error } = await supabase
    .from("company_users")
    .select("company_id")
    .eq("user_id", user.id);
  sbErr(error, "list assigned companies");

  return (data ?? []).map((row: Record<string, unknown>) => row.company_id as string);
}

export async function getCompanyRole(
  user: AuthenticatedUser,
  companyId: string,
): Promise<string | null> {
  if (isPlatformAdmin(user)) return "admin";

  const { data, error } = await supabase
    .from("company_users")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .maybeSingle();
  sbErr(error, "check company assignment");

  return data ? String((data as Record<string, unknown>).role ?? "member") : null;
}

export async function hasCompanyAccess(
  user: AuthenticatedUser,
  companyId: string,
): Promise<boolean> {
  return (await getCompanyRole(user, companyId)) !== null;
}

export async function requireCompanyAccess(
  req: Request,
  res: Response,
  companyId: string,
): Promise<AuthenticatedUser | null> {
  const user = currentUser(req, res);
  if (!user) return null;

  if (!UUID_RE.test(companyId)) {
    res.status(400).json({ error: "Invalid company id" });
    return null;
  }

  if (!(await hasCompanyAccess(user, companyId))) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }

  return user;
}

export async function requireCompanyManager(
  req: Request,
  res: Response,
  companyId: string,
): Promise<AuthenticatedUser | null> {
  const user = currentUser(req, res);
  if (!user) return null;

  if (!UUID_RE.test(companyId)) {
    res.status(400).json({ error: "Invalid company id" });
    return null;
  }

  const role = await getCompanyRole(user, companyId);
  if (!role || !COMPANY_MANAGER_ROLES.has(role)) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }

  return user;
}

export function emptyPaginated(page: number, limit: number) {
  return { data: [], total: 0, page, limit };
}
