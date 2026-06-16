import * as assert from 'assert';
import * as vscode from 'vscode';

describe('Extension Host Tests', () => {
    const extensionId = 'YakovT.sql-in-query-statement-generator';
    const configSection = 'inQueryGenerator';

    async function activateExtension() {
        const extension = vscode.extensions.getExtension(extensionId);
        assert.ok(extension, `Extension ${extensionId} should be installed in the test host.`);
        await extension.activate();
        return extension;
    }

    async function openEditor(content: string = ''): Promise<vscode.TextEditor> {
        const document = await vscode.workspace.openTextDocument({ content });
        const editor = await vscode.window.showTextDocument(document);
        editor.selection = new vscode.Selection(0, 0, 0, 0);
        return editor;
    }

    async function waitForDocumentText(document: vscode.TextDocument, expectedText: string): Promise<void> {
        const timeoutAt = Date.now() + 5000;

        while (Date.now() < timeoutAt) {
            if (document.getText() === expectedText) {
                return;
            }

            await new Promise(resolve => setTimeout(resolve, 50));
        }

        assert.strictEqual(document.getText(), expectedText);
    }

    async function withConfigOverrides(
        overrides: Record<string, unknown>,
        run: () => Promise<void>
    ): Promise<void> {
        const config = vscode.workspace.getConfiguration(configSection);
        const originals = new Map<string, unknown>();

        try {
            for (const [key, value] of Object.entries(overrides)) {
                originals.set(key, config.get(key));
                await config.update(key, value, true);
            }

            await run();
        } finally {
            for (const [key, value] of originals.entries()) {
                await config.update(key, value, true);
            }
        }
    }

    async function withWindowMethodOverride<T>(
        methodName: 'showQuickPick' | 'showInputBox',
        replacement: T,
        run: () => Promise<void>
    ): Promise<void> {
        const original = (vscode.window as Record<string, unknown>)[methodName];

        Object.defineProperty(vscode.window, methodName, {
            value: replacement,
            configurable: true
        });

        try {
            await run();
        } finally {
            Object.defineProperty(vscode.window, methodName, {
                value: original,
                configurable: true
            });
        }
    }

    it('registers core commands after activation', async () => {
        await activateExtension();

        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('extension.copyAsInStatement'));
        assert.ok(commands.includes('extension.pasteAsInStatementDirect'));
        assert.ok(commands.includes('extension.pasteSpecialInStatement'));
        assert.ok(commands.includes('inQueryGenerator.toggleSplitOnWhitespace'));
    });

    it('toggle command updates the splitOnWhitespace setting', async () => {
        await activateExtension();

        const getCurrentValue = () =>
            vscode.workspace.getConfiguration(configSection).get<boolean>('splitOnWhitespace', false);
        const originalValue = getCurrentValue();

        try {
            const configChanged = new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    subscription.dispose();
                    reject(new Error('Timed out waiting for splitOnWhitespace to change.'));
                }, 5000);

                const subscription = vscode.workspace.onDidChangeConfiguration(event => {
                    if (!event.affectsConfiguration('inQueryGenerator.splitOnWhitespace')) {
                        return;
                    }

                    clearTimeout(timeout);
                    subscription.dispose();
                    resolve();
                });
            });

            await vscode.commands.executeCommand('inQueryGenerator.toggleSplitOnWhitespace');
            await configChanged;
            assert.strictEqual(getCurrentValue(), !originalValue);
        } finally {
            const config = vscode.workspace.getConfiguration(configSection);
            await config.update('splitOnWhitespace', originalValue, true);
        }
    });

    it('direct paste preserves single-column values with embedded commas', async () => {
        await activateExtension();

        await withConfigOverrides({
            splitOnWhitespace: false,
            distinctValues: false
        }, async () => {
            const editor = await openEditor();
            await vscode.env.clipboard.writeText('"Smith, John"\n"Doe, Jane"');

            await vscode.commands.executeCommand('extension.pasteAsInStatementDirect');
            await waitForDocumentText(editor.document, "IN ('Smith, John', 'Doe, Jane')");
        });
    });

    it('direct paste uses all rows for no-header multi-column tables', async () => {
        await activateExtension();

        await withConfigOverrides({
            splitOnWhitespace: false,
            distinctValues: false
        }, async () => {
            const editor = await openEditor();
            await vscode.env.clipboard.writeText('1\tJohn\n2\tJane');

            await withWindowMethodOverride(
                'showQuickPick',
                async () => 'Column 2',
                async () => {
                    await vscode.commands.executeCommand('extension.pasteAsInStatementDirect');
                }
            );

            await waitForDocumentText(editor.document, "IN ('John', 'Jane')");
        });
    });

    it('column paste uses inferred single-column headers as the default SQL column name', async () => {
        await activateExtension();

        await withConfigOverrides({
            splitOnWhitespace: false,
            distinctValues: false
        }, async () => {
            const editor = await openEditor();
            await vscode.env.clipboard.writeText('"Product Name"\n"iPhone 13, 128GB"\n"Samsung Galaxy, S22"');

            await withWindowMethodOverride(
                'showInputBox',
                async () => undefined,
                async () => {
                    await vscode.commands.executeCommand('extension.pasteColumnInStatement');
                }
            );

            await waitForDocumentText(
                editor.document,
                "Product Name IN ('iPhone 13, 128GB', 'Samsung Galaxy, S22')"
            );
        });
    });
});
