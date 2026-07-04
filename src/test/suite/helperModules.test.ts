import * as assert from 'assert';
import * as vscode from 'vscode';
import { DataTypeMode } from '../../pure';
import { showKeybindingScopeNoticeOnce } from '../../migrationNotices';
import { createStatusBarItem, updateStatusBarItem } from '../../statusBarManager';
import { applyClauseNullSafety, generateStatementWithMode, prepareValuesForStatement } from '../../statementPreparation';

describe('Helper Module Host Tests', () => {
    const configSection = 'inQueryGenerator';

    async function withConfigOverrides(
        overrides: Record<string, unknown>,
        run: () => Promise<void> | void
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
        methodName: 'showInformationMessage',
        replacement: T,
        run: () => Promise<void> | void
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

    it('prepareValuesForStatement honours config-driven deduplication rules', async () => {
        await withConfigOverrides({
            distinctValues: true,
            distinctCaseSensitive: false,
            distinctTrimWhitespace: true
        }, () => {
            const result = prepareValuesForStatement([' A ', 'a', 'B']);

            assert.deepStrictEqual(result.values, [' A ', 'B']);
            assert.strictEqual(result.removed, 1);
            assert.strictEqual(result.useDistinct, true);
        });
    });

    it('prepareValuesForStatement can bypass deduplication with an explicit override', async () => {
        await withConfigOverrides({
            distinctValues: true,
            distinctCaseSensitive: false,
            distinctTrimWhitespace: true
        }, () => {
            const result = prepareValuesForStatement([' A ', 'a'], false);

            assert.deepStrictEqual(result.values, [' A ', 'a']);
            assert.strictEqual(result.removed, 0);
            assert.strictEqual(result.useDistinct, false);
        });
    });

    it('generateStatementWithMode uses the configured default column name and forced text mode', async () => {
        await withConfigOverrides({
            defaultColumnName: 'customer_id'
        }, () => {
            const result = generateStatementWithMode(
                ['001', '002'],
                undefined,
                false,
                DataTypeMode.ForceText
            );

            assert.strictEqual(result, "customer_id IN ('001', '002')");
        });
    });

    it('applyClauseNullSafety removes NULL-like values from NOT IN but preserves them for IN', () => {
        const notInResult = applyClauseNullSafety(['A', '', 'NULL', 'B'], true);
        assert.deepStrictEqual(notInResult.values, ['A', 'B']);
        assert.strictEqual(notInResult.nullLikeCount, 2);
        assert.strictEqual(notInResult.removedNullsFromNotIn, true);

        const inResult = applyClauseNullSafety(['A', '', 'NULL', 'B'], false);
        assert.deepStrictEqual(inResult.values, ['A', '', 'NULL', 'B']);
        assert.strictEqual(inResult.nullLikeCount, 2);
        assert.strictEqual(inResult.removedNullsFromNotIn, false);
    });

    it('updateStatusBarItem applies pinned action text and command', async () => {
        await withConfigOverrides({
            statusBarActions: ['extension.pasteAsNotInStatementDirect']
        }, () => {
            const statusBarItem = createStatusBarItem();

            try {
                updateStatusBarItem(statusBarItem);

                assert.strictEqual(statusBarItem.text, 'Paste NOT IN');
                assert.strictEqual(statusBarItem.command, 'extension.pasteAsNotInStatementDirect');
                assert.ok(String(statusBarItem.tooltip).includes('Paste NOT IN Statement'));
            } finally {
                statusBarItem.dispose();
            }
        });
    });

    it('showKeybindingScopeNoticeOnce records dismissal immediately so it only shows once', async () => {
        let shownCount = 0;
        const stored = new Map<string, boolean>();
        const context = {
            globalState: {
                get<T>(key: string, defaultValue?: T): T {
                    return (stored.has(key) ? stored.get(key) : defaultValue) as T;
                },
                update(key: string, value: boolean): Thenable<void> {
                    stored.set(key, value);
                    return Promise.resolve();
                }
            }
        } as unknown as vscode.ExtensionContext;

        await withWindowMethodOverride(
            'showInformationMessage',
            async () => {
                shownCount += 1;
                return undefined;
            },
            async () => {
                showKeybindingScopeNoticeOnce(context);
                showKeybindingScopeNoticeOnce(context);
                await Promise.resolve();
            }
        );

        assert.strictEqual(shownCount, 1);
        assert.strictEqual(stored.get('inQueryGenerator.keybindingScopeNoticeShown'), true);
    });
});
