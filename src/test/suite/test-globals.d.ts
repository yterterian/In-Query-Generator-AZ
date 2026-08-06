import { describe as registerSuite, it as registerTest } from './testHarness';

declare global {
    const describe: typeof registerSuite;
    const it: typeof registerTest;
}

export {};
