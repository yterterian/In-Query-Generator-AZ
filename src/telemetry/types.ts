/**
 * Telemetry event types and interfaces for Enhanced In-Query Statement Generator
 * Minimal, privacy-first, and extensible for future scaling.
 */

export interface TelemetryEvent {
  readonly id: string;
  readonly event_name: string;
  readonly timestamp: string;
  readonly session_id: string;
  readonly user_id?: string;
  readonly extension_version: string;
  readonly vscode_version: string;
  readonly platform: string;
  readonly properties?: Record<string, string | number | boolean>;
  readonly measurements?: Record<string, number>;
  readonly context?: Record<string, any>;
}

export interface TelemetryCollector {
  logEvent(
    eventName: string,
    properties?: Record<string, string | number | boolean>,
    measurements?: Record<string, number>
  ): Promise<void>;
  logError(error: Error, context?: string, properties?: Record<string, string | number | boolean>): Promise<void>;
  flush(): Promise<void>;
  dispose(): Promise<void>;
}
