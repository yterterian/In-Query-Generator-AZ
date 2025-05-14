const spawn = require('child_process').spawn;
const path = require('path');
const fs = require('fs');

// Make sure the coverage directory exists
const coverageDir = path.join(__dirname, '.coverage');
if (!fs.existsSync(coverageDir)) {
    fs.mkdirSync(coverageDir);
}

// Run the test with NYC instrumentation
console.log('Running tests with coverage...');

// Set appropriate command for Windows or Unix
const isWindows = process.platform === 'win32';
const nycBin = path.join(__dirname, 'node_modules', '.bin', isWindows ? 'nyc.cmd' : 'nyc');

// Run nyc with appropriate configuration
const nyc = spawn(nycBin, [
    '--reporter=html',
    '--reporter=text',
    '--report-dir=.coverage',
    '--include=out/**/*.js',
    '--exclude=out/test/**/*.js',
    'node',
    './out/test/runTest.js'
], {
    stdio: 'inherit',
    env: { ...process.env }
});

nyc.on('close', (code) => {
    if (code === 0) {
        console.log('\nCoverage report generated successfully.');
        console.log('View detailed coverage report at: .coverage/index.html');
    } else {
        console.error(`\nTest run failed with exit code ${code}`);
        process.exit(code);
    }
});