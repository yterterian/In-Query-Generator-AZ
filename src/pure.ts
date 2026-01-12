/**
 * Pure logic for IN statement generation, parsing, and formatting.
 * No VS Code dependencies.
 */

export interface FormatOptions {
    oneValuePerLine: boolean;
    maxValuesPerLine: number;
    indentSize: number;
}

/**
 * Data type detection strategy for value formatting
 */
export enum DataTypeMode {
    /** Automatically detect numbers, dates, GUIDs (smart mode) */
    Auto = 'auto',
    /** Force all values to be treated as text (quoted) */
    ForceText = 'force_text',
    /** Force all values to be treated as numbers (unquoted, with fallback) */
    ForceNumber = 'force_number'
}

export function parseText(
    text: string,
    splitOnWhitespace: boolean = false
): string[] {
    text = text.replace(/^(NOT\s+)?IN\s*\(\s*'/i, '').replace(/'\s*\)$/, '');

    let result: string[];

    if (splitOnWhitespace) {
        result = text.split(/\s+/)
            .map(item => item.trim())
            .filter(item => item !== '');
    } else {
        // Split first by any newline or carriage return, then flatten by splitting each line by tabs or commas
        result = text
            .split(/[\r\n]+/)
            .flatMap(line => line.split(/\t|,/))
            .map(item => item.trim())
            .filter(item => item !== '');
    }

    return result;
}

/**
 * Type guard: checks if a string is a valid number
 */
function isNumeric(value: string): boolean {
    return /^-?\d+(\.\d+)?$/.test(value);
}

/**
 * Type guard: checks if a string is a date
 */
function isDate(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Type guard: checks if a string is a datetime
 */
function isDateTime(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(value);
}

/**
 * Type guard: checks if a string is a GUID
 */
function isGuid(value: string): boolean {
    return /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(value);
}

/**
 * Escapes single quotes for SQL string literals
 */
function escapeSqlString(value: string): string {
    return value.replace(/'/g, "''");
}

/**
 * Formats a string value as a quoted SQL string
 */
function formatAsText(value: string): string {
    return `'${escapeSqlString(value)}'`;
}

/**
 * Attempts to format a value as a number, returns formatted value with fallback to text
 */
function tryFormatAsNumber(value: string): string {
    if (isNumeric(value)) {
        return value;
    }
    // Silent fallback: if not numeric, quote it
    return formatAsText(value);
}

/**
 * Formats a value based on auto-detection rules
 */
function formatAutoDetect(value: string): string {
    // Numbers stay unquoted
    if (isNumeric(value)) {
        return value;
    }

    // Dates, datetimes, and GUIDs are quoted
    if (isDate(value) || isDateTime(value) || isGuid(value)) {
        return formatAsText(value);
    }

    // Everything else is quoted
    return formatAsText(value);
}

/**
 * Formats a single value for SQL IN clause based on data type strategy.
 *
 * @param item - The value to format
 * @param dataTypeMode - The detection strategy to use
 * @returns Formatted SQL value (e.g., 'text', 123, NULL)
 *
 * @remarks
 * - Empty strings and 'null' (case-insensitive) are always formatted as NULL
 * - ForceNumber mode silently falls back to quoting non-numeric values
 * - All string values have single quotes escaped ('' in SQL)
 */
export function formatValue(
    item: string,
    dataTypeMode: DataTypeMode = DataTypeMode.Auto
): string {
    // NULL handling is universal - always takes precedence
    if (!item || item.toLowerCase() === 'null') {
        return 'NULL';
    }

    // Apply formatting strategy based on mode
    switch (dataTypeMode) {
        case DataTypeMode.Auto:
            return formatAutoDetect(item);

        case DataTypeMode.ForceText:
            return formatAsText(item);

        case DataTypeMode.ForceNumber:
            return tryFormatAsNumber(item);

        default: {
            // Exhaustive check - TypeScript will error if we miss a case
            const _exhaustive: never = dataTypeMode;
            throw new Error(`Unhandled DataTypeMode: ${_exhaustive}`);
        }
    }
}

/**
 * Generates SQL IN/NOT IN statement from array of values.
 *
 * @param data - Array of string values to include in the IN clause
 * @param options - Configuration options
 * @returns Formatted SQL IN/NOT IN statement
 */
export function generateInStatement(
    data: string[],
    options?: {
        columnName?: string;
        useNotIn?: boolean;
        dataTypeMode?: DataTypeMode;
        formatOptions?: FormatOptions;
    }
): string {
    if (data.length === 0) {
        return '';
    }

    const {
        columnName = '',
        useNotIn = false,
        dataTypeMode = DataTypeMode.Auto,
        formatOptions = {
            oneValuePerLine: false,
            maxValuesPerLine: 5,
            indentSize: 4
        }
    } = options || {};

    const clauseType = useNotIn ? 'NOT IN' : 'IN';

    // Map values through formatValue with chosen data type mode
    const formattedData = data.map(item => formatValue(item, dataTypeMode));

    let valuesString: string;

    if (formatOptions.oneValuePerLine && data.length > 1) {
        const indent = ' '.repeat(formatOptions.indentSize);
        valuesString = '\n' + indent + formattedData.join(',\n' + indent) + '\n';
    } else if (!formatOptions.oneValuePerLine && formatOptions.maxValuesPerLine > 0 && data.length > formatOptions.maxValuesPerLine) {
        const chunks: string[][] = [];
        for (let i = 0; i < formattedData.length; i += formatOptions.maxValuesPerLine) {
            chunks.push(formattedData.slice(i, i + formatOptions.maxValuesPerLine));
        }

        const indent = ' '.repeat(formatOptions.indentSize);
        valuesString = '\n' + indent + chunks.map(chunk => chunk.join(', ')).join(',\n' + indent) + '\n';
    } else {
        valuesString = formattedData.join(', ');
    }

    const inStatement = columnName
        ? `${columnName} ${clauseType} (${valuesString})`
        : `${clauseType} (${valuesString})`;

    return inStatement;
}
