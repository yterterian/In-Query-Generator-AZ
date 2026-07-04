import * as assert from 'assert';
import {
  TELEMETRY_FIELD_LIMITS,
  buildSafeErrorProperties,
  clampTelemetryString,
  formatSydneyTimestamp,
  getDurationSeconds,
  hashAnonymousUserId,
  sanitizeTelemetryEvent
} from '../../telemetry/privacy';
import { TelemetryEvent } from '../../telemetry/types';

describe('Telemetry Privacy Tests', () => {
  it('hashAnonymousUserId returns a stable SHA-256 hash', () => {
    const firstHash = hashAnonymousUserId('machine-123', 'publisher.extension');
    const secondHash = hashAnonymousUserId('machine-123', 'publisher.extension');

    assert.strictEqual(firstHash, secondHash);
    assert.match(firstHash, /^[a-f0-9]{64}$/);
    assert.notStrictEqual(firstHash, 'machine-123');
  });

  it('formatSydneyTimestamp uses +11:00 during daylight saving time', () => {
    const timestamp = formatSydneyTimestamp(new Date('2026-01-15T00:00:00Z'));
    assert.ok(timestamp.endsWith('+11:00'));
  });

  it('formatSydneyTimestamp uses +10:00 outside daylight saving time', () => {
    const timestamp = formatSydneyTimestamp(new Date('2026-06-15T00:00:00Z'));
    assert.ok(timestamp.endsWith('+10:00'));
  });

  it('buildSafeErrorProperties omits raw error message and stack data', () => {
    const error = new TypeError('C:\\sensitive\\path.sql failed to parse') as TypeError & { code?: string };
    error.code = 'E_PARSE';
    error.stack = 'stack trace that should not be sent';

    const properties = buildSafeErrorProperties(error, 'activation');

    assert.deepStrictEqual(properties, {
      error_name: 'TypeError',
      error_context: 'activation',
      error_code: 'E_PARSE'
    });
  });

  it('clampTelemetryString truncates values that exceed the schema limit', () => {
    assert.strictEqual(clampTelemetryString('abcdef', 4), 'abcd');
    assert.strictEqual(clampTelemetryString('abcd', 4), 'abcd');
  });

  it('sanitizeTelemetryEvent clamps fixed-width top-level fields and preserves session_id', () => {
    const event: TelemetryEvent = {
      id: 'evt_123',
      event_name: 'x'.repeat(TELEMETRY_FIELD_LIMITS.event_name + 5),
      timestamp: '2026-07-04T12:00:00+10:00',
      session_id: 's'.repeat(200),
      user_id: 'u'.repeat(TELEMETRY_FIELD_LIMITS.user_id + 5),
      extension_version: '1'.repeat(TELEMETRY_FIELD_LIMITS.extension_version + 5),
      vscode_version: '2'.repeat(TELEMETRY_FIELD_LIMITS.vscode_version + 5),
      platform: '3'.repeat(TELEMETRY_FIELD_LIMITS.platform + 5)
    };

    const sanitized = sanitizeTelemetryEvent(event);

    assert.strictEqual(sanitized.event_name.length, TELEMETRY_FIELD_LIMITS.event_name);
    assert.strictEqual(sanitized.user_id?.length, TELEMETRY_FIELD_LIMITS.user_id);
    assert.strictEqual(sanitized.extension_version.length, TELEMETRY_FIELD_LIMITS.extension_version);
    assert.strictEqual(sanitized.vscode_version.length, TELEMETRY_FIELD_LIMITS.vscode_version);
    assert.strictEqual(sanitized.platform.length, TELEMETRY_FIELD_LIMITS.platform);
    assert.strictEqual(sanitized.session_id.length, 200);
  });

  it('getDurationSeconds returns a non-negative rounded duration', () => {
    const duration = getDurationSeconds('2026-05-29T00:00:00.000Z', new Date('2026-05-29T00:00:04.400Z'));
    assert.strictEqual(duration, 4);
  });
});
