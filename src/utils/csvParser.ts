/**
 * Robust CSV/TSV parser for detecting and parsing tabular data
 * Handles quoted values, escaped characters, and multiple delimiters
 */

export interface ParsedTableData {
    hasHeaders: boolean;
    data: string[][];
    delimiter: string;
    debugInfo?: string;
}

export interface DelimiterAnalysis {
    delimiter: string;
    confidence: number;
    avgColumnsPerRow: number;
    consistentColumnCount: boolean;
}

type CellValueType = 'empty' | 'numeric' | 'date' | 'guid' | 'text';

export function extractSingleColumnValue(line: string): string {
    const trimmed = line.trim();
    const fields = parseCsvLine(trimmed, ',');
    return fields.length === 1 ? (fields[0] ?? '') : trimmed;
}

const COMMON_HEADER_LABELS = new Set([
    'id',
    'name',
    'age',
    'email',
    'date',
    'datetime',
    'timestamp',
    'status',
    'type',
    'code',
    'description',
    'category',
    'amount',
    'value',
    'price',
    'quantity',
    'count',
    'number',
    'phone',
    'city',
    'state',
    'country',
    'postcode',
    'zip',
    'customer',
    'customer id',
    'customer name',
    'product',
    'product id',
    'product name',
    'first name',
    'last name'
]);

function normaliseHeaderLabel(value: string): string {
    return value
        .trim()
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

function classifyCellValue(value: string): CellValueType {
    const trimmed = value.trim();

    if (trimmed === '') {
        return 'empty';
    }

    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        return 'numeric';
    }

    if (/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?$/.test(trimmed)) {
        return 'date';
    }

    if (/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(trimmed)) {
        return 'guid';
    }

    return 'text';
}

function inferHeaderRow(parsedData: string[][]): boolean {
    if (parsedData.length < 2 || parsedData[0].length < 2) {
        return false;
    }

    const [firstRow, ...dataRows] = parsedData;
    if (firstRow.some(cell => cell.trim() === '')) {
        return false;
    }

    let evidenceColumns = 0;

    for (let columnIndex = 0; columnIndex < firstRow.length; columnIndex++) {
        const firstValue = firstRow[columnIndex]?.trim() ?? '';
        const laterValues = dataRows
            .map(row => (row[columnIndex] ?? '').trim())
            .filter(value => value !== '');

        if (laterValues.length === 0) {
            continue;
        }

        const repeatedFirstValue = laterValues.some(
            value => value.toLowerCase() === firstValue.toLowerCase()
        );
        if (repeatedFirstValue) {
            continue;
        }

        const laterTypes = laterValues.map(classifyCellValue);
        const structuredLaterRatio = laterTypes.filter(type => type !== 'text').length / laterTypes.length;

        if (COMMON_HEADER_LABELS.has(normaliseHeaderLabel(firstValue))) {
            evidenceColumns++;
            continue;
        }

        if (classifyCellValue(firstValue) === 'text' && structuredLaterRatio >= 0.6) {
            evidenceColumns++;
        }
    }

    return evidenceColumns >= Math.max(2, Math.ceil(firstRow.length / 2));
}

function inferSingleColumnHeader(values: string[]): boolean {
    if (values.length < 2) {
        return false;
    }

    const [firstValue, ...laterValues] = values.map(value => value.trim());
    if (firstValue === '') {
        return false;
    }

    if (COMMON_HEADER_LABELS.has(normaliseHeaderLabel(firstValue))) {
        return true;
    }

    const laterTypes = laterValues
        .map(classifyCellValue)
        .filter(type => type !== 'empty');

    if (laterTypes.length === 0) {
        return false;
    }

    const structuredLaterRatio = laterTypes.filter(type => type !== 'text').length / laterTypes.length;
    return classifyCellValue(firstValue) === 'text' && structuredLaterRatio >= 0.8;
}

/**
 * Parse a single CSV line with proper quote and escape handling
 */
export function parseCsvLine(line: string, delimiter: string = ','): string[] {
    const shouldTrackBracketDepth = delimiter === ',' || delimiter === ';';
    const depthAwareResult = parseCsvLineInternal(line, delimiter, shouldTrackBracketDepth);

    if (shouldTrackBracketDepth && !depthAwareResult.balancedBrackets) {
        return parseCsvLineInternal(line, delimiter, false).fields;
    }

    return depthAwareResult.fields;
}

function parseCsvLineInternal(
    line: string,
    delimiter: string,
    trackBracketDepth: boolean
): { fields: string[]; balancedBrackets: boolean } {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let bracketDepth = 0;
    let i = 0;

    while (i < line.length) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escaped quote
                current += '"';
                i += 2;
                continue;
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
            }
        } else if (trackBracketDepth && !inQuotes && (char === '(' || char === '[')) {
            bracketDepth++;
            current += char;
        } else if (trackBracketDepth && !inQuotes && (char === ')' || char === ']')) {
            bracketDepth = Math.max(0, bracketDepth - 1);
            current += char;
        } else if (char === delimiter && !inQuotes && bracketDepth === 0) {
            // End of field
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
        i++;
    }

    // Add the last field
    result.push(current.trim());

    // Post-process: remove surrounding quotes and unescape double quotes
    const fields = result.map(field => {
        let trimmed = field.trim();
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
            // Remove surrounding quotes and unescape double quotes
            trimmed = trimmed.slice(1, -1).replace(/""/g, '"');
        }
        return trimmed;
    });

    return {
        fields,
        balancedBrackets: bracketDepth === 0
    };
}

/**
 * Analyse potential delimiters and their effectiveness
 */
export function analyseDelimiters(lines: string[]): DelimiterAnalysis[] {
    const candidateDelimiters = ['\t', ',', ';', '|'];
    const analyses: DelimiterAnalysis[] = [];

    for (const delimiter of candidateDelimiters) {
        const parsedLines = lines.map(line => parseCsvLine(line, delimiter));
        const columnCounts = parsedLines.map(cols => cols.length);
        
        // Skip if all lines have only one column (no actual delimiter found)
        if (columnCounts.every(count => count === 1)) {
            continue;
        }

        const avgColumns = columnCounts.reduce((sum, count) => sum + count, 0) / columnCounts.length;
        const mostCommonCount = getMostCommonCount(columnCounts);
        const consistentRows = columnCounts.filter(count => count === mostCommonCount).length;
        const consistencyRatio = consistentRows / columnCounts.length;

        // Calculate confidence based on consistency and column distribution
        let confidence = 0;
        
        // Prefer consistency (same number of columns across rows)
        confidence += consistencyRatio * 50;
        
        // Prefer reasonable number of columns (2-20)
        if (avgColumns >= 2 && avgColumns <= 20) {
            confidence += 30;
        }
        
        // Tab gets bonus for being common in copy-paste scenarios
        if (delimiter === '\t') {
            confidence += 10;
        }
        
        // Comma gets slight bonus but less than tab
        if (delimiter === ',') {
            confidence += 5;
        }

        analyses.push({
            delimiter,
            confidence,
            avgColumnsPerRow: avgColumns,
            consistentColumnCount: consistencyRatio > 0.8
        });
    }

    return analyses.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Get the most frequently occurring column count
 */
function getMostCommonCount(counts: number[]): number {
    const frequency: { [key: number]: number } = {};
    
    for (const count of counts) {
        frequency[count] = (frequency[count] || 0) + 1;
    }
    
    return Number(Object.keys(frequency).reduce((a, b) => 
        frequency[Number(a)] > frequency[Number(b)] ? a : b
    ));
}

/**
 * Detect if text represents tabular data and parse it appropriately
 */
export function detectAndParseTableData(text: string): ParsedTableData {
    const lines = text.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
    
    if (lines.length < 2) {
        return {
            hasHeaders: false,
            data: [],
            delimiter: '',
            debugInfo: 'Insufficient lines for tabular data (need at least 2)'
        };
    }

    // Analyse potential delimiters
    const delimiterAnalyses = analyseDelimiters(lines);
    
    if (delimiterAnalyses.length === 0) {
        const singleColumnValues = lines.map(extractSingleColumnValue);
        // No delimiters found - treat as single column
        return {
            hasHeaders: inferSingleColumnHeader(singleColumnValues),
            data: singleColumnValues.map(value => [value]),
            delimiter: '',
            debugInfo: 'Single column data detected'
        };
    }

    const bestDelimiter = delimiterAnalyses[0];
    
    // Only treat as tabular if we have good confidence and multiple columns
    if (bestDelimiter.confidence < 40 || bestDelimiter.avgColumnsPerRow < 2) {
        return {
            hasHeaders: false,
            data: [],
            delimiter: '',
            debugInfo: `Low confidence for tabular data. Best delimiter: ${bestDelimiter.delimiter}, confidence: ${bestDelimiter.confidence.toFixed(1)}`
        };
    }

    // Parse all lines with the best delimiter
    const parsedData = lines.map(line => parseCsvLine(line, bestDelimiter.delimiter));
    
    // Validate consistency
    const mostCommonColumnCount = getMostCommonCount(parsedData.map(row => row.length));
    const inconsistentRows = parsedData.filter(row => row.length !== mostCommonColumnCount);
    
    if (inconsistentRows.length > parsedData.length * 0.3) {
        return {
            hasHeaders: false,
            data: [],
            delimiter: bestDelimiter.delimiter,
            debugInfo: `Too many inconsistent rows. Expected ${mostCommonColumnCount} columns but ${inconsistentRows.length}/${parsedData.length} rows differ`
        };
    }

    return {
        hasHeaders: inferHeaderRow(parsedData),
        data: parsedData,
        delimiter: bestDelimiter.delimiter,
        debugInfo: `Detected ${mostCommonColumnCount} columns with delimiter '${bestDelimiter.delimiter}' (confidence: ${bestDelimiter.confidence.toFixed(1)})`
    };
}

/**
 * Quick check if text is likely to be single-column data with embedded commas
 */
export function isSingleColumnWithCommas(text: string): boolean {
    const lines = text.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
    
    if (lines.length < 2) {
        return false;
    }

    // Check if lines have quotes around values with commas
    const quotedLinesWithCommas = lines.filter(line => {
        const trimmed = line.trim();
        return (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.includes(',')) ||
               (!trimmed.includes('\t') && trimmed.includes(','));
    });

    // If most lines look like single quoted values or simple comma-containing values
    return quotedLinesWithCommas.length > lines.length * 0.6;
}
