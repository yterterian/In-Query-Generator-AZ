// File: src/test/suite/index.ts
import * as path from 'path';
// Import using require for Mocha
const Mocha = require('mocha');
import { glob } from 'glob';

export function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 30000 // Longer timeout for UI tests
    });

    const testsRoot = path.resolve(__dirname, '.');
    console.log(`Looking for test files in: ${testsRoot}`);

    return new Promise<void>((resolve, reject) => {
        // Use the promisified version of glob
        glob('**/**.test.js', { cwd: testsRoot })
            .then((files: string[]) => {
                // Add files to the test suite
                console.log(`Found ${files.length} test files:`);
                files.forEach((f: string) => {
                    console.log(`- Adding test file: ${f}`);
                    mocha.addFile(path.resolve(testsRoot, f));
                });

                try {
                    // Run the mocha test
                    console.log('Starting mocha test run...');
                    mocha.run((failures: number) => {
                        if (failures > 0) {
                            reject(new Error(`${failures} tests failed.`));
                        } else {
                            resolve();
                        }
                    });
                } catch (err) {
                    console.error('Error running tests:', err);
                    reject(err);
                }
            })
            .catch((err: any) => {
                console.error('Error finding test files:', err);
                reject(err);
            });
    });
}