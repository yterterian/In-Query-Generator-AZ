import * as assert from 'assert';
import { buildSafeErrorProperties, formatSydneyTimestamp, getDurationSeconds, hashAnonymousUserId } from '../../telemetry/privacy';

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

  it('getDurationSeconds returns a non-negative rounded duration', () => {
    const duration = getDurationSeconds('2026-05-29T00:00:00.000Z', new Date('2026-05-29T00:00:04.400Z'));
    assert.strictEqual(duration, 4);
  });
});
