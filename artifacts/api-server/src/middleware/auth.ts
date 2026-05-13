import type { NextFunction, Request, Response } from "express";
import type { User } from "@supabase/supabase-js";
import { supabaseAuth } from "../lib/supabase.js";

export type ProfileRole = "admin" | "advisor" | "client_user";

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  fullName: string | null;
  role: ProfileRole;
  companyId: string | null;
  createdAt: string;
  raw: User;
}

export type PublicAuthUser = Omit<AuthenticatedUser, "raw">;

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      accessToken?: string;
    }
  }
}

const VALID_ROLES = new Set<ProfileRole>(["admin", "advisor", "client_user"]);

export function formatAuthUser(user: User): AuthenticatedUser {
  const metadata = user.user_metadata ?? {};
  const roleValue = String(metadata.role ?? "advisor");
  const role = VALID_ROLES.has(roleValue as ProfileRole)
    ? (roleValue as ProfileRole)
    : "advisor";

  return {
    id: user.id,
    email: user.email ?? null,
    fullName: typeof metadata.full_name === "string" ? metadata.full_name : null,
    role,
    companyId:
      typeof metadata.company_id === "string" ? metadata.company_id : null,
    createdAt: user.created_at ?? new Date().toISOString(),
    raw: user,
  };
}

export function serializeAuthUser(user: AuthenticatedUser): PublicAuthUser {
  const { raw: _raw, ...publicUser } = user;
  return publicUser;
}

function getBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const {
      data: { user },
      error,
    } = await supabaseAuth.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    req.user = formatAuthUser(user);
    req.accessToken = token;
    next();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export function requireRoles(...roles: ProfileRole[]) {
  const allowed = new Set(roles);

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!allowed.has(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    next();
  };
}
