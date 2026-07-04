import * as vscode from 'vscode';
import {
    generateInStatement as pureGenerateInStatement,
    formatValue as pureFormatValue,
    FormatOptions,
    DataTypeMode,
    isNullLikeValue
} from './pure';

export interface PreparedStatementValues {
    values: string[];
    removed: number;
    useDistinct: boolean;
}

export interface ClauseNullSafetyResult {
    values: string[];
    nullLikeCount: number;
    removedNullsFromNotIn: boolean;
}

function deduplicateValues(
    values: string[],
    caseSensitive: boolean,
    trimWhitespace: boolean
): { unique: string[], removed: number } {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const val of values) {
        let norm = trimWhitespace ? val.trim() : val;
        if (!caseSensitive) {
            norm = norm.toLowerCase();
        }

        if (!seen.has(norm)) {
            seen.add(norm);
            result.push(val);
        }
    }

    return { unique: result, removed: values.length - result.length };
}

function getFormatOptions(config: vscode.WorkspaceConfiguration): FormatOptions {
    return config.get<FormatOptions>('formatOptions', {
        oneValuePerLine: false,
        maxValuesPerLine: 5,
        indentSize: 4
    });
}

export function getDataTypeModeFromConfig(config: vscode.WorkspaceConfiguration): DataTypeMode {
    const detectDataTypes = config.get<boolean>('detectDataTypes', true);
    return detectDataTypes ? DataTypeMode.Auto : DataTypeMode.ForceText;
}

export function prepareValuesForStatement(
    values: string[],
    distinctOverride?: boolean
): PreparedStatementValues {
    const config = vscode.workspace.getConfiguration('inQueryGenerator');
    const useDistinct = typeof distinctOverride === 'boolean'
        ? distinctOverride
        : config.get<boolean>('distinctValues', true);

    if (!useDistinct) {
        return {
            values,
            removed: 0,
            useDistinct: false
        };
    }

    const caseSensitive = config.get<boolean>('distinctCaseSensitive', false);
    const trimWhitespace = config.get<boolean>('distinctTrimWhitespace', true);
    const deduplicated = deduplicateValues(values, caseSensitive, trimWhitespace);

    return {
        values: deduplicated.unique,
        removed: deduplicated.removed,
        useDistinct: true
    };
}

export function applyClauseNullSafety(
    values: string[],
    useNotIn: boolean
): ClauseNullSafetyResult {
    const nullLikeCount = values.filter(isNullLikeValue).length;

    if (nullLikeCount === 0) {
        return {
            values,
            nullLikeCount,
            removedNullsFromNotIn: false
        };
    }

    if (!useNotIn) {
        return {
            values,
            nullLikeCount,
            removedNullsFromNotIn: false
        };
    }

    return {
        values: values.filter(value => !isNullLikeValue(value)),
        nullLikeCount,
        removedNullsFromNotIn: true
    };
}

export function generateStatementWithMode(
    data: string[],
    columnName: string | undefined,
    forceNotIn: boolean,
    dataTypeModeOverride?: DataTypeMode
): string {
    const config = vscode.workspace.getConfiguration('inQueryGenerator');
    const dataTypeMode = dataTypeModeOverride ?? getDataTypeModeFromConfig(config);

    return pureGenerateInStatement(data, {
        columnName: columnName || config.get<string>('defaultColumnName', ''),
        useNotIn: forceNotIn,
        dataTypeMode,
        formatOptions: getFormatOptions(config)
    });
}

export function generateStatement(
    data: string[],
    columnName?: string,
    forceNotIn?: boolean
): string {
    const config = vscode.workspace.getConfiguration('inQueryGenerator');
    let useNotIn = config.get<boolean>('useNotIn', false);

    if (typeof forceNotIn === 'boolean') {
        useNotIn = forceNotIn;
    }

    return pureGenerateInStatement(data, {
        columnName: columnName || config.get<string>('defaultColumnName', ''),
        useNotIn,
        dataTypeMode: getDataTypeModeFromConfig(config),
        formatOptions: getFormatOptions(config)
    });
}

export function formatValueWithConfig(item: string): string {
    const config = vscode.workspace.getConfiguration('inQueryGenerator');
    return pureFormatValue(item, getDataTypeModeFromConfig(config));
}
