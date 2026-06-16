import * as vscode from 'vscode';

function getPinnedActionDisplay(action: string): { text: string; tooltip: string; command: string } {
    switch (action) {
        case 'extension.copyAsInStatement':
            return {
                text: 'Copy IN',
                tooltip: 'Copy as IN Statement',
                command: action
            };
        case 'extension.pasteAsInStatementDirect':
            return {
                text: 'Paste IN',
                tooltip: 'Paste IN Statement',
                command: action
            };
        case 'extension.pasteAsNotInStatementDirect':
            return {
                text: 'Paste NOT IN',
                tooltip: 'Paste NOT IN Statement',
                command: action
            };
        case 'extension.pasteSpecialInStatement':
            return {
                text: 'SQL IN Tools',
                tooltip: 'Show SQL IN/NOT IN dropdown',
                command: action
            };
        case 'extension.pasteColumnInStatement':
            return {
                text: 'Paste Col+IN',
                tooltip: 'Paste Column + IN Statement',
                command: action
            };
        case 'extension.pasteColumnNotInStatement':
            return {
                text: 'Paste Col+NOT IN',
                tooltip: 'Paste Column + NOT IN Statement',
                command: action
            };
        default:
            return {
                text: 'SQL IN Tools',
                tooltip: 'SQL IN/NOT IN features',
                command: action
            };
    }
}

export function createStatusBarItem(): vscode.StatusBarItem {
    return vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
}

export function updateStatusBarItem(statusBarItem: vscode.StatusBarItem): void {
    const config = vscode.workspace.getConfiguration('inQueryGenerator');
    const statusBarActions = config.get<string[]>('statusBarActions', ['dropdown']);
    const splitOnWhitespace = config.get<boolean>('splitOnWhitespace', false);
    const useNotIn = config.get<boolean>('useNotIn', false);

    if (statusBarActions.length === 1 && statusBarActions[0] === 'dropdown') {
        statusBarItem.text = 'SQL IN Tools';
        statusBarItem.tooltip = 'Click to access SQL IN/NOT IN features';
        statusBarItem.command = 'extension.pasteSpecialInStatement';
        statusBarItem.show();
        return;
    }

    if (statusBarActions.length > 0) {
        const display = getPinnedActionDisplay(statusBarActions[0]);
        statusBarItem.text = display.text;
        statusBarItem.tooltip = display.tooltip + ' (right-click for dropdown)';
        statusBarItem.command = display.command;
        statusBarItem.show();
        return;
    }

    statusBarItem.text = `${useNotIn ? 'NOT IN' : 'IN'}: ${splitOnWhitespace ? 'Split' : 'No Split'}`;
    statusBarItem.tooltip = `Split on whitespace: ${splitOnWhitespace ? 'enabled' : 'disabled'}, NOT IN: ${useNotIn ? 'enabled' : 'disabled'}`;
    statusBarItem.command = 'extension.pasteSpecialInStatement';
    statusBarItem.show();
}
