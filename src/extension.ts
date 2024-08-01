import * as vscode from 'vscode';
import * as azdata from 'azdata';

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
                const inStatement = generateInStatement(selectedText.split('\n'));
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

function generateInStatement(data: string[]): string {
    if (data.length === 0) {
        vscode.window.showWarningMessage('No data to generate IN statement.');
        return '';
    }
    
    const cleanedData = data.map(item => item.trim()).filter(item => item !== '');
    const inStatement = `IN (${cleanedData.map(item => `'${item}'`).join(', ')})`;
    return inStatement;
}

export function deactivate() {}