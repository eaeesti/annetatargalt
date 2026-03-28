import type { Context } from "koa";
import { adminAuditLogRepository } from "../../../../db/repositories/adminAuditLog.repository";

export async function auditLog(
  ctx: Context,
  action: string,
  recordId?: string,
): Promise<void> {
  try {
    const user = ctx.state.user as { id: number; email: string } | undefined;
    if (!user) return;
    const ip = ctx.ip || null;
    await adminAuditLogRepository.log({
      userId: String(user.id),
      userEmail: user.email,
      action,
      recordId: recordId ?? null,
      ip,
    });
  } catch {
    // Never fail the request due to audit logging errors
  }
}
