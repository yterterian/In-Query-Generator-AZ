"use strict";
/// <reference types="mocha" />
/// <reference types="node" />
/// <reference types="vscode" />
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const vscode = __importStar(require("vscode"));
// Fix the import path - for the test file in src/test/suite
const extension_1 = require("../../extension");
suite('In-Query Generator Extension Tests', () => {
    // Ensure the extension is activated before running tests
    suiteSetup(() => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        // Activate the extension
        yield ((_a = vscode.extensions.getExtension('YakovT.Sql-in-query-statement-generator')) === null || _a === void 0 ? void 0 : _a.activate());
    }));
    test('Parse Text - Newline Separated', () => {
        const input = 'value1\nvalue2\nvalue3';
        const expected = ['value1', 'value2', 'value3'];
        const result = (0, extension_1.parseText)(input);
        assert.deepStrictEqual(result, expected);
    });
    test('Parse Text - Tab Separated', () => {
        const input = 'value1\tvalue2\tvalue3';
        const expected = ['value1', 'value2', 'value3'];
        const result = (0, extension_1.parseText)(input);
        assert.deepStrictEqual(result, expected);
    });
    test('Parse Text - Mixed Separators', () => {
        const input = 'value1\nvalue2\tvalue3\rvalue4';
        const expected = ['value1', 'value2', 'value3', 'value4'];
        const result = (0, extension_1.parseText)(input);
        assert.deepStrictEqual(result, expected);
    });
    test('Parse Text - With Empty Lines', () => {
        const input = 'value1\n\nvalue2\n\n\nvalue3';
        const expected = ['value1', 'value2', 'value3'];
        const result = (0, extension_1.parseText)(input);
        assert.deepStrictEqual(result, expected);
    });
    // Edge case tests - pulled out from nested position
    test('Parse Text - Empty Input', () => {
        const input = '';
        const expected = [];
        const result = (0, extension_1.parseText)(input);
        assert.deepStrictEqual(result, expected);
    });
    test('Parse Text - Very Long Input', () => {
        // Generate a long string with 1000 values
        const values = Array.from({ length: 1000 }, (_, i) => `value${i}`);
        const input = values.join('\n');
        const result = (0, extension_1.parseText)(input);
        assert.strictEqual(result.length, 1000);
        assert.strictEqual(result[0], 'value0');
        assert.strictEqual(result[999], 'value999');
    });
    test('Parse Text - Special Characters', () => {
        // Define mockConfig within the test scope
        const mockConfig = {
            splitOnWhitespace: false
        };
        // Setup a mock for vscode.workspace.getConfiguration
        const originalGetConfiguration = vscode.workspace.getConfiguration;
        // Create a more robust mock that correctly handles the 'inQueryGenerator' section
        vscode.workspace.getConfiguration = function (section) {
            if (section === 'inQueryGenerator' || section === undefined) {
                return {
                    get: function (key, defaultValue) {
                        if (key === 'splitOnWhitespace') {
                            return mockConfig.splitOnWhitespace;
                        }
                        return defaultValue;
                    },
                    // Add other necessary methods to avoid "not a function" errors
                    update: function () { return Promise.resolve(); },
                    has: function () { return false; },
                    inspect: function () { return undefined; }
                };
            }
            return originalGetConfiguration(section);
        };
        try {
            const input = 'value-with-hyphens\nvalue_with_underscores\nvalue with spaces\nvalue,with,commas';
            const expected = ['value-with-hyphens', 'value_with_underscores', 'value with spaces', 'value,with,commas'];
            const result = (0, extension_1.parseText)(input);
            assert.deepStrictEqual(result, expected);
        }
        finally {
            // Restore the original function
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });
    test('Generate IN Statement - Empty Array', () => {
        const input = [];
        const result = (0, extension_1.generateInStatement)(input);
        assert.strictEqual(result, '');
    });
    test('Generate IN Statement - Very Large Dataset', () => {
        // Generate a large array with 1000 values
        const values = Array.from({ length: 1000 }, (_, i) => `value${i}`);
        const result = (0, extension_1.generateInStatement)(values);
        // Just check that it generates something and has the expected structure
        assert.ok(result.startsWith('IN ('));
        assert.ok(result.endsWith(')'));
        assert.ok(result.includes('value0'));
        assert.ok(result.includes('value999'));
    });
    test('Format Value - Various Data Types', () => {
        // Set up the mock configuration
        const originalGetConfiguration = vscode.workspace.getConfiguration;
        vscode.workspace.getConfiguration = () => {
            return {
                get: () => true
            };
        };
        try {
            // Test various data types
            assert.strictEqual((0, extension_1.formatValue)('NULL'), 'NULL');
            assert.strictEqual((0, extension_1.formatValue)('null'), 'NULL');
            assert.strictEqual((0, extension_1.formatValue)('123'), '123');
            assert.strictEqual((0, extension_1.formatValue)('-123.45'), '-123.45');
            assert.strictEqual((0, extension_1.formatValue)('2023-01-01'), "DATE '2023-01-01'");
            assert.strictEqual((0, extension_1.formatValue)('2023-01-01 12:34:56'), "TIMESTAMP '2023-01-01 12:34:56'");
            assert.strictEqual((0, extension_1.formatValue)('550e8400-e29b-41d4-a716-446655440000'), "'550e8400-e29b-41d4-a716-446655440000'");
            assert.strictEqual((0, extension_1.formatValue)('O\'Reilly'), "'O''Reilly'");
        }
        finally {
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });
    test('Generate IN Statement - Regular Values', () => {
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
                get: (section, defaultValue) => {
                    switch (section) {
                        case 'useNotIn': return mockConfig.useNotIn;
                        case 'defaultColumnName': return mockConfig.defaultColumnName;
                        case 'detectDataTypes': return mockConfig.detectDataTypes;
                        case 'formatOptions': return mockConfig.formatOptions;
                        default: return defaultValue;
                    }
                }
            };
        };
        try {
            const input = ['value1', 'value2', 'NULL', '123'];
            const expected = "IN ('value1', 'value2', NULL, 123)";
            const result = (0, extension_1.generateInStatement)(input);
            assert.strictEqual(result, expected);
        }
        finally {
            // Restore the original function
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });
    test('Generate IN Statement - With Single Quotes', () => {
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
                get: (section, defaultValue) => {
                    switch (section) {
                        case 'useNotIn': return mockConfig.useNotIn;
                        case 'defaultColumnName': return mockConfig.defaultColumnName;
                        case 'detectDataTypes': return mockConfig.detectDataTypes;
                        case 'formatOptions': return mockConfig.formatOptions;
                        default: return defaultValue;
                    }
                }
            };
        };
        try {
            const input = ["O'Reilly", "Alice's Restaurant"];
            const expected = "IN ('O''Reilly', 'Alice''s Restaurant')";
            const result = (0, extension_1.generateInStatement)(input);
            assert.strictEqual(result, expected);
        }
        finally {
            // Restore the original function
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });
    test('Generate IN Statement - With Column Name', () => {
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
                get: (section, defaultValue) => {
                    switch (section) {
                        case 'useNotIn': return mockConfig.useNotIn;
                        case 'defaultColumnName': return mockConfig.defaultColumnName;
                        case 'detectDataTypes': return mockConfig.detectDataTypes;
                        case 'formatOptions': return mockConfig.formatOptions;
                        default: return defaultValue;
                    }
                }
            };
        };
        try {
            const input = ['value1', 'value2', 'value3'];
            const columnName = 'customer_id';
            const expected = "customer_id IN ('value1', 'value2', 'value3')";
            const result = (0, extension_1.generateInStatement)(input, columnName);
            assert.strictEqual(result, expected);
        }
        finally {
            // Restore the original function
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });
    test('Generate NOT IN Statement', () => {
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
                get: (section, defaultValue) => {
                    switch (section) {
                        case 'useNotIn': return mockConfig.useNotIn;
                        case 'defaultColumnName': return mockConfig.defaultColumnName;
                        case 'detectDataTypes': return mockConfig.detectDataTypes;
                        case 'formatOptions': return mockConfig.formatOptions;
                        default: return defaultValue;
                    }
                }
            };
        };
        try {
            const input = ['value1', 'value2', 'value3'];
            const expected = "NOT IN ('value1', 'value2', 'value3')";
            const result = (0, extension_1.generateInStatement)(input);
            assert.strictEqual(result, expected);
        }
        finally {
            // Restore the original function
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });
    test('Generate IN Statement - With Data Type Detection', () => {
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
                get: (section, defaultValue) => {
                    switch (section) {
                        case 'useNotIn': return mockConfig.useNotIn;
                        case 'defaultColumnName': return mockConfig.defaultColumnName;
                        case 'detectDataTypes': return mockConfig.detectDataTypes;
                        case 'formatOptions': return mockConfig.formatOptions;
                        default: return defaultValue;
                    }
                }
            };
        };
        try {
            const input = ['2023-01-01', '123.45', 'text', '2023-01-01 12:34:56', '550e8400-e29b-41d4-a716-446655440000'];
            const expected = "IN (DATE '2023-01-01', 123.45, 'text', TIMESTAMP '2023-01-01 12:34:56', '550e8400-e29b-41d4-a716-446655440000')";
            const result = (0, extension_1.generateInStatement)(input);
            assert.strictEqual(result, expected);
        }
        finally {
            // Restore the original function
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });
    test('Generate IN Statement - One Value Per Line', () => {
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
                get: (section, defaultValue) => {
                    switch (section) {
                        case 'useNotIn': return mockConfig.useNotIn;
                        case 'defaultColumnName': return mockConfig.defaultColumnName;
                        case 'detectDataTypes': return mockConfig.detectDataTypes;
                        case 'formatOptions': return mockConfig.formatOptions;
                        default: return defaultValue;
                    }
                }
            };
        };
        try {
            const input = ['value1', 'value2', 'value3'];
            const expected = "IN (\n    'value1',\n    'value2',\n    'value3'\n)";
            const result = (0, extension_1.generateInStatement)(input);
            assert.strictEqual(result, expected);
        }
        finally {
            // Restore the original function
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });
});
//# sourceMappingURL=extension.test.js.map