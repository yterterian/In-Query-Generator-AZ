/// <reference types="mocha" />
/// <reference types="node" />
/// <reference types="vscode" />

import * as assert from 'assert';
import * as vscode from 'vscode';
import { parseText, generateInStatement } from '../../extension';

suite('Configuration Tests', () => {
    test('Split on Whitespace Option', () => {
        // Mock configuration with splitOnWhitespace enabled
        const mockConfig = {
            splitOnWhitespace: true,
            useNotIn: false,
            defaultColumnName: '',
            detectDataTypes: true,
            formatOptions: {
                oneValuePerLine: false,
                maxValuesPerLine: 5,
                indentSize: 4
            }
        };

        // Setup a mock for vscode.workspace.getConfiguration
        const originalGetConfiguration = vscode.workspace.getConfiguration;
        vscode.workspace.getConfiguration = () => {
            return {
                get: <T>(section: string, defaultValue?: T) => {
                    switch (section) {
                        case 'splitOnWhitespace': return mockConfig.splitOnWhitespace as T;
                        case 'useNotIn': return mockConfig.useNotIn as T;
                        case 'defaultColumnName': return mockConfig.defaultColumnName as T;
                        case 'detectDataTypes': return mockConfig.detectDataTypes as T;
                        case 'formatOptions': return mockConfig.formatOptions as T;
                        default: return defaultValue as T;
                    }
                }
            } as any;
        };

        try {
            // Test with whitespace-separated values instead of newline-separated
            const input = 'value1 value2 value3';
            const expected = ['value1', 'value2', 'value3'];
            const result = parseText(input);
            assert.deepStrictEqual(result, expected);
        } finally {
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });

    test('Detect Data Types Option Disabled', () => {
        // Mock configuration with detectDataTypes disabled
        const mockConfig = {
            splitOnWhitespace: false,
            useNotIn: false,
            defaultColumnName: '',
            detectDataTypes: false,
            formatOptions: {
                oneValuePerLine: false,
                maxValuesPerLine: 5,
                indentSize: 4
            }
        };

        // Setup a mock for vscode.workspace.getConfiguration
        const originalGetConfiguration = vscode.workspace.getConfiguration;
        vscode.workspace.getConfiguration = () => {
            return {
                get: <T>(section: string, defaultValue?: T) => {
                    switch (section) {
                        case 'splitOnWhitespace': return mockConfig.splitOnWhitespace as T;
                        case 'useNotIn': return mockConfig.useNotIn as T;
                        case 'defaultColumnName': return mockConfig.defaultColumnName as T;
                        case 'detectDataTypes': return mockConfig.detectDataTypes as T;
                        case 'formatOptions': return mockConfig.formatOptions as T;
                        default: return defaultValue as T;
                    }
                }
            } as any;
        };

        try {
            // When detectDataTypes is false, dates should be treated as regular strings
            const input = ['2023-01-01', '123.45'];
            const expected = "IN ('2023-01-01', 123.45)";
            const result = generateInStatement(input);
            assert.strictEqual(result, expected);
        } finally {
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });

    test('Format Option - One Value Per Line', () => {
        // Mock configuration with oneValuePerLine enabled
        const mockConfig = {
            splitOnWhitespace: false,
            useNotIn: false,
            defaultColumnName: '',
            detectDataTypes: true,
            formatOptions: {
                oneValuePerLine: true,
                maxValuesPerLine: 5,
                indentSize: 2  // Using 2 spaces instead of default 4
            }
        };

        // Setup a mock for vscode.workspace.getConfiguration
        const originalGetConfiguration = vscode.workspace.getConfiguration;
        vscode.workspace.getConfiguration = () => {
            return {
                get: <T>(section: string, defaultValue?: T) => {
                    switch (section) {
                        case 'splitOnWhitespace': return mockConfig.splitOnWhitespace as T;
                        case 'useNotIn': return mockConfig.useNotIn as T;
                        case 'defaultColumnName': return mockConfig.defaultColumnName as T;
                        case 'detectDataTypes': return mockConfig.detectDataTypes as T;
                        case 'formatOptions': return mockConfig.formatOptions as T;
                        default: return defaultValue as T;
                    }
                }
            } as any;
        };

        try {
            const input = ['value1', 'value2', 'value3'];
            const expected = "IN (\n  'value1',\n  'value2',\n  'value3'\n)";
            const result = generateInStatement(input);
            assert.strictEqual(result, expected);
        } finally {
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });

    test('Format Option - Max Values Per Line', () => {
        // Mock configuration with maxValuesPerLine set to 2
        const mockConfig = {
            splitOnWhitespace: false,
            useNotIn: false,
            defaultColumnName: '',
            detectDataTypes: true,
            formatOptions: {
                oneValuePerLine: false,
                maxValuesPerLine: 2,
                indentSize: 4
            }
        };

        // Setup a mock for vscode.workspace.getConfiguration
        const originalGetConfiguration = vscode.workspace.getConfiguration;
        vscode.workspace.getConfiguration = () => {
            return {
                get: <T>(section: string, defaultValue?: T) => {
                    switch (section) {
                        case 'splitOnWhitespace': return mockConfig.splitOnWhitespace as T;
                        case 'useNotIn': return mockConfig.useNotIn as T;
                        case 'defaultColumnName': return mockConfig.defaultColumnName as T;
                        case 'detectDataTypes': return mockConfig.detectDataTypes as T;
                        case 'formatOptions': return mockConfig.formatOptions as T;
                        default: return defaultValue as T;
                    }
                }
            } as any;
        };

        try {
            const input = ['value1', 'value2', 'value3', 'value4', 'value5'];
            // With maxValuesPerLine set to 2, we should get grouped values
            const expected = "IN (\n    'value1', 'value2',\n    'value3', 'value4',\n    'value5'\n)";
            const result = generateInStatement(input);
            assert.strictEqual(result, expected);
        } finally {
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });
});