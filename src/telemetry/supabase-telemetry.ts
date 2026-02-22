/**
 * Supabase-based telemetry collector for SQL IN Clause Generator
 * Minimal, privacy-first, async, and non-blocking.
 */
import { TelemetryEvent, TelemetryCollector } from './types';
import * as vscode from 'vscode';

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
  private readonly batchSize = 20;
  private readonly flushInterval = 60000; // 1 minute

  constructor() {
    this.flushTimer = setInterval(() => this.flush(), this.flushInterval);
  }

  async logEvent(
    eventName: string,
    properties?: Record<string, string | number | boolean>,
    measurements?: Record<string, number>
  ): Promise<void> {
    if (!isTelemetryEnabled()) return;

    const event: TelemetryEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
      event_name: eventName,
      timestamp: this.getSydneyTimestamp(),
      session_id: vscode.env.sessionId || '',
      user_id: this.getAnonymousUserId(),
      extension_version: vscode.extensions.getExtension('YakovT.sql-in-query-statement-generator')?.packageJSON.version || 'unknown',
      vscode_version: this.getAppVersion(),
      platform: process.platform,
      properties,
      measurements,
      context: {
        os: process.platform,
        trigger: properties?.trigger,
        editor: vscode.env.appName,
        sydney_offset: '+10:00'
      }
    };

    this.queue.push(event);
    if (this.queue.length >= this.batchSize) {
      await this.flush();
    }
  }

  // --- Helper methods moved to class scope ---
  private getAnonymousUserId(): string {
    // Use a stable, privacy-preserving hash of machineId + extension ID
    const base = vscode.env.machineId + ':YakovT.sql-in-query-statement-generator';
    // Simple hash: base64 of UTF-8 bytes, truncated for brevity
    return Buffer.from(base, 'utf8').toString('base64').substr(0, 24);
  }

  private getSydneyTimestamp(): string {
    // Use Intl.DateTimeFormat to get Sydney time, then format as ISO string
    const now = new Date();
    const sydneyTime = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Sydney',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).formatToParts(now);

    // Build ISO string in Sydney time
    const dateParts: Record<string, string> = {};
    sydneyTime.forEach(part => {
      if (part.type !== 'literal') dateParts[part.type] = part.value;
    });
    // Format: YYYY-MM-DDTHH:mm:ss+10:00
    return `${dateParts.year}-${dateParts.month}-${dateParts.day}T${dateParts.hour}:${dateParts.minute}:${dateParts.second}+10:00`;
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

  async logError(error: Error, context?: string, properties?: Record<string, string | number | boolean>): Promise<void> {
    await this.logEvent('error', {
      ...properties,
      error_message: error.message,
      error_stack: error.stack || '',
      error_context: context || '',
    });
  }

  async flush(): Promise<void> {
    if (!isTelemetryEnabled() || this.queue.length === 0) return;
    const eventsToSend = this.queue.splice(0, this.batchSize);
    try {
      const client = await getSupabaseClient();
      const { data, error, status } = await client.from('extension_telemetry').insert(eventsToSend);
      if (error) {
        telemetryOutputChannel.appendLine(`[Telemetry] Supabase error: ${error.message} (status: ${status})`);
        telemetryOutputChannel.show(true);
        // Re-queue events for retry
        this.queue.unshift(...eventsToSend);
      }
      // On success, do not log anything
    } catch (err) {
      telemetryOutputChannel.appendLine(`[Telemetry] Failed to send events: ${err instanceof Error ? err.message : String(err)}`);
      telemetryOutputChannel.show(true);
      // Re-queue events for retry
      this.queue.unshift(...eventsToSend);
    }
  }

  async dispose(): Promise<void> {
    if (this.flushTimer) clearInterval(this.flushTimer);
    await this.flush();
  }
}
