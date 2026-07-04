/**
 * Supabase-based telemetry collector for SQL IN Clause Generator
 * Minimal, privacy-first, async, and non-blocking.
 */
import { TelemetryEvent, TelemetryCollector, TelemetryScalar } from './types';
import { buildSafeErrorProperties, bucketValueCount, formatSydneyTimestamp, generateUuidV7, hashAnonymousUserId } from './privacy';
import { buildTelemetryInsertEvent } from './event-builder';
import * as vscode from 'vscode';

const EXTENSION_ID = 'YakovT.sql-in-query-statement-generator';
const SUPABASE_URL = 'https://yomxzbdletcfnjsrlnsk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvbXh6YmRsZXRjZm5qc3JsbnNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1NTcwNDUsImV4cCI6MjA2NDEzMzA0NX0.gTrhsdftNEMFIwVz8sD4xwM05iGVqeLZjgC_cifZrj4';

import type { SupabaseClient } from '@supabase/supabase-js';

const telemetryOutputChannel = vscode.window.createOutputChannel('SQL IN Clause Telemetry');

// Lazy import to avoid dependency if not needed
let supabase: SupabaseClient | undefined = undefined;
async function getSupabaseClient() {
  if (!supabase) {
    const { createClient } = await import('@supabase/supabase-js');
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  }
  return supabase;
}

function isTelemetryEnabled(): boolean {
  // Respect both VS Code global and extension-specific settings
  const globalEnabled = vscode.env.isTelemetryEnabled;
  const extEnabled = vscode.workspace.getConfiguration('inQueryGenerator.telemetry').get<boolean>('enabled', true);
  return globalEnabled && extEnabled;
}

export interface SqlGenerationTelemetry {
  command: string;
  clauseType: 'IN' | 'NOT IN';
  dataTypeMode: string;
  usedDistinct: boolean;
  duplicatesRemoved: number;
  uniqueValueCount: number;
  origin: 'direct' | 'paste_special' | 'column' | 'batch' | 'copy';
}

export class SupabaseTelemetryCollector implements TelemetryCollector {
  private queue: TelemetryEvent[] = [];
  private flushTimer: NodeJS.Timeout | undefined;
  private activeFlush: Promise<void> | undefined;
  private consecutiveFailures = 0;
  private readonly batchSize = 20;
  private readonly flushInterval = 60000; // 1 minute
  private readonly maxQueueSize = 200;
  private readonly maxRetries = 3;
  private readonly isDev: boolean;

  constructor(extensionMode: vscode.ExtensionMode = vscode.ExtensionMode.Production) {
    this.isDev = extensionMode !== vscode.ExtensionMode.Production;
    this.flushTimer = setInterval(() => this.flush(), this.flushInterval);
  }

  async logEvent(
    eventName: string,
    properties?: Record<string, TelemetryScalar>,
    measurements?: Record<string, number>
  ): Promise<void> {
    if (!isTelemetryEnabled()) return;

    const event = buildTelemetryInsertEvent({
      id: generateUuidV7(),
      eventName,
      timestamp: formatSydneyTimestamp(),
      sessionId: vscode.env.sessionId || '',
      userId: this.getAnonymousUserId(),
      extensionVersion: vscode.extensions.getExtension(EXTENSION_ID)?.packageJSON.version || 'unknown',
      vscodeVersion: this.getAppVersion(),
      platform: process.platform,
      properties,
      measurements,
      context: { is_dev: this.isDev }
    });

    this.queue.push(event);
    this.trimQueueToLimit();
    if (this.queue.length >= this.batchSize) {
      await this.flush();
    }
  }

  // --- Helper methods moved to class scope ---
  private getAnonymousUserId(): string {
    return hashAnonymousUserId(vscode.env.machineId, EXTENSION_ID);
  }

  private getAppVersion(): string {
    return vscode.version;
  }

  async logError(error: Error, context?: string, properties?: Record<string, TelemetryScalar>): Promise<void> {
    await this.logEvent('error', {
      ...properties,
      ...buildSafeErrorProperties(error, context)
    });
  }

  async logSqlGeneration(details: SqlGenerationTelemetry): Promise<void> {
    await this.logEvent('sql_generation', {
      command: details.command,
      clause_type: details.clauseType,
      data_type_mode: details.dataTypeMode,
      used_distinct: details.usedDistinct,
      duplicates_removed: details.duplicatesRemoved,
      value_count_bucket: bucketValueCount(details.uniqueValueCount),
      origin: details.origin
    });
  }

  async flush(): Promise<void> {
    if (this.activeFlush) {
      await this.activeFlush;
      return;
    }

    if (!isTelemetryEnabled() || this.queue.length === 0) return;

    const flushPromise = this.runFlushLoop();
    this.activeFlush = flushPromise;

    try {
      await flushPromise;
    } finally {
      if (this.activeFlush === flushPromise) {
        this.activeFlush = undefined;
      }
    }
  }

  private async runFlushLoop(): Promise<void> {
    while (isTelemetryEnabled() && this.queue.length > 0) {
      const eventsToSend = this.queue.splice(0, this.batchSize);
      const shouldContinue = await this.sendBatch(eventsToSend);
      if (!shouldContinue) {
        break;
      }
    }
  }

  private async sendBatch(eventsToSend: TelemetryEvent[]): Promise<boolean> {
    try {
      const client = await getSupabaseClient();
      const { error, status } = await client.from('extension_telemetry').insert(eventsToSend);
      if (error) {
        const isPermanent = typeof status === 'number' && status >= 400 && status < 500 && status !== 429;
        if (isPermanent) {
          telemetryOutputChannel.appendLine(
            `[Telemetry] Dropped ${eventsToSend.length} event(s) after permanent error: ${error.message} (status: ${status})`
          );
          this.consecutiveFailures = 0;
          return true;
        }

        this.handleTransientFailure(eventsToSend, `${error.message} (status: ${status})`);
        return false;
      }

      this.consecutiveFailures = 0;
      return true;
    } catch (err) {
      this.handleTransientFailure(eventsToSend, err instanceof Error ? err.message : String(err));
      return false;
    }
  }

  private handleTransientFailure(events: TelemetryEvent[], message: string): void {
    this.consecutiveFailures += 1;
    telemetryOutputChannel.appendLine(
      `[Telemetry] Send failed (attempt ${this.consecutiveFailures}/${this.maxRetries}): ${message}`
    );

    if (this.consecutiveFailures <= this.maxRetries) {
      this.queue.unshift(...events);
      this.trimQueueToLimit();
      return;
    }

    telemetryOutputChannel.appendLine(`[Telemetry] Retry limit reached; dropping ${events.length} event(s).`);
    this.consecutiveFailures = 0;
  }

  private trimQueueToLimit(): void {
    const overflow = this.queue.length - this.maxQueueSize;
    if (overflow > 0) {
      this.queue.splice(0, overflow);
    }
  }

  async dispose(): Promise<void> {
    if (this.flushTimer) clearInterval(this.flushTimer);
    if (this.activeFlush) {
      await this.activeFlush;
    }
    await this.flush();
  }
}
