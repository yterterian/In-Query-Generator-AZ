import * as vscode from 'vscode';

export interface SessionTelemetryState {
    session_id: string;
    start_time: string;
    end_time?: string;
    total_sql_generations: number;
    by_command: Record<string, number>;
    by_clause_type: Record<string, number>;
    deduped_count: number;
    duplicates_removed_total: number;
    error_count: number;
}

interface PreviewOptions {
    inStatement: string;
    editor: vscode.TextEditor;
    isCopyCommand: boolean;
}

interface PasteMessageOptions {
    clauseType: 'IN' | 'NOT IN';
    removed: number;
    useDistinct: boolean;
    columnName?: string;
}

interface TelemetryOptions {
    commandName: string;
    clauseType: 'IN' | 'NOT IN';
    removed: number;
    useDistinct: boolean;
}

async function writeStatementToEditor(editor: vscode.TextEditor, inStatement: string): Promise<void> {
    await editor.edit(editBuilder => {
        if (editor.selection.isEmpty) {
            editBuilder.insert(editor.selection.active, inStatement);
        } else {
            editBuilder.replace(editor.selection, inStatement);
        }
    });
}

export async function previewAndApplyStatement({
    inStatement,
    editor,
    isCopyCommand
}: PreviewOptions): Promise<void> {
    const config = vscode.workspace.getConfiguration('inQueryGenerator');
    const alwaysShowPreview = config.get<boolean>('alwaysShowPreview', true);

    if (!alwaysShowPreview) {
        if (isCopyCommand) {
            await vscode.env.clipboard.writeText(inStatement);
            vscode.window.showInformationMessage('Copied as IN statement to clipboard!');
        } else {
            await writeStatementToEditor(editor, inStatement);
            vscode.window.showInformationMessage('IN statement inserted!');
        }
        return;
    }

    const maxPreviewLength = 70;
    const previewText = inStatement.length > maxPreviewLength
        ? inStatement.substring(0, maxPreviewLength) + '...'
        : inStatement;

    const actions = isCopyCommand
        ? ['Copy to clipboard', 'Insert at cursor', 'Cancel']
        : ['Insert at cursor', 'Copy to clipboard', 'Cancel'];

    const selectedAction = await vscode.window.showQuickPick(actions, {
        placeHolder: 'Preview: ' + previewText
    });

    if (selectedAction === 'Insert at cursor') {
        await writeStatementToEditor(editor, inStatement);
        vscode.window.showInformationMessage('IN statement inserted!');
    } else if (selectedAction === 'Copy to clipboard') {
        await vscode.env.clipboard.writeText(inStatement);
        vscode.window.showInformationMessage('Copied IN statement to clipboard!');
    }
}

export async function insertStatement(editor: vscode.TextEditor, inStatement: string): Promise<void> {
    await writeStatementToEditor(editor, inStatement);
}

export function recordSessionSqlGeneration(
    sessionTelemetry: SessionTelemetryState | undefined,
    options: TelemetryOptions
): void {
    if (!sessionTelemetry) {
        return;
    }

    sessionTelemetry.total_sql_generations += 1;
    sessionTelemetry.by_command[options.commandName] =
        (sessionTelemetry.by_command[options.commandName] || 0) + 1;
    sessionTelemetry.by_clause_type[options.clauseType] =
        (sessionTelemetry.by_clause_type[options.clauseType] || 0) + 1;

    if (options.useDistinct) {
        sessionTelemetry.deduped_count += 1;
        sessionTelemetry.duplicates_removed_total += options.removed;
    }
}

export function buildPasteInsertedMessage(options: PasteMessageOptions): string {
    let msg = `${options.clauseType} statement inserted!`;

    if (options.columnName) {
        msg = `${options.clauseType} statement inserted for column "${options.columnName}"!`;
    }

    if (options.useDistinct) {
        msg += ` (${options.removed} duplicate${options.removed === 1 ? '' : 's'} removed)`;
    }

    return msg;
}

export function buildDeduplicationMessage(scope: 'Selection' | 'Batch', removed: number): string {
    return `${scope}: ${removed} duplicate${removed === 1 ? '' : 's'} removed.`;
}

export function buildSelectionCopiedMessage(itemCount: number): string {
    return `✅ Copied ${itemCount} item${itemCount !== 1 ? 's' : ''} as IN statement to clipboard!`;
}

export function buildClauseNullWarningMessage(
    clauseType: 'IN' | 'NOT IN',
    nullLikeCount: number,
    removedNullsFromNotIn: boolean
): string {
    const valueLabel = `${nullLikeCount} blank/NULL value${nullLikeCount === 1 ? '' : 's'}`;
    if (removedNullsFromNotIn) {
        return `Removed ${valueLabel} from NOT IN because NULL would make the predicate return no rows.`;
    }

    return `${clauseType} contains ${valueLabel}; NULL entries do not match rows in SQL.`;
}
