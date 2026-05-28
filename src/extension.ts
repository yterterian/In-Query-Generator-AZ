import * as vscode from 'vscode';
import * as crypto from 'crypto';
import fetch from 'node-fetch';
import { SupabaseTelemetryCollector } from './telemetry/supabase-telemetry';
import {
    detectTableData,
    prepareClipboardValuesForColumnPaste,
    prepareClipboardValuesForDirectPaste
} from './inputPreparation';
import { parseText as pureParseText, DataTypeMode } from './pure';
import {
    formatValueWithConfig,
    generateStatement,
    generateStatementWithMode,
    prepareValuesForStatement
} from './statementPreparation';
import {
    buildDeduplicationMessage,
    buildPasteInsertedMessage,
    buildSelectionCopiedMessage,
    insertStatement,
    previewAndApplyStatement,
    recordSessionSqlGeneration,
    SessionTelemetryState
} from './commandEffects';
import { trackUsageAndPromptRating } from './ratingPrompt';
import { createStatusBarItem, updateStatusBarItem } from './statusBarManager';

type GlobalFetch = typeof globalThis & { fetch?: typeof fetch };
const globalWithFetch = globalThis as GlobalFetch;
if (!globalWithFetch.fetch) {
    globalWithFetch.fetch = fetch;
}

let telemetryCollector: SupabaseTelemetryCollector | undefined;
let sessionTelemetry: SessionTelemetryState | undefined;
let statusBarItem: vscode.StatusBarItem;
let extensionContext: vscode.ExtensionContext | undefined;
const EXTENSION_ID = 'YakovT.sql-in-query-statement-generator';

export async function activate(context: vscode.ExtensionContext) {
    extensionContext = context;
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

    let toggleSplitCommand = vscode.commands.registerCommand('inQueryGenerator.toggleSplitOnWhitespace', async () => {
        const config = vscode.workspace.getConfiguration('inQueryGenerator');
        const currentValue = config.get<boolean>('splitOnWhitespace', false);
        await config.update('splitOnWhitespace', !currentValue, true);
        updateStatusBarItem(statusBarItem);
        vscode.window.showInformationMessage(`Split on whitespace: ${!currentValue}`);
    });

    let toggleNotInCommand = vscode.commands.registerCommand('inQueryGenerator.toggleNotIn', async () => {
        const config = vscode.workspace.getConfiguration('inQueryGenerator');
        const currentValue = config.get<boolean>('useNotIn', false);
        await config.update('useNotIn', !currentValue, true);
        updateStatusBarItem(statusBarItem);
        vscode.window.showInformationMessage(`NOT IN clause: ${!currentValue ? 'enabled' : 'disabled'}`);
    });

    // Create status bar item
    statusBarItem = createStatusBarItem();
    context.subscriptions.push(statusBarItem);

    // Initial update of status bar
    updateStatusBarItem(statusBarItem);

    // Listen for configuration changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('inQueryGenerator')) {
            updateStatusBarItem(statusBarItem);
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

        const preparedValues = await prepareClipboardValuesForDirectPaste(
            clipboardText,
            parseText,
            async (labels, placeHolder) => vscode.window.showQuickPick(labels, { placeHolder })
        );

        if (!preparedValues) {
            vscode.window.showWarningMessage('No column selected.');
            return;
        }

        let parsedData = preparedValues.values;

        if (parsedData.length === 0) {
            vscode.window.showWarningMessage('No valid data found in clipboard.');
            return;
        }

        const preparedStatement = prepareValuesForStatement(parsedData, distinctOverride);
        parsedData = preparedStatement.values;

        const inStatement = generateStatementWithMode(parsedData, undefined, forceNotIn, dataTypeModeOverride);
        await insertStatement(editor, inStatement);
        recordSessionSqlGeneration(sessionTelemetry, {
            commandName: 'pasteAs' + (forceNotIn ? 'NotIn' : 'In') + 'StatementDirect',
            clauseType: forceNotIn ? 'NOT IN' : 'IN',
            removed: preparedStatement.removed,
            useDistinct: preparedStatement.useDistinct
        });
        vscode.window.showInformationMessage(buildPasteInsertedMessage({
            clauseType: forceNotIn ? 'NOT IN' : 'IN',
            removed: preparedStatement.removed,
            useDistinct: preparedStatement.useDistinct
        }));
        // Track usage for rating prompt
        if (context) {
            await trackUsageAndPromptRating(context, EXTENSION_ID);
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
            if (!extensionContext) {
                vscode.window.showErrorMessage('Extension context is not available.');
                return;
            }
            await processAndPasteClipboardDirect(false, distinctOverride, dataTypeModeOverride, extensionContext);
            break;
        case 'extension.pasteAsNotInStatementDirect':
            if (!extensionContext) {
                vscode.window.showErrorMessage('Extension context is not available.');
                return;
            }
            await processAndPasteClipboardDirect(true, distinctOverride, dataTypeModeOverride, extensionContext);
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

        const preparedValues = await prepareClipboardValuesForColumnPaste(
            clipboardText,
            async (labels, placeHolder) => vscode.window.showQuickPick(labels, { placeHolder })
        );

        if (!preparedValues) {
            return; // User cancelled
        }

        if (preparedValues.source === 'raw_lines') {
            vscode.window.showInformationMessage('No column headers detected in clipboard data. You will be prompted to enter the column name manually.');
        }

        let values = preparedValues.values;
        if (values.length === 0) {
            vscode.window.showWarningMessage('No valid data found in selected column.');
            return;
        }

        const preparedStatement = prepareValuesForStatement(values, distinctOverride);
        values = preparedStatement.values;

        // Prompt for column name (suggest detected header if available)
        const suggestedColumnName = preparedValues.suggestedColumnName;
        const columnNameInput = await vscode.window.showInputBox({
            prompt: 'Enter column name to use in the IN clause (optional)',
            placeHolder: 'e.g., customer_id',
            value: suggestedColumnName
        });

        const resolvedColumnName = columnNameInput || suggestedColumnName;
        const inStatement = generateStatementWithMode(values, resolvedColumnName, forceNotIn, dataTypeModeOverride);
        await insertStatement(editor, inStatement);
        recordSessionSqlGeneration(sessionTelemetry, {
            commandName: 'pasteColumn' + (forceNotIn ? 'NotIn' : 'In') + 'Statement',
            clauseType: forceNotIn ? 'NOT IN' : 'IN',
            removed: preparedStatement.removed,
            useDistinct: preparedStatement.useDistinct
        });
        vscode.window.showInformationMessage(buildPasteInsertedMessage({
            clauseType: forceNotIn ? 'NOT IN' : 'IN',
            removed: preparedStatement.removed,
            useDistinct: preparedStatement.useDistinct,
            columnName: resolvedColumnName
        }));
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
                const preparedStatement = prepareValuesForStatement(data);
                data = preparedStatement.values;

                const inStatement = generateInStatement(data);
                await previewAndApplyStatement({ inStatement, editor, isCopyCommand: true });
                recordSessionSqlGeneration(sessionTelemetry, {
                    commandName: 'copyAsInStatement',
                    clauseType: 'IN',
                    removed: preparedStatement.removed,
                    useDistinct: preparedStatement.useDistinct
                });
                if (preparedStatement.useDistinct) {
                    vscode.window.showInformationMessage(buildDeduplicationMessage('Selection', preparedStatement.removed));
                }
                const itemCount = data.length;
                vscode.window.showInformationMessage(buildSelectionCopiedMessage(itemCount));
                await trackUsageAndPromptRating(context, EXTENSION_ID);
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

        const preparedStatement = prepareValuesForStatement(values);
        values = preparedStatement.values;

        const config = vscode.workspace.getConfiguration('inQueryGenerator');

        const columnNameInput = await vscode.window.showInputBox({
            prompt: 'Enter column name to use in the IN clause (optional)',
            placeHolder: 'e.g., customer_id',
            value: selectedColumn
        });

        if (columnNameInput) {
            config.update('defaultColumnName', columnNameInput, true);
        }

        const inStatement = generateInStatement(values, columnNameInput, false);
        await previewAndApplyStatement({ inStatement, editor, isCopyCommand: false });
        recordSessionSqlGeneration(sessionTelemetry, {
            commandName: 'batchProcessInStatement',
            clauseType: 'IN',
            removed: preparedStatement.removed,
            useDistinct: preparedStatement.useDistinct
        });
        if (preparedStatement.useDistinct) {
            vscode.window.showInformationMessage(buildDeduplicationMessage('Batch', preparedStatement.removed));
        }
    }
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

    return generateStatement(data, columnName, forceNotIn);
}

export function formatValue(item: string): string {
    return formatValueWithConfig(item);
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
