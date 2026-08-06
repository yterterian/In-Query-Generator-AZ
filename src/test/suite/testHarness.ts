import * as path from 'path';

export interface TestContext {
    timeout(milliseconds: number): void;
}

type TestCallback = (this: TestContext) => void | Promise<void>;

interface RegisteredTest {
    name: string;
    callback: TestCallback;
}

const suiteStack: string[] = [];
const registeredTests: RegisteredTest[] = [];

export function describe(name: string, callback: () => void): void {
    suiteStack.push(name);
    try {
        callback();
    } finally {
        suiteStack.pop();
    }
}

export function it(name: string, callback: TestCallback): void {
    registeredTests.push({
        name: [...suiteStack, name].join(' > '),
        callback
    });
}

export function installTestGlobals(): void {
    const testGlobals = globalThis as typeof globalThis & {
        describe?: typeof describe;
        it?: typeof it;
    };

    testGlobals.describe = describe;
    testGlobals.it = it;
}

export async function runTestFiles(files: readonly string[]): Promise<void> {
    registeredTests.length = 0;
    installTestGlobals();

    for (const file of files) {
        // Test files are compiled as CommonJS modules by this extension.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require(path.resolve(file));
    }

    const failures: string[] = [];

    for (const test of registeredTests) {
        let timeoutMilliseconds = 30000;
        const context: TestContext = {
            timeout: milliseconds => {
                timeoutMilliseconds = milliseconds;
            }
        };

        let timeoutHandle: NodeJS.Timeout | undefined;
        try {
            const testPromise = Promise.resolve().then(() => test.callback.call(context));
            const timeoutPromise = new Promise<never>((_, reject) => {
                timeoutHandle = setTimeout(() => {
                    reject(new Error(`Timed out after ${timeoutMilliseconds} ms`));
                }, timeoutMilliseconds);
            });

            await Promise.race([testPromise, timeoutPromise]);
            console.log(`  ✓ ${test.name}`);
        } catch (error) {
            failures.push(test.name);
            console.error(`  ✗ ${test.name}`);
            console.error(error);
        } finally {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
        }
    }

    console.log(`\n${registeredTests.length - failures.length} passing`);

    if (failures.length > 0) {
        throw new Error(`${failures.length} test(s) failed: ${failures.join(', ')}`);
    }
}
