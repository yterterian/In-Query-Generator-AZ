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
        methodName: 'showQuickPick' | 'showInputBox' | 'showWarningMessage',
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

    it('direct NOT IN paste strips blank and NULL values before generating SQL', async () => {
        await activateExtension();

        await withConfigOverrides({
            splitOnWhitespace: false,
            distinctValues: false
        }, async () => {
            const editor = await openEditor();
            await vscode.env.clipboard.writeText('1336\n\nNULL\n8869');

            await withWindowMethodOverride(
                'showWarningMessage',
                async () => undefined,
                async () => {
                    await vscode.commands.executeCommand('extension.pasteAsNotInStatementDirect');
                }
            );

            await waitForDocumentText(editor.document, 'NOT IN (1336, 8869)');
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

    it('paste special keeps both quick picks open when focus changes', async () => {
        await activateExtension();

        const quickPickOptions: vscode.QuickPickOptions[] = [];

        await withWindowMethodOverride(
            'showQuickPick',
            async (_items: readonly unknown[], options?: vscode.QuickPickOptions) => {
                quickPickOptions.push(options ?? {});
                if (quickPickOptions.length === 1) {
                    return {
                        itemType: 'action',
                        label: 'Paste IN Statement',
                        command: 'extension.pasteAsInStatementDirect',
                        option: 'paste_in_statement'
                    };
                }

                return undefined;
            },
            async () => {
                await vscode.commands.executeCommand('extension.pasteSpecialInStatement');
            }
        );

        assert.strictEqual(quickPickOptions[0]?.ignoreFocusOut, true);
        assert.strictEqual(quickPickOptions[1]?.ignoreFocusOut, true);
    });

    it('paste special defaults to the configured distinct setting without a separate duplicate stage', async () => {
        await activateExtension();

        await withConfigOverrides({
            splitOnWhitespace: false,
            distinctValues: true
        }, async () => {
            const editor = await openEditor();
            await vscode.env.clipboard.writeText('1336\n1336\n8869');

            const firstQuickPickLabels: string[] = [];

            await withWindowMethodOverride(
                'showQuickPick',
                async (items: readonly unknown[]) => {
                    const options = items as Array<{ label?: string; itemType?: string; command?: string; value?: string }>;
                    if (firstQuickPickLabels.length === 0) {
                        firstQuickPickLabels.push(...options.map(option => option.label ?? ''));
                        return options.find(option => option.itemType === 'action' && option.command === 'extension.pasteAsInStatementDirect');
                    }

                    return {
                        label: '$(symbol-misc) Auto-detect (Smart)',
                        value: 'auto'
                    };
                },
                async () => {
                    await vscode.commands.executeCommand('extension.pasteSpecialInStatement');
                }
            );

            await waitForDocumentText(editor.document, 'IN (1336, 8869)');
            assert.ok(firstQuickPickLabels[0]?.includes('Distinct values (current)'));
            assert.ok(!firstQuickPickLabels.includes('Distinct values (remove duplicates)'));
            assert.ok(!firstQuickPickLabels.includes('All values (keep duplicates)'));
        });
    });

    it('paste special modifier row toggles duplicate handling for one run only', async () => {
        await activateExtension();

        await withConfigOverrides({
            splitOnWhitespace: false,
            distinctValues: true
        }, async () => {
            const editor = await openEditor();
            await vscode.env.clipboard.writeText('1336\n1336\n8869');

            let quickPickCall = 0;

            await withWindowMethodOverride(
                'showQuickPick',
                async (items: readonly unknown[]) => {
                    quickPickCall += 1;
                    const options = items as Array<{ label?: string; itemType?: string; command?: string; value?: string }>;

                    if (quickPickCall === 1) {
                        return options.find(option => option.itemType === 'modifier');
                    }

                    if (quickPickCall === 2) {
                        assert.ok(options[0]?.label?.includes('All values (current)'));
                        return options.find(option => option.itemType === 'action' && option.command === 'extension.pasteAsInStatementDirect');
                    }

                    return {
                        label: '$(symbol-misc) Auto-detect (Smart)',
                        value: 'auto'
                    };
                },
                async () => {
                    await vscode.commands.executeCommand('extension.pasteSpecialInStatement');
                }
            );

            await waitForDocumentText(editor.document, 'IN (1336, 1336, 8869)');
            assert.strictEqual(
                vscode.workspace.getConfiguration(configSection).get<boolean>('distinctValues', false),
                true
            );
        });
    });

    it('batch flow uses the typed column name without mutating the global defaultColumnName setting', async () => {
        await activateExtension();

        await withConfigOverrides({
            defaultColumnName: 'saved_default',
            alwaysShowPreview: false,
            distinctValues: false
        }, async () => {
            const editor = await openEditor('Asset_Number\tName\n1336\tOne\n8869\tTwo');
            editor.selection = new vscode.Selection(0, 0, editor.document.lineCount - 1, editor.document.lineAt(editor.document.lineCount - 1).text.length);

            await withWindowMethodOverride(
                'showQuickPick',
                async () => 'Asset_Number',
                async () => {
                    await withWindowMethodOverride(
                        'showInputBox',
                        async () => 'batch_once',
                        async () => {
                            await vscode.commands.executeCommand('extension.batchProcessInStatement');
                        }
                    );
                }
            );

            await waitForDocumentText(editor.document, 'batch_once IN (1336, 8869)');
            assert.strictEqual(
                vscode.workspace.getConfiguration(configSection).get<string>('defaultColumnName', ''),
                'saved_default'
            );
        });
    });
});
