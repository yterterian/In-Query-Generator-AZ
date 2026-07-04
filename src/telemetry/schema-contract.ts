/**
 * Supabase contract for the public.extension_telemetry table, captured from the
 * live schema on 2026-07-04. Update this intentionally alongside any backend
 * migration or payload shape change.
 */
export const EXTENSION_TELEMETRY_TABLE = 'extension_telemetry';

export const EXTENSION_TELEMETRY_WRITABLE_COLUMNS = [
  'id',
  'event_name',
  'timestamp',
  'session_id',
  'user_id',
  'extension_version',
  'vscode_version',
  'platform',
  'properties',
  'measurements',
  'context'
] as const;

export const EXTENSION_TELEMETRY_SERVER_MANAGED_COLUMNS = [
  'created_at'
] as const;

export const TELEMETRY_FIELD_LIMITS = {
  event_name: 50,
  user_id: 64,
  extension_version: 20,
  vscode_version: 30,
  platform: 20
} as const;

export const EXTENSION_TELEMETRY_COLUMN_TYPES = {
  id: 'text',
  event_name: 'character varying',
  timestamp: 'timestamp with time zone',
  session_id: 'text',
  user_id: 'character varying',
  extension_version: 'character varying',
  vscode_version: 'character varying',
  platform: 'character varying',
  properties: 'jsonb',
  measurements: 'jsonb',
  context: 'jsonb',
  created_at: 'timestamp with time zone'
} as const;
