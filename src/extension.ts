import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { SupabaseTelemetryCollector } from './telemetry/supabase-telemetry';
import { generateUuidV7 } from './telemetry/privacy';
import {
    detectTableData,
    prepareClipboardValuesForColumnPaste,
    prepareClipboardValuesForDirectPaste
} from './inputPreparation';
import { parseText as pureParseText, DataTypeMode } from './pure';
import {
    applyClauseNullSafety,
    formatValueWithConfig,
    getDataTypeModeFromConfig,
    generateStatement,
    generateStatementWithMode,
    prepareValuesForStatement
} from './statementPreparation';
import {
    buildClauseNullWarningMessage,
    buildDeduplicationMessage,
    buildPasteInsertedMessage,
    buildSelectionCopiedMessage,
    insertStatement,
    previewAndApplyStatement,
    recordSessionSqlGeneration,
    SessionTelemetryState
} from './commandEffects';
import { sendPendingSessionSummaries, persistSessionSummary } from './telemetry/sessionSummary';
import { showKeybindingScopeNoticeOnce } from './migrationNotices';
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

function recordExtensionError(error: unknown, context: string): void {
    if (sessionTelemetry) {
        sessionTelemetry.error_count += 1;
    }

    if (extensionContext && sessionTelemetry) {
        void persistSessionSummary(extensionContext, sessionTelemetry);
    }

    if (!telemetryCollector) {
        return;
    }

    const normalizedError = error instanceof Error ? error : new Error(String(error));
    void telemetryCollector.logError(normalizedError, context);
}

function showClauseNullWarning(
    clauseType: 'IN' | 'NOT IN',
    nullLikeCount: number,
    removedNullsFromNotIn: boolean
): void {
    if (nullLikeCount === 0) {
        return;
    }

    vscode.window.showWarningMessage(
        buildClauseNullWarningMessage(clauseType, nullLikeCount, removedNullsFromNotIn)
    );
}

function resolveTelemetryDataTypeMode(dataTypeModeOverride?: DataTypeMode): DataTypeMode {
    if (dataTypeModeOverride) {
        return dataTypeModeOverride;
    }

    return getDataTypeModeFromConfig(vscode.workspace.getConfiguration('inQueryGenerator'));
}

function persistCurrentSessionSummary(): void {
    if (extensionContext && sessionTelemetry) {
        void persistSessionSummary(extensionContext, sessionTelemetry);
    }
}

function logSqlGenerationTelemetry(details: {
    command: string;
    clauseType: 'IN' | 'NOT IN';
    dataTypeMode: DataTypeMode;
    usedDistinct: boolean;
    duplicatesRemoved: number;
    uniqueValueCount: number;
    origin: 'direct' | 'paste_special' | 'column' | 'batch' | 'copy';
}): void {
    void telemetryCollector?.logSqlGeneration({
        command: details.command,
        clauseType: details.clauseType,
        dataTypeMode: details.dataTypeMode,
        usedDistinct: details.usedDistinct,
        duplicatesRemoved: details.duplicatesRemoved,
        uniqueValueCount: details.uniqueValueCount,
        origin: details.origin
    });
}

export async function activate(context: vscode.ExtensionContext) {
    extensionContext = context;
    // Initialize telemetry
    telemetryCollector = new SupabaseTelemetryCollector(context.extensionMode);
    await telemetryCollector.logEvent('extension_activated', {
        first_activation: !context.globalState.get('hasActivatedBefore', false),
        workspace_type: vscode.workspace.workspaceFolders ? 'workspace' : 'no-workspace'
    });
    await context.globalState.update('hasActivatedBefore', true);

    // Initialize session telemetry state
    sessionTelemetry = {
        session_id: generateUuidV7(),
        start_time: new Date().toISOString(),
        total_sql_generations: 0,
        by_command: {},
        by_clause_type: {},
        deduped_count: 0,
        duplicates_removed_total: 0,
        error_count: 0
    };

    void sendPendingSessionSummaries(context, telemetryCollector, sessionTelemetry.session_id);

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

    showKeybindingScopeNoticeOnce(context);
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
        const clauseSafety = applyClauseNullSafety(parsedData, forceNotIn);
        parsedData = clauseSafety.values;

        if (parsedData.length === 0) {
            vscode.window.showWarningMessage('No valid data remains after removing blank/NULL values from NOT IN.');
            return;
        }

        const inStatement = generateStatementWithMode(parsedData, undefined, forceNotIn, dataTypeModeOverride);
        await insertStatement(editor, inStatement);
        recordSessionSqlGeneration(sessionTelemetry, {
            commandName: 'pasteAs' + (forceNotIn ? 'NotIn' : 'In') + 'StatementDirect',
            clauseType: forceNotIn ? 'NOT IN' : 'IN',
            removed: preparedStatement.removed,
            useDistinct: preparedStatement.useDistinct
        });
        logSqlGenerationTelemetry({
            command: 'pasteAs' + (forceNotIn ? 'NotIn' : 'In') + 'StatementDirect',
            clauseType: forceNotIn ? 'NOT IN' : 'IN',
            dataTypeMode: resolveTelemetryDataTypeMode(dataTypeModeOverride),
            usedDistinct: preparedStatement.useDistinct,
            duplicatesRemoved: preparedStatement.removed,
            uniqueValueCount: parsedData.length,
            origin: dataTypeModeOverride !== undefined || distinctOverride !== undefined ? 'paste_special' : 'direct'
        });
        persistCurrentSessionSummary();
        vscode.window.showInformationMessage(buildPasteInsertedMessage({
            clauseType: forceNotIn ? 'NOT IN' : 'IN',
            removed: preparedStatement.removed,
            useDistinct: preparedStatement.useDistinct
        }));
        showClauseNullWarning(
            forceNotIn ? 'NOT IN' : 'IN',
            clauseSafety.nullLikeCount,
            clauseSafety.removedNullsFromNotIn
        );
        // Track usage for rating prompt
        if (context) {
            await trackUsageAndPromptRating(context, EXTENSION_ID);
        }
    } catch (error) {
        recordExtensionError(error, 'processAndPasteClipboardDirect');
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
    let stageReached = 1;
    const emitFunnel = (completed: boolean) => {
        void telemetryCollector?.logEvent('paste_special_funnel', {
            stage_reached: stageReached,
            completed
        });
    };

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
    if (!distinctChoice) {
        emitFunnel(false);
        return;
    }
    const distinctOverride = distinctChoice.value;
    stageReached = 2;

    // STAGE 2: Action choice
    const actionOptions = [
        { label: 'Paste IN Statement', command: 'extension.pasteAsInStatementDirect', option: 'paste_in_statement' },
        { label: 'Paste NOT IN Statement', command: 'extension.pasteAsNotInStatementDirect', option: 'paste_not_in_statement' },
        { label: 'Paste Column + IN Statement (use Copy with Header to select data)', command: 'extension.pasteColumnInStatement', option: 'paste_column_in_statement' },
        { label: 'Paste Column + NOT IN Statement (use Copy with Header to select data)', command: 'extension.pasteColumnNotInStatement', option: 'paste_column_not_in_statement' },
        { label: 'Cancel', command: undefined, option: 'cancel' }
    ];
    const actionChoice = await vscode.window.showQuickPick(actionOptions, {
        placeHolder: 'Stage 2 of 3: Select paste action',
        ignoreFocusOut: true
    });
    if (!actionChoice || !actionChoice.command) {
        emitFunnel(false);
        return;
    }
    stageReached = 3;

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
    if (!dataTypeChoice) {
        emitFunnel(false);
        return;
    }
    const dataTypeModeOverride = dataTypeChoice.value;
    emitFunnel(true);

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
        const clauseSafety = applyClauseNullSafety(values, forceNotIn);
        values = clauseSafety.values;

        if (values.length === 0) {
            vscode.window.showWarningMessage('No valid data remains after removing blank/NULL values from NOT IN.');
            return;
        }

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
        logSqlGenerationTelemetry({
            command: 'pasteColumn' + (forceNotIn ? 'NotIn' : 'In') + 'Statement',
            clauseType: forceNotIn ? 'NOT IN' : 'IN',
            dataTypeMode: resolveTelemetryDataTypeMode(dataTypeModeOverride),
            usedDistinct: preparedStatement.useDistinct,
            duplicatesRemoved: preparedStatement.removed,
            uniqueValueCount: values.length,
            origin: dataTypeModeOverride !== undefined || distinctOverride !== undefined ? 'paste_special' : 'column'
        });
        persistCurrentSessionSummary();
        vscode.window.showInformationMessage(buildPasteInsertedMessage({
            clauseType: forceNotIn ? 'NOT IN' : 'IN',
            removed: preparedStatement.removed,
            useDistinct: preparedStatement.useDistinct,
            columnName: resolvedColumnName
        }));
        showClauseNullWarning(
            forceNotIn ? 'NOT IN' : 'IN',
            clauseSafety.nullLikeCount,
            clauseSafety.removedNullsFromNotIn
        );
    } catch (error) {
        recordExtensionError(error, 'processColumnPaste');
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
                const useNotIn = vscode.workspace.getConfiguration('inQueryGenerator').get<boolean>('useNotIn', false);
                const clauseSafety = applyClauseNullSafety(data, useNotIn);
                data = clauseSafety.values;

                if (data.length === 0) {
                    vscode.window.showWarningMessage('No valid data remains after removing blank/NULL values from NOT IN.');
                    return;
                }

                const inStatement = generateInStatement(data);
                await previewAndApplyStatement({ inStatement, editor, isCopyCommand: true });
                recordSessionSqlGeneration(sessionTelemetry, {
                    commandName: 'copyAsInStatement',
                    clauseType: useNotIn ? 'NOT IN' : 'IN',
                    removed: preparedStatement.removed,
                    useDistinct: preparedStatement.useDistinct
                });
                logSqlGenerationTelemetry({
                    command: 'copyAsInStatement',
                    clauseType: useNotIn ? 'NOT IN' : 'IN',
                    dataTypeMode: resolveTelemetryDataTypeMode(),
                    usedDistinct: preparedStatement.useDistinct,
                    duplicatesRemoved: preparedStatement.removed,
                    uniqueValueCount: data.length,
                    origin: 'copy'
                });
                persistCurrentSessionSummary();
                if (preparedStatement.useDistinct) {
                    vscode.window.showInformationMessage(buildDeduplicationMessage('Selection', preparedStatement.removed));
                }
                showClauseNullWarning(
                    useNotIn ? 'NOT IN' : 'IN',
                    clauseSafety.nullLikeCount,
                    clauseSafety.removedNullsFromNotIn
                );
                const itemCount = data.length;
                vscode.window.showInformationMessage(buildSelectionCopiedMessage(itemCount));
                await trackUsageAndPromptRating(context, EXTENSION_ID);
            } else {
                vscode.window.showWarningMessage('No text selected.');
            }
        } else {
            vscode.window.showWarningMessage('No active text editor.');
        }
    } catch (error) {
        recordExtensionError(error, 'processSelection');
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
    } catch (error) {
        recordExtensionError(error, 'processBatchData');
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
        const columnIndex = columns.find(col => col.label === selectedColumn)?.index;
        if (columnIndex === undefined) {
            vscode.window.showWarningMessage('Selected column could not be resolved.');
            return;
        }
        let values = data.slice(1).map(row => row[columnIndex] || '').filter(val => val !== '');

        if (values.length === 0) {
            vscode.window.showWarningMessage('No valid data found in selected column.');
            return;
        }

        const preparedStatement = prepareValuesForStatement(values);
        values = preparedStatement.values;
        const clauseSafety = applyClauseNullSafety(values, false);
        values = clauseSafety.values;

        const columnNameInput = await vscode.window.showInputBox({
            prompt: 'Enter column name to use in the IN clause (optional)',
            placeHolder: 'e.g., customer_id',
            value: selectedColumn
        });

        const inStatement = generateInStatement(values, columnNameInput, false);
        await previewAndApplyStatement({ inStatement, editor, isCopyCommand: false });
        recordSessionSqlGeneration(sessionTelemetry, {
            commandName: 'batchProcessInStatement',
            clauseType: 'IN',
            removed: preparedStatement.removed,
            useDistinct: preparedStatement.useDistinct
        });
        logSqlGenerationTelemetry({
            command: 'batchProcessInStatement',
            clauseType: 'IN',
            dataTypeMode: resolveTelemetryDataTypeMode(),
            usedDistinct: preparedStatement.useDistinct,
            duplicatesRemoved: preparedStatement.removed,
            uniqueValueCount: values.length,
            origin: 'batch'
        });
        persistCurrentSessionSummary();
        if (preparedStatement.useDistinct) {
            vscode.window.showInformationMessage(buildDeduplicationMessage('Batch', preparedStatement.removed));
        }
        showClauseNullWarning('IN', clauseSafety.nullLikeCount, clauseSafety.removedNullsFromNotIn);
    }
}

export function parseText(text: string): string[] {
    try {
        const config = vscode.workspace.getConfiguration('inQueryGenerator');
        const splitOnWhitespace = config.get<boolean>('splitOnWhitespace', false);
        return pureParseText(text, splitOnWhitespace);
    } catch (error) {
        recordExtensionError(error, 'parseText');
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
    if (telemetryCollector) {
        await telemetryCollector.dispose();
    }
}

// Export for use in other modules
export function getTelemetryCollector() {
    return telemetryCollector;
}
