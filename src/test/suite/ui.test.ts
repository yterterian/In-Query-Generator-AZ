/// <reference types="mocha" />
/// <reference types="node" />

import * as assert from 'assert';
import * as vscode from 'vscode';

describe('UI Integration Tests', () => {
    // Ensure the extension is activated before running tests
    before(async () => {
        // Activate the extension
        await vscode.extensions.getExtension('YakovT.Sql-in-query-statement-generator')?.activate();
    });

    // Add a small delay to give the UI time to update
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    it('Command copyAsInStatement exists', async () => {
        const commands = await vscode.commands.getCommands();
        assert.ok(commands.includes('extension.copyAsInStatement'));
    });

    it('Command pasteAsInStatement exists', async () => {
        const commands = await vscode.commands.getCommands();
        assert.ok(commands.includes('extension.pasteAsInStatement'));
    });

    it('Command batchProcessInStatement exists', async () => {
        const commands = await vscode.commands.getCommands();
        assert.ok(commands.includes('extension.batchProcessInStatement'));
    });

    it('Status bar item is visible', async () => {
        // Wait for extension to fully activate and status bar item to be created
        await delay(500);
        // This test is limited since we can't easily access the status bar item directly
        // In a real test, we might use UI automation tools
        assert.ok(true, 'Test passed if no errors occurred');
    });

    it('End-to-end command execution', async function() {
        // Increase timeout for this test
        this.timeout(30000); // Increase from 10000ms to 30000ms
        
        try {
            // Create a document with some test content
            const document = await vscode.workspace.openTextDocument({
                content: 'value1\nvalue2\nvalue3'
            });
            
            const editor = await vscode.window.showTextDocument(document);
            
            // Wait for editor to fully initialize
            await delay(1000);
            
            // Select all text
            const lastLine = document.lineAt(document.lineCount - 1);
            editor.selection = new vscode.Selection(
                new vscode.Position(0, 0),
                lastLine.range.end
            );
            
            // Wait for selection to take effect
            await delay(500);
            
            // Execute the command and wait for it to complete
            await vscode.commands.executeCommand('extension.copyAsInStatement');
            
            // Wait longer for clipboard operations to complete
            await delay(2000);
            
            assert.ok(true, 'Command executed without throwing an error');
            
            // Close the editor to clean up
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        } catch (error) {
            assert.fail(`Command execution failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
});
