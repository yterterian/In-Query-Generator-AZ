import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('extension.copyAsInStatement', async () => {
        await processSelection();
    });

    context.subscriptions.push(disposable);
}

async function processSelection() {
    try {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);
            if (selectedText) {
                const data = parseSelectedText(selectedText);
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

function parseSelectedText(text: string): string[] {
    // Remove the opening 'IN (' and closing ')' if present
    text = text.replace(/^IN\s*\(\s*'/i, '').replace(/'\s*\)$/, '');
    
    // Split the text by newlines and trim each item
    return text.split('\n')
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