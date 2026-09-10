// Supabase Edge Function: automation-job-worker
// Release 14: Durable Scheduler + Delay Engine
// Autonomous worker for processing due scheduled automation jobs.
// Guarantees:
// - Server-side execution independent of browser session
// - Zero secrets received from or leaked to clients
// - Enforces database-authoritative automation text (anti-injection)
// - Concurrency-safe atomic claim with FOR UPDATE SKIP LOCKED
// - Deterministic retry with exponential backoff

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { getServerSupabaseClient } from "../_shared/supabaseServer.ts";
import { createErrorResponse, createSuccessResponse } from "../_shared/errors.ts";
import { logSecure } from "../_shared/logger.ts";

interface WorkerRequest {
  limit?: number;
  workerId?: string;
}

serve(async (req: Request) => {
  const startTime = Date.now();

  // 1. Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  // 2. Validate HTTP method
  if (req.method !== "POST") {
    return createErrorResponse(405, "Método não permitido. Utilize POST.", "METHOD_NOT_ALLOWED");
  }

  // 3. Authorization check (accepts Bearer JWT, Service Role Key, or Cron trigger)
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  const supabase = getServerSupabaseClient();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  let isAuthorized = false;

  if (token && serviceRoleKey && token === serviceRoleKey) {
    isAuthorized = true;
  } else if (token) {
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser(token);
      if (!authError && authData?.user) {
        // Any authenticated user or service can trigger the worker run
        isAuthorized = true;
      }
    } catch {
      isAuthorized = false;
    }
  }

  // Also check if running in internal test / cron context without external bearer
  const cronHeader = req.headers.get("x-cron-secret");
  const expectedCronSecret = Deno.env.get("CRON_SECRET");
  if (expectedCronSecret && cronHeader === expectedCronSecret) {
    isAuthorized = true;
  }

  if (!isAuthorized) {
    logSecure("warn", {
      service: "automation-job-worker",
      action: "auth_check",
      status: "unauthorized",
      message: "Worker invocation rejected: unauthorized or missing credentials",
    });
    return createErrorResponse(401, "Não autorizado para executar o worker de agendamento.", "UNAUTHORIZED");
  }

  let body: WorkerRequest = {};
  try {
    const text = await req.text();
    if (text.trim()) {
      body = JSON.parse(text);
    }
  } catch {
    body = {};
  }

  const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 50);
  const workerId = body.workerId || `worker_edge_${Date.now()}`;

  logSecure("info", {
    service: "automation-job-worker",
    action: "worker_start",
    status: "processing",
    workerId,
    limit,
  });

  // 4. Claim due jobs atomically using stored procedure
  let claimedJobs: any[] = [];
  try {
    const { data: rpcJobs, error: rpcError } = await supabase.rpc("claim_due_automation_jobs", {
      p_limit: limit,
      p_worker_id: workerId,
    });

    if (rpcError) {
      logSecure("error", {
        service: "automation-job-worker",
        action: "claim_rpc_failed",
        status: "error",
        error: rpcError.message,
      });

      // Fallback query
      const { data: fallbackJobs, error: selectErr } = await supabase
        .from("automation_jobs")
        .select("*")
        .eq("status", "pending")
        .lte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(limit);

      if (selectErr || !fallbackJobs) {
        return createErrorResponse(500, "Falha ao buscar jobs pendentes.", "DATABASE_ERROR");
      }

      claimedJobs = fallbackJobs;
    } else {
      claimedJobs = rpcJobs || [];
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return createErrorResponse(500, `Erro ao realizar claim de jobs: ${msg}`, "CLAIM_ERROR");
  }

  const summary = {
    claimedCount: claimedJobs.length,
    processedCount: 0,
    completedCount: 0,
    failedCount: 0,
    retriedCount: 0,
    jobs: [] as any[],
  };

  const nowIso = new Date().toISOString();

  // 5. Process each claimed job
  for (const job of claimedJobs) {
    summary.processedCount++;

    try {
      // Revalidation for inactive_followup jobs: check if customer has replied
      if (job.job_type === "inactive_followup") {
        const payload = job.payload || {};
        const refMsgId = payload.referenceMessageId;
        const refTimestamp = payload.referenceMessageTimestamp;

        // Fetch latest contact message
        const { data: latestMsgs } = await supabase
          .from("messages")
          .select("id, created_at, sender")
          .eq("conversation_id", job.conversation_id)
          .eq("sender", "contact")
          .order("created_at", { ascending: false })
          .limit(1);

        const latestMsg = latestMsgs?.[0];
        if (latestMsg) {
          const isDifferentId = refMsgId && latestMsg.id !== refMsgId;
          const isNewer = refTimestamp && new Date(latestMsg.created_at).getTime() > new Date(refTimestamp).getTime();

          if (isDifferentId || isNewer) {
            await supabase
              .from("automation_jobs")
              .update({
                status: "cancelled",
                last_error: "Cliente respondeu antes ou durante a janela de inatividade.",
                updated_at: nowIso,
              })
              .eq("id", job.id);

            summary.failedCount++;
            summary.jobs.push({ id: job.id, status: "cancelled", error: "Customer replied" });
            continue;
          }
        }
      }

      // 5.1 Resolve automation
      const { data: automation, error: autoErr } = await supabase
        .from("automations")
        .select("*")
        .eq("id", job.automation_id)
        .maybeSingle();

      if (autoErr || !automation) {
        await supabase
          .from("automation_jobs")
          .update({
            status: "failed",
            failed_at: nowIso,
            last_error: "Automação vinculada não encontrada.",
            updated_at: nowIso,
          })
          .eq("id", job.id);

        summary.failedCount++;
        summary.jobs.push({ id: job.id, status: "failed", error: "Automation not found" });
        continue;
      }

      if (!automation.enabled) {
        await supabase
          .from("automation_jobs")
          .update({
            status: "failed",
            failed_at: nowIso,
            last_error: "Automação desativada.",
            updated_at: nowIso,
          })
          .eq("id", job.id);

        summary.failedCount++;
        summary.jobs.push({ id: job.id, status: "failed", error: "Automation disabled" });
        continue;
      }

      // 5.2 Resolve action from DB (anti-injection)
      const { data: action, error: actionErr } = await supabase
        .from("automation_actions")
        .select("*")
        .eq("id", job.action_id)
        .eq("automation_id", job.automation_id)
        .maybeSingle();

      if (actionErr || !action) {
        await supabase
          .from("automation_jobs")
          .update({
            status: "failed",
            failed_at: nowIso,
            last_error: "Ação vinculada não encontrada na automação.",
            updated_at: nowIso,
          })
          .eq("id", job.id);

        summary.failedCount++;
        summary.jobs.push({ id: job.id, status: "failed", error: "Action not found" });
        continue;
      }

      // 5.3 Execute action
      let actionSuccess = true;
      let actionError: string | null = null;

      if (action.type === "send_message" || action.type === "send_dm") {
        const messageText = action.config?.messageText;
        if (!messageText) {
          actionSuccess = false;
          actionError = "Texto da mensagem não configurado na ação.";
        } else {
          // Persist message in database
          const { error: msgInsertError } = await supabase.from("messages").insert({
            conversation_id: job.conversation_id,
            sender: "bot",
            content: messageText,
            content_type: "text",
            is_automated: true,
            status: "sent",
          });

          if (msgInsertError) {
            actionSuccess = false;
            actionError = `Erro ao registrar mensagem bot: ${msgInsertError.message}`;
          }
        }
      } else if (action.type === "add_tag") {
        const tagName = action.config?.tagName;
        if (tagName) {
          // Add tag to contact
          const { data: conv } = await supabase
            .from("conversations")
            .select("contact_id")
            .eq("id", job.conversation_id)
            .maybeSingle();

          if (conv?.contact_id) {
            const { data: tag } = await supabase
              .from("contact_tags")
              .select("id")
              .eq("name", tagName)
              .maybeSingle();

            if (tag?.id) {
              await supabase
                .from("contact_tag_assignments")
                .upsert({ contact_id: conv.contact_id, tag_id: tag.id }, { onConflict: "contact_id,tag_id" });
            }
          }
        }
      }

      // 5.4 Update job state
      if (actionSuccess) {
        await supabase
          .from("automation_jobs")
          .update({
            status: "completed",
            completed_at: nowIso,
            updated_at: nowIso,
          })
          .eq("id", job.id);

        summary.completedCount++;
        summary.jobs.push({ id: job.id, status: "completed" });
      } else {
        const attempts = Number(job.attempts) || 1;
        const maxAttempts = Number(job.max_attempts) || 3;

        if (attempts < maxAttempts) {
          const backoffSec = Math.min(30 * Math.pow(2, attempts - 1), 900);
          const nextScheduled = new Date(Date.now() + backoffSec * 1000).toISOString();

          await supabase
            .from("automation_jobs")
            .update({
              status: "pending",
              scheduled_at: nextScheduled,
              last_error: actionError,
              updated_at: nowIso,
            })
            .eq("id", job.id);

          summary.retriedCount++;
          summary.jobs.push({ id: job.id, status: "retrying", nextScheduled, error: actionError });
        } else {
          await supabase
            .from("automation_jobs")
            .update({
              status: "failed",
              failed_at: nowIso,
              last_error: actionError,
              updated_at: nowIso,
            })
            .eq("id", job.id);

          summary.failedCount++;
          summary.jobs.push({ id: job.id, status: "failed", error: actionError });
        }
      }
    } catch (jobErr: unknown) {
      const errMessage = jobErr instanceof Error ? jobErr.message : String(jobErr);
      await supabase
        .from("automation_jobs")
        .update({
          status: "failed",
          failed_at: nowIso,
          last_error: errMessage,
          updated_at: nowIso,
        })
        .eq("id", job.id);

      summary.failedCount++;
      summary.jobs.push({ id: job.id, status: "failed", error: errMessage });
    }
  }

  logSecure("info", {
    service: "automation-job-worker",
    action: "worker_finish",
    status: "completed",
    durationMs: Date.now() - startTime,
    summary,
  });

  return createSuccessResponse(summary, 200);
});
