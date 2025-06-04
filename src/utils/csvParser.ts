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

/**
 * Parse a single CSV line with proper quote and escape handling
 */
export function parseCsvLine(line: string, delimiter: string = ','): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
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
        } else if (char === delimiter && !inQuotes) {
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
    return result.map(field => {
        let trimmed = field.trim();
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
            // Remove surrounding quotes and unescape double quotes
            trimmed = trimmed.slice(1, -1).replace(/""/g, '"');
        }
        return trimmed;
    });
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
        // No delimiters found - treat as single column
        return {
            hasHeaders: true,
            data: lines.map(line => [parseCsvLine(line, ',')[0]]),
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
        hasHeaders: true,
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
