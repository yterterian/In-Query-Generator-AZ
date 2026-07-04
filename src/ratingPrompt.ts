import * as vscode from 'vscode';

const RATING_THRESHOLDS = [10, 50, 150, 250];
const RATING_PROMPT_KEY = 'inQueryGenerator.ratingPromptShown';
const RATING_DISMISSED_KEY = 'inQueryGenerator.ratingDismissed';
const RATING_BACKOFF_KEY = 'inQueryGenerator.ratingBackoffCount';
const USAGE_COUNTER_KEY = 'inQueryGenerator.usageCounter';

function getNextThreshold(backoffCount: number): number {
    let nextThreshold = 0;

    for (let index = 0; index <= backoffCount; index++) {
        if (index < RATING_THRESHOLDS.length) {
            nextThreshold += RATING_THRESHOLDS[index];
        } else {
            nextThreshold += RATING_THRESHOLDS[RATING_THRESHOLDS.length - 1];
        }
    }

    return nextThreshold;
}

async function showRatingPrompt(context: vscode.ExtensionContext, extensionId: string): Promise<void> {
    const rateAction = 'Rate Extension';
    const laterAction = 'Remind Me Later';
    const dontShowAction = "Don't Show Again";

    const selection = await vscode.window.showInformationMessage(
        '🌟 Enjoying the SQL IN Clause Generator? Your rating helps others discover this time-saving tool!',
        rateAction,
        laterAction,
        dontShowAction
    );

    switch (selection) {
        case rateAction: {
            await context.globalState.update(RATING_PROMPT_KEY, true);
            await context.globalState.update(RATING_BACKOFF_KEY, 0);

            const marketplaceUrl = `https://marketplace.visualstudio.com/items?itemName=${extensionId}&ssr=false#review-details`;

            try {
                await vscode.env.openExternal(vscode.Uri.parse(marketplaceUrl));
                vscode.window.showInformationMessage('Thank you for taking the time to rate our extension! 🙏');
            } catch {
                await vscode.env.clipboard.writeText(marketplaceUrl);
                vscode.window.showInformationMessage('Rating URL copied to clipboard - paste it in your browser to rate! 📋');
            }
            break;
        }

        case laterAction: {
            const backoffCount = context.globalState.get<number>(RATING_BACKOFF_KEY, 0) + 1;
            await context.globalState.update(RATING_BACKOFF_KEY, backoffCount);
            break;
        }

        case dontShowAction:
            await context.globalState.update(RATING_DISMISSED_KEY, true);
            await context.globalState.update(RATING_PROMPT_KEY, true);
            await context.globalState.update(RATING_BACKOFF_KEY, 0);
            break;

        default: {
            const backoffCount = context.globalState.get<number>(RATING_BACKOFF_KEY, 0) + 1;
            await context.globalState.update(RATING_BACKOFF_KEY, backoffCount);
            break;
        }
    }
}

export async function trackUsageAndPromptRating(
    context: vscode.ExtensionContext,
    extensionId: string
): Promise<void> {
    const usageCounter = context.globalState.get<number>(USAGE_COUNTER_KEY, 0) + 1;
    await context.globalState.update(USAGE_COUNTER_KEY, usageCounter);

    const ratingPromptShown = context.globalState.get<boolean>(RATING_PROMPT_KEY, false);
    const ratingDismissed = context.globalState.get<boolean>(RATING_DISMISSED_KEY, false);
    const backoffCount = context.globalState.get<number>(RATING_BACKOFF_KEY, 0);

    if (!ratingPromptShown && !ratingDismissed && usageCounter >= getNextThreshold(backoffCount)) {
        await showRatingPrompt(context, extensionId);
    }
}
