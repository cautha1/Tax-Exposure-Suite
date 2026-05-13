import type { Request } from "express";
import { supabase } from "./supabase.js";

interface AuditEvent {
  action: string;
  entityType: string;
  entityId?: string | null;
  companyId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(
  req: Request,
  event: AuditEvent,
): Promise<void> {
  const user = req.user;
  if (!user) return;

  const { error } = await supabase.from("activity_logs").insert({
    actor_user_id: user.id,
    actor_role: user.role,
    company_id: event.companyId ?? null,
    action: event.action,
    entity_type: event.entityType,
    entity_id: event.entityId ?? null,
    metadata: event.metadata ?? {},
  });

  if (error) {
    req.log.warn(
      { err: error.message, action: event.action },
      "Audit log write skipped",
    );
  }
}
