import * as vscode from 'vscode';

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    // Register commands
    let copyDisposable = vscode.commands.registerCommand('extension.copyAsInStatement', async () => {
        await processSelection();
    });

    // Direct paste as IN
    let pasteInDisposable = vscode.commands.registerCommand('extension.pasteAsInStatementDirect', async () => {
        await processAndPasteClipboardDirect(false, undefined);
    });

    // Direct paste as NOT IN
    let pasteNotInDisposable = vscode.commands.registerCommand('extension.pasteAsNotInStatementDirect', async () => {
        await processAndPasteClipboardDirect(true, undefined);
    });

    // Paste Special (dropdown)
    let pasteSpecialDisposable = vscode.commands.registerCommand('extension.pasteSpecialInStatement', async () => {
        await showPasteSpecialDropdown();
    });

    // Paste Column + IN
    let pasteColumnInDisposable = vscode.commands.registerCommand('extension.pasteColumnInStatement', async () => {
        await processColumnPaste(false, undefined);
    });

    // Paste Column + NOT IN
    let pasteColumnNotInDisposable = vscode.commands.registerCommand('extension.pasteColumnNotInStatement', async () => {
        await processColumnPaste(true, undefined);
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
        statusBarItem.text = 'IN Tools';
        statusBarItem.tooltip = 'Click to access IN/NOT IN features';
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
async function processAndPasteClipboardDirect(forceNotIn: boolean, distinctOverride: boolean | undefined) {
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
        let parsedData = parseText(clipboardText);
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

        const inStatement = generateInStatement(parsedData, undefined, forceNotIn);
        editor.edit(editBuilder => {
            if (editor.selection.isEmpty) {
                editBuilder.insert(editor.selection.active, inStatement);
            } else {
                editBuilder.replace(editor.selection, inStatement);
            }
        });
        let msg = `${forceNotIn ? 'NOT IN' : 'IN'} statement inserted!`;
        if (useDistinct) {
            msg += ` (${removed} duplicate${removed === 1 ? '' : 's'} removed)`;
        }
        vscode.window.showInformationMessage(msg);
    } catch (error) {
        vscode.window.showErrorMessage(`Error processing clipboard: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// Paste Special dropdown
async function showPasteSpecialDropdown() {
    // Ask for distinct option
    const config = vscode.workspace.getConfiguration('inQueryGenerator');
    const defaultDistinct = config.get<boolean>('distinctValues', true);
    const distinctChoice = await vscode.window.showQuickPick(
        [
            { label: 'Distinct values (remove duplicates)', value: true },
            { label: 'All values (keep duplicates)', value: false }
        ],
        {
            placeHolder: 'Choose whether to remove duplicate values for this operation',
            ignoreFocusOut: true
        }
    );
    if (!distinctChoice) return;
    const distinctOverride = distinctChoice.value;

    const options = [
        { label: 'Paste IN Statement', command: 'extension.pasteAsInStatementDirect' },
        { label: 'Paste NOT IN Statement', command: 'extension.pasteAsNotInStatementDirect' },
        { label: 'Paste Column + IN Statement (use Copy with Header to select data)', command: 'extension.pasteColumnInStatement' },
        { label: 'Paste Column + NOT IN Statement (use Copy with Header to select data)', command: 'extension.pasteColumnNotInStatement' },
        { label: 'Cancel', command: undefined }
    ];
    const selected = await vscode.window.showQuickPick(options, {
        placeHolder: 'Select an IN/NOT IN paste option'
    });
    if (selected && selected.command) {
        // Pass distinctOverride to the command
        switch (selected.command) {
            case 'extension.pasteAsInStatementDirect':
                await processAndPasteClipboardDirect(false, distinctOverride);
                break;
            case 'extension.pasteAsNotInStatementDirect':
                await processAndPasteClipboardDirect(true, distinctOverride);
                break;
            case 'extension.pasteColumnInStatement':
                await processColumnPaste(false, distinctOverride);
                break;
            case 'extension.pasteColumnNotInStatement':
                await processColumnPaste(true, distinctOverride);
                break;
            default:
                break;
        }
    }
}

// Paste Column + IN/NOT IN
async function processColumnPaste(forceNotIn: boolean, distinctOverride: boolean | undefined) {
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
        if (!hasHeaders || data.length <= 1) {
            vscode.window.showWarningMessage('Clipboard data does not appear to be tabular with headers. Please copy with headers.\n' + (debugInfo || ''));
            return;
        }
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

            // Use the header as the default column name
            const columnNameInput = await vscode.window.showInputBox({
                prompt: 'Enter column name to use in the IN clause (optional)',
                placeHolder: 'e.g., customer_id',
                value: selectedColumn
            });
            const inStatement = generateInStatement(values, columnNameInput || selectedColumn, forceNotIn);
            editor.edit(editBuilder => {
                if (editor.selection.isEmpty) {
                    editBuilder.insert(editor.selection.active, inStatement);
                } else {
                    editBuilder.replace(editor.selection, inStatement);
                }
            });
            let msg = `${forceNotIn ? 'NOT IN' : 'IN'} statement inserted for column "${columnNameInput || selectedColumn}"!`;
            if (useDistinct) {
                msg += ` (${removed} duplicate${removed === 1 ? '' : 's'} removed)`;
            }
            vscode.window.showInformationMessage(msg);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Error processing column paste: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// Existing logic for selection, batch, and preview
async function processSelection() {
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
                if (useDistinct) {
                    vscode.window.showInformationMessage(`Selection: ${removed} duplicate${removed === 1 ? '' : 's'} removed.`);
                }
            } else {
                vscode.window.showWarningMessage('No text selected.');
            }
        } else {
            vscode.window.showWarningMessage('No active text editor.');
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Error processing selection: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function processAndPasteClipboard() {
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active text editor.');
            return;
        }

        const clipboardText = await vscode.env.clipboard.readText();
        if (clipboardText) {
            if (clipboardText.length > 100000) {
                vscode.window.showWarningMessage('Processing a large amount of data. This might take a moment.');
            }
            const { hasHeaders, data } = detectTableData(clipboardText);
            if (hasHeaders && data.length > 1) {
                const choice = await vscode.window.showQuickPick(
                    ['Process as single list', 'Process as table (select column)'],
                    { placeHolder: 'Detected table data in clipboard. How would you like to process it?' }
                );
                if (choice === 'Process as table (select column)') {
                    await processBatchDataFromArray(data);
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
            const useDistinct = config.get<boolean>('distinctValues', true);
            const caseSensitive = config.get<boolean>('distinctCaseSensitive', false);
            const trimWhitespace = config.get<boolean>('distinctTrimWhitespace', true);

            let removed = 0;
            if (useDistinct) {
                const dedup = deduplicateValues(parsedData, caseSensitive, trimWhitespace);
                removed = dedup.removed;
                parsedData = dedup.unique;
            }

            const inStatement = generateInStatement(parsedData);
            await previewAndApplyInStatement(inStatement, editor, false);
            if (useDistinct) {
                vscode.window.showInformationMessage(`Clipboard: ${removed} duplicate${removed === 1 ? '' : 's'} removed.`);
            }
        } else {
            vscode.window.showWarningMessage('Clipboard is empty.');
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Error processing clipboard: ${error instanceof Error ? error.message : String(error)}`);
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
        vscode.window.showErrorMessage(`Error processing batch data: ${error instanceof Error ? error.message : String(error)}`);
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
        if (useDistinct) {
            vscode.window.showInformationMessage(`Batch: ${removed} duplicate${removed === 1 ? '' : 's'} removed.`);
        }
    }
}

function detectTableData(text: string): { hasHeaders: boolean, data: string[][], debugInfo?: string } {
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

export function parseText(text: string): string[] {
    try {
        text = text.replace(/^(NOT\s+)?IN\s*\(\s*'/i, '').replace(/'\s*\)$/, '');

        const config = vscode.workspace.getConfiguration('inQueryGenerator');
        const splitOnWhitespace = config.get<boolean>('splitOnWhitespace', false);

        let result: string[];

        if (splitOnWhitespace) {
            result = text.split(/\s+/)
                .map(item => item.trim())
                .filter(item => item !== '');
        } else {
            result = text.split(/[\r\n\t]+/)
                .map(item => item.trim())
                .filter(item => item !== '');
        }

        return result;
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to parse input: ${error instanceof Error ? error.message : String(error)}`);
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
    const clauseType = useNotIn ? 'NOT IN' : 'IN';

    if (!columnName) {
        columnName = config.get<string>('defaultColumnName', '');
    }

    const formatOptions = config.get<FormatOptions>('formatOptions', {
        oneValuePerLine: false,
        maxValuesPerLine: 5,
        indentSize: 4
    });

    const formattedData = data.map(item => formatValue(item));

    let valuesString: string;

    if (formatOptions.oneValuePerLine && data.length > 1) {
        const indent = ' '.repeat(formatOptions.indentSize);
        valuesString = '\n' + indent + formattedData.join(',\n' + indent) + '\n';
    } else if (!formatOptions.oneValuePerLine && formatOptions.maxValuesPerLine > 0 && data.length > formatOptions.maxValuesPerLine) {
        const chunks: string[][] = [];
        for (let i = 0; i < formattedData.length; i += formatOptions.maxValuesPerLine) {
            chunks.push(formattedData.slice(i, i + formatOptions.maxValuesPerLine));
        }

        const indent = ' '.repeat(formatOptions.indentSize);
        valuesString = '\n' + indent + chunks.map(chunk => chunk.join(', ')).join(',\n' + indent) + '\n';
    } else {
        valuesString = formattedData.join(', ');
    }

    const inStatement = columnName
        ? `${columnName} ${clauseType} (${valuesString})`
        : `${clauseType} (${valuesString})`;

    return inStatement;
}

export function formatValue(item: string): string {
    if (!item || item.toLowerCase() === 'null') {
        return 'NULL';
    }

    if (/^-?\d+(\.\d+)?$/.test(item)) {
        return item;
    }

    const config = vscode.workspace.getConfiguration('inQueryGenerator');
    const detectDataTypes = config.get<boolean>('detectDataTypes', true);

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

interface FormatOptions {
    oneValuePerLine: boolean;
    maxValuesPerLine: number;
    indentSize: number;
}

export function deactivate() {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}
