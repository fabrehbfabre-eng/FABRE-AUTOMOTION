/**
 * FABRE AUTOMATION - Supabase Automation Job Repository
 * Release 14: Durable Scheduler + Delay Engine
 * 
 * Provides production-grade persistence for delayed actions and scheduled automation jobs.
 */

import { supabase } from '../../../lib/supabase';
import { AutomationJob, AutomationJobStatus, CreateJobInput, ClaimJobsOptions } from '../../../types/jobs';
import { IAutomationJobRepository } from '../IAutomationJobRepository';
import { Database, Json } from '../../../types/database';

type AutomationJobUpdate = Database['public']['Tables']['automation_jobs']['Update'];

function mapJobFromRow(row: any): AutomationJob {
  return {
    id: row.id,
    automationId: row.automation_id,
    conversationId: row.conversation_id,
    actionId: row.action_id,
    jobType: row.job_type,
    status: row.status as AutomationJobStatus,
    scheduledAt: row.scheduled_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    failedAt: row.failed_at,
    attempts: Number(row.attempts) || 0,
    maxAttempts: Number(row.max_attempts) || 3,
    payload: (typeof row.payload === 'object' && row.payload !== null) ? row.payload : {},
    lastError: row.last_error,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseAutomationJobRepository implements IAutomationJobRepository {
  async createJob(input: CreateJobInput): Promise<AutomationJob> {
    const { data, error } = await supabase
      .from('automation_jobs')
      .insert({
        automation_id: input.automationId,
        conversation_id: input.conversationId,
        action_id: input.actionId,
        job_type: input.jobType || 'delayed_action',
        status: 'pending',
        scheduled_at: input.scheduledAt,
        max_attempts: input.maxAttempts !== undefined ? input.maxAttempts : 3,
        attempts: 0,
        payload: (input.payload || {}) as unknown as Json,
        idempotency_key: input.idempotencyKey || null,
      })
      .select()
      .single();

    if (error) {
      const err = new Error(error.message);
      (err as any).code = error.code;
      throw err;
    }

    return mapJobFromRow(data);
  }

  async claimDueJobs(options?: ClaimJobsOptions): Promise<AutomationJob[]> {
    const limit = options?.limit || 10;
    const workerId = options?.workerId || null;

    // Prefer transactional RPC with FOR UPDATE SKIP LOCKED
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('claim_due_automation_jobs', {
        p_limit: limit,
        p_worker_id: workerId,
      });

      if (!rpcError && Array.isArray(rpcData)) {
        return rpcData.map(mapJobFromRow);
      }
    } catch {
      // Fallback below
    }

    // Fallback if RPC is not present: optimistic locking
    const nowIso = options?.now ? options.now.toISOString() : new Date().toISOString();
    const { data: candidates, error: selectError } = await supabase
      .from('automation_jobs')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true })
      .limit(limit);

    if (selectError || !candidates || candidates.length === 0) {
      return [];
    }

    const claimed: AutomationJob[] = [];
    for (const row of candidates) {
      const { data: updated, error: updateError } = await supabase
        .from('automation_jobs')
        .update({
          status: 'processing',
          started_at: nowIso,
          attempts: (Number(row.attempts) || 0) + 1,
          updated_at: nowIso,
        })
        .eq('id', row.id)
        .eq('status', 'pending') // Guard against concurrent claim
        .select()
        .single();

      if (!updateError && updated) {
        claimed.push(mapJobFromRow(updated));
      }
    }

    return claimed;
  }

  async markCompleted(jobId: string): Promise<AutomationJob> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('automation_jobs')
      .update({
        status: 'completed',
        completed_at: now,
        updated_at: now,
      })
      .eq('id', jobId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to mark job completed: ${error.message}`);
    }

    return mapJobFromRow(data);
  }

  async markFailed(jobId: string, error: string): Promise<AutomationJob> {
    const now = new Date().toISOString();
    const { data, error: updateError } = await supabase
      .from('automation_jobs')
      .update({
        status: 'failed',
        failed_at: now,
        last_error: error,
        updated_at: now,
      })
      .eq('id', jobId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to mark job failed: ${updateError.message}`);
    }

    return mapJobFromRow(data);
  }

  async scheduleRetry(jobId: string, nextScheduledAt: string, error: string): Promise<AutomationJob> {
    const job = await this.getJobById(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const now = new Date().toISOString();
    const updates: AutomationJobUpdate = {
      last_error: error,
      updated_at: now,
    };

    if (job.attempts >= job.maxAttempts) {
      updates.status = 'failed';
      updates.failed_at = now;
      updates.last_error = `Max attempts reached (${job.attempts}/${job.maxAttempts}). Last error: ${error}`;
    } else {
      updates.status = 'pending';
      updates.scheduled_at = nextScheduledAt;
    }

    const { data, error: updateError } = await supabase
      .from('automation_jobs')
      .update(updates)
      .eq('id', jobId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to schedule retry: ${updateError.message}`);
    }

    return mapJobFromRow(data);
  }

  async cancelJob(jobId: string, reason?: string, options?: { allowProcessing?: boolean }): Promise<AutomationJob> {
    const job = await this.getJobById(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.status === 'completed') {
      throw new Error(`Cannot cancel an already completed job: ${jobId}`);
    }

    if (job.status === 'processing' && !options?.allowProcessing) {
      throw new Error(`Cannot cancel a job currently in processing state: ${jobId}`);
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('automation_jobs')
      .update({
        status: 'cancelled',
        last_error: reason || 'Cancelled by operator',
        updated_at: now,
      })
      .eq('id', jobId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to cancel job: ${error.message}`);
    }

    return mapJobFromRow(data);
  }

  async cancelPendingJobsForConversation(
    conversationId: string,
    options?: { jobType?: string; reason?: string }
  ): Promise<AutomationJob[]> {
    const now = new Date().toISOString();
    let query = supabase
      .from('automation_jobs')
      .update({
        status: 'cancelled',
        last_error: options?.reason || 'Cancelado por nova atividade na conversa',
        updated_at: now,
      })
      .eq('conversation_id', conversationId)
      .eq('status', 'pending');

    if (options?.jobType) {
      query = query.eq('job_type', options.jobType);
    }

    const { data, error } = await query.select();
    if (error) {
      throw new Error(`Failed to cancel pending jobs for conversation: ${error.message}`);
    }

    return (data || []).map(mapJobFromRow);
  }

  async recoverStaleJobs(staleThresholdMs = 5 * 60 * 1000, now = new Date()): Promise<AutomationJob[]> {
    const thresholdIso = new Date(now.getTime() - staleThresholdMs).toISOString();

    const { data: staleRows, error } = await supabase
      .from('automation_jobs')
      .select('*')
      .eq('status', 'processing')
      .lte('started_at', thresholdIso);

    if (error || !staleRows) {
      return [];
    }

    const recovered: AutomationJob[] = [];
    const nowIso = now.toISOString();

    for (const row of staleRows) {
      const attempts = Number(row.attempts) || 0;
      const maxAttempts = Number(row.max_attempts) || 3;

      const updates: AutomationJobUpdate = {
        updated_at: nowIso,
      };

      if (attempts < maxAttempts) {
        updates.status = 'pending';
        updates.scheduled_at = nowIso;
        updates.last_error = 'Recovered from stale processing state';
      } else {
        updates.status = 'failed';
        updates.failed_at = nowIso;
        updates.last_error = 'Stale processing timeout exceeded max attempts';
      }

      const { data: updated } = await supabase
        .from('automation_jobs')
        .update(updates)
        .eq('id', row.id)
        .select()
        .single();

      if (updated) {
        recovered.push(mapJobFromRow(updated));
      }
    }

    return recovered;
  }

  async getJobById(jobId: string): Promise<AutomationJob | null> {
    const { data, error } = await supabase
      .from('automation_jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (error || !data) return null;
    return mapJobFromRow(data);
  }

  async getJobByIdempotencyKey(key: string): Promise<AutomationJob | null> {
    const { data, error } = await supabase
      .from('automation_jobs')
      .select('*')
      .eq('idempotency_key', key)
      .maybeSingle();

    if (error || !data) return null;
    return mapJobFromRow(data);
  }

  async listJobs(filter?: {
    status?: AutomationJobStatus;
    conversationId?: string;
    automationId?: string;
    limit?: number;
  }): Promise<AutomationJob[]> {
    let query = supabase.from('automation_jobs').select('*');

    if (filter?.status) {
      query = query.eq('status', filter.status);
    }
    if (filter?.conversationId) {
      query = query.eq('conversation_id', filter.conversationId);
    }
    if (filter?.automationId) {
      query = query.eq('automation_id', filter.automationId);
    }

    query = query.order('created_at', { ascending: false });

    if (filter?.limit) {
      query = query.limit(filter.limit);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(mapJobFromRow);
  }
}
