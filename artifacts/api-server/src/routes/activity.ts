import { Router, type IRouter } from "express";
import { supabase, toCamel, sbErr } from "../lib/supabase.js";
import {
  UUID_RE,
  currentUser,
  getVisibleCompanyIds,
  requireCompanyAccess,
} from "../lib/access.js";

const router: IRouter = Router();

interface ActivityLog {
  id: string;
  actorUserId: string | null;
  actorRole: string | null;
  companyId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

const fmtActivity = (row: ActivityLog, companyName?: string | null) => ({
  id: row.id,
  actorUserId: row.actorUserId ?? null,
  actorRole: row.actorRole ?? null,
  companyId: row.companyId ?? null,
  companyName: companyName ?? null,
  action: row.action,
  entityType: row.entityType,
  entityId: row.entityId ?? null,
  metadata: row.metadata ?? {},
  createdAt: row.createdAt,
});

router.get("/activity", async (req, res) => {
  const user = currentUser(req, res);
  if (!user) return;

  try {
    const { companyId, limit = "50" } = req.query as Record<string, string>;
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));

    if (companyId && !UUID_RE.test(companyId)) {
      res.status(400).json({ error: "Invalid company id" });
      return;
    }

    if (companyId && !(await requireCompanyAccess(req, res, companyId))) return;

    const visibleCompanyIds = companyId ? null : await getVisibleCompanyIds(user);
    if (!companyId && visibleCompanyIds && visibleCompanyIds.length === 0) {
      res.json({ data: [], total: 0 });
      return;
    }

    let q = supabase
      .from("activity_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(limitNum);

    if (companyId) q = q.eq("company_id", companyId);
    else if (visibleCompanyIds) q = q.in("company_id", visibleCompanyIds);

    const { data, error, count } = await q;
    sbErr(error, "list activity logs");

    const companyIds = Array.from(
      new Set((data ?? []).map((row: Record<string, unknown>) => row.company_id).filter(Boolean) as string[]),
    );
    let companyMap: Record<string, string> = {};
    if (companyIds.length > 0) {
      const { data: companiesRaw, error: companiesErr } = await supabase
        .from("companies")
        .select("id, company_name")
        .in("id", companyIds);
      sbErr(companiesErr, "list activity companies");
      companyMap = Object.fromEntries(
        (companiesRaw ?? []).map((c: Record<string, unknown>) => [String(c.id), String(c.company_name)]),
      );
    }

    res.json({
      data: (data ?? []).map((row: unknown) => {
        const activity = toCamel<ActivityLog>(row);
        return fmtActivity(activity, activity.companyId ? companyMap[activity.companyId] : null);
      }),
      total: count ?? 0,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
