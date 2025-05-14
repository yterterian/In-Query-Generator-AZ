const spawn = require('child_process').spawn;
const path = require('path');
const fs = require('fs');

// Make sure coverage directories exist
const nycOutputDir = path.join(__dirname, '.nyc_output');
const coverageDir = path.join(__dirname, 'coverage');
if (!fs.existsSync(nycOutputDir)) {
    fs.mkdirSync(nycOutputDir, { recursive: true });
}
if (!fs.existsSync(coverageDir)) {
    fs.mkdirSync(coverageDir, { recursive: true });
}

// Run the tests with nyc instrumentation directly
console.log('Running VS Code extension tests with coverage...');

// Build the nyc command
const isWindows = process.platform === 'win32';
const nyc = spawn(
    path.join(__dirname, 'node_modules', '.bin', isWindows ? 'nyc.cmd' : 'nyc'),
    [
        '--reporter=lcov',
        '--reporter=text',
        '--report-dir=coverage',
        '--include=src/**/*.ts',  // Include TypeScript source files
        '--exclude=src/test/**',  // Exclude test files
        'node',
        path.join(__dirname, 'out', 'test', 'runTest.js')
    ],
    {
        stdio: 'inherit',
        env: {
            ...process.env,
            NYC_CWD: __dirname,
            NODE_V8_COVERAGE: path.join(__dirname, '.nyc_output', 'v8'),
        }
    }
);

nyc.on('close', (code) => {
    if (code === 0) {
        console.log('\nCoverage report generated successfully.');
        console.log(`View detailed report at: file://${path.join(__dirname, 'coverage', 'lcov-report', 'index.html')}`);
    } else {
        console.error(`\nTest run completed with code ${code} but coverage report was generated.`);
        console.log(`View detailed report at: file://${path.join(__dirname, 'coverage', 'lcov-report', 'index.html')}`);
    }
});