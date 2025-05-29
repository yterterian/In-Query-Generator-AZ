/// <reference types="mocha" />
/// <reference types="node" />

import * as assert from 'assert';
import * as vscode from 'vscode';
// Fix the import path - for the test file in src/test/suite
import { parseText, generateInStatement, formatValue } from '../../extension';

describe('In-Query Generator Extension Tests', () => {
    // Ensure the extension is activated before running tests
    before(async () => {
        // Activate the extension
        await vscode.extensions.getExtension('YakovT.Sql-in-query-statement-generator')?.activate();
    });

    it('Parse Text - Newline Separated', () => {
        const input = 'value1\nvalue2\nvalue3';
        const expected = ['value1', 'value2', 'value3'];
        const result = parseText(input);
        assert.deepStrictEqual(result, expected);
    });

    it('Parse Text - Tab Separated', () => {
        const input = 'value1\tvalue2\tvalue3';
        const expected = ['value1', 'value2', 'value3'];
        const result = parseText(input);
        assert.deepStrictEqual(result, expected);
    });

    it('Parse Text - Mixed Separators', () => {
        const input = 'value1\nvalue2\tvalue3\rvalue4';
        const expected = ['value1', 'value2', 'value3', 'value4'];
        const result = parseText(input);
        assert.deepStrictEqual(result, expected);
    });

    it('Parse Text - With Empty Lines', () => {
        const input = 'value1\n\nvalue2\n\n\nvalue3';
        const expected = ['value1', 'value2', 'value3'];
        const result = parseText(input);
        assert.deepStrictEqual(result, expected);
    });

    // Edge case tests - pulled out from nested position
    it('Parse Text - Empty Input', () => {
        const input = '';
        const expected: string[] = [];
        const result = parseText(input);
        assert.deepStrictEqual(result, expected);
    });
    
    it('Parse Text - Very Long Input', () => {
        // Generate a long string with 1000 values
        const values = Array.from({ length: 1000 }, (_, i) => `value${i}`);
        const input = values.join('\n');
        const result = parseText(input);
        assert.strictEqual(result.length, 1000);
        assert.strictEqual(result[0], 'value0');
        assert.strictEqual(result[999], 'value999');
    });
    
    it('Parse Text - Special Characters', () => {
        // Define mockConfig within the test scope
        const mockConfig = {
            splitOnWhitespace: false
        };
    
        // Setup a mock for vscode.workspace.getConfiguration
        const originalGetConfiguration = vscode.workspace.getConfiguration;
        
        // Create a more robust mock that correctly handles the 'inQueryGenerator' section
        vscode.workspace.getConfiguration = function(section?: string) {
            if (section === 'inQueryGenerator' || section === undefined) {
                return {
                    get: function<T>(key: string, defaultValue?: T) {
                        if (key === 'splitOnWhitespace') {
                            return mockConfig.splitOnWhitespace as unknown as T;
                        }
                        return defaultValue as T;
                    },
                    // Add other necessary methods to avoid "not a function" errors
                    update: function() { return Promise.resolve(); },
                    has: function() { return false; },
                    inspect: function() { return undefined; }
                } as unknown as vscode.WorkspaceConfiguration;
            }
            return originalGetConfiguration(section);
        };

        try {
            const input = 'value-with-hyphens\nvalue_with_underscores\nvalue with spaces\nvalue,with,commas';
            const expected = ['value-with-hyphens', 'value_with_underscores', 'value with spaces', 'value,with,commas'];
            const result = parseText(input);
            assert.deepStrictEqual(result, expected);
        } finally {
            // Restore the original function
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });
    
    it('Generate IN Statement - Empty Array', () => {
        const input: string[] = [];
        const result = generateInStatement(input);
        assert.strictEqual(result, '');
    });
    
    it('Generate IN Statement - Very Large Dataset', () => {
        // Generate a large array with 1000 values
        const values = Array.from({ length: 1000 }, (_, i) => `value${i}`);
        const result = generateInStatement(values);
        // Just check that it generates something and has the expected structure
        assert.ok(result.startsWith('IN ('));
        assert.ok(result.endsWith(')'));
        assert.ok(result.includes('value0'));
        assert.ok(result.includes('value999'));
    });
    
    it('Format Value - Various Data Types', () => {
        // Set up the mock configuration
        const originalGetConfiguration = vscode.workspace.getConfiguration;
        vscode.workspace.getConfiguration = () => {
            return {
                get: <T>() => true as T
            } as unknown as vscode.WorkspaceConfiguration;
        };
    
        try {
            // Test various data types
            assert.strictEqual(formatValue('NULL'), 'NULL');
            assert.strictEqual(formatValue('null'), 'NULL');
            assert.strictEqual(formatValue('123'), '123');
            assert.strictEqual(formatValue('-123.45'), '-123.45');
            assert.strictEqual(formatValue('2023-01-01'), "DATE '2023-01-01'");
            assert.strictEqual(formatValue('2023-01-01 12:34:56'), "TIMESTAMP '2023-01-01 12:34:56'");
            assert.strictEqual(formatValue('550e8400-e29b-41d4-a716-446655440000'), "'550e8400-e29b-41d4-a716-446655440000'");
            assert.strictEqual(formatValue('O\'Reilly'), "'O''Reilly'");
        } finally {
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });

    it('Generate IN Statement - Regular Values', () => {
        // Mock the configuration for this test
        const mockConfig = {
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
                        case 'useNotIn': return mockConfig.useNotIn as T;
                        case 'defaultColumnName': return mockConfig.defaultColumnName as T;
                        case 'detectDataTypes': return mockConfig.detectDataTypes as T;
                        case 'formatOptions': return mockConfig.formatOptions as T;
                        default: return defaultValue as T;
                    }
                }
            } as unknown as vscode.WorkspaceConfiguration;
        };

        try {
            const input = ['value1', 'value2', 'NULL', '123'];
            const expected = "IN ('value1', 'value2', NULL, 123)";
            const result = generateInStatement(input);
            assert.strictEqual(result, expected);
        } finally {
            // Restore the original function
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });

    it('Generate IN Statement - With Single Quotes', () => {
        // Mock the configuration
        const mockConfig = {
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
                        case 'useNotIn': return mockConfig.useNotIn as T;
                        case 'defaultColumnName': return mockConfig.defaultColumnName as T;
                        case 'detectDataTypes': return mockConfig.detectDataTypes as T;
                        case 'formatOptions': return mockConfig.formatOptions as T;
                        default: return defaultValue as T;
                    }
                }
            } as unknown as vscode.WorkspaceConfiguration;
        };

        try {
            const input = ["O'Reilly", "Alice's Restaurant"];
            const expected = "IN ('O''Reilly', 'Alice''s Restaurant')";
            const result = generateInStatement(input);
            assert.strictEqual(result, expected);
        } finally {
            // Restore the original function
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });

    it('Generate IN Statement - With Column Name', () => {
        // Mock the configuration
        const mockConfig = {
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
                        case 'useNotIn': return mockConfig.useNotIn as T;
                        case 'defaultColumnName': return mockConfig.defaultColumnName as T;
                        case 'detectDataTypes': return mockConfig.detectDataTypes as T;
                        case 'formatOptions': return mockConfig.formatOptions as T;
                        default: return defaultValue as T;
                    }
                }
            } as unknown as vscode.WorkspaceConfiguration;
        };

        try {
            const input = ['value1', 'value2', 'value3'];
            const columnName = 'customer_id';
            const expected = "customer_id IN ('value1', 'value2', 'value3')";
            const result = generateInStatement(input, columnName);
            assert.strictEqual(result, expected);
        } finally {
            // Restore the original function
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });

    it('Generate NOT IN Statement', () => {
        // Mock the configuration
        const mockConfig = {
            useNotIn: true,
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
                        case 'useNotIn': return mockConfig.useNotIn as T;
                        case 'defaultColumnName': return mockConfig.defaultColumnName as T;
                        case 'detectDataTypes': return mockConfig.detectDataTypes as T;
                        case 'formatOptions': return mockConfig.formatOptions as T;
                        default: return defaultValue as T;
                    }
                }
            } as unknown as vscode.WorkspaceConfiguration;
        };

        try {
            const input = ['value1', 'value2', 'value3'];
            const expected = "NOT IN ('value1', 'value2', 'value3')";
            const result = generateInStatement(input);
            assert.strictEqual(result, expected);
        } finally {
            // Restore the original function
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });

    it('Generate IN Statement - With Data Type Detection', () => {
        // Mock the configuration
        const mockConfig = {
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
                        case 'useNotIn': return mockConfig.useNotIn as T;
                        case 'defaultColumnName': return mockConfig.defaultColumnName as T;
                        case 'detectDataTypes': return mockConfig.detectDataTypes as T;
                        case 'formatOptions': return mockConfig.formatOptions as T;
                        default: return defaultValue as T;
                    }
                }
            } as unknown as vscode.WorkspaceConfiguration;
        };

        try {
            const input = ['2023-01-01', '123.45', 'text', '2023-01-01 12:34:56', '550e8400-e29b-41d4-a716-446655440000'];
            const expected = "IN (DATE '2023-01-01', 123.45, 'text', TIMESTAMP '2023-01-01 12:34:56', '550e8400-e29b-41d4-a716-446655440000')";
            const result = generateInStatement(input);
            assert.strictEqual(result, expected);
        } finally {
            // Restore the original function
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });

    it('Generate IN Statement - One Value Per Line', () => {
        // Mock the configuration
        const mockConfig = {
            useNotIn: false,
            defaultColumnName: '',
            detectDataTypes: true,
            formatOptions: {
                oneValuePerLine: true,
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
                        case 'useNotIn': return mockConfig.useNotIn as T;
                        case 'defaultColumnName': return mockConfig.defaultColumnName as T;
                        case 'detectDataTypes': return mockConfig.detectDataTypes as T;
                        case 'formatOptions': return mockConfig.formatOptions as T;
                        default: return defaultValue as T;
                    }
                }
            } as unknown as vscode.WorkspaceConfiguration;
        };

        try {
            const input = ['value1', 'value2', 'value3'];
            const expected = "IN (\n    'value1',\n    'value2',\n    'value3'\n)";
            const result = generateInStatement(input);
            assert.strictEqual(result, expected);
        } finally {
            // Restore the original function
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });
});
