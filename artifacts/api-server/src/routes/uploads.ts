import { Router, type IRouter } from "express";
import { supabase, toCamel, sbErr } from "../lib/supabase.js";

const router: IRouter = Router();

router.get("/uploads", async (req, res) => {
  try {
    const { companyId } = req.query as Record<string, string>;
    let q = supabase.from("uploads").select("*").order("created_at", { ascending: false });
    if (companyId) q = q.eq("company_id", companyId);
    const { data, error } = await q;
    sbErr(error, "list uploads");
    res.json((data ?? []).map((u: unknown) => {
      const row = toCamel<{
        id: string; companyId: string; fileName: string | null;
        rowCount: number | null; status: string | null; createdAt: string;
      }>(u);
      return {
        id: row.id, companyId: row.companyId, fileName: row.fileName ?? null,
        rowCount: row.rowCount ?? null, status: row.status ?? null, createdAt: row.createdAt,
      };
    }));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
