/**
 * Supabase-based telemetry collector for SQL IN Clause Generator
 * Minimal, privacy-first, async, and non-blocking.
 */
import { TelemetryEvent, TelemetryCollector, TelemetryScalar } from './types';
import { buildSafeErrorProperties, formatSydneyTimestamp, hashAnonymousUserId, sanitizeTelemetryEvent } from './privacy';
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

export class SupabaseTelemetryCollector implements TelemetryCollector {
  private queue: TelemetryEvent[] = [];
  private flushTimer: NodeJS.Timeout | undefined;
  private flushing = false;
  private activeFlush: Promise<void> | undefined;
  private consecutiveFailures = 0;
  private readonly batchSize = 20;
  private readonly flushInterval = 60000; // 1 minute
  private readonly maxQueueSize = 200;
  private readonly maxRetries = 3;

  constructor() {
    this.flushTimer = setInterval(() => this.flush(), this.flushInterval);
  }

  async logEvent(
    eventName: string,
    properties?: Record<string, TelemetryScalar>,
    measurements?: Record<string, number>
  ): Promise<void> {
    if (!isTelemetryEnabled()) return;

    const event = sanitizeTelemetryEvent({
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      event_name: eventName,
      timestamp: formatSydneyTimestamp(),
      session_id: vscode.env.sessionId || '',
      user_id: this.getAnonymousUserId(),
      extension_version: vscode.extensions.getExtension(EXTENSION_ID)?.packageJSON.version || 'unknown',
      vscode_version: this.getAppVersion(),
      platform: process.platform,
      properties,
      measurements
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
    // Detect app version (VS Code or legacy Azure Data Studio)
    const appName = vscode.env.appName || '';
    if (appName.toLowerCase().includes('azure data studio')) {
      // Legacy: Azure Data Studio retired Feb 28, 2026
      const envVer = process.env['AZURE_DATA_STUDIO_VERSION'];
      if (envVer) return envVer;
      // Parse from appName (e.g., "Azure Data Studio - 1.100.2")
      const match = appName.match(/(\d+\.\d+\.\d+)/);
      if (match) return match[1];
      return 'AzureDataStudio';
    }
    return vscode.version;
  }

  async logError(error: Error, context?: string, properties?: Record<string, TelemetryScalar>): Promise<void> {
    await this.logEvent('error', {
      ...properties,
      ...buildSafeErrorProperties(error, context)
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
    this.flushing = true;

    try {
      while (isTelemetryEnabled() && this.queue.length > 0) {
        const eventsToSend = this.queue.splice(0, this.batchSize);
        const shouldContinue = await this.sendBatch(eventsToSend);
        if (!shouldContinue) {
          break;
        }
      }
    } finally {
      this.flushing = false;
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
