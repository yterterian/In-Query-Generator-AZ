// Replace the content of vscode-coverage.js with this:

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Function to ensure a directory exists
function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

// Ensure necessary directories exist
ensureDirectoryExists(path.join(__dirname, '.nyc_output'));
ensureDirectoryExists(path.join(__dirname, 'coverage'));

console.log('Running VS Code extension coverage analysis...');

try {
    // Step 1: Ensure TypeScript is compiled with source maps
    console.log('\n1. Compiling TypeScript with source maps...');
    
    // Update tsconfig if needed to ensure source maps
    const tsconfigPath = path.join(__dirname, 'tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
        let tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
        if (!tsconfig.compilerOptions.sourceMap) {
            tsconfig.compilerOptions.sourceMap = true;
            tsconfig.compilerOptions.inlineSources = true;
            fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2), 'utf8');
            console.log('  Updated tsconfig.json to enable source maps');
        }
    }
    
    // Compile with source maps
    execSync('npm run compile', { stdio: 'inherit' });
    
    // Step 2: Run the tests with nyc
    console.log('\n2. Running tests with coverage...');
    try {
        execSync('npx nyc --reporter=lcov --reporter=text --include="src/**/*.ts" --exclude="src/test/**/*.ts" npm test', {
            stdio: 'inherit',
            env: {
                ...process.env,
                NYC_CWD: __dirname,
                NODE_OPTIONS: '--no-warnings'
            }
        });
    } catch (error) {
        console.warn('\nTests completed with errors, but continuing with coverage report...');
    }
    
    // Step 3: Generate the reports explicitly in case it wasn't done
    console.log('\n3. Generating coverage reports...');
    execSync('npx nyc report --reporter=lcov --reporter=text', {
        stdio: 'inherit',
        env: {
            ...process.env,
            NYC_CWD: __dirname
        }
    });
    
    console.log('\nCoverage analysis complete!');
    console.log('Open coverage/lcov-report/index.html to view the HTML report');
} catch (error) {
    console.error('\nError during coverage analysis:', error.message);
    process.exit(1);
}