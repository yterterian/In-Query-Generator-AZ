const path = require('path');
const fs = require('fs');
const { runTests } = require('@vscode/test-electron');

async function main() {
    try {
        console.log('Running VS Code extension tests with coverage...');

        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = path.resolve(__dirname);

        // The path to the extension test runner script
        const extensionTestsPath = path.resolve(__dirname, 'out', 'test', 'suite', 'index');

        // Ensure coverage directory exists
        const coverageDir = path.join(__dirname, '.coverage');
        if (!fs.existsSync(coverageDir)) {
            fs.mkdirSync(coverageDir, { recursive: true });
        }

        // Additional VS Code test arguments
        const launchArgs = [
            '--disable-extensions',
            `--extensionDevelopmentPath=${extensionDevelopmentPath}`,
            `--extensionTestsPath=${extensionTestsPath}`
        ];

        // Set environment variables for NYC
        const testRunnerEnv = {
            ...process.env,
            CODE_COVERAGE: '1',
            CODE_TESTS_WORKSPACE: path.resolve(__dirname, 'test-workspace'),
            NYC_CONFIG: JSON.stringify({
                all: true,
                'check-coverage': false,
                extension: ['.ts'],
                include: ['src/**/*.ts'],
                exclude: ['src/test/**/*.ts'],
                reporter: ['text', 'lcov', 'html'],
                'report-dir': '.coverage'
            })
        };

        // Run tests
        console.log('Running tests with coverage collection...');
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs,
            extensionTestsEnv: testRunnerEnv
        });

        console.log('Tests completed. Coverage data should be available in .coverage directory.');
    } catch (err) {
        console.error('Failed to run tests with coverage:', err);
        process.exit(1);
    }
}

main();