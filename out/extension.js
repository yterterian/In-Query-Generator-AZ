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
exports.deactivate = exports.formatValue = exports.generateInStatement = exports.parseText = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
let statusBarItem;
let usageCounter = 0;
const RATING_THRESHOLDS = [10, 50, 150, 250]; // Custom backoff intervals
const RATING_PROMPT_KEY = 'inQueryGenerator.ratingPromptShown';
const RATING_DISMISSED_KEY = 'inQueryGenerator.ratingDismissed';
const RATING_BACKOFF_KEY = 'inQueryGenerator.ratingBackoffCount';
function activate(context) {
    // Load usage counter from storage
    usageCounter = context.globalState.get('inQueryGenerator.usageCounter', 0);
    // Register commands
    let copyDisposable = vscode.commands.registerCommand('extension.copyAsInStatement', () => __awaiter(this, void 0, void 0, function* () {
        yield processSelection(context);
    }));
    // Direct paste as IN
    let pasteInDisposable = vscode.commands.registerCommand('extension.pasteAsInStatementDirect', () => __awaiter(this, void 0, void 0, function* () {
        yield processAndPasteClipboardDirect(false, undefined, context);
    }));
    // Paste as IN Statement (for keybinding/alias)
    let pasteAsInStatementDisposable = vscode.commands.registerCommand('extension.pasteAsInStatement', () => __awaiter(this, void 0, void 0, function* () {
        yield processAndPasteClipboardDirect(false, undefined, context);
    }));
    // Direct paste as NOT IN
    let pasteNotInDisposable = vscode.commands.registerCommand('extension.pasteAsNotInStatementDirect', () => __awaiter(this, void 0, void 0, function* () {
        yield processAndPasteClipboardDirect(true, undefined, context);
    }));
    // Paste Special (dropdown)
    let pasteSpecialDisposable = vscode.commands.registerCommand('extension.pasteSpecialInStatement', () => __awaiter(this, void 0, void 0, function* () {
        yield showPasteSpecialDropdown();
    }));
    // Paste Column + IN
    let pasteColumnInDisposable = vscode.commands.registerCommand('extension.pasteColumnInStatement', () => __awaiter(this, void 0, void 0, function* () {
        yield processColumnPaste(false, undefined);
    }));
    // Paste Column + NOT IN
    let pasteColumnNotInDisposable = vscode.commands.registerCommand('extension.pasteColumnNotInStatement', () => __awaiter(this, void 0, void 0, function* () {
        yield processColumnPaste(true, undefined);
    }));
    let batchProcessDisposable = vscode.commands.registerCommand('extension.batchProcessInStatement', () => __awaiter(this, void 0, void 0, function* () {
        yield processBatchData();
    }));
    let toggleSplitCommand = vscode.commands.registerCommand('inQueryGenerator.toggleSplitOnWhitespace', () => {
        const config = vscode.workspace.getConfiguration('inQueryGenerator');
        const currentValue = config.get('splitOnWhitespace', false);
        config.update('splitOnWhitespace', !currentValue, true);
        updateStatusBarItem();
        vscode.window.showInformationMessage(`Split on whitespace: ${!currentValue}`);
    });
    let toggleNotInCommand = vscode.commands.registerCommand('inQueryGenerator.toggleNotIn', () => {
        const config = vscode.workspace.getConfiguration('inQueryGenerator');
        const currentValue = config.get('useNotIn', false);
        config.update('useNotIn', !currentValue, true);
        updateStatusBarItem();
        vscode.window.showInformationMessage(`NOT IN clause: ${!currentValue ? 'enabled' : 'disabled'}`);
    });
    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(statusBarItem);
    // Initial update of status bar
    updateStatusBarItem();
    // Listen for configuration changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('inQueryGenerator')) {
            updateStatusBarItem();
        }
    }));
    context.subscriptions.push(copyDisposable, pasteInDisposable, pasteAsInStatementDisposable, pasteNotInDisposable, pasteSpecialDisposable, pasteColumnInDisposable, pasteColumnNotInDisposable, batchProcessDisposable, toggleSplitCommand, toggleNotInCommand);
}
exports.activate = activate;
function updateStatusBarItem() {
    const config = vscode.workspace.getConfiguration('inQueryGenerator');
    const statusBarActions = config.get('statusBarActions', ['dropdown']);
    const splitOnWhitespace = config.get('splitOnWhitespace', false);
    const useNotIn = config.get('useNotIn', false);
    if (statusBarActions.length === 1 && statusBarActions[0] === 'dropdown') {
        statusBarItem.text = 'IN Tools';
        statusBarItem.tooltip = 'Click to access IN/NOT IN features';
        statusBarItem.command = 'extension.pasteSpecialInStatement';
        statusBarItem.show();
    }
    else if (statusBarActions.length > 0) {
        // Show the first pinned action, allow right-click for dropdown
        const action = statusBarActions[0];
        let text = '';
        let tooltip = '';
        let command = action;
        switch (action) {
            case 'extension.copyAsInStatement':
                text = 'Copy IN';
                tooltip = 'Copy as IN Statement';
                break;
            case 'extension.pasteAsInStatementDirect':
                text = 'Paste IN';
                tooltip = 'Paste IN Statement';
                break;
            case 'extension.pasteAsNotInStatementDirect':
                text = 'Paste NOT IN';
                tooltip = 'Paste NOT IN Statement';
                break;
            case 'extension.pasteSpecialInStatement':
                text = 'IN Tools';
                tooltip = 'Show IN/NOT IN dropdown';
                break;
            case 'extension.pasteColumnInStatement':
                text = 'Paste Col+IN';
                tooltip = 'Paste Column + IN Statement';
                break;
            case 'extension.pasteColumnNotInStatement':
                text = 'Paste Col+NOT IN';
                tooltip = 'Paste Column + NOT IN Statement';
                break;
            default:
                text = 'IN Tools';
                tooltip = 'IN/NOT IN features';
        }
        statusBarItem.text = text;
        statusBarItem.tooltip = tooltip + ' (right-click for dropdown)';
        statusBarItem.command = command;
        statusBarItem.show();
    }
    else {
        // Fallback: show current mode
        statusBarItem.text = `${useNotIn ? 'NOT IN' : 'IN'}: ${splitOnWhitespace ? 'Split' : 'No Split'}`;
        statusBarItem.tooltip = `Split on whitespace: ${splitOnWhitespace ? 'enabled' : 'disabled'}, NOT IN: ${useNotIn ? 'enabled' : 'disabled'}`;
        statusBarItem.command = 'extension.pasteSpecialInStatement';
        statusBarItem.show();
    }
}
// Deduplication logic
function deduplicateValues(values, caseSensitive, trimWhitespace) {
    const seen = new Set();
    const result = [];
    for (const val of values) {
        let norm = trimWhitespace ? val.trim() : val;
        if (!caseSensitive)
            norm = norm.toLowerCase();
        if (!seen.has(norm)) {
            seen.add(norm);
            result.push(val);
        }
    }
    return { unique: result, removed: values.length - result.length };
}
// Direct paste as IN/NOT IN
function processAndPasteClipboardDirect(forceNotIn, distinctOverride, context) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active text editor.');
                return;
            }
            const clipboardText = yield vscode.env.clipboard.readText();
            if (!clipboardText) {
                vscode.window.showWarningMessage('Clipboard is empty.');
                return;
            }
            let parsedData = parseText(clipboardText);
            if (parsedData.length === 0) {
                vscode.window.showWarningMessage('No valid data found in clipboard.');
                return;
            }
            // Deduplication
            const config = vscode.workspace.getConfiguration('inQueryGenerator');
            const useDistinct = typeof distinctOverride === 'boolean'
                ? distinctOverride
                : config.get('distinctValues', true);
            const caseSensitive = config.get('distinctCaseSensitive', false);
            const trimWhitespace = config.get('distinctTrimWhitespace', true);
            let removed = 0;
            if (useDistinct) {
                const dedup = deduplicateValues(parsedData, caseSensitive, trimWhitespace);
                removed = dedup.removed;
                parsedData = dedup.unique;
            }
            const inStatement = generateInStatement(parsedData, undefined, forceNotIn);
            editor.edit(editBuilder => {
                if (editor.selection.isEmpty) {
                    editBuilder.insert(editor.selection.active, inStatement);
                }
                else {
                    editBuilder.replace(editor.selection, inStatement);
                }
            });
            let msg = `${forceNotIn ? 'NOT IN' : 'IN'} statement inserted!`;
            if (useDistinct) {
                msg += ` (${removed} duplicate${removed === 1 ? '' : 's'} removed)`;
            }
            vscode.window.showInformationMessage(msg);
            // Track usage for rating prompt
            if (context) {
                yield trackUsageAndPromptRating(context);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error processing clipboard: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
// Paste Special dropdown
function showPasteSpecialDropdown() {
    var _a, _b, _c, _d;
    return __awaiter(this, void 0, void 0, function* () {
        // Ask for distinct option
        const config = vscode.workspace.getConfiguration('inQueryGenerator');
        const defaultDistinct = config.get('distinctValues', true);
        const distinctChoice = yield vscode.window.showQuickPick([
            { label: 'Distinct values (remove duplicates)', value: true },
            { label: 'All values (keep duplicates)', value: false }
        ], {
            placeHolder: 'Choose whether to remove duplicate values for this operation',
            ignoreFocusOut: true
        });
        if (!distinctChoice)
            return;
        const distinctOverride = distinctChoice.value;
        const options = [
            { label: 'Paste IN Statement', command: 'extension.pasteAsInStatementDirect' },
            { label: 'Paste NOT IN Statement', command: 'extension.pasteAsNotInStatementDirect' },
            { label: 'Paste Column + IN Statement (use Copy with Header to select data)', command: 'extension.pasteColumnInStatement' },
            { label: 'Paste Column + NOT IN Statement (use Copy with Header to select data)', command: 'extension.pasteColumnNotInStatement' },
            { label: 'Cancel', command: undefined }
        ];
        const selected = yield vscode.window.showQuickPick(options, {
            placeHolder: 'Select an IN/NOT IN paste option'
        });
        if (selected && selected.command) {
            // Pass distinctOverride to the command
            switch (selected.command) {
                case 'extension.pasteAsInStatementDirect':
                    yield processAndPasteClipboardDirect(false, distinctOverride, (_b = (_a = vscode.extensions.getExtension('YakovT.Sql-in-query-statement-generator')) === null || _a === void 0 ? void 0 : _a.exports) === null || _b === void 0 ? void 0 : _b.context);
                    break;
                case 'extension.pasteAsNotInStatementDirect':
                    yield processAndPasteClipboardDirect(true, distinctOverride, (_d = (_c = vscode.extensions.getExtension('YakovT.Sql-in-query-statement-generator')) === null || _c === void 0 ? void 0 : _c.exports) === null || _d === void 0 ? void 0 : _d.context);
                    break;
                case 'extension.pasteColumnInStatement':
                    yield processColumnPaste(false, distinctOverride);
                    break;
                case 'extension.pasteColumnNotInStatement':
                    yield processColumnPaste(true, distinctOverride);
                    break;
                default:
                    break;
            }
        }
    });
}
// Paste Column + IN/NOT IN
function processColumnPaste(forceNotIn, distinctOverride) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active text editor.');
                return;
            }
            const clipboardText = yield vscode.env.clipboard.readText();
            if (!clipboardText) {
                vscode.window.showWarningMessage('Clipboard is empty.');
                return;
            }
            const { hasHeaders, data, debugInfo } = detectTableData(clipboardText);
            if (!hasHeaders || data.length <= 1) {
                vscode.window.showWarningMessage('Clipboard data does not appear to be tabular with headers. Please copy with headers.\n' + (debugInfo || ''));
                return;
            }
            const headers = data[0];
            const columns = headers.map((header, index) => ({
                label: header,
                index: index
            }));
            const selectedColumn = yield vscode.window.showQuickPick(columns.map(col => col.label), { placeHolder: 'Select column for IN clause' });
            if (selectedColumn) {
                const columnIndex = ((_a = columns.find(col => col.label === selectedColumn)) === null || _a === void 0 ? void 0 : _a.index) || 0;
                let values = data.slice(1).map(row => row[columnIndex] || '').filter(val => val !== '');
                if (values.length === 0) {
                    vscode.window.showWarningMessage('No valid data found in selected column.');
                    return;
                }
                // Deduplication
                const config = vscode.workspace.getConfiguration('inQueryGenerator');
                const useDistinct = typeof distinctOverride === 'boolean'
                    ? distinctOverride
                    : config.get('distinctValues', true);
                const caseSensitive = config.get('distinctCaseSensitive', false);
                const trimWhitespace = config.get('distinctTrimWhitespace', true);
                let removed = 0;
                if (useDistinct) {
                    const dedup = deduplicateValues(values, caseSensitive, trimWhitespace);
                    removed = dedup.removed;
                    values = dedup.unique;
                }
                // Use the header as the default column name
                const columnNameInput = yield vscode.window.showInputBox({
                    prompt: 'Enter column name to use in the IN clause (optional)',
                    placeHolder: 'e.g., customer_id',
                    value: selectedColumn
                });
                const inStatement = generateInStatement(values, columnNameInput || selectedColumn, forceNotIn);
                editor.edit(editBuilder => {
                    if (editor.selection.isEmpty) {
                        editBuilder.insert(editor.selection.active, inStatement);
                    }
                    else {
                        editBuilder.replace(editor.selection, inStatement);
                    }
                });
                let msg = `${forceNotIn ? 'NOT IN' : 'IN'} statement inserted for column "${columnNameInput || selectedColumn}"!`;
                if (useDistinct) {
                    msg += ` (${removed} duplicate${removed === 1 ? '' : 's'} removed)`;
                }
                vscode.window.showInformationMessage(msg);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error processing column paste: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
// Existing logic for selection, batch, and preview
function processSelection(context) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const selection = editor.selection;
                const selectedText = editor.document.getText(selection);
                if (selectedText) {
                    if (selectedText.length > 100000) {
                        vscode.window.showWarningMessage('Processing a large amount of data. This might take a moment.');
                    }
                    let data = parseText(selectedText);
                    if (data.length === 0) {
                        vscode.window.showWarningMessage('No valid data found in selection.');
                        return;
                    }
                    // Deduplication (global config only)
                    const config = vscode.workspace.getConfiguration('inQueryGenerator');
                    const useDistinct = config.get('distinctValues', true);
                    const caseSensitive = config.get('distinctCaseSensitive', false);
                    const trimWhitespace = config.get('distinctTrimWhitespace', true);
                    let removed = 0;
                    if (useDistinct) {
                        const dedup = deduplicateValues(data, caseSensitive, trimWhitespace);
                        removed = dedup.removed;
                        data = dedup.unique;
                    }
                    const inStatement = generateInStatement(data);
                    yield previewAndApplyInStatement(inStatement, editor, true);
                    if (useDistinct) {
                        vscode.window.showInformationMessage(`Selection: ${removed} duplicate${removed === 1 ? '' : 's'} removed.`);
                    }
                    // Enhanced success message with value proposition
                    const itemCount = data.length;
                    vscode.window.showInformationMessage(`✅ Copied ${itemCount} item${itemCount !== 1 ? 's' : ''} as IN statement to clipboard!`);
                    yield trackUsageAndPromptRating(context);
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
            vscode.window.showErrorMessage(`Error processing selection: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
function processAndPasteClipboard(context) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active text editor.');
                return;
            }
            const clipboardText = yield vscode.env.clipboard.readText();
            if (clipboardText) {
                if (clipboardText.length > 100000) {
                    vscode.window.showWarningMessage('Processing a large amount of data. This might take a moment.');
                }
                const { hasHeaders, data } = detectTableData(clipboardText);
                if (hasHeaders && data.length > 1) {
                    const choice = yield vscode.window.showQuickPick(['Process as single list', 'Process as table (select column)'], { placeHolder: 'Detected table data in clipboard. How would you like to process it?' });
                    if (choice === 'Process as table (select column)') {
                        yield processBatchDataFromArray(data);
                        return;
                    }
                }
                let parsedData = parseText(clipboardText);
                if (parsedData.length === 0) {
                    vscode.window.showWarningMessage('No valid data found in clipboard.');
                    return;
                }
                // Deduplication (global config only)
                const config = vscode.workspace.getConfiguration('inQueryGenerator');
                const useDistinct = config.get('distinctValues', true);
                const caseSensitive = config.get('distinctCaseSensitive', false);
                const trimWhitespace = config.get('distinctTrimWhitespace', true);
                let removed = 0;
                if (useDistinct) {
                    const dedup = deduplicateValues(parsedData, caseSensitive, trimWhitespace);
                    removed = dedup.removed;
                    parsedData = dedup.unique;
                }
                const inStatement = generateInStatement(parsedData);
                yield previewAndApplyInStatement(inStatement, editor, false);
                if (useDistinct) {
                    vscode.window.showInformationMessage(`Clipboard: ${removed} duplicate${removed === 1 ? '' : 's'} removed.`);
                }
                // Enhanced success message with value proposition
                const itemCount = parsedData.length;
                vscode.window.showInformationMessage(`✅ Pasted ${itemCount} item${itemCount !== 1 ? 's' : ''} as IN statement!`);
                yield trackUsageAndPromptRating(context);
            }
            else {
                vscode.window.showWarningMessage('Clipboard is empty.');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error processing clipboard: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
function processBatchData() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active text editor.');
                return;
            }
            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);
            if (!selectedText) {
                vscode.window.showWarningMessage('No text selected.');
                return;
            }
            const { hasHeaders, data } = detectTableData(selectedText);
            if (!hasHeaders || data.length <= 1) {
                vscode.window.showWarningMessage('Selected text does not appear to be tabular data with headers.');
                return;
            }
            yield processBatchDataFromArray(data);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error processing batch data: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
function processBatchDataFromArray(data) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const headers = data[0];
        const columns = headers.map((header, index) => ({
            label: header,
            index: index
        }));
        const selectedColumn = yield vscode.window.showQuickPick(columns.map(col => col.label), { placeHolder: 'Select column for IN clause' });
        if (selectedColumn) {
            const columnIndex = ((_a = columns.find(col => col.label === selectedColumn)) === null || _a === void 0 ? void 0 : _a.index) || 0;
            let values = data.slice(1).map(row => row[columnIndex] || '').filter(val => val !== '');
            if (values.length === 0) {
                vscode.window.showWarningMessage('No valid data found in selected column.');
                return;
            }
            // Deduplication (global config only)
            const config = vscode.workspace.getConfiguration('inQueryGenerator');
            const useDistinct = config.get('distinctValues', true);
            const caseSensitive = config.get('distinctCaseSensitive', false);
            const trimWhitespace = config.get('distinctTrimWhitespace', true);
            let removed = 0;
            if (useDistinct) {
                const dedup = deduplicateValues(values, caseSensitive, trimWhitespace);
                removed = dedup.removed;
                values = dedup.unique;
            }
            const columnNameInput = yield vscode.window.showInputBox({
                prompt: 'Enter column name to use in the IN clause (optional)',
                placeHolder: 'e.g., customer_id',
                value: selectedColumn
            });
            if (columnNameInput) {
                config.update('defaultColumnName', columnNameInput, true);
            }
            const inStatement = generateInStatement(values, columnNameInput, false);
            yield previewAndApplyInStatement(inStatement, editor, false);
            if (useDistinct) {
                vscode.window.showInformationMessage(`Batch: ${removed} duplicate${removed === 1 ? '' : 's'} removed.`);
            }
        }
    });
}
function detectTableData(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length > 1) {
        // Try tab or comma first
        let delimiter = '\t';
        let columnCounts = lines.map(line => line.split(delimiter).length);
        if (columnCounts[0] <= 1 || !columnCounts.every(count => count === columnCounts[0])) {
            delimiter = ',';
            columnCounts = lines.map(line => line.split(delimiter).length);
        }
        let debugInfo = `Delimiter: "${delimiter}"\nColumn counts: ${columnCounts.join(', ')}\nFirst 3 lines:\n${lines.slice(0, 3).join('\n')}`;
        // Multi-column table
        const isConsistent = columnCounts.every(count => count === columnCounts[0] && count > 1);
        if (isConsistent) {
            return {
                hasHeaders: true,
                data: lines.map(line => line.split(delimiter).map(cell => cell.trim())),
                debugInfo
            };
        }
        // Single-column table (header + values)
        const isSingleColumn = columnCounts.every(count => count === 1);
        if (isSingleColumn) {
            // Treat first line as header, rest as values
            const data = lines.map(line => [line.trim()]);
            return {
                hasHeaders: true,
                data,
                debugInfo: debugInfo + '\n(Single-column mode)'
            };
        }
        return { hasHeaders: false, data: [], debugInfo };
    }
    return { hasHeaders: false, data: [], debugInfo: 'Not enough lines for tabular data.' };
}
function previewAndApplyInStatement(inStatement, editor, isCopyCommand) {
    return __awaiter(this, void 0, void 0, function* () {
        const config = vscode.workspace.getConfiguration('inQueryGenerator');
        const alwaysShowPreview = config.get('alwaysShowPreview', true);
        if (!alwaysShowPreview) {
            if (isCopyCommand) {
                yield vscode.env.clipboard.writeText(inStatement);
                vscode.window.showInformationMessage('Copied as IN statement to clipboard!');
            }
            else {
                editor.edit(editBuilder => {
                    if (editor.selection.isEmpty) {
                        editBuilder.insert(editor.selection.active, inStatement);
                    }
                    else {
                        editBuilder.replace(editor.selection, inStatement);
                    }
                });
                vscode.window.showInformationMessage('IN statement inserted!');
            }
            return;
        }
        const maxPreviewLength = 70;
        const previewText = inStatement.length > maxPreviewLength
            ? inStatement.substring(0, maxPreviewLength) + '...'
            : inStatement;
        const options = {
            placeHolder: 'Preview: ' + previewText
        };
        const actions = isCopyCommand
            ? ['Copy to clipboard', 'Insert at cursor', 'Cancel']
            : ['Insert at cursor', 'Copy to clipboard', 'Cancel'];
        const selectedAction = yield vscode.window.showQuickPick(actions, options);
        if (selectedAction === 'Insert at cursor') {
            editor.edit(editBuilder => {
                if (editor.selection.isEmpty) {
                    editBuilder.insert(editor.selection.active, inStatement);
                }
                else {
                    editBuilder.replace(editor.selection, inStatement);
                }
            });
            vscode.window.showInformationMessage('IN statement inserted!');
        }
        else if (selectedAction === 'Copy to clipboard') {
            yield vscode.env.clipboard.writeText(inStatement);
            vscode.window.showInformationMessage('Copied IN statement to clipboard!');
        }
    });
}
function parseText(text) {
    try {
        text = text.replace(/^(NOT\s+)?IN\s*\(\s*'/i, '').replace(/'\s*\)$/, '');
        const config = vscode.workspace.getConfiguration('inQueryGenerator');
        const splitOnWhitespace = config.get('splitOnWhitespace', false);
        let result;
        if (splitOnWhitespace) {
            result = text.split(/\s+/)
                .map(item => item.trim())
                .filter(item => item !== '');
        }
        else {
            result = text.split(/[\r\n\t]+/)
                .map(item => item.trim())
                .filter(item => item !== '');
        }
        return result;
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to parse input: ${error instanceof Error ? error.message : String(error)}`);
        return [];
    }
}
exports.parseText = parseText;
function generateInStatement(data, columnName, forceNotIn) {
    if (data.length === 0) {
        vscode.window.showWarningMessage('No data to generate IN statement.');
        return '';
    }
    const config = vscode.workspace.getConfiguration('inQueryGenerator');
    let useNotIn = config.get('useNotIn', false);
    if (typeof forceNotIn === 'boolean') {
        useNotIn = forceNotIn;
    }
    const clauseType = useNotIn ? 'NOT IN' : 'IN';
    if (!columnName) {
        columnName = config.get('defaultColumnName', '');
    }
    const formatOptions = config.get('formatOptions', {
        oneValuePerLine: false,
        maxValuesPerLine: 5,
        indentSize: 4
    });
    const formattedData = data.map(item => formatValue(item));
    let valuesString;
    if (formatOptions.oneValuePerLine && data.length > 1) {
        const indent = ' '.repeat(formatOptions.indentSize);
        valuesString = '\n' + indent + formattedData.join(',\n' + indent) + '\n';
    }
    else if (!formatOptions.oneValuePerLine && formatOptions.maxValuesPerLine > 0 && data.length > formatOptions.maxValuesPerLine) {
        const chunks = [];
        for (let i = 0; i < formattedData.length; i += formatOptions.maxValuesPerLine) {
            chunks.push(formattedData.slice(i, i + formatOptions.maxValuesPerLine));
        }
        const indent = ' '.repeat(formatOptions.indentSize);
        valuesString = '\n' + indent + chunks.map(chunk => chunk.join(', ')).join(',\n' + indent) + '\n';
    }
    else {
        valuesString = formattedData.join(', ');
    }
    const inStatement = columnName
        ? `${columnName} ${clauseType} (${valuesString})`
        : `${clauseType} (${valuesString})`;
    return inStatement;
}
exports.generateInStatement = generateInStatement;
function formatValue(item) {
    if (!item || item.toLowerCase() === 'null') {
        return 'NULL';
    }
    if (/^-?\d+(\.\d+)?$/.test(item)) {
        return item;
    }
    const config = vscode.workspace.getConfiguration('inQueryGenerator');
    const detectDataTypes = config.get('detectDataTypes', true);
    if (detectDataTypes) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(item)) {
            return `DATE '${item}'`;
        }
        if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(item)) {
            return `TIMESTAMP '${item}'`;
        }
        if (/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(item)) {
            return `'${item}'`;
        }
    }
    return `'${item.replace(/'/g, "''")}'`;
}
exports.formatValue = formatValue;
function trackUsageAndPromptRating(context) {
    return __awaiter(this, void 0, void 0, function* () {
        // Increment usage counter
        usageCounter++;
        yield context.globalState.update('inQueryGenerator.usageCounter', usageCounter);
        // Backoff logic
        const ratingPromptShown = context.globalState.get(RATING_PROMPT_KEY, false);
        const ratingDismissed = context.globalState.get(RATING_DISMISSED_KEY, false);
        const backoffCount = context.globalState.get(RATING_BACKOFF_KEY, 0);
        // Custom backoff: [10, 50, 150, 250, 250, ...]
        let nextThreshold = 0;
        for (let i = 0; i <= backoffCount; i++) {
            if (i < RATING_THRESHOLDS.length) {
                nextThreshold += RATING_THRESHOLDS[i];
            }
            else {
                nextThreshold += RATING_THRESHOLDS[RATING_THRESHOLDS.length - 1];
            }
        }
        if (!ratingPromptShown && !ratingDismissed && usageCounter >= nextThreshold) {
            yield showRatingPrompt(context);
        }
    });
}
function showRatingPrompt(context) {
    return __awaiter(this, void 0, void 0, function* () {
        const rateAction = 'Rate Extension';
        const laterAction = 'Remind Me Later';
        const dontShowAction = "Don't Show Again";
        const selection = yield vscode.window.showInformationMessage(`🌟 Enjoying the IN-Query Generator? Your rating helps others discover this time-saving tool!`, rateAction, laterAction, dontShowAction);
        switch (selection) {
            case rateAction:
                // Mark as shown so we don't prompt again
                yield context.globalState.update(RATING_PROMPT_KEY, true);
                yield context.globalState.update(RATING_BACKOFF_KEY, 0);
                // Extension ID from package.json: publisher.name
                const extensionId = 'YakovT.Sql-in-query-statement-generator';
                const marketplaceUrl = `https://marketplace.visualstudio.com/items?itemName=${extensionId}&ssr=false#review-details`;
                try {
                    yield vscode.env.openExternal(vscode.Uri.parse(marketplaceUrl));
                    vscode.window.showInformationMessage('Thank you for taking the time to rate our extension! 🙏');
                }
                catch (error) {
                    // Fallback: copy URL to clipboard if opening fails
                    yield vscode.env.clipboard.writeText(marketplaceUrl);
                    vscode.window.showInformationMessage('Rating URL copied to clipboard - paste it in your browser to rate! 📋');
                }
                break;
            case laterAction: {
                // Custom backoff: increment backoff count, keep usageCounter as is
                let backoffCount = context.globalState.get(RATING_BACKOFF_KEY, 0);
                backoffCount++;
                yield context.globalState.update(RATING_BACKOFF_KEY, backoffCount);
                break;
            }
            case dontShowAction:
                // Mark as dismissed permanently
                yield context.globalState.update(RATING_DISMISSED_KEY, true);
                yield context.globalState.update(RATING_PROMPT_KEY, true);
                yield context.globalState.update(RATING_BACKOFF_KEY, 0);
                break;
        }
    });
}
function deactivate() {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map