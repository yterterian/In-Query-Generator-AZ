import * as assert from 'assert';
import {
    detectTableData,
    prepareClipboardValuesForColumnPaste,
    prepareClipboardValuesForDirectPaste
} from '../../inputPreparation';

describe('Input Preparation Tests', () => {
    it('detectTableData preserves single-column comma values as non-header data', () => {
        const result = detectTableData('"Smith, John"\n"Doe, Jane"');

        assert.strictEqual(result.hasHeaders, false);
        assert.deepStrictEqual(result.data, [['Smith, John'], ['Doe, Jane']]);
    });

    it('prepareClipboardValuesForDirectPaste selects a column from no-header tabular data', async () => {
        const result = await prepareClipboardValuesForDirectPaste(
            '1\tJohn\n2\tJane',
            () => {
                throw new Error('parseValues should not be used for detected tabular data.');
            },
            async () => 'Column 2'
        );

        assert.deepStrictEqual(result, {
            values: ['John', 'Jane'],
            suggestedColumnName: '',
            source: 'selected_column'
        });
    });

    it('prepareClipboardValuesForDirectPaste falls back to parseValues for plain text input', async () => {
        let parseCallCount = 0;
        const result = await prepareClipboardValuesForDirectPaste(
            'alpha\nbeta',
            text => {
                parseCallCount++;
                assert.strictEqual(text, 'alpha\nbeta');
                return ['alpha', 'beta'];
            },
            async () => {
                throw new Error('promptForColumn should not be called for plain text input.');
            }
        );

        assert.strictEqual(parseCallCount, 1);
        assert.deepStrictEqual(result, {
            values: ['alpha', 'beta'],
            suggestedColumnName: '',
            source: 'parsed_text'
        });
    });

    it('prepareClipboardValuesForColumnPaste carries inferred single-column headers through', async () => {
        const result = await prepareClipboardValuesForColumnPaste(
            '"Product Name"\n"iPhone 13, 128GB"\n"Samsung Galaxy, S22"',
            async () => {
                throw new Error('promptForColumn should not be called for single-column data.');
            }
        );

        assert.deepStrictEqual(result, {
            values: ['iPhone 13, 128GB', 'Samsung Galaxy, S22'],
            suggestedColumnName: 'Product Name',
            source: 'detected_single_column'
        });
    });

    it('prepareClipboardValuesForColumnPaste falls back to raw lines for unstructured text', async () => {
        const result = await prepareClipboardValuesForColumnPaste(
            'alpha\nbeta',
            async () => {
                throw new Error('promptForColumn should not be called for raw single-column text.');
            }
        );

        assert.deepStrictEqual(result, {
            values: ['alpha', 'beta'],
            suggestedColumnName: '',
            source: 'raw_lines'
        });
    });
});
