import { createHash, randomBytes } from 'crypto';
import { TelemetryEvent, TelemetryScalar } from './types';
import { TELEMETRY_FIELD_LIMITS } from './schema-contract';

const SYDNEY_TIME_ZONE = 'Australia/Sydney';
const DEFAULT_SYDNEY_OFFSET = '+10:00';

function normaliseUtcOffset(offsetLabel: string): string {
  const match = offsetLabel.replace('GMT', '').match(/^([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) {
    return DEFAULT_SYDNEY_OFFSET;
  }

  const [, sign, hours, minutes] = match;
  return `${sign}${hours.padStart(2, '0')}:${minutes ?? '00'}`;
}

export function hashAnonymousUserId(machineId: string, extensionId: string): string {
  return createHash('sha256')
    .update(`${extensionId}:${machineId}`, 'utf8')
    .digest('hex');
}

function formatUuidBytes(bytes: Uint8Array): string {
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function generateUuidV7(date: Date = new Date()): string {
  const timestamp = date.getTime();
  const bytes = randomBytes(16);

  bytes[0] = Math.floor(timestamp / 0x10000000000) & 0xff;
  bytes[1] = Math.floor(timestamp / 0x100000000) & 0xff;
  bytes[2] = Math.floor(timestamp / 0x1000000) & 0xff;
  bytes[3] = Math.floor(timestamp / 0x10000) & 0xff;
  bytes[4] = Math.floor(timestamp / 0x100) & 0xff;
  bytes[5] = timestamp & 0xff;

  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return formatUuidBytes(bytes);
}

export function formatSydneyTimestamp(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SYDNEY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset'
  }).formatToParts(date);

  const values: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  }

  const offset = normaliseUtcOffset(values.timeZoneName || DEFAULT_SYDNEY_OFFSET);
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}${offset}`;
}

export function buildSafeErrorProperties(
  error: Error & { code?: unknown },
  context?: string
): Record<string, TelemetryScalar> {
  const properties: Record<string, TelemetryScalar> = {
    error_name: error.name || 'Error'
  };

  if (context) {
    properties.error_context = context;
  }

  if (typeof error.code === 'string' || typeof error.code === 'number') {
    properties.error_code = error.code;
  }

  return properties;
}

export function clampTelemetryString(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}

export function clampString(value: string, maxLength: number): string {
  return clampTelemetryString(value, maxLength);
}

export function bucketValueCount(count: number): string {
  if (count <= 0) return '0';
  if (count <= 10) return '1-10';
  if (count <= 100) return '11-100';
  if (count <= 1000) return '101-1000';
  return '1001+';
}

export function sanitizeTelemetryEvent(event: TelemetryEvent): TelemetryEvent {
  return {
    ...event,
    event_name: clampTelemetryString(event.event_name, TELEMETRY_FIELD_LIMITS.event_name),
    user_id: typeof event.user_id === 'string'
      ? clampTelemetryString(event.user_id, TELEMETRY_FIELD_LIMITS.user_id)
      : event.user_id,
    extension_version: clampTelemetryString(event.extension_version, TELEMETRY_FIELD_LIMITS.extension_version),
    vscode_version: clampTelemetryString(event.vscode_version, TELEMETRY_FIELD_LIMITS.vscode_version),
    platform: clampTelemetryString(event.platform, TELEMETRY_FIELD_LIMITS.platform)
  };
}

export function getDurationSeconds(startTimeIso: string, endDate: Date = new Date()): number | undefined {
  const startTime = Date.parse(startTimeIso);
  if (Number.isNaN(startTime)) {
    return undefined;
  }

  const durationSeconds = Math.round((endDate.getTime() - startTime) / 1000);
  return Math.max(0, durationSeconds);
}
