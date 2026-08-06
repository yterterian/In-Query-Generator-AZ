import * as path from 'path';
import { runTestFiles } from './testHarness';

const testFiles = process.argv.slice(2);

if (testFiles.length === 0) {
    throw new Error('Specify at least one compiled test file.');
}

runTestFiles(testFiles.map(file => path.resolve(__dirname, file))).catch(error => {
    console.error(error);
    process.exitCode = 1;
});
