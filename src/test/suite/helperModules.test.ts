import * as assert from 'assert';
import * as vscode from 'vscode';
import { DataTypeMode } from '../../pure';
import { createStatusBarItem, updateStatusBarItem } from '../../statusBarManager';
import { generateStatementWithMode, prepareValuesForStatement } from '../../statementPreparation';

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
});
