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
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const vscode = __importStar(require("vscode"));
const extension_1 = require("../../extension");
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
                get: (section, defaultValue) => {
                    switch (section) {
                        case 'splitOnWhitespace': return mockConfig.splitOnWhitespace;
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
            // Test with whitespace-separated values instead of newline-separated
            const input = 'value1 value2 value3';
            const expected = ['value1', 'value2', 'value3'];
            const result = (0, extension_1.parseText)(input);
            assert.deepStrictEqual(result, expected);
        }
        finally {
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
                get: (section, defaultValue) => {
                    switch (section) {
                        case 'splitOnWhitespace': return mockConfig.splitOnWhitespace;
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
            // When detectDataTypes is false, dates should be treated as regular strings
            const input = ['2023-01-01', '123.45'];
            const expected = "IN ('2023-01-01', 123.45)";
            const result = (0, extension_1.generateInStatement)(input);
            assert.strictEqual(result, expected);
        }
        finally {
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
                indentSize: 2 // Using 2 spaces instead of default 4
            }
        };
        // Setup a mock for vscode.workspace.getConfiguration
        const originalGetConfiguration = vscode.workspace.getConfiguration;
        vscode.workspace.getConfiguration = () => {
            return {
                get: (section, defaultValue) => {
                    switch (section) {
                        case 'splitOnWhitespace': return mockConfig.splitOnWhitespace;
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
            const expected = "IN (\n  'value1',\n  'value2',\n  'value3'\n)";
            const result = (0, extension_1.generateInStatement)(input);
            assert.strictEqual(result, expected);
        }
        finally {
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
                get: (section, defaultValue) => {
                    switch (section) {
                        case 'splitOnWhitespace': return mockConfig.splitOnWhitespace;
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
            const input = ['value1', 'value2', 'value3', 'value4', 'value5'];
            // With maxValuesPerLine set to 2, we should get grouped values
            const expected = "IN (\n    'value1', 'value2',\n    'value3', 'value4',\n    'value5'\n)";
            const result = (0, extension_1.generateInStatement)(input);
            assert.strictEqual(result, expected);
        }
        finally {
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });
});
//# sourceMappingURL=config.test.js.map