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
    let disposable = vscode.commands.registerCommand('extension.copyAsInStatement', () => __awaiter(this, void 0, void 0, function* () {
        yield processSelection();
    }));
    context.subscriptions.push(disposable);
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
                    const inStatement = generateInStatement(selectedText.split('\n'));
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
function generateInStatement(data) {
    if (data.length === 0) {
        vscode.window.showWarningMessage('No data to generate IN statement.');
        return '';
    }
    const cleanedData = data.map(item => item.trim()).filter(item => item !== '');
    const inStatement = `IN (${cleanedData.map(item => `'${item}'`).join(', ')})`;
    return inStatement;
}
function deactivate() { }
exports.deactivate = deactivate;
