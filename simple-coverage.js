// File: simple-coverage.js (Save in project root)
/**
 * A simple coverage script for VS Code Extensions
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Ensure coverage directories exist
const nycOutputDir = path.join(__dirname, '.nyc_output');
const coverageDir = path.join(__dirname, 'coverage');

if (!fs.existsSync(nycOutputDir)) {
    fs.mkdirSync(nycOutputDir, { recursive: true });
}
if (!fs.existsSync(coverageDir)) {
    fs.mkdirSync(coverageDir, { recursive: true });
}

try {
    console.log('Running VS Code extension tests with coverage...');
    
    // Compile with source maps enabled
    console.log('\n1. Ensuring TypeScript is compiled with source maps...');
    
    // Check if tsconfig has source maps enabled
    const tsconfigPath = path.join(__dirname, 'tsconfig.json');
    let tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
    if (!tsconfig.compilerOptions.sourceMap) {
        console.log('  Updating tsconfig.json to enable source maps');
        tsconfig.compilerOptions.sourceMap = true;
        tsconfig.compilerOptions.inlineSources = true;
        fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2), 'utf8');
    }
    
    // Compile the extension
    execSync('npm run compile', { stdio: 'inherit' });
    
    // Run the tests with NYC directly
    console.log('\n2. Running tests with NYC instrumentation...');
    
    // The key is using --instrument here
    execSync(
        'nyc --reporter=lcov --reporter=text --report-dir=coverage --temp-dir=.nyc_output ' +
        '--instrument --all --include="src/**/*.ts" --exclude="src/test/**/*.ts" node ./out/test/runTest.js', 
        {
            stdio: 'inherit',
            env: {
                ...process.env,
                TS_NODE_PROJECT: path.resolve(__dirname, 'tsconfig.json')
            }
        }
    );
    
    console.log('\nCoverage analysis complete.');
    console.log(`View the HTML report at: file://${path.join(__dirname, 'coverage', 'lcov-report', 'index.html')}`);
} catch (error) {
    console.error('\nError during coverage analysis:', error.message);
    process.exit(1);
}