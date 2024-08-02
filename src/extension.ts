import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    let copyDisposable = vscode.commands.registerCommand('extension.copyAsInStatement', async () => {
        await processSelection();
    });

    let pasteDisposable = vscode.commands.registerCommand('extension.pasteAsInStatement', async () => {
        await processAndPasteClipboard();
    });

    context.subscriptions.push(copyDisposable, pasteDisposable);
}

async function processSelection() {
    try {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);
            if (selectedText) {
                const data = parseText(selectedText);
                const inStatement = generateInStatement(data);
                await vscode.env.clipboard.writeText(inStatement);
                vscode.window.showInformationMessage('Copied as IN statement to clipboard!');
            } else {
                vscode.window.showWarningMessage('No text selected.');
            }
        } else {
            vscode.window.showWarningMessage('No active text editor.');
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Error processing selection: ${error}`);
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
            const data = parseText(clipboardText);
            const inStatement = generateInStatement(data);
            
            editor.edit(editBuilder => {
                if (editor.selection.isEmpty) {
                    editBuilder.insert(editor.selection.active, inStatement);
                } else {
                    editBuilder.replace(editor.selection, inStatement);
                }
            });
            vscode.window.showInformationMessage('IN statement pasted!');
        } else {
            vscode.window.showWarningMessage('Clipboard is empty.');
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Error processing clipboard: ${error}`);
    }
}

function parseText(text: string): string[] {
    // Remove the opening 'IN (' and closing ')' if present
    text = text.replace(/^IN\s*\(\s*'/i, '').replace(/'\s*\)$/, '');
    
    // Split by newlines and/or tabs to handle various formats
    return text.split(/[\n\t]+/)
        .map(item => item.trim())
        .filter(item => item !== '');
}

function generateInStatement(data: string[]): string {
    if (data.length === 0) {
        vscode.window.showWarningMessage('No data to generate IN statement.');
        return '';
    }
    
    const formattedData = data.map(item => {
        if (item.toLowerCase() === 'null') {
            return 'NULL';
        } else {
            // Escape single quotes and wrap all values in single quotes
            return `'${item.replace(/'/g, "''")}'`;
        }
    });

    const inStatement = `IN (${formattedData.join(', ')})`;
    return inStatement;
}

export function deactivate() {}