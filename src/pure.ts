/**
 * Pure logic for IN statement generation, parsing, and formatting.
 * No VS Code dependencies.
 */

export interface FormatOptions {
    oneValuePerLine: boolean;
    maxValuesPerLine: number;
    indentSize: number;
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
        result = text.split(/[\r\n\t]+/)
            .map(item => item.trim())
            .filter(item => item !== '');
    }

    return result;
}

export function formatValue(
    item: string,
    detectDataTypes: boolean = true
): string {
    if (!item || item.toLowerCase() === 'null') {
        return 'NULL';
    }

    if (/^-?\d+(\.\d+)?$/.test(item)) {
        return item;
    }

    if (detectDataTypes) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(item)) {
            return `DATE '${item}'`;
        }
        if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(item)) {
            return `TIMESTAMP '${item}'`;
        }
        if (/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(item)) {
            return `'${item}'`;
        }
    }

    return `'${item.replace(/'/g, "''")}'`;
}

export function generateInStatement(
    data: string[],
    options?: {
        columnName?: string;
        useNotIn?: boolean;
        detectDataTypes?: boolean;
        formatOptions?: FormatOptions;
    }
): string {
    if (data.length === 0) {
        return '';
    }

    const {
        columnName = '',
        useNotIn = false,
        detectDataTypes = true,
        formatOptions = {
            oneValuePerLine: false,
            maxValuesPerLine: 5,
            indentSize: 4
        }
    } = options || {};

    const clauseType = useNotIn ? 'NOT IN' : 'IN';

    const formattedData = data.map(item => formatValue(item, detectDataTypes));

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
