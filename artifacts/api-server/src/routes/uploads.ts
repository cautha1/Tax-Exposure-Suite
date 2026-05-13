import { Router, type IRouter } from "express";
import { supabase, toCamel, sbErr } from "../lib/supabase.js";
import {
  currentUser,
  getVisibleCompanyIds,
  requireCompanyAccess,
} from "../lib/access.js";

const router: IRouter = Router();

router.get("/uploads", async (req, res) => {
  const user = currentUser(req, res);
  if (!user) return;

  try {
    const { companyId } = req.query as Record<string, string>;
    let q = supabase.from("uploads").select("*").order("created_at", { ascending: false });
    if (companyId) {
      if (!(await requireCompanyAccess(req, res, companyId))) return;
      q = q.eq("company_id", companyId);
    } else {
      const visibleCompanyIds = await getVisibleCompanyIds(user);
      if (visibleCompanyIds && visibleCompanyIds.length === 0) {
        res.json([]);
        return;
      }
      if (visibleCompanyIds) q = q.in("company_id", visibleCompanyIds);
    }
    const { data, error } = await q;
    sbErr(error, "list uploads");
    res.json((data ?? []).map((u: unknown) => {
      const row = toCamel<{
        id: string; companyId: string; fileName: string | null;
        rowCount: number | null; totalRows: number | null; validRows: number | null;
        failedRows: number | null; duplicateRows: number | null; status: string | null;
        errorSummary: unknown; advisorId: string | null; startedAt: string | null;
        completedAt: string | null; createdAt: string;
      }>(u);
      return {
        id: row.id, companyId: row.companyId, fileName: row.fileName ?? null,
        rowCount: row.rowCount ?? null,
        totalRows: row.totalRows ?? null,
        validRows: row.validRows ?? null,
        failedRows: row.failedRows ?? null,
        duplicateRows: row.duplicateRows ?? null,
        status: row.status ?? null,
        errorSummary: row.errorSummary ?? [],
        advisorId: row.advisorId ?? null,
        startedAt: row.startedAt ?? null,
        completedAt: row.completedAt ?? null,
        createdAt: row.createdAt,
      };
    }));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
