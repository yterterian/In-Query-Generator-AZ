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
            assert.strictEqual(formatValue('2023-01-01', true), "DATE '2023-01-01'");
            assert.strictEqual(formatValue('2023-01-01 12:34:56', true), "TIMESTAMP '2023-01-01 12:34:56'");
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
});
