import { sanitizeTelemetryEvent } from './privacy';
import { TelemetryContextValue, TelemetryEvent, TelemetryScalar } from './types';

export interface TelemetryEventBuildInput {
  id: string;
  eventName: string;
  timestamp: string;
  sessionId: string;
  userId?: string;
  extensionVersion: string;
  vscodeVersion: string;
  platform: string;
  properties?: Record<string, TelemetryScalar>;
  measurements?: Record<string, number>;
  context?: Record<string, TelemetryContextValue>;
}

export function buildTelemetryInsertEvent(input: TelemetryEventBuildInput): TelemetryEvent {
  const event: TelemetryEvent = {
    id: input.id,
    event_name: input.eventName,
    timestamp: input.timestamp,
    session_id: input.sessionId,
    user_id: input.userId,
    extension_version: input.extensionVersion,
    vscode_version: input.vscodeVersion,
    platform: input.platform,
    properties: input.properties,
    measurements: input.measurements
  };

  if (input.context) {
    return sanitizeTelemetryEvent({
      ...event,
      context: input.context
    });
  }

  return sanitizeTelemetryEvent(event);
}
