import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { supabase } from "../lib/supabase.js";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/readiness", async (_req, res) => {
  const checks: Array<{ name: string; ok: boolean; message?: string }> = [];

  const requiredChecks = [
    {
      name: "phase2_upload_columns",
      query: supabase
        .from("uploads")
        .select("advisor_id,total_rows,valid_rows,failed_rows,duplicate_rows,started_at,completed_at,error_summary", { head: true })
        .limit(1),
    },
    {
      name: "phase2_transaction_trace_columns",
      query: supabase
        .from("transactions")
        .select("source_row_number,row_hash,validation_status,duplicate_of_transaction_id,raw_data", { head: true })
        .limit(1),
    },
    {
      name: "phase3_risk_evidence_columns",
      query: supabase
        .from("tax_risk_flags")
        .select("detection_method,legal_reference,evidence", { head: true })
        .limit(1),
    },
    {
      name: "phase4_activity_logs",
      query: supabase
        .from("activity_logs")
        .select("id,action,entity_type,metadata", { head: true })
        .limit(1),
    },
  ];

  for (const check of requiredChecks) {
    const { error } = await check.query;
    checks.push({ name: check.name, ok: !error, message: error?.message });
  }

  const ok = checks.every(check => check.ok);
  res.status(ok ? 200 : 503).json({
    status: ok ? "ready" : "not_ready",
    checks,
    migrationRequired: ok ? null : "supabase-phase2-phase3-migration.sql",
  });
});

export default router;
