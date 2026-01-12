import * as vscode from 'vscode';
import * as crypto from 'crypto';
import fetch from 'node-fetch';
if (!(globalThis as any).fetch) { (globalThis as any).fetch = fetch; }
import { SupabaseTelemetryCollector } from './telemetry/supabase-telemetry';

interface SessionTelemetryState {
    session_id: string;
    start_time: string;
    end_time?: string;
    total_sql_generations: number;
    by_command: Record<string, number>;
    by_clause_type: Record<string, number>;
    deduped_count: number;
    duplicates_removed_total: number;
    error_count: number;
}

let telemetryCollector: SupabaseTelemetryCollector | undefined;
let sessionTelemetry: SessionTelemetryState | undefined;
let statusBarItem: vscode.StatusBarItem;
let usageCounter = 0;
const RATING_THRESHOLDS = [10, 50, 150, 250]; // Custom backoff intervals
const RATING_PROMPT_KEY = 'inQueryGenerator.ratingPromptShown';
const RATING_DISMISSED_KEY = 'inQueryGenerator.ratingDismissed';
const RATING_BACKOFF_KEY = 'inQueryGenerator.ratingBackoffCount';

export async function activate(context: vscode.ExtensionContext) {
    // Initialize telemetry
    telemetryCollector = new SupabaseTelemetryCollector();
    await telemetryCollector.logEvent('extension_activated', {
        first_activation: !context.globalState.get('hasActivatedBefore', false),
        workspace_type: vscode.workspace.workspaceFolders ? 'workspace' : 'no-workspace'
    });
    context.globalState.update('hasActivatedBefore', true);

    // Initialize session telemetry state
    sessionTelemetry = {
        session_id: generateSessionId(),
        start_time: new Date().toISOString(),
        total_sql_generations: 0,
        by_command: {},
        by_clause_type: {},
        deduped_count: 0,
        duplicates_removed_total: 0,
        error_count: 0
    };

    // Load usage counter from storage
    usageCounter = context.globalState.get('inQueryGenerator.usageCounter', 0);

    // Register commands
    let copyDisposable = vscode.commands.registerCommand('extension.copyAsInStatement', async () => {
        await processSelection(context);
    });

    // Direct paste as IN
    let pasteInDisposable = vscode.commands.registerCommand('extension.pasteAsInStatementDirect', async () => {
        await processAndPasteClipboardDirect(false, undefined, undefined, context);
    });

    // Paste as IN Statement (for keybinding/alias)
    let pasteAsInStatementDisposable = vscode.commands.registerCommand('extension.pasteAsInStatement', async () => {
        await processAndPasteClipboardDirect(false, undefined, undefined, context);
    });

    // Direct paste as NOT IN
    let pasteNotInDisposable = vscode.commands.registerCommand('extension.pasteAsNotInStatementDirect', async () => {
        await processAndPasteClipboardDirect(true, undefined, undefined, context);
    });

    // Paste Special (dropdown)
    let pasteSpecialDisposable = vscode.commands.registerCommand('extension.pasteSpecialInStatement', async () => {
        await showPasteSpecialDropdown();
    });

    // Paste Column + IN
    let pasteColumnInDisposable = vscode.commands.registerCommand('extension.pasteColumnInStatement', async () => {
        await processColumnPaste(false, undefined, undefined);
    });

    // Paste Column + NOT IN
    let pasteColumnNotInDisposable = vscode.commands.registerCommand('extension.pasteColumnNotInStatement', async () => {
        await processColumnPaste(true, undefined, undefined);
    });

    let batchProcessDisposable = vscode.commands.registerCommand('extension.batchProcessInStatement', async () => {
        await processBatchData();
    });

    let toggleSplitCommand = vscode.commands.registerCommand('inQueryGenerator.toggleSplitOnWhitespace', () => {
        const config = vscode.workspace.getConfiguration('inQueryGenerator');
        const currentValue = config.get<boolean>('splitOnWhitespace', false);
        config.update('splitOnWhitespace', !currentValue, true);
        updateStatusBarItem();
        vscode.window.showInformationMessage(`Split on whitespace: ${!currentValue}`);
    });

    let toggleNotInCommand = vscode.commands.registerCommand('inQueryGenerator.toggleNotIn', () => {
        const config = vscode.workspace.getConfiguration('inQueryGenerator');
        const currentValue = config.get<boolean>('useNotIn', false);
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

    context.subscriptions.push(
        copyDisposable,
        pasteInDisposable,
        pasteAsInStatementDisposable,
        pasteNotInDisposable,
        pasteSpecialDisposable,
        pasteColumnInDisposable,
        pasteColumnNotInDisposable,
        batchProcessDisposable,
        toggleSplitCommand,
        toggleNotInCommand
    );
}

function updateStatusBarItem(): void {
    const config = vscode.workspace.getConfiguration('inQueryGenerator');
    const statusBarActions = config.get<string[]>('statusBarActions', ['dropdown']);
    const splitOnWhitespace = config.get<boolean>('splitOnWhitespace', false);
    const useNotIn = config.get<boolean>('useNotIn', false);

    if (statusBarActions.length === 1 && statusBarActions[0] === 'dropdown') {
        statusBarItem.text = 'SQL IN Tools';
        statusBarItem.tooltip = 'Click to access SQL IN/NOT IN features';
        statusBarItem.command = 'extension.pasteSpecialInStatement';
        statusBarItem.show();
    } else if (statusBarActions.length > 0) {
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
                text = 'SQL IN Tools';
                tooltip = 'Show SQL IN/NOT IN dropdown';
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
                text = 'SQL IN Tools';
                tooltip = 'SQL IN/NOT IN features';
        }
        statusBarItem.text = text;
        statusBarItem.tooltip = tooltip + ' (right-click for dropdown)';
        statusBarItem.command = command;
        statusBarItem.show();
    } else {
        // Fallback: show current mode
        statusBarItem.text = `${useNotIn ? 'NOT IN' : 'IN'}: ${splitOnWhitespace ? 'Split' : 'No Split'}`;
        statusBarItem.tooltip = `Split on whitespace: ${splitOnWhitespace ? 'enabled' : 'disabled'}, NOT IN: ${useNotIn ? 'enabled' : 'disabled'}`;
        statusBarItem.command = 'extension.pasteSpecialInStatement';
        statusBarItem.show();
    }
}

// Deduplication logic
function deduplicateValues(
    values: string[],
    caseSensitive: boolean,
    trimWhitespace: boolean
): { unique: string[], removed: number } {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const val of values) {
        let norm = trimWhitespace ? val.trim() : val;
        if (!caseSensitive) norm = norm.toLowerCase();
        if (!seen.has(norm)) {
            seen.add(norm);
            result.push(val);
        }
    }
    return { unique: result, removed: values.length - result.length };
}

// Direct paste as IN/NOT IN
async function processAndPasteClipboardDirect(forceNotIn: boolean, distinctOverride: boolean | undefined, dataTypeModeOverride: DataTypeMode | undefined, context: vscode.ExtensionContext) {
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active text editor.');
            return;
        }
        const clipboardText = await vscode.env.clipboard.readText();
        if (!clipboardText) {
            vscode.window.showWarningMessage('Clipboard is empty.');
            return;
        }

        // Detect if clipboard contains tabular data (multiple columns)
        const { hasHeaders, data } = detectTableData(clipboardText);

        let parsedData: string[] = [];
        if (hasHeaders && data.length > 1 && data[0].length > 1) {
            // Multiple columns detected, prompt user to select column
            const headers = data[0];
            const columns = headers.map((header, index) => ({
                label: header,
                index: index
            }));
            const selectedColumn = await vscode.window.showQuickPick(
                columns.map(col => col.label),
                { placeHolder: 'Multiple columns detected. Select the column to use for the IN clause (first value from each column shown below).' }
            );
            if (!selectedColumn) {
                vscode.window.showWarningMessage('No column selected.');
                return;
            }
            const columnIndex = columns.find(col => col.label === selectedColumn)?.index || 0;
            parsedData = data.slice(1).map(row => row[columnIndex] || '').filter(val => val !== '');
        } else {
            // Single column or non-tabular data, use default parseText
            parsedData = parseText(clipboardText);
        }

        if (parsedData.length === 0) {
            vscode.window.showWarningMessage('No valid data found in clipboard.');
            return;
        }

        // Deduplication
        const config = vscode.workspace.getConfiguration('inQueryGenerator');
        const useDistinct = typeof distinctOverride === 'boolean'
            ? distinctOverride
            : config.get<boolean>('distinctValues', true);
        const caseSensitive = config.get<boolean>('distinctCaseSensitive', false);
        const trimWhitespace = config.get<boolean>('distinctTrimWhitespace', true);

        let removed = 0;
        if (useDistinct) {
            const dedup = deduplicateValues(parsedData, caseSensitive, trimWhitespace);
            removed = dedup.removed;
            parsedData = dedup.unique;
        }

        const inStatement = generateInStatementWithMode(parsedData, undefined, forceNotIn, dataTypeModeOverride);
        editor.edit(editBuilder => {
            if (editor.selection.isEmpty) {
                editBuilder.insert(editor.selection.active, inStatement);
            } else {
                editBuilder.replace(editor.selection, inStatement);
            }
        });
        // Session-based telemetry aggregation
        if (sessionTelemetry) {
            sessionTelemetry.total_sql_generations += 1;
            const cmd = 'pasteAs' + (forceNotIn ? 'NotIn' : 'In') + 'StatementDirect';
            sessionTelemetry.by_command[cmd] = (sessionTelemetry.by_command[cmd] || 0) + 1;
            const clause = forceNotIn ? 'NOT IN' : 'IN';
            sessionTelemetry.by_clause_type[clause] = (sessionTelemetry.by_clause_type[clause] || 0) + 1;
            if (useDistinct) {
                sessionTelemetry.deduped_count += 1;
                sessionTelemetry.duplicates_removed_total += removed;
            }
        }
        // (Per-action telemetry removed; now aggregated per session)
        let msg = `${forceNotIn ? 'NOT IN' : 'IN'} statement inserted!`;
        if (useDistinct) {
            msg += ` (${removed} duplicate${removed === 1 ? '' : 's'} removed)`;
        }
        vscode.window.showInformationMessage(msg);
        // Track usage for rating prompt
        if (context) {
            await trackUsageAndPromptRating(context);
        }
    } catch {
        vscode.window.showErrorMessage('Error processing clipboard.');
    }
}

// Paste Special dropdown
/**
 * Paste Special dropdown with 3-stage flow:
 * Stage 1: Choose distinct vs all values
 * Stage 2: Choose action type (IN, NOT IN, Column+IN, Column+NOT IN)
 * Stage 3: Choose data type override (Auto, Force Text, Force Number)
 */
async function showPasteSpecialDropdown() {
    // STAGE 1: Distinct choice
    const distinctChoice = await vscode.window.showQuickPick(
        [
            { label: 'Distinct values (remove duplicates)', value: true },
            { label: 'All values (keep duplicates)', value: false }
        ],
        {
            placeHolder: 'Stage 1 of 3: Choose whether to remove duplicate values',
            ignoreFocusOut: true
        }
    );
    if (!distinctChoice) return;
    const distinctOverride = distinctChoice.value;
    const dedupType = distinctOverride ? 'distinct' : 'all';

    // STAGE 2: Action choice
    const actionOptions = [
        { label: 'Paste IN Statement', command: 'extension.pasteAsInStatementDirect', option: 'paste_in_statement' },
        { label: 'Paste NOT IN Statement', command: 'extension.pasteAsNotInStatementDirect', option: 'paste_not_in_statement' },
        { label: 'Paste Column + IN Statement (use Copy with Header to select data)', command: 'extension.pasteColumnInStatement', option: 'paste_column_in_statement' },
        { label: 'Paste Column + NOT IN Statement (use Copy with Header to select data)', command: 'extension.pasteColumnNotInStatement', option: 'paste_column_not_in_statement' },
        { label: 'Cancel', command: undefined, option: 'cancel' }
    ];
    const actionChoice = await vscode.window.showQuickPick(actionOptions, {
        placeHolder: 'Stage 2 of 3: Select paste action'
    });
    if (!actionChoice || !actionChoice.command) return;

    // STAGE 3: Data type override choice
    const dataTypeChoice = await vscode.window.showQuickPick(
        [
            {
                label: '$(symbol-misc) Auto-detect (Smart)',
                description: 'Automatically detect numbers, dates, GUIDs',
                value: DataTypeMode.Auto,
                detail: 'Default behavior - intelligently formats each value'
            },
            {
                label: '$(quote) Force Text (Quote All)',
                description: 'Treat all values as text (quoted)',
                value: DataTypeMode.ForceText,
                detail: 'Useful for IDs that look like numbers but should be text'
            },
            {
                label: '$(symbol-number) Force Number (Unquote All)',
                description: 'Treat all values as numbers (unquoted)',
                value: DataTypeMode.ForceNumber,
                detail: 'Non-numeric values will be quoted automatically (fallback)'
            }
        ],
        {
            placeHolder: 'Stage 3 of 3: Choose data type formatting',
            ignoreFocusOut: true
        }
    );
    if (!dataTypeChoice) return;
    const dataTypeModeOverride = dataTypeChoice.value;

    // Telemetry: log granular usage
    if (typeof telemetryCollector !== 'undefined') {
        telemetryCollector.logEvent('paste_special_option', {
            option: actionChoice.option,
            deduplication: dedupType,
            data_type_mode: dataTypeModeOverride,
            trigger: 'context_menu_or_command'
        });
    }

    // Execute the chosen action with all overrides
    switch (actionChoice.command) {
        case 'extension.pasteAsInStatementDirect':
            await processAndPasteClipboardDirect(false, distinctOverride, dataTypeModeOverride, vscode.extensions.getExtension('YakovT.Sql-in-query-statement-generator')?.exports?.context);
            break;
        case 'extension.pasteAsNotInStatementDirect':
            await processAndPasteClipboardDirect(true, distinctOverride, dataTypeModeOverride, vscode.extensions.getExtension('YakovT.Sql-in-query-statement-generator')?.exports?.context);
            break;
        case 'extension.pasteColumnInStatement':
            await processColumnPaste(false, distinctOverride, dataTypeModeOverride);
            break;
        case 'extension.pasteColumnNotInStatement':
            await processColumnPaste(true, distinctOverride, dataTypeModeOverride);
            break;
        default:
            break;
    }
}

// Paste Column + IN/NOT IN
async function processColumnPaste(forceNotIn: boolean, distinctOverride: boolean | undefined, dataTypeModeOverride: DataTypeMode | undefined) {
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active text editor.');
            return;
        }
        const clipboardText = await vscode.env.clipboard.readText();
        if (!clipboardText) {
            vscode.window.showWarningMessage('Clipboard is empty.');
            return;
        }
        const { hasHeaders, data, debugInfo } = detectTableData(clipboardText);

        let headers: string[] = [];
        let dataRows: string[][];
        let selectedColumnIndex = 0;

        if (hasHeaders && data.length > 1) {
            // Has headers - use them for column selection
            headers = data[0];
            dataRows = data.slice(1);

            const columns = headers.map((header, index) => ({
                label: header,
                index: index
            }));
            const selectedColumn = await vscode.window.showQuickPick(
                columns.map(col => col.label),
                { placeHolder: 'Select column for IN clause' }
            );
            if (!selectedColumn) {
                return; // User cancelled
            }
            selectedColumnIndex = columns.find(col => col.label === selectedColumn)?.index || 0;
        } else {
            // No headers detected - show informative message and treat as simple list
            vscode.window.showInformationMessage('No column headers detected in clipboard data. You will be prompted to enter the column name manually.');

            // Treat all data as simple single-column list
            const lines = clipboardText.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
            if (lines.length === 0) {
                vscode.window.showWarningMessage('No data found in clipboard.');
                return;
            }

            dataRows = lines.map(line => [line]);
            selectedColumnIndex = 0;
        }

        // Extract values from selected column
        let values = dataRows.map(row => row[selectedColumnIndex] || '').filter(val => val !== '');
        if (values.length === 0) {
            vscode.window.showWarningMessage('No valid data found in selected column.');
            return;
        }

        // Deduplication
        const config = vscode.workspace.getConfiguration('inQueryGenerator');
        const useDistinct = typeof distinctOverride === 'boolean'
            ? distinctOverride
            : config.get<boolean>('distinctValues', true);
        const caseSensitive = config.get<boolean>('distinctCaseSensitive', false);
        const trimWhitespace = config.get<boolean>('distinctTrimWhitespace', true);

        let removed = 0;
        if (useDistinct) {
            const dedup = deduplicateValues(values, caseSensitive, trimWhitespace);
            removed = dedup.removed;
            values = dedup.unique;
        }

        // Prompt for column name (suggest detected header if available)
        const suggestedColumnName = hasHeaders && headers ? headers[selectedColumnIndex] : '';
        const columnNameInput = await vscode.window.showInputBox({
            prompt: 'Enter column name to use in the IN clause (optional)',
            placeHolder: 'e.g., customer_id',
            value: suggestedColumnName
        });

        const inStatement = generateInStatementWithMode(values, columnNameInput || suggestedColumnName, forceNotIn, dataTypeModeOverride);
        editor.edit(editBuilder => {
            if (editor.selection.isEmpty) {
                editBuilder.insert(editor.selection.active, inStatement);
            } else {
                editBuilder.replace(editor.selection, inStatement);
            }
        });

        // Session-based telemetry aggregation
        if (sessionTelemetry) {
            sessionTelemetry.total_sql_generations += 1;
            const cmd = 'pasteColumn' + (forceNotIn ? 'NotIn' : 'In') + 'Statement';
            sessionTelemetry.by_command[cmd] = (sessionTelemetry.by_command[cmd] || 0) + 1;
            const clause = forceNotIn ? 'NOT IN' : 'IN';
            sessionTelemetry.by_clause_type[clause] = (sessionTelemetry.by_clause_type[clause] || 0) + 1;
            if (useDistinct) {
                sessionTelemetry.deduped_count += 1;
                sessionTelemetry.duplicates_removed_total += removed;
            }
        }

        // Display success message
        let msg = `${forceNotIn ? 'NOT IN' : 'IN'} statement inserted!`;
        if (columnNameInput || suggestedColumnName) {
            msg = `${forceNotIn ? 'NOT IN' : 'IN'} statement inserted for column "${columnNameInput || suggestedColumnName}"!`;
        }
        if (useDistinct) {
            msg += ` (${removed} duplicate${removed === 1 ? '' : 's'} removed)`;
        }
        vscode.window.showInformationMessage(msg);
    } catch {
        vscode.window.showErrorMessage('Error processing column paste.');
    }
}

// Existing logic for selection, batch, and preview
async function processSelection(context: vscode.ExtensionContext) {
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
                const useDistinct = config.get<boolean>('distinctValues', true);
                const caseSensitive = config.get<boolean>('distinctCaseSensitive', false);
                const trimWhitespace = config.get<boolean>('distinctTrimWhitespace', true);

                let removed = 0;
                if (useDistinct) {
                    const dedup = deduplicateValues(data, caseSensitive, trimWhitespace);
                    removed = dedup.removed;
                    data = dedup.unique;
                }

                const inStatement = generateInStatement(data);
                await previewAndApplyInStatement(inStatement, editor, true);
                // Session-based telemetry aggregation
                if (sessionTelemetry) {
                    sessionTelemetry.total_sql_generations += 1;
                    const cmd = 'copyAsInStatement';
                    sessionTelemetry.by_command[cmd] = (sessionTelemetry.by_command[cmd] || 0) + 1;
                    const clause = 'IN';
                    sessionTelemetry.by_clause_type[clause] = (sessionTelemetry.by_clause_type[clause] || 0) + 1;
                    if (useDistinct) {
                        sessionTelemetry.deduped_count += 1;
                        sessionTelemetry.duplicates_removed_total += removed;
                    }
                }
                // (Per-action telemetry removed; now aggregated per session)
                if (useDistinct) {
                    vscode.window.showInformationMessage(`Selection: ${removed} duplicate${removed === 1 ? '' : 's'} removed.`);
                }
                // Enhanced success message with value proposition
                const itemCount = data.length;
                vscode.window.showInformationMessage(
                    `✅ Copied ${itemCount} item${itemCount !== 1 ? 's' : ''} as IN statement to clipboard!`
                );
                await trackUsageAndPromptRating(context);
            } else {
                vscode.window.showWarningMessage('No text selected.');
            }
        } else {
            vscode.window.showWarningMessage('No active text editor.');
        }
    } catch {
        vscode.window.showErrorMessage('Error processing selection.');
    }
}


async function processBatchData() {
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

        await processBatchDataFromArray(data);
    } catch {
        vscode.window.showErrorMessage('Error processing selection.');
    }
}

async function processBatchDataFromArray(data: string[][]) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const headers = data[0];
    const columns = headers.map((header, index) => ({
        label: header,
        index: index
    }));

    const selectedColumn = await vscode.window.showQuickPick(
        columns.map(col => col.label),
        { placeHolder: 'Select column for IN clause' }
    );

    if (selectedColumn) {
        const columnIndex = columns.find(col => col.label === selectedColumn)?.index || 0;
        let values = data.slice(1).map(row => row[columnIndex] || '').filter(val => val !== '');

        if (values.length === 0) {
            vscode.window.showWarningMessage('No valid data found in selected column.');
            return;
        }

        // Deduplication (global config only)
        const config = vscode.workspace.getConfiguration('inQueryGenerator');
        const useDistinct = config.get<boolean>('distinctValues', true);
        const caseSensitive = config.get<boolean>('distinctCaseSensitive', false);
        const trimWhitespace = config.get<boolean>('distinctTrimWhitespace', true);

        let removed = 0;
        if (useDistinct) {
            const dedup = deduplicateValues(values, caseSensitive, trimWhitespace);
            removed = dedup.removed;
            values = dedup.unique;
        }

        const columnNameInput = await vscode.window.showInputBox({
            prompt: 'Enter column name to use in the IN clause (optional)',
            placeHolder: 'e.g., customer_id',
            value: selectedColumn
        });

        if (columnNameInput) {
            config.update('defaultColumnName', columnNameInput, true);
        }

        const inStatement = generateInStatement(values, columnNameInput, false);
        await previewAndApplyInStatement(inStatement, editor, false);
        // Session-based telemetry aggregation
        if (sessionTelemetry) {
            sessionTelemetry.total_sql_generations += 1;
            const cmd = 'batchProcessInStatement';
            sessionTelemetry.by_command[cmd] = (sessionTelemetry.by_command[cmd] || 0) + 1;
            const clause = 'IN';
            sessionTelemetry.by_clause_type[clause] = (sessionTelemetry.by_clause_type[clause] || 0) + 1;
            if (useDistinct) {
                sessionTelemetry.deduped_count += 1;
                sessionTelemetry.duplicates_removed_total += removed;
            }
        }
        // (Per-action telemetry removed; now aggregated per session)
        if (useDistinct) {
            vscode.window.showInformationMessage(`Batch: ${removed} duplicate${removed === 1 ? '' : 's'} removed.`);
        }
    }
}

import { detectAndParseTableData, isSingleColumnWithCommas, parseCsvLine } from './utils/csvParser';

// Improved robust tabular data detection
function detectTableData(text: string): { hasHeaders: boolean, data: string[][], debugInfo?: string } {
    const parseResult = detectAndParseTableData(text);

    // If parsing failed but we suspect single-column data with commas, treat as single column
    if (!parseResult.hasHeaders && parseResult.data.length === 0) {
        if (isSingleColumnWithCommas(text)) {
            const lines = text.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
            return {
                hasHeaders: true,
                data: lines.map(line => [parseCsvLine(line, ',')[0]]),
                debugInfo: 'Detected single-column data with embedded commas'
            };
        }
    }

    return {
        hasHeaders: parseResult.hasHeaders,
        data: parseResult.data,
        debugInfo: parseResult.debugInfo
    };
}

async function previewAndApplyInStatement(inStatement: string, editor: vscode.TextEditor, isCopyCommand: boolean) {
    const config = vscode.workspace.getConfiguration('inQueryGenerator');
    const alwaysShowPreview = config.get<boolean>('alwaysShowPreview', true);

    if (!alwaysShowPreview) {
        if (isCopyCommand) {
            await vscode.env.clipboard.writeText(inStatement);
            vscode.window.showInformationMessage('Copied as IN statement to clipboard!');
        } else {
            editor.edit(editBuilder => {
                if (editor.selection.isEmpty) {
                    editBuilder.insert(editor.selection.active, inStatement);
                } else {
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

    const options: vscode.QuickPickOptions = {
        placeHolder: 'Preview: ' + previewText
    };

    const actions = isCopyCommand
        ? ['Copy to clipboard', 'Insert at cursor', 'Cancel']
        : ['Insert at cursor', 'Copy to clipboard', 'Cancel'];

    const selectedAction = await vscode.window.showQuickPick(actions, options);

    if (selectedAction === 'Insert at cursor') {
        editor.edit(editBuilder => {
            if (editor.selection.isEmpty) {
                editBuilder.insert(editor.selection.active, inStatement);
            } else {
                editBuilder.replace(editor.selection, inStatement);
            }
        });
        vscode.window.showInformationMessage('IN statement inserted!');
    } else if (selectedAction === 'Copy to clipboard') {
        await vscode.env.clipboard.writeText(inStatement);
        vscode.window.showInformationMessage('Copied IN statement to clipboard!');
    }
}

import { parseText as pureParseText, formatValue as pureFormatValue, generateInStatement as pureGenerateInStatement, FormatOptions, DataTypeMode } from './pure';

/**
 * Converts boolean detectDataTypes config to DataTypeMode enum.
 * Provides backward compatibility with existing config.
 */
function getDataTypeModeFromConfig(config: vscode.WorkspaceConfiguration): DataTypeMode {
    const detectDataTypes = config.get<boolean>('detectDataTypes', true);
    return detectDataTypes ? DataTypeMode.Auto : DataTypeMode.ForceText;
}

/**
 * Wrapper around pure generateInStatement that integrates config and overrides
 */
function generateInStatementWithMode(
    data: string[],
    columnName: string | undefined,
    forceNotIn: boolean,
    dataTypeModeOverride?: DataTypeMode
): string {
    const config = vscode.workspace.getConfiguration('inQueryGenerator');

    const formatOptions = config.get<FormatOptions>('formatOptions', {
        oneValuePerLine: false,
        maxValuesPerLine: 5,
        indentSize: 4
    });

    // Determine data type mode
    const dataTypeMode = dataTypeModeOverride ?? getDataTypeModeFromConfig(config);

    return pureGenerateInStatement(data, {
        columnName: columnName || config.get<string>('defaultColumnName', ''),
        useNotIn: forceNotIn,
        dataTypeMode,
        formatOptions
    });
}

export function parseText(text: string): string[] {
    try {
        const config = vscode.workspace.getConfiguration('inQueryGenerator');
        const splitOnWhitespace = config.get<boolean>('splitOnWhitespace', false);
        return pureParseText(text, splitOnWhitespace);
    } catch {
        vscode.window.showErrorMessage('Failed to parse input.');
        return [];
    }
}

export function generateInStatement(data: string[], columnName?: string, forceNotIn?: boolean): string {
    if (data.length === 0) {
        vscode.window.showWarningMessage('No data to generate IN statement.');
        return '';
    }

    const config = vscode.workspace.getConfiguration('inQueryGenerator');
    let useNotIn = config.get<boolean>('useNotIn', false);
    if (typeof forceNotIn === 'boolean') {
        useNotIn = forceNotIn;
    }
    if (!columnName) {
        columnName = config.get<string>('defaultColumnName', '');
    }
    const dataTypeMode = getDataTypeModeFromConfig(config);
    const formatOptions = config.get<FormatOptions>('formatOptions', {
        oneValuePerLine: false,
        maxValuesPerLine: 5,
        indentSize: 4
    });

    return pureGenerateInStatement(data, {
        columnName,
        useNotIn,
        dataTypeMode,
        formatOptions
    });
}

export function formatValue(item: string): string {
    const config = vscode.workspace.getConfiguration('inQueryGenerator');
    const dataTypeMode = getDataTypeModeFromConfig(config);
    return pureFormatValue(item, dataTypeMode);
}

async function trackUsageAndPromptRating(context: vscode.ExtensionContext) {
    // Increment usage counter
    usageCounter++;
    await context.globalState.update('inQueryGenerator.usageCounter', usageCounter);

    // Backoff logic
    const ratingPromptShown = context.globalState.get(RATING_PROMPT_KEY, false);
    const ratingDismissed = context.globalState.get(RATING_DISMISSED_KEY, false);
    const backoffCount = context.globalState.get(RATING_BACKOFF_KEY, 0);

    // Custom backoff: [10, 50, 150, 250, 250, ...]
    let nextThreshold = 0;
    for (let i = 0; i <= backoffCount; i++) {
        if (i < RATING_THRESHOLDS.length) {
            nextThreshold += RATING_THRESHOLDS[i];
        } else {
            nextThreshold += RATING_THRESHOLDS[RATING_THRESHOLDS.length - 1];
        }
    }

    if (!ratingPromptShown && !ratingDismissed && usageCounter >= nextThreshold) {
        await showRatingPrompt(context);
    }
}

async function showRatingPrompt(context: vscode.ExtensionContext) {
    const rateAction = 'Rate Extension';
    const laterAction = 'Remind Me Later';
    const dontShowAction = "Don't Show Again";

    const selection = await vscode.window.showInformationMessage(
        `🌟 Enjoying the SQL IN Clause Generator? Your rating helps others discover this time-saving tool!`,
        rateAction,
        laterAction,
        dontShowAction
    );

    switch (selection) {
        case rateAction:
            // Mark as shown so we don't prompt again
            await context.globalState.update(RATING_PROMPT_KEY, true);
            await context.globalState.update(RATING_BACKOFF_KEY, 0);

            // Extension ID from package.json: publisher.name
            const extensionId = 'YakovT.Sql-in-query-statement-generator';
            const marketplaceUrl = `https://marketplace.visualstudio.com/items?itemName=${extensionId}&ssr=false#review-details`;

            try {
                await vscode.env.openExternal(vscode.Uri.parse(marketplaceUrl));
                vscode.window.showInformationMessage('Thank you for taking the time to rate our extension! 🙏');
            } catch {
                // Fallback: copy URL to clipboard if opening fails
                await vscode.env.clipboard.writeText(marketplaceUrl);
                vscode.window.showInformationMessage('Rating URL copied to clipboard - paste it in your browser to rate! 📋');
            }
            break;

        case laterAction: {
            // Custom backoff: increment backoff count, keep usageCounter as is
            let backoffCount = context.globalState.get(RATING_BACKOFF_KEY, 0);
            backoffCount++;
            await context.globalState.update(RATING_BACKOFF_KEY, backoffCount);
            break;
        }

        case dontShowAction:
            // Mark as dismissed permanently
            await context.globalState.update(RATING_DISMISSED_KEY, true);
            await context.globalState.update(RATING_PROMPT_KEY, true);
            await context.globalState.update(RATING_BACKOFF_KEY, 0);
            break;
    }
}

export async function deactivate() {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
    // Send session-based telemetry if there was any SQL generation activity
    if (telemetryCollector && sessionTelemetry && sessionTelemetry.total_sql_generations > 0) {
        sessionTelemetry.end_time = new Date().toISOString();
        // Flatten nested objects for telemetry
        const flatSession: Record<string, string | number | boolean> = {
            session_id: sessionTelemetry.session_id,
            start_time: sessionTelemetry.start_time,
            end_time: sessionTelemetry.end_time || '',
            total_sql_generations: sessionTelemetry.total_sql_generations,
            by_command: JSON.stringify(sessionTelemetry.by_command),
            by_clause_type: JSON.stringify(sessionTelemetry.by_clause_type),
            deduped_count: sessionTelemetry.deduped_count,
            duplicates_removed_total: sessionTelemetry.duplicates_removed_total,
            error_count: sessionTelemetry.error_count
        };
        await telemetryCollector.logEvent('session_sql_utilization', flatSession);
    }
    if (telemetryCollector) {
        await telemetryCollector.logEvent('extension_deactivated');
        await telemetryCollector.dispose();
    }
}

function generateSessionId(): string {
    // Secure UUID generation using crypto.randomBytes
    const randomBytes = crypto.randomBytes(16);
    randomBytes[6] = (randomBytes[6] & 0x0f) | 0x40; // Set version to 4
    randomBytes[8] = (randomBytes[8] & 0x3f) | 0x80; // Set variant to RFC4122
    return [...randomBytes].map((byte, index) => {
        const hex = byte.toString(16).padStart(2, '0');
        return (index === 4 || index === 6 || index === 8 || index === 10) ? `-${hex}` : hex;
    }).join('');
}

// Export for use in other modules
export function getTelemetryCollector() {
    return telemetryCollector;
}
