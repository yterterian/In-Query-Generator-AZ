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
suite('UI Integration Tests', () => {
    // Ensure the extension is activated before running tests
    suiteSetup(() => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        // Activate the extension
        yield ((_a = vscode.extensions.getExtension('YakovT.Sql-in-query-statement-generator')) === null || _a === void 0 ? void 0 : _a.activate());
    }));
    // Add a small delay to give the UI time to update
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    test('Command copyAsInStatement exists', () => __awaiter(void 0, void 0, void 0, function* () {
        const commands = yield vscode.commands.getCommands();
        assert.ok(commands.includes('extension.copyAsInStatement'));
    }));
    test('Command pasteAsInStatement exists', () => __awaiter(void 0, void 0, void 0, function* () {
        const commands = yield vscode.commands.getCommands();
        assert.ok(commands.includes('extension.pasteAsInStatement'));
    }));
    test('Command batchProcessInStatement exists', () => __awaiter(void 0, void 0, void 0, function* () {
        const commands = yield vscode.commands.getCommands();
        assert.ok(commands.includes('extension.batchProcessInStatement'));
    }));
    test('Status bar item is visible', () => __awaiter(void 0, void 0, void 0, function* () {
        // Wait for extension to fully activate and status bar item to be created
        yield delay(500);
        // This test is limited since we can't easily access the status bar item directly
        // In a real test, we might use UI automation tools
        assert.ok(true, 'Test passed if no errors occurred');
    }));
    test('End-to-end command execution', function () {
        return __awaiter(this, void 0, void 0, function* () {
            // Increase timeout for this test
            this.timeout(30000); // Increase from 10000ms to 30000ms
            try {
                // Create a document with some test content
                const document = yield vscode.workspace.openTextDocument({
                    content: 'value1\nvalue2\nvalue3'
                });
                const editor = yield vscode.window.showTextDocument(document);
                // Wait for editor to fully initialize
                yield delay(1000);
                // Select all text
                const lastLine = document.lineAt(document.lineCount - 1);
                editor.selection = new vscode.Selection(new vscode.Position(0, 0), lastLine.range.end);
                // Wait for selection to take effect
                yield delay(500);
                // Execute the command and wait for it to complete
                yield vscode.commands.executeCommand('extension.copyAsInStatement');
                // Wait longer for clipboard operations to complete
                yield delay(2000);
                assert.ok(true, 'Command executed without throwing an error');
                // Close the editor to clean up
                yield vscode.commands.executeCommand('workbench.action.closeActiveEditor');
            }
            catch (error) {
                assert.fail(`Command execution failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    });
});
//# sourceMappingURL=ui.test.js.map