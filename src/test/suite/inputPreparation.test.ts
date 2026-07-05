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

    it('detectTableData preserves inconsistent comma-rich rows verbatim when table parsing is ambiguous', () => {
        const result = detectTableData(
            'Fixed plant and equipment - Uncontrolled energy release from fixed plant (electrical, mechanical, stored energy) - FPE-03,Use of tools and equipment - Tool or equipment failure/malfunction leading to injury - TOOL-02\n'
            + 'Fixed plant and equipment - Uncontrolled energy release from fixed plant (electrical, mechanical, stored energy) - FPE-03,Working with energised systems - Uncontrolled release of energy (live electrical work) - WES-02\n'
            + 'Ground disturbance (excavation, pits, slopes, underground services) - Contact with underground services - GRD-05,Ground disturbance (excavation, pits, slopes, underground services) - Excavation flooding - GRD-03,Ground disturbance (excavation, pits, slopes, underground services) - Ground or slope failure\t- GRD-01\n'
            + 'Ground disturbance (excavation, pits, slopes, underground services) - Fall of object from one level to another - GRD-04,Mobile plant and equipment - Loss of control over mobile plant - MPE-02'
        );

        assert.strictEqual(result.hasHeaders, false);
        assert.deepStrictEqual(result.data, [
            [
                'Fixed plant and equipment - Uncontrolled energy release from fixed plant (electrical, mechanical, stored energy) - FPE-03',
                'Use of tools and equipment - Tool or equipment failure/malfunction leading to injury - TOOL-02'
            ],
            [
                'Fixed plant and equipment - Uncontrolled energy release from fixed plant (electrical, mechanical, stored energy) - FPE-03',
                'Working with energised systems - Uncontrolled release of energy (live electrical work) - WES-02'
            ],
            [
                'Ground disturbance (excavation, pits, slopes, underground services) - Contact with underground services - GRD-05',
                'Ground disturbance (excavation, pits, slopes, underground services) - Excavation flooding - GRD-03',
                'Ground disturbance (excavation, pits, slopes, underground services) - Ground or slope failure\t- GRD-01'
            ],
            [
                'Ground disturbance (excavation, pits, slopes, underground services) - Fall of object from one level to another - GRD-04',
                'Mobile plant and equipment - Loss of control over mobile plant - MPE-02'
            ]
        ]);
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

    it('prepareClipboardValuesForDirectPaste can flatten all values from no-header multi-column data', async () => {
        const result = await prepareClipboardValuesForDirectPaste(
            'A1,B1\nA2,B2',
            () => {
                throw new Error('parseValues should not be used for detected tabular data.');
            },
            async () => 'All values (flatten every field into the list)'
        );

        assert.deepStrictEqual(result, {
            values: ['A1', 'B1', 'A2', 'B2'],
            suggestedColumnName: '',
            source: 'flattened_values'
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

    it('prepareClipboardValuesForDirectPaste can flatten inconsistent comma-rich rows when table parsing is ambiguous', async () => {
        const result = await prepareClipboardValuesForDirectPaste(
            'Fixed plant and equipment - Uncontrolled energy release from fixed plant (electrical, mechanical, stored energy) - FPE-03,Use of tools and equipment - Tool or equipment failure/malfunction leading to injury - TOOL-02\n'
            + 'Fixed plant and equipment - Uncontrolled energy release from fixed plant (electrical, mechanical, stored energy) - FPE-03,Working with energised systems - Uncontrolled release of energy (live electrical work) - WES-02\n'
            + 'Ground disturbance (excavation, pits, slopes, underground services) - Contact with underground services - GRD-05,Ground disturbance (excavation, pits, slopes, underground services) - Excavation flooding - GRD-03,Ground disturbance (excavation, pits, slopes, underground services) - Ground or slope failure\t- GRD-01\n'
            + 'Ground disturbance (excavation, pits, slopes, underground services) - Fall of object from one level to another - GRD-04,Mobile plant and equipment - Loss of control over mobile plant - MPE-02',
            () => {
                throw new Error('parseValues should not be used for detected tabular data.');
            },
            async () => 'All values (flatten every field into the list)'
        );

        assert.deepStrictEqual(result, {
            values: [
                'Fixed plant and equipment - Uncontrolled energy release from fixed plant (electrical, mechanical, stored energy) - FPE-03',
                'Use of tools and equipment - Tool or equipment failure/malfunction leading to injury - TOOL-02',
                'Fixed plant and equipment - Uncontrolled energy release from fixed plant (electrical, mechanical, stored energy) - FPE-03',
                'Working with energised systems - Uncontrolled release of energy (live electrical work) - WES-02',
                'Ground disturbance (excavation, pits, slopes, underground services) - Contact with underground services - GRD-05',
                'Ground disturbance (excavation, pits, slopes, underground services) - Excavation flooding - GRD-03',
                'Ground disturbance (excavation, pits, slopes, underground services) - Ground or slope failure\t- GRD-01',
                'Ground disturbance (excavation, pits, slopes, underground services) - Fall of object from one level to another - GRD-04',
                'Mobile plant and equipment - Loss of control over mobile plant - MPE-02'
            ],
            suggestedColumnName: '',
            source: 'flattened_values'
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
