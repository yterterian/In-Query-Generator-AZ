import * as vscode from 'vscode';

const KEYBINDING_SCOPE_NOTICE_KEY = 'inQueryGenerator.keybindingScopeNoticeShown';

export function showKeybindingScopeNoticeOnce(context: vscode.ExtensionContext): void {
    if (context.globalState.get<boolean>(KEYBINDING_SCOPE_NOTICE_KEY, false)) {
        return;
    }

    void context.globalState.update(KEYBINDING_SCOPE_NOTICE_KEY, true);

    const enableEverywhere = 'Enable Everywhere';
    const openSettings = 'Open Settings';

    void vscode.window.showInformationMessage(
        'SQL IN Clause Generator: keyboard shortcuts (Ctrl+Shift+V, Ctrl+Shift+I, Ctrl+Alt+V) now apply only in SQL files by default, so they no longer override VS Code shortcuts elsewhere. You can re-enable them for all file types.',
        enableEverywhere,
        openSettings
    ).then(async selection => {
        if (selection === enableEverywhere) {
            await vscode.workspace
                .getConfiguration('inQueryGenerator')
                .update('globalKeybindings', true, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage('Shortcuts enabled for all file types.');
        } else if (selection === openSettings) {
            await vscode.commands.executeCommand(
                'workbench.action.openSettings',
                'inQueryGenerator.globalKeybindings'
            );
        }
    });
}
