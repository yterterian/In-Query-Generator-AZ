"use strict";
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
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
function activate(context) {
    let copyDisposable = vscode.commands.registerCommand('extension.copyAsInStatement', () => __awaiter(this, void 0, void 0, function* () {
        yield processSelection();
    }));
    let pasteDisposable = vscode.commands.registerCommand('extension.pasteAsInStatement', () => __awaiter(this, void 0, void 0, function* () {
        yield processAndPasteClipboard();
    }));
    context.subscriptions.push(copyDisposable, pasteDisposable);
}
exports.activate = activate;
function processSelection() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const selection = editor.selection;
                const selectedText = editor.document.getText(selection);
                if (selectedText) {
                    const data = parseText(selectedText);
                    const inStatement = generateInStatement(data);
                    yield vscode.env.clipboard.writeText(inStatement);
                    vscode.window.showInformationMessage('Copied as IN statement to clipboard!');
                }
                else {
                    vscode.window.showWarningMessage('No text selected.');
                }
            }
            else {
                vscode.window.showWarningMessage('No active text editor.');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error processing selection: ${error}`);
        }
    });
}
function processAndPasteClipboard() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active text editor.');
                return;
            }
            const clipboardText = yield vscode.env.clipboard.readText();
            if (clipboardText) {
                const data = parseText(clipboardText);
                const inStatement = generateInStatement(data);
                editor.edit(editBuilder => {
                    if (editor.selection.isEmpty) {
                        editBuilder.insert(editor.selection.active, inStatement);
                    }
                    else {
                        editBuilder.replace(editor.selection, inStatement);
                    }
                });
                vscode.window.showInformationMessage('IN statement pasted!');
            }
            else {
                vscode.window.showWarningMessage('Clipboard is empty.');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error processing clipboard: ${error}`);
        }
    });
}
function parseText(text) {
    // Remove the opening 'IN (' and closing ')' if present
    text = text.replace(/^IN\s*\(\s*'/i, '').replace(/'\s*\)$/, '');
    // Split by newlines and/or tabs to handle various formats
    return text.split(/[\n\t]+/)
        .map(item => item.trim())
        .filter(item => item !== '');
}
function generateInStatement(data) {
    if (data.length === 0) {
        vscode.window.showWarningMessage('No data to generate IN statement.');
        return '';
    }
    const formattedData = data.map(item => {
        if (item.toLowerCase() === 'null') {
            return 'NULL';
        }
        else {
            // Escape single quotes and wrap all values in single quotes
            return `'${item.replace(/'/g, "''")}'`;
        }
    });
    const inStatement = `IN (${formattedData.join(', ')})`;
    return inStatement;
}
function deactivate() { }
exports.deactivate = deactivate;
