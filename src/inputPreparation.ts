import { detectAndParseTableData, isSingleColumnWithCommas, parseCsvLine } from './utils/csvParser';

export interface DetectedTableData {
    hasHeaders: boolean;
    data: string[][];
    debugInfo?: string;
}

export type ClipboardPreparationSource =
    | 'parsed_text'
    | 'selected_column'
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

type PromptForColumn = (labels: string[], placeHolder: string) => Promise<string | undefined>;

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
    data: string[][],
    hasHeaders: boolean,
    promptForColumn: PromptForColumn,
    placeHolder: string
): Promise<number | undefined> {
    const columns = getColumnChoices(data, hasHeaders);
    const selectedColumn = await promptForColumn(
        columns.map(col => col.label),
        placeHolder
    );

    if (!selectedColumn) {
        return undefined;
    }

    return columns.find(col => col.label === selectedColumn)?.index ?? 0;
}

export function detectTableData(text: string): DetectedTableData {
    const parseResult = detectAndParseTableData(text);

    // If parsing failed but we suspect single-column data with commas, treat as single column.
    if (!parseResult.hasHeaders && parseResult.data.length === 0) {
        if (isSingleColumnWithCommas(text)) {
            const lines = text.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
            return {
                hasHeaders: false,
                data: lines.map(line => [parseCsvLine(line, ',')[0]]),
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
        const columnIndex = await promptForColumnIndex(
            data,
            hasHeaders,
            promptForColumn,
            hasHeaders
                ? 'Multiple columns detected. Select the column to use for the IN clause.'
                : 'Multiple columns detected without headers. Select the column to use for the IN clause.'
        );

        if (columnIndex === undefined) {
            return undefined;
        }

        return {
            values: getNonEmptyColumnValues(getDataRows(data, hasHeaders), columnIndex),
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
        const columnIndex = await promptForColumnIndex(
            data,
            hasHeaders,
            promptForColumn,
            hasHeaders
                ? 'Select column for IN clause'
                : 'Select column for IN clause (no headers detected)'
        );

        if (columnIndex === undefined) {
            return undefined;
        }

        return {
            values: getNonEmptyColumnValues(getDataRows(data, hasHeaders), columnIndex),
            suggestedColumnName: hasHeaders ? data[0]?.[columnIndex] ?? '' : '',
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

    const lines = clipboardText.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
    return {
        values: lines,
        suggestedColumnName: '',
        source: 'raw_lines'
    };
}
