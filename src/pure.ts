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

const SQL_IDENTIFIER_PART = '(?:\\[[^\\]]+\\]|"[^"]+"|`[^`]+`|[A-Za-z_][\\w$]*)';
const SQL_IDENTIFIER_PATH = `${SQL_IDENTIFIER_PART}(?:\\s*\\.\\s*${SQL_IDENTIFIER_PART})*`;
const SQL_IN_CLAUSE_PREFIX = new RegExp(`^(?:${SQL_IDENTIFIER_PATH}\\s+)?(?:NOT\\s+)?IN\\s*\\(`, 'i');

function looksLikeSqlInClause(text: string): boolean {
    return SQL_IN_CLAUSE_PREFIX.test(text.trim());
}

function parseSqlValueList(text: string): string[] | null {
    const trimmed = text.trim();
    const clauseMatch = trimmed.match(new RegExp(`^(?:${SQL_IDENTIFIER_PATH}\\s+)?(?:NOT\\s+)?IN\\s*\\(([\\s\\S]*)\\)\\s*;?\\s*$`, 'i'));
    if (!clauseMatch) {
        if (looksLikeSqlInClause(trimmed)) {
            throw new Error('Malformed SQL IN clause.');
        }
        return null;
    }

    const values = clauseMatch[1];
    if (values.trim() === '') {
        return [];
    }

    const parsed: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < values.length; index++) {
        const char = values[index];
        const nextChar = values[index + 1];

        if (char === '\'') {
            current += char;
            if (inQuotes && nextChar === '\'') {
                current += nextChar;
                index++;
                continue;
            }

            inQuotes = !inQuotes;
            continue;
        }

        if (char === ',' && !inQuotes) {
            parsed.push(current);
            current = '';
            continue;
        }

        current += char;
    }

    parsed.push(current);

    if (inQuotes) {
        throw new Error('Malformed SQL IN clause.');
    }

    return parsed
        .map(token => token.trim())
        .map(token => {
            if (/^null$/i.test(token)) {
                return 'NULL';
            }

            if (token.startsWith('\'') && token.endsWith('\'')) {
                return token.slice(1, -1).replace(/''/g, '\'');
            }

            return token;
        });
}

export function parseText(
    text: string,
    splitOnWhitespace: boolean = false
): string[] {
    if (text.trim() === '') {
        return [];
    }

    const sqlValues = parseSqlValueList(text);
    if (sqlValues !== null) {
        return sqlValues;
    }

    let result: string[];

    if (splitOnWhitespace) {
        result = text.split(/\s+/)
            .map(item => item.trim())
            .filter(item => item !== '');
    } else {
        // Preserve empty items created by delimiters so the original list stays traceable.
        const trimmedBoundaryText = text.replace(/^[\r\n]+|[\r\n]+$/g, '');
        result = trimmedBoundaryText
            .split(/\r\n|\n|\r/)
            .flatMap(line => line.split(/\t|,/))
            .map(item => item.trim());
    }

    return result;
}

/**
 * Type guard: checks if a string is a valid number
 */
function isNumeric(value: string): boolean {
    return /^-?\d+(\.\d+)?$/.test(value);
}

function hasLeadingZeroInteger(value: string): boolean {
    return /^-?0\d+$/.test(value);
}

function isValidDateParts(year: number, month: number, day: number): boolean {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
        return false;
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) {
        return false;
    }

    const candidate = new Date(Date.UTC(year, month - 1, day));
    return candidate.getUTCFullYear() === year
        && candidate.getUTCMonth() === month - 1
        && candidate.getUTCDate() === day;
}

function isValidTimeParts(hour: number, minute: number, second: number): boolean {
    return Number.isInteger(hour)
        && Number.isInteger(minute)
        && Number.isInteger(second)
        && hour >= 0
        && hour <= 23
        && minute >= 0
        && minute <= 59
        && second >= 0
        && second <= 59;
}

/**
 * Type guard: checks if a string is a date
 */
function isDate(value: string): boolean {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
        return false;
    }

    const [, year, month, day] = match;
    return isValidDateParts(Number(year), Number(month), Number(day));
}

/**
 * Type guard: checks if a string is a datetime
 */
function isDateTime(value: string): boolean {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
    if (!match) {
        return false;
    }

    const [, year, month, day, hour, minute, second] = match;
    return isValidDateParts(Number(year), Number(month), Number(day))
        && isValidTimeParts(Number(hour), Number(minute), Number(second));
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
    if (isNumeric(value) && !hasLeadingZeroInteger(value)) {
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
    const trimmedItem = item.trim();

    // NULL handling is universal - always takes precedence
    if (!trimmedItem || trimmedItem.toLowerCase() === 'null') {
        return 'NULL';
    }

    // Apply formatting strategy based on mode
    switch (dataTypeMode) {
        case DataTypeMode.Auto:
            return formatAutoDetect(trimmedItem);

        case DataTypeMode.ForceText:
            return formatAsText(item);

        case DataTypeMode.ForceNumber:
            return tryFormatAsNumber(trimmedItem);

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
