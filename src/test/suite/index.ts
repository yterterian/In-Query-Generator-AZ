// File: src/test/suite/index.ts
import * as path from 'path';
import { glob } from 'glob';
import { runTestFiles } from './testHarness';

export function run(): Promise<void> {
    const testsRoot = path.resolve(__dirname, '.');
    console.log(`Looking for test files in: ${testsRoot}`);

    return glob('**/*.test.js', { cwd: testsRoot })
        .then((files: string[]) => {
            console.log(`Found ${files.length} test files:`);
            files.forEach((file: string) => console.log(`- Adding test file: ${file}`));
            return runTestFiles(files.map(file => path.resolve(testsRoot, file)));
        });
}
