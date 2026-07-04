import type * as vscode from 'vscode';
import { SessionTelemetryState } from '../commandEffects';
import type { TelemetryCollector } from './types';
import { getDurationSeconds } from './privacy';

const PENDING_SUMMARIES_KEY = 'inQueryGenerator.pendingSessionSummaries';
const MAX_PENDING_SUMMARIES = 20;

type PendingSummaries = Record<string, SessionTelemetryState>;
type SessionSummarySink = Pick<TelemetryCollector, 'logEvent'>;

function cloneSessionSummary(session: SessionTelemetryState): SessionTelemetryState {
  return {
    ...session,
    by_command: { ...session.by_command },
    by_clause_type: { ...session.by_clause_type }
  };
}

function flattenCounts(prefix: string, counts: Record<string, number>): Record<string, number> {
  const flat: Record<string, number> = {};
  for (const [key, value] of Object.entries(counts)) {
    flat[`${prefix}_${key}`] = value;
  }
  return flat;
}

export async function persistSessionSummary(
  context: vscode.ExtensionContext,
  session: SessionTelemetryState
): Promise<void> {
  if (session.total_sql_generations === 0) {
    return;
  }

  const pending = context.globalState.get<PendingSummaries>(PENDING_SUMMARIES_KEY, {});
  const persisted = cloneSessionSummary(session);
  persisted.end_time = new Date().toISOString();
  pending[persisted.session_id] = persisted;

  const entries = Object.entries(pending);
  if (entries.length > MAX_PENDING_SUMMARIES) {
    entries
      .sort((a, b) => (a[1].end_time ?? '').localeCompare(b[1].end_time ?? ''))
      .slice(0, entries.length - MAX_PENDING_SUMMARIES)
      .forEach(([key]) => delete pending[key]);
  }

  await context.globalState.update(PENDING_SUMMARIES_KEY, pending);
}

export async function sendPendingSessionSummaries(
  context: vscode.ExtensionContext,
  collector: SessionSummarySink,
  currentSessionId: string
): Promise<void> {
  const pending = context.globalState.get<PendingSummaries>(PENDING_SUMMARIES_KEY, {});
  const remaining: PendingSummaries = {};

  for (const [sessionId, summary] of Object.entries(pending)) {
    if (sessionId === currentSessionId) {
      remaining[sessionId] = summary;
      continue;
    }

    const duration = summary.end_time
      ? getDurationSeconds(summary.start_time, new Date(summary.end_time))
      : undefined;

    const summaryProperties: Record<string, string | number | boolean> = {
      total_sql_generations: summary.total_sql_generations,
      deduped_count: summary.deduped_count,
      duplicates_removed_total: summary.duplicates_removed_total,
      error_count: summary.error_count,
      delivery: 'next_activation'
    };

    if (typeof duration === 'number') {
      summaryProperties.session_duration_seconds = duration;
    }

    await collector.logEvent('session_sql_utilization', summaryProperties);
    await collector.logEvent('session_command_breakdown', flattenCounts('cmd', summary.by_command));
    await collector.logEvent('session_clause_breakdown', flattenCounts('clause', summary.by_clause_type));
  }

  await context.globalState.update(PENDING_SUMMARIES_KEY, remaining);
}
