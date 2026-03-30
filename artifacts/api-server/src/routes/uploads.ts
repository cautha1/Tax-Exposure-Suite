import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";

const router: IRouter = Router();

router.get("/uploads", async (req, res) => {
  try {
    const { companyId } = req.query as Record<string, string>;
    let query = supabase.from("uploads").select("*").order("created_at", { ascending: false });
    if (companyId) query = query.eq("company_id", companyId);
    const { data, error } = await query;
    if (error) throw error;
    res.json((data ?? []).map((u: Record<string, unknown>) => ({
      id: u.id, companyId: u.company_id, fileName: u.file_name ?? null,
      rowCount: u.row_count ?? null, status: u.status ?? null, createdAt: u.created_at,
    })));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
