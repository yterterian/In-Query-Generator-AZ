import { detectAndParseTableData, extractSingleColumnValue, isSingleColumnWithCommas } from './utils/csvParser';

export interface DetectedTableData {
    hasHeaders: boolean;
    data: string[][];
    debugInfo?: string;
}

export type ClipboardPreparationSource =
    | 'parsed_text'
    | 'selected_column'
    | 'selected_lines'
    | 'flattened_values'
    | 'detected_single_column'
    | 'raw_lines';

export interface PreparedClipboardValues {
    values: string[];
    suggestedColumnName: string;
    source: ClipboardPreparationSource;
}

type ColumnChoice = {
    label: string;
    index: number;
};

type ColumnSelection =
    | { kind: 'column'; index: number }
    | { kind: 'lines' }
    | { kind: 'flatten' };

export interface ColumnPromptItem {
    label: string;
    description: string;
    detail?: string;
    selection: ColumnSelection;
}

type PromptForColumn = (items: ColumnPromptItem[], placeHolder: string) => Promise<ColumnPromptItem | undefined>;

const EACH_LINE_AS_VALUE_LABEL = 'Each line as one value';
const FLATTEN_ALL_VALUES_LABEL = 'All values (flatten every field into the list)';

function hasMultipleColumns(data: string[][]): boolean {
    return data.length > 0 && data[0].length > 1;
}

function getColumnChoices(data: string[][], hasHeaders: boolean): ColumnChoice[] {
    const firstRow = data[0] ?? [];

    return firstRow.map((header, index) => ({
        label: hasHeaders && header ? header : `Column ${index + 1}`,
        index
    }));
}

function getDataRows(data: string[][], hasHeaders: boolean): string[][] {
    return hasHeaders ? data.slice(1) : data;
}

function getNonEmptyColumnValues(dataRows: string[][], columnIndex: number): string[] {
    return dataRows
        .map(row => row[columnIndex] || '')
        .filter(val => val !== '');
}

function getFlattenedNonEmptyValues(dataRows: string[][]): string[] {
    return dataRows
        .flatMap(row => row)
        .map(value => value || '')
        .filter(value => value !== '');
}

function getTrimmedNonEmptyLines(text: string): string[] {
    return text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);
}

function formatValueCount(count: number): string {
    return `${count} value${count === 1 ? '' : 's'}`;
}

function shouldUseDetectedSingleColumnData(
    clipboardText: string,
    hasHeaders: boolean,
    data: string[][]
): boolean {
    return data.length > 0
        && data[0].length === 1
        && (hasHeaders || isSingleColumnWithCommas(clipboardText));
}

async function promptForColumnIndex(
    clipboardText: string,
    data: string[][],
    hasHeaders: boolean,
    promptForColumn: PromptForColumn,
    placeHolder: string
): Promise<ColumnSelection | undefined> {
    const columns = getColumnChoices(data, hasHeaders);
    const dataRows = getDataRows(data, hasHeaders);
    const items: ColumnPromptItem[] = columns.map(col => ({
        label: col.label,
        description: formatValueCount(getNonEmptyColumnValues(dataRows, col.index).length),
        selection: { kind: 'column', index: col.index }
    }));

    if (!hasHeaders) {
        // Raw-line and flatten options are only offered for headerless data because explicit
        // headers usually mean the user expects column semantics rather than alternate
        // interpretations of the clipboard payload.
        items.push({
            label: EACH_LINE_AS_VALUE_LABEL,
            description: formatValueCount(getTrimmedNonEmptyLines(clipboardText).length),
            detail: 'Ignore commas and keep each original clipboard line as a single value.',
            selection: { kind: 'lines' }
        });
        items.push({
            label: FLATTEN_ALL_VALUES_LABEL,
            description: formatValueCount(getFlattenedNonEmptyValues(dataRows).length),
            detail: 'Flatten every parsed field into the list.',
            selection: { kind: 'flatten' }
        });
    }

    const selectedItem = await promptForColumn(
        items,
        placeHolder
    );

    if (!selectedItem) {
        return undefined;
    }

    return selectedItem.selection;
}

export function detectTableData(text: string): DetectedTableData {
    const parseResult = detectAndParseTableData(text);

    // If parsing failed, preserve comma-delimited lines as a non-lossy single-column shape.
    // This keeps wildly inconsistent comma-rich clipboard rows intact instead of truncating
    // them at the first comma or discarding them as malformed table data.
    if (!parseResult.hasHeaders && parseResult.data.length === 0) {
        if (isSingleColumnWithCommas(text) || parseResult.delimiter === ',') {
            const lines = text.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
            return {
                hasHeaders: false,
                data: lines.map(line => [extractSingleColumnValue(line)]),
                debugInfo: 'Detected single-column data with embedded commas'
            };
        }
    }

    return {
        hasHeaders: parseResult.hasHeaders,
        data: parseResult.data,
        debugInfo: parseResult.debugInfo
    };
}

export async function prepareClipboardValuesForDirectPaste(
    clipboardText: string,
    parseValues: (text: string) => string[],
    promptForColumn: PromptForColumn
): Promise<PreparedClipboardValues | undefined> {
    const { hasHeaders, data } = detectTableData(clipboardText);

    if (hasMultipleColumns(data)) {
        const columnSelection = await promptForColumnIndex(
            clipboardText,
            data,
            hasHeaders,
            promptForColumn,
            hasHeaders
                ? 'Multiple columns detected. Select the column to use for the IN clause.'
                : 'Multiple columns detected without headers. Select the column to use for the IN clause.'
        );

        if (columnSelection === undefined) {
            return undefined;
        }

        if (columnSelection.kind === 'lines') {
            return {
                values: getTrimmedNonEmptyLines(clipboardText),
                suggestedColumnName: '',
                source: 'selected_lines'
            };
        }

        if (columnSelection.kind === 'flatten') {
            return {
                values: getFlattenedNonEmptyValues(getDataRows(data, hasHeaders)),
                suggestedColumnName: '',
                source: 'flattened_values'
            };
        }

        return {
            values: getNonEmptyColumnValues(getDataRows(data, hasHeaders), columnSelection.index),
            suggestedColumnName: '',
            source: 'selected_column'
        };
    }

    if (shouldUseDetectedSingleColumnData(clipboardText, hasHeaders, data)) {
        return {
            values: getNonEmptyColumnValues(getDataRows(data, hasHeaders), 0),
            suggestedColumnName: hasHeaders ? data[0]?.[0] ?? '' : '',
            source: 'detected_single_column'
        };
    }

    return {
        values: parseValues(clipboardText),
        suggestedColumnName: '',
        source: 'parsed_text'
    };
}

export async function prepareClipboardValuesForColumnPaste(
    clipboardText: string,
    promptForColumn: PromptForColumn
): Promise<PreparedClipboardValues | undefined> {
    const { hasHeaders, data } = detectTableData(clipboardText);

    if (hasMultipleColumns(data)) {
        const columnSelection = await promptForColumnIndex(
            clipboardText,
            data,
            hasHeaders,
            promptForColumn,
            hasHeaders
                ? 'Select column for IN clause'
                : 'Select column for IN clause (no headers detected)'
        );

        if (columnSelection === undefined) {
            return undefined;
        }

        if (columnSelection.kind === 'lines') {
            return {
                values: getTrimmedNonEmptyLines(clipboardText),
                suggestedColumnName: '',
                source: 'selected_lines'
            };
        }

        if (columnSelection.kind === 'flatten') {
            return {
                values: getFlattenedNonEmptyValues(getDataRows(data, hasHeaders)),
                suggestedColumnName: '',
                source: 'flattened_values'
            };
        }

        return {
            values: getNonEmptyColumnValues(getDataRows(data, hasHeaders), columnSelection.index),
            suggestedColumnName: hasHeaders ? data[0]?.[columnSelection.index] ?? '' : '',
            source: 'selected_column'
        };
    }

    if (shouldUseDetectedSingleColumnData(clipboardText, hasHeaders, data)) {
        return {
            values: getNonEmptyColumnValues(getDataRows(data, hasHeaders), 0),
            suggestedColumnName: hasHeaders ? data[0]?.[0] ?? '' : '',
            source: 'detected_single_column'
        };
    }

    return {
        values: getTrimmedNonEmptyLines(clipboardText),
        suggestedColumnName: '',
        source: 'raw_lines'
    };
}
