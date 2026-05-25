// File: src/test/runTest.ts
import * as path from 'path';
import * as fs from 'fs';
import * as process from 'process';
import { runTests } from '@vscode/test-electron';

function resolveVSCodeExecutablePath(): string | undefined {
    const envPath = process.env.VSCODE_EXECUTABLE_PATH;
    if (envPath && fs.existsSync(envPath)) {
        return envPath;
    }

    let candidates: string[] = [];

    if (process.platform === 'darwin') {
        candidates = [
            '/Applications/Visual Studio Code.app/Contents/MacOS/Electron',
            '/Applications/Visual Studio Code - Insiders.app/Contents/MacOS/Electron'
        ];
    } else if (process.platform === 'linux') {
        candidates = [
            '/usr/share/code/code',
            '/usr/bin/code',
            '/snap/bin/code'
        ];
    } else if (process.platform === 'win32') {
        candidates = [
            'C:\\Program Files\\Microsoft VS Code\\Code.exe',
            process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Microsoft VS Code', 'Code.exe') : ''
        ].filter((candidate): candidate is string => Boolean(candidate));
    }

    return candidates.find(candidate => fs.existsSync(candidate));
}

async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to the extension test script
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        console.log('Running extension tests with the following paths:');
        console.log(`- Extension path: ${extensionDevelopmentPath}`);
        console.log(`- Tests path: ${extensionTestsPath}`);
        const vscodeExecutablePath = resolveVSCodeExecutablePath();
        if (vscodeExecutablePath) {
            console.log(`- VS Code executable: ${vscodeExecutablePath}`);
        }
        
        // Initialize environment variables for the extension host
        const testEnv = { ...process.env };
        
        // Check if we're running in coverage mode
        const isCoverageEnabled = process.env.NYC_CONFIG || process.argv.includes('--coverage');
        if (isCoverageEnabled) {
            console.log('Coverage collection is enabled');
            
            // Ensure we have the .nyc_output directory
            const nycOutputDir = path.resolve(extensionDevelopmentPath, '.nyc_output');
            if (!fs.existsSync(nycOutputDir)) {
                fs.mkdirSync(nycOutputDir, { recursive: true });
            }
            
            // Add coverage-related environment variables
            Object.assign(testEnv, {
                COVERAGE_ENABLED: '1',
                NODE_ENV: 'test'
            });
        }

        // Use an existing VS Code install when available, otherwise download it and run the integration test
        await runTests({
            vscodeExecutablePath,
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [
                '--disable-extensions', // Disable other extensions
                '--disable-telemetry'   // Disable telemetry
            ],
            extensionTestsEnv: testEnv
        });
    } catch (err) {
        console.error('Failed to run tests', err);
        process.exit(1);
    }
}

main();