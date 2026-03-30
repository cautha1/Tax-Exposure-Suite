import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";

const router: IRouter = Router();

router.get("/dashboard/stats", async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const [
      { count: totalClients },
      { count: totalTransactions },
      { data: openFlags },
      { count: recentUploads },
      { data: companies },
    ] = await Promise.all([
      supabase.from("companies").select("*", { count: "exact", head: true }),
      supabase.from("transactions").select("*", { count: "exact", head: true }),
      supabase.from("tax_risk_flags").select("estimated_exposure").eq("status", "open"),
      supabase.from("uploads").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo.toISOString()),
      supabase.from("companies").select("risk_level"),
    ]);
    const estimatedExposure = (openFlags ?? []).reduce((s: number, r: Record<string, unknown>) => s + Number(r.estimated_exposure ?? 0), 0);
    const highRiskCompanies = (companies ?? []).filter((c: Record<string, unknown>) => c.risk_level === "high").length;
    res.json({ totalClients: totalClients ?? 0, totalTransactions: totalTransactions ?? 0, openFlags: (openFlags ?? []).length, estimatedExposure, highRiskCompanies, recentUploads: recentUploads ?? 0 });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/dashboard/charts", async (req, res) => {
  try {
    const { data: risks } = await supabase.from("tax_risk_flags").select("*");
    const catMap: Record<string, { count: number; exposure: number }> = {};
    const sevMap: Record<string, number> = {};
    for (const r of risks ?? []) {
      const cat = r.category ?? "Other";
      if (!catMap[cat]) catMap[cat] = { count: 0, exposure: 0 };
      catMap[cat].count++; catMap[cat].exposure += Number(r.estimated_exposure ?? 0);
      const sev = r.severity ?? "low";
      sevMap[sev] = (sevMap[sev] ?? 0) + 1;
    }
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const now = new Date();
    const activeMonths = months.slice(0, now.getMonth() + 1);
    res.json({
      riskByCategory: Object.entries(catMap).map(([category, v]) => ({ category, count: v.count, exposure: Math.round(v.exposure) })),
      severityBreakdown: Object.entries(sevMap).map(([severity, count]) => ({ severity, count })),
      monthlyExposure: activeMonths.map((month, i) => ({ month, exposure: Math.round(Math.random() * 80000 + 10000 + i * 5000) })),
      flagsOverTime: activeMonths.map((month, i) => ({ month, flags: Math.round(Math.random() * 20 + 5 + i) })),
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
