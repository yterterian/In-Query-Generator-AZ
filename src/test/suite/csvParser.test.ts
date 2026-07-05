import * as assert from 'assert';
import {
    analyseDelimiters,
    detectAndParseTableData,
    extractSingleColumnValue,
    isSingleColumnWithCommas,
    parseCsvLine
} from '../../utils/csvParser';

describe('CSV Parser Tests', () => {
    describe('parseCsvLine', () => {
        it('should handle simple comma-separated values', () => {
            const result = parseCsvLine('a,b,c');
            assert.deepStrictEqual(result, ['a', 'b', 'c']);
        });

        it('should handle quoted values with commas', () => {
            const result = parseCsvLine('"Smith, John",25,"Engineer, Senior"');
            assert.deepStrictEqual(result, ['Smith, John', '25', 'Engineer, Senior']);
        });

        it('should handle escaped quotes', () => {
            const result = parseCsvLine('"He said ""Hello""",world');
            assert.deepStrictEqual(result, ['He said "Hello"', 'world']);
        });

        it('should handle tab delimiter', () => {
            const result = parseCsvLine('a\tb\tc', '\t');
            assert.deepStrictEqual(result, ['a', 'b', 'c']);
        });

        it('should handle mixed quotes and no quotes', () => {
            const result = parseCsvLine('simple,"with, comma",123');
            assert.deepStrictEqual(result, ['simple', 'with, comma', '123']);
        });

        it('should not split on commas inside parentheses', () => {
            const result = parseCsvLine('Fixed plant (electrical, mechanical) - FPE-03,Tools - TOOL-02');
            assert.deepStrictEqual(result, [
                'Fixed plant (electrical, mechanical) - FPE-03',
                'Tools - TOOL-02'
            ]);
        });

        it('should fall back to plain splitting when brackets are unbalanced', () => {
            const result = parseCsvLine('smiley (,b,c');
            assert.deepStrictEqual(result, ['smiley (', 'b', 'c']);
        });

        it('should still split tab-delimited cells containing parenthetical commas', () => {
            const result = parseCsvLine('Plant (a, b)\tFPE-03', '\t');
            assert.deepStrictEqual(result, ['Plant (a, b)', 'FPE-03']);
        });
    });

    describe('analyseDelimiters', () => {
        it('should prefer tab over comma for consistent data', () => {
            const lines = [
                'Name\tAge\tCity',
                'John\t25\tNew York',
                'Jane\t30\tBoston'
            ];
            const analyses = analyseDelimiters(lines);
            assert.strictEqual(analyses[0].delimiter, '\t');
            assert.ok(analyses[0].confidence > 50);
        });

        it('should detect comma delimiter with quoted values', () => {
            const lines = [
                'Name,Description',
                '"Smith, John","Engineer, Senior"',
                '"Doe, Jane","Manager, Project"'
            ];
            const analyses = analyseDelimiters(lines);
            assert.strictEqual(analyses[0].delimiter, ',');
        });
    });

    describe('detectAndParseTableData', () => {
        it('should detect single column data', () => {
            const text = 'Value 1\nValue 2\nValue 3';
            const result = detectAndParseTableData(text);
            assert.strictEqual(result.hasHeaders, false);
            assert.strictEqual(result.data.length, 3);
            assert.strictEqual(result.data[0].length, 1);
        });

        it('should detect tabular data with headers', () => {
            const text = 'Name\tAge\nJohn\t25\nJane\t30';
            const result = detectAndParseTableData(text);
            assert.strictEqual(result.hasHeaders, true);
            assert.strictEqual(result.data.length, 3);
            assert.strictEqual(result.data[0].length, 2);
            assert.deepStrictEqual(result.data[0], ['Name', 'Age']);
        });

        it('should handle single column with embedded commas', () => {
            const text = '"Smith, John"\n"Doe, Jane"\n"Brown, Bob"';
            const result = detectAndParseTableData(text);
            assert.strictEqual(result.hasHeaders, false);
            assert.strictEqual(result.data.length, 3);
            assert.strictEqual(result.data[0].length, 1);
            assert.strictEqual(result.data[0][0], 'Smith, John');
        });

        it('should not assume headers for multi-column rows without clear labels', () => {
            const text = '1\tJohn\n2\tJane';
            const result = detectAndParseTableData(text);
            assert.strictEqual(result.hasHeaders, false);
            assert.strictEqual(result.data.length, 2);
            assert.deepStrictEqual(result.data[0], ['1', 'John']);
        });

        it('should infer headers for labelled multi-column data', () => {
            const text = 'Customer ID\tCustomer Name\n123\tAlice\n456\tBob';
            const result = detectAndParseTableData(text);
            assert.strictEqual(result.hasHeaders, true);
            assert.strictEqual(result.data.length, 3);
            assert.deepStrictEqual(result.data[0], ['Customer ID', 'Customer Name']);
        });
    });

    describe('isSingleColumnWithCommas', () => {
        it('should detect quoted single-column data', () => {
            const text = '"Smith, John"\n"Doe, Jane"';
            assert.strictEqual(isSingleColumnWithCommas(text), true);
        });

        it('should detect unquoted single-column data with commas', () => {
            const text = 'Red, Green, Blue\nSmall, Medium, Large';
            assert.strictEqual(isSingleColumnWithCommas(text), true);
        });

        it('should not detect true tabular data as single column', () => {
            const text = 'Name\tAge\nJohn\t25';
            assert.strictEqual(isSingleColumnWithCommas(text), false);
        });
    });

    describe('extractSingleColumnValue', () => {
        it('never truncates unquoted single-column lines at embedded commas', () => {
            const line = 'Ground disturbance (excavation, pits, slopes) - GRD-05';
            assert.strictEqual(extractSingleColumnValue(line), line);
        });
    });

    describe('Real-world edge cases', () => {
        it('should handle Excel copy-paste with quoted cells', () => {
            const text = '"Product Name"\n"iPhone 13, 128GB"\n"Samsung Galaxy, S22"\n"Google Pixel, 6"';
            const result = detectAndParseTableData(text);
            assert.strictEqual(result.hasHeaders, true);
            assert.strictEqual(result.data.length, 4);
            assert.strictEqual(result.data[1][0], 'iPhone 13, 128GB');
        });

        it('should handle mixed delimiter confusion', () => {
            const text = 'Name,Age\n"Smith, John",25\n"Doe, Jane",30';
            const result = detectAndParseTableData(text);
            assert.strictEqual(result.hasHeaders, true);
            assert.strictEqual(result.data.length, 3);
            assert.strictEqual(result.data[0].length, 2);
            assert.strictEqual(result.data[1][0], 'Smith, John');
            assert.strictEqual(result.data[1][1], '25');
        });

        it('should handle numbers with thousand separators', () => {
            const text = '"1,234,567"\n"2,345,678"\n"3,456,789"';
            const result = detectAndParseTableData(text);
            assert.strictEqual(result.hasHeaders, false);
            assert.strictEqual(result.data.length, 3);
            assert.strictEqual(result.data[0][0], '1,234,567');
        });
    });
});
