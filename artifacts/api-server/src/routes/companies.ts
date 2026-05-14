import { Router, type IRouter } from "express";
import { supabase, supabaseAuth, toCamel, sbErr } from "../lib/supabase.js";
import {
  canCreateCompany,
  currentUser,
  getVisibleCompanyIds,
  isPlatformAdmin,
  requireCompanyAccess,
  requireCompanyManager,
} from "../lib/access.js";
import { writeAuditLog } from "../lib/audit.js";

const router: IRouter = Router();

interface Company {
  id: string;
  companyName: string;
  tinOrTaxId: string | null;
  industry: string | null;
  country: string | null;
  financialYear: string | null;
  riskLevel: string | null;
  riskScore: string | number | null;
  transactionCount: number | null;
  openFlagsCount: number | null;
  estimatedExposure: string | number | null;
  createdAt: string;
}

interface RiskSummaryRow {
  status: string | null;
  severity: string | null;
  category: string | null;
  estimatedExposure: string | number | null;
  createdAt: string | null;
}

const fmt = (c: Company) => ({
  id: c.id,
  companyName: c.companyName,
  tinOrTaxId: c.tinOrTaxId ?? null,
  industry: c.industry ?? null,
  country: c.country ?? null,
  financialYear: c.financialYear ?? null,
  riskLevel: c.riskLevel ?? null,
  status: c.riskLevel === "suspended" ? "suspended" : "active",
  riskScore: c.riskScore != null ? Number(c.riskScore) : null,
  transactionCount: c.transactionCount ?? null,
  openFlagsCount: c.openFlagsCount ?? null,
  estimatedExposure:
    c.estimatedExposure != null ? Number(c.estimatedExposure) : null,
  createdAt: c.createdAt,
});

function monthlyExposureSeries(risks: RiskSummaryRow[]) {
  const now = new Date();
  const buckets = Array.from({ length: now.getMonth() + 1 }, () => 0);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  for (const risk of risks) {
    if (!risk.createdAt) continue;
    const createdAt = new Date(risk.createdAt);
    if (
      Number.isNaN(createdAt.getTime()) ||
      createdAt.getFullYear() !== now.getFullYear()
    ) continue;

    buckets[createdAt.getMonth()] += Number(risk.estimatedExposure ?? 0);
  }

  return buckets.map((exposure, index) => ({
    month: monthNames[index],
    exposure: Math.round(exposure),
  }));
}

router.get("/companies", async (req, res) => {
  const user = currentUser(req, res);
  if (!user) return;

  try {
    const { search, industry, riskLevel } = req.query as Record<string, string>;
    const visibleCompanyIds = await getVisibleCompanyIds(user);
    if (visibleCompanyIds && visibleCompanyIds.length === 0) {
      res.json([]);
      return;
    }

    let q = supabase.from("companies").select("*").order("company_name");
    if (visibleCompanyIds) q = q.in("id", visibleCompanyIds);
    if (industry) q = q.eq("industry", industry);
    if (riskLevel) q = q.eq("risk_level", riskLevel);
    if (search) q = q.ilike("company_name", `%${search}%`);
    const { data, error } = await q;
    sbErr(error, "list companies");
    res.json((data ?? []).map((r: unknown) => fmt(toCamel<Company>(r))));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/companies", async (req, res) => {
  const user = currentUser(req, res);
  if (!user) return;
  if (!canCreateCompany(user)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  try {
    const { companyName, tinOrTaxId, industry, country, financialYear, assignedAdvisorId } = req.body;
    if (!companyName) { res.status(400).json({ error: "companyName is required" }); return; }

    const { data, error } = await supabase.from("companies").insert({
      company_name: companyName, tin_or_tax_id: tinOrTaxId || null, industry: industry || null,
      country: country || null, financial_year: financialYear || null,
      risk_level: "low", risk_score: 0,
    }).select().single();
    sbErr(error, "insert company");
    const row = toCamel<Company>(data);

    const advisorId = user.role === "admin" && assignedAdvisorId
      ? assignedAdvisorId
      : user.id;

    await supabase.from("company_users").upsert({
      company_id: row.id, user_id: advisorId, role: "advisor", assigned_by: user.id,
    }, { onConflict: "company_id,user_id" });

    if (user.id !== advisorId) {
      await supabase.from("company_users").upsert({
        company_id: row.id, user_id: user.id, role: "owner", assigned_by: user.id,
      }, { onConflict: "company_id,user_id" });
    }

    await writeAuditLog(req, {
      action: "company.created",
      entityType: "company",
      entityId: row.id,
      companyId: row.id,
      metadata: { companyName, assignedAdvisorId: advisorId },
    });

    res.status(201).json(fmt(row));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/companies/:id", async (req, res) => {
  if (!(await requireCompanyAccess(req, res, req.params.id))) return;

  try {
    const { data, error } = await supabase.from("companies").select("*").eq("id", req.params.id).single();
    if (error || !data) { res.status(404).json({ error: "Not found" }); return; }
    res.json(fmt(toCamel<Company>(data)));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.put("/companies/:id", async (req, res) => {
  const user = await requireCompanyManager(req, res, req.params.id);
  if (!user) return;

  try {
    const { companyName, tinOrTaxId, industry, country, financialYear, assignedAdvisorId } = req.body;
    if (assignedAdvisorId && user.role !== "admin") {
      res.status(403).json({ error: "Only admins can assign advisors" });
      return;
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (companyName !== undefined) updates.company_name = companyName;
    if (tinOrTaxId !== undefined) updates.tin_or_tax_id = tinOrTaxId;
    if (industry !== undefined) updates.industry = industry;
    if (country !== undefined) updates.country = country;
    if (financialYear !== undefined) updates.financial_year = financialYear;

    const { data, error } = await supabase.from("companies").update(updates).eq("id", req.params.id).select().single();
    if (error || !data) { res.status(404).json({ error: "Not found" }); return; }
    const row = toCamel<Company>(data);

    if (assignedAdvisorId) {
      await supabase.from("company_users").upsert({
        company_id: row.id, user_id: assignedAdvisorId, role: "advisor", assigned_by: user.id,
      }, { onConflict: "company_id,user_id" });
    }

    await writeAuditLog(req, {
      action: "company.updated",
      entityType: "company",
      entityId: row.id,
      companyId: row.id,
      metadata: { updatedFields: Object.keys(updates), assignedAdvisorId: assignedAdvisorId ?? null },
    });

    res.json(fmt(row));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/companies/:id/users", async (req, res) => {
  if (!(await requireCompanyManager(req, res, req.params.id))) return;

  try {
    const { data: assignments, error } = await supabase.from("company_users").select("*").eq("company_id", req.params.id);
    sbErr(error, "list company users");
    const userIds = (assignments ?? []).map((a: Record<string, unknown>) => a.user_id as string);
    if (userIds.length === 0) { res.json([]); return; }

    const profileMap: Record<string, { id: string; email: string | null; fullName: string | null; role: string }> = {};
    for (const uid of userIds) {
      const { data: { user } } = await supabaseAuth.auth.admin.getUserById(uid);
      if (user) {
        profileMap[uid] = {
          id: user.id,
          email: user.email ?? null,
          fullName: user.user_metadata?.full_name ?? null,
          role: user.user_metadata?.role ?? "advisor",
        };
      }
    }

    res.json((assignments ?? []).map((a: Record<string, unknown>) => ({
      ...toCamel(a), user: profileMap[a.user_id as string] ?? null,
    })));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.patch("/companies/:id/status", async (req, res) => {
  const user = currentUser(req, res);
  if (!user) return;
  if (!isPlatformAdmin(user)) {
    res.status(403).json({ error: "Only admins can change client status" });
    return;
  }

  try {
    const { status } = req.body ?? {};
    if (status !== "active" && status !== "suspended") {
      res.status(400).json({ error: "status must be active or suspended" });
      return;
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      risk_level: status === "suspended" ? "suspended" : "low",
    };

    const { data, error } = await supabase
      .from("companies")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .single();
    if (error || !data) { res.status(404).json({ error: "Not found" }); return; }
    const row = toCamel<Company>(data);

    await writeAuditLog(req, {
      action: status === "suspended" ? "company.suspended" : "company.activated",
      entityType: "company",
      entityId: row.id,
      companyId: row.id,
      metadata: { status },
    });

    res.json(fmt(row));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.delete("/companies/:id", async (req, res) => {
  const user = currentUser(req, res);
  if (!user) return;
  if (!isPlatformAdmin(user)) {
    res.status(403).json({ error: "Only admins can delete clients" });
    return;
  }

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from("companies")
      .select("id, company_name")
      .eq("id", req.params.id)
      .single();
    if (fetchErr || !existing) { res.status(404).json({ error: "Not found" }); return; }

    await writeAuditLog(req, {
      action: "company.deleted",
      entityType: "company",
      entityId: req.params.id,
      companyId: req.params.id,
      metadata: { companyName: (existing as Record<string, unknown>).company_name },
    });

    const { error } = await supabase.from("companies").delete().eq("id", req.params.id);
    sbErr(error, "delete company");
    res.json({ success: true });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/companies/:id/users", async (req, res) => {
  const user = await requireCompanyManager(req, res, req.params.id);
  if (!user) return;

  try {
    const { userId: targetUserId, role = "member" } = req.body;
    if (!targetUserId) { res.status(400).json({ error: "userId required" }); return; }
    const { data, error } = await supabase.from("company_users").upsert({
      company_id: req.params.id, user_id: targetUserId, role, assigned_by: user.id,
    }, { onConflict: "company_id,user_id" }).select().single();
    sbErr(error, "assign company user");
    await writeAuditLog(req, {
      action: "company_user.assigned",
      entityType: "company_user",
      entityId: (data as Record<string, unknown>)?.id as string | undefined,
      companyId: req.params.id,
      metadata: { targetUserId, role },
    });
    res.status(201).json(toCamel(data));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/companies/:id/summary", async (req, res) => {
  if (!(await requireCompanyAccess(req, res, req.params.id))) return;

  try {
    const { id } = req.params;
    const { data: companyRaw, error } = await supabase.from("companies").select("*").eq("id", id).single();
    if (error || !companyRaw) { res.status(404).json({ error: "Not found" }); return; }
    const company = toCamel<Company>(companyRaw);

    const { data: risksRaw } = await supabase
      .from("tax_risk_flags")
      .select("status, severity, category, estimated_exposure, created_at")
      .eq("company_id", id);
    const risks = (risksRaw ?? []).map((r: unknown) => toCamel<RiskSummaryRow>(r));

    const openRisks = risks.filter(r => r.status === "open");
    const estimatedExposure = openRisks.reduce((s, r) => s + Number(r.estimatedExposure ?? 0), 0);
    const riskScore = company.riskScore != null ? Number(company.riskScore) : 0;
    const catMap: Record<string, { count: number; exposure: number }> = {};
    const sevMap: Record<string, number> = {};
    for (const r of risks) {
      const cat = r.category ?? "Other";
      if (!catMap[cat]) catMap[cat] = { count: 0, exposure: 0 };
      catMap[cat].count++; catMap[cat].exposure += Number(r.estimatedExposure ?? 0);
      const sev = r.severity ?? "low";
      sevMap[sev] = (sevMap[sev] ?? 0) + 1;
    }
    res.json({
      totalTransactions: company.transactionCount ?? 0,
      openRisks: openRisks.length, estimatedExposure, riskScore, riskLevel: company.riskLevel ?? "low",
      risksByCategory: Object.entries(catMap).map(([category, v]) => ({ category, count: v.count, exposure: Math.round(v.exposure) })),
      severityBreakdown: Object.entries(sevMap).map(([severity, count]) => ({ severity, count })),
      monthlyExposure: monthlyExposureSeries(openRisks),
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
