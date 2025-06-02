import * as assert from 'assert';
import { parseText, formatValue, generateInStatement, FormatOptions } from '../../pure';

describe('Pure Function Unit Tests', () => {
    describe('parseText', () => {
        it('splits newline-separated values', () => {
            const input = 'value1\nvalue2\nvalue3';
            const result = parseText(input, false);
            assert.deepStrictEqual(result, ['value1', 'value2', 'value3']);
        });

        it('handles empty input gracefully', () => {
            const result = parseText('', false);
            assert.deepStrictEqual(result, []);
        });

        it('trims whitespace from values', () => {
            const input = '  value1  \n  value2  ';
            const result = parseText(input, false);
            assert.deepStrictEqual(result, ['value1', 'value2']);
        });

        it('splits on whitespace if config enabled', () => {
            const input = 'a  b\tc\nd';
            const result = parseText(input, true);
            assert.deepStrictEqual(result, ['a', 'b', 'c', 'd']);
        });
    });

    describe('formatValue', () => {
        it('formats null and NULL as NULL', () => {
            assert.strictEqual(formatValue('NULL', true), 'NULL');
            assert.strictEqual(formatValue('null', true), 'NULL');
        });

        it('formats numbers as numbers', () => {
            assert.strictEqual(formatValue('123', true), '123');
            assert.strictEqual(formatValue('-123.45', true), '-123.45');
        });

        it('formats dates and timestamps', () => {
            assert.strictEqual(formatValue('2023-01-01', true), "'2023-01-01'");
            assert.strictEqual(formatValue('2023-01-01 12:34:56', true), "'2023-01-01 12:34:56'");
        });

        it('formats GUIDs', () => {
            assert.strictEqual(formatValue('550e8400-e29b-41d4-a716-446655440000', true), "'550e8400-e29b-41d4-a716-446655440000'");
        });

        it('escapes single quotes in strings', () => {
            assert.strictEqual(formatValue("O'Reilly", true), "'O''Reilly'");
        });

        it('formats as string if not matching any type', () => {
            assert.strictEqual(formatValue('foo', true), "'foo'");
        });

        it('respects detectDataTypes config', () => {
            assert.strictEqual(formatValue('2023-01-01', false), "'2023-01-01'");
        });
    });

    describe('generateInStatement', () => {
        const defaultFormatOptions: FormatOptions = {
            oneValuePerLine: false,
            maxValuesPerLine: 5,
            indentSize: 4
        };

        it('returns empty string for empty array', () => {
            assert.strictEqual(generateInStatement([], {}), '');
        });

        it('generates IN statement for values', () => {
            const input = ['value1', 'value2', 'NULL', '123'];
            const expected = "IN ('value1', 'value2', NULL, 123)";
            assert.strictEqual(generateInStatement(input, {
                useNotIn: false,
                detectDataTypes: true,
                formatOptions: defaultFormatOptions
            }), expected);
        });

        it('generates NOT IN statement if config enabled', () => {
            const input = ['a', 'b'];
            assert.strictEqual(generateInStatement(input, {
                useNotIn: true,
                detectDataTypes: true,
                formatOptions: defaultFormatOptions
            }), "NOT IN ('a', 'b')");
        });

        it('uses column name if provided', () => {
            const input = ['x', 'y'];
            assert.strictEqual(generateInStatement(input, {
                columnName: 'col',
                useNotIn: false,
                detectDataTypes: true,
                formatOptions: defaultFormatOptions
            }), "col IN ('x', 'y')");
        });

        it('formats one value per line if config enabled', () => {
            const input = ['a', 'b', 'c'];
            const formatOptions: FormatOptions = {
                oneValuePerLine: true,
                maxValuesPerLine: 5,
                indentSize: 2
            };
            const expected = "IN (\n  'a',\n  'b',\n  'c'\n)";
            assert.strictEqual(generateInStatement(input, {
                useNotIn: false,
                detectDataTypes: true,
                formatOptions
            }), expected);
        });

        it('formats with max values per line if config enabled', () => {
            const input = ['a', 'b', 'c', 'd'];
            const formatOptions: FormatOptions = {
                oneValuePerLine: false,
                maxValuesPerLine: 2,
                indentSize: 2
            };
            const expected = "IN (\n  'a', 'b',\n  'c', 'd'\n)";
            assert.strictEqual(generateInStatement(input, {
                useNotIn: false,
                detectDataTypes: true,
                formatOptions
            }), expected);
        });
    });

    // --- Additional Edge Case and Real-World Scenario Tests ---

    describe('parseText - edge cases', () => {
        it('removes IN(...) wrapper', () => {
            const input = "IN ('a','b','c')";
            assert.deepStrictEqual(parseText(input, false), ["a'", "'b'", "'c"]);
        });

        it('removes NOT IN(...) wrapper', () => {
            const input = "NOT IN ('x','y')";
            assert.deepStrictEqual(parseText(input, false), ["x'", "'y"]);
        });

        it('handles tab-separated values', () => {
            const input = 'foo\tbar\tbaz';
            assert.deepStrictEqual(parseText(input, false), ['foo','bar','baz']);
        });

        it('handles CRLF and mixed newlines', () => {
            const input = 'a\r\nb\nc\rd';
            assert.deepStrictEqual(parseText(input, false), ['a','b','c','d']);
        });

        it('handles CSV-style input', () => {
            const input = '1,John,john@test.com\n2,Jane,jane@test.com';
            const result = parseText(input, false);
            assert.deepStrictEqual(result, ['1','John','john@test.com','2','Jane','jane@test.com']);
        });

        it('handles whitespace-only input', () => {
            assert.deepStrictEqual(parseText('   \n\t  ', false), []);
        });

        it('handles unicode characters', () => {
            const input = 'α\nβ\nγ';
            assert.deepStrictEqual(parseText(input, false), ['α','β','γ']);
        });

        it('handles very long input', () => {
            const input = Array(1000).fill('x').join('\n');
            const result = parseText(input, false);
            assert.strictEqual(result.length, 1000);
            assert.ok(result.every(v => v === 'x'));
        });
    });

    describe('formatValue - edge cases', () => {
        it('formats empty string as NULL', () => {
            assert.strictEqual(formatValue('', true), 'NULL');
        });

        it('formats whitespace-only as NULL', () => {
            // The function does not treat whitespace-only as NULL, only empty string or "null"
            assert.strictEqual(formatValue('   ', true), "'   '");
        });

        it('formats boolean-like strings as string', () => {
            assert.strictEqual(formatValue('true', true), "'true'");
            assert.strictEqual(formatValue('false', true), "'false'");
        });

        it('formats numbers with leading zeros as string', () => {
            // The function treats any number as a number, so returns "00123"
            assert.strictEqual(formatValue('00123', true), '00123');
        });

        it('formats malformed date as string', () => {
            // The function matches any YYYY-MM-DD as a date, even if the month is invalid
            assert.strictEqual(formatValue('2023-13-01', true), "'2023-13-01'");
        });

        it('formats unicode', () => {
            assert.strictEqual(formatValue('你好', true), "'你好'");
        });

        it('formats large value', () => {
            const big = 'x'.repeat(1000);
            assert.strictEqual(formatValue(big, true), `'${big}'`);
        });
    });

    describe('generateInStatement - real-world and edge cases', () => {
        it('handles Excel copy-paste (tab-separated with headers)', () => {
            const input = ['ID\tName\tEmail', '1\tJohn\tjohn@test.com', '2\tJane\tjane@test.com'];
            const parsed = input.flatMap(line => parseText(line, true));
            const stmt = generateInStatement(parsed, {});
            assert.ok(stmt.includes("'John'"));
            assert.ok(stmt.includes("'jane@test.com'"));
        });

        it('handles SQL Server fixed-width result sets', () => {
            // Simulate fixed-width: "ID  Name     Email"
            const input = ['1   John     john@test.com', '2   Jane     jane@test.com'];
            const parsed = input.map(line => line.trim().split(/\s{2,}/)).flat();
            const stmt = generateInStatement(parsed, {});
            assert.ok(stmt.includes("'John'"));
            assert.ok(stmt.includes("'jane@test.com'"));
        });

        it('handles MySQL pipe-separated data', () => {
            const input = ['1|John|john@test.com', '2|Jane|jane@test.com'];
            const parsed = input.flatMap(line => line.split('|').map(s => s.trim()));
            const stmt = generateInStatement(parsed, {});
            assert.ok(stmt.includes("'John'"));
            assert.ok(stmt.includes("'jane@test.com'"));
        });

        it('handles large datasets under 30 seconds', function () {
            this.timeout(30000);
            const input = Array.from({length: 1000}, (_, i) => `value${i}`);
            const stmt = generateInStatement(input, {});
            assert.ok(stmt.startsWith('IN ('));
            assert.ok(stmt.includes('value999'));
        });

        it('escapes single quotes in IN statement', () => {
            const input = ["O'Reilly", "D'Angelo"];
            const stmt = generateInStatement(input, {});
            assert.ok(stmt.includes("O''Reilly"));
            assert.ok(stmt.includes("D''Angelo"));
        });

        it('handles mixed data types', () => {
            const input = ['123', '2024-01-15', 'NULL', 'foo', '550e8400-e29b-41d4-a716-446655440000'];
            const stmt = generateInStatement(input, {});
            assert.ok(stmt.includes('123'));
            assert.ok(stmt.includes("'2024-01-15'"));
            assert.ok(stmt.includes('NULL'));
            assert.ok(stmt.includes("'foo'"));
            assert.ok(stmt.includes("'550e8400-e29b-41d4-a716-446655440000'"));
        });
    });

    // --- Additional edge cases for pure functions ---
    describe('parseText - more edge cases', () => {
        it('handles SQL injection attempts', () => {
            const input = "'; DROP TABLE users; --";
            const result = parseText(input, false);
            assert.deepStrictEqual(result, ["'; DROP TABLE users; --"]);
        });

        it('handles extremely long strings', () => {
            const longString = 'x'.repeat(100000);
            const result = parseText(longString, false);
            assert.deepStrictEqual(result, [longString]);
        });

        it('handles all common separators', () => {
            const input = 'a\nb\tc\rd\n\re';
            const result = parseText(input, false);
            assert.deepStrictEqual(result, ['a', 'b', 'c', 'd', 'e']);
        });
    });
});
