// File: src/test/runTest.ts
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as process from 'process';
import { spawn } from 'child_process';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';

const FILTERED_RUNNER_OUTPUT_PATTERNS = [
    /update#setState disabled/i,
    /update#ctor - updates are disabled by the environment/i,
    /Error: Error mutex already exists/i,
    /Failed to commit changes to custom Jump List/i,
    /updateWindowsJumpList#setJumpList unexpected result: error/i
];

function shouldSuppressRunnerLine(line: string): boolean {
    const trimmedLine = line.trim();

    if (trimmedLine === '') {
        return false;
    }

    if (FILTERED_RUNNER_OUTPUT_PATTERNS.some(pattern => pattern.test(trimmedLine))) {
        return true;
    }

    // The mutex warning prints a single stack frame line immediately after the warning itself.
    if (/^\s*at .*resources\/app\/out\/main\.js:/i.test(trimmedLine)) {
        return true;
    }

    return false;
}

function forwardOutputWithFiltering(
    stream: NodeJS.ReadableStream,
    target: NodeJS.WriteStream
): void {
    let buffer = '';

    stream.on('data', chunk => {
        buffer += chunk.toString();

        let newlineIndex = buffer.indexOf('\n');
        while (newlineIndex !== -1) {
            const line = buffer.slice(0, newlineIndex + 1);
            if (!shouldSuppressRunnerLine(line)) {
                target.write(line);
            }

            buffer = buffer.slice(newlineIndex + 1);
            newlineIndex = buffer.indexOf('\n');
        }
    });

    stream.on('end', () => {
        if (buffer && !shouldSuppressRunnerLine(buffer)) {
            target.write(buffer);
        }
    });
}

function getVSCodeExecutableRelativePath(): string {
    if (process.platform === 'darwin') {
        return path.join('Visual Studio Code.app', 'Contents', 'MacOS', 'Electron');
    }

    if (process.platform === 'win32') {
        return 'Code.exe';
    }

    return 'code';
}

function compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(part => Number(part));
    const bParts = b.split('.').map(part => Number(part));
    const maxLength = Math.max(aParts.length, bParts.length);

    for (let index = 0; index < maxLength; index++) {
        const aValue = aParts[index] ?? 0;
        const bValue = bParts[index] ?? 0;

        if (aValue !== bValue) {
            return aValue - bValue;
        }
    }

    return 0;
}

function resolveVSCodeExecutablePath(cacheRoot: string): string | undefined {
    const envPath = process.env.VSCODE_EXECUTABLE_PATH;
    if (envPath && fs.existsSync(envPath)) {
        return envPath;
    }

    if (!fs.existsSync(cacheRoot)) {
        return undefined;
    }

    const executableRelativePath = getVSCodeExecutableRelativePath();
    const cachedEntries = fs.readdirSync(cacheRoot, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => {
            const match = /^vscode-.+-(\d+\.\d+\.\d+)$/.exec(entry.name);
            if (!match) {
                return undefined;
            }

            const executablePath = path.join(cacheRoot, entry.name, executableRelativePath);
            if (!fs.existsSync(executablePath)) {
                return undefined;
            }

            return {
                version: match[1],
                executablePath
            };
        })
        .filter((entry): entry is { version: string; executablePath: string } => Boolean(entry))
        .sort((left, right) => compareVersions(right.version, left.version));

    return cachedEntries[0]?.executablePath;
}

async function resolveOrDownloadVSCodeExecutablePath(
    cacheRoot: string,
    extensionDevelopmentPath: string
): Promise<string> {
    const resolved = resolveVSCodeExecutablePath(cacheRoot);
    if (resolved) {
        return resolved;
    }

    return downloadAndUnzipVSCode({
        cachePath: cacheRoot,
        extensionDevelopmentPath
    });
}

async function runExtensionTests(
    vscodeExecutablePath: string,
    extensionDevelopmentPath: string,
    extensionTestsPath: string,
    cacheRoot: string,
    testEnv: NodeJS.ProcessEnv
): Promise<void> {
    const extensionsDir = path.join(cacheRoot, 'extensions');
    // Use os.tmpdir() so the socket path stays under the 103-char Unix limit on macOS CI
    const userDataDir = path.join(os.tmpdir(), `vscode-test-${Date.now()}-${process.pid}`);
    fs.mkdirSync(extensionsDir, { recursive: true });
    fs.mkdirSync(userDataDir, { recursive: true });

    const args = [
        '--disable-extensions',
        '--disable-telemetry',
        '--no-sandbox',
        '--disable-gpu-sandbox',
        '--disable-updates',
        '--skip-welcome',
        '--skip-release-notes',
        '--disable-workspace-trust',
        `--extensionTestsPath=${extensionTestsPath}`,
        `--extensionDevelopmentPath=${extensionDevelopmentPath}`,
        `--extensions-dir=${extensionsDir}`,
        `--user-data-dir=${userDataDir}`
    ];

    await new Promise<void>((resolve, reject) => {
        const child = spawn(vscodeExecutablePath, args, {
            env: testEnv,
            shell: false,
            stdio: 'pipe',
            windowsHide: true
        });

        forwardOutputWithFiltering(child.stdout, process.stdout);
        forwardOutputWithFiltering(child.stderr, process.stderr);
        child.on('error', reject);
        child.on('close', code => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(new Error(`Extension test run failed with code ${code ?? 'unknown'}.`));
        });
    });
}

async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');
        const vscodeCachePath = path.resolve(extensionDevelopmentPath, '.vscode-test');

        // The path to the extension test script
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        console.log('Running extension tests with the following paths:');
        console.log(`- Extension path: ${extensionDevelopmentPath}`);
        console.log(`- Tests path: ${extensionTestsPath}`);
        const vscodeExecutablePath = await resolveOrDownloadVSCodeExecutablePath(
            vscodeCachePath,
            extensionDevelopmentPath
        );
        console.log(`- VS Code executable: ${vscodeExecutablePath}`);
        
        // Initialize environment variables for the extension host
        const testEnv = { ...process.env };
        delete testEnv.ELECTRON_RUN_AS_NODE;
        
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
        await runExtensionTests(
            vscodeExecutablePath,
            extensionDevelopmentPath,
            extensionTestsPath,
            vscodeCachePath,
            testEnv
        );
    } catch (err) {
        console.error('Failed to run tests', err);
        process.exit(1);
    }
}

main();
