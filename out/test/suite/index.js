"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = void 0;
// File: src/test/suite/index.ts
const path = __importStar(require("path"));
// Import using require for Mocha
const Mocha = require('mocha');
const glob_1 = require("glob");
function run() {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 30000 // Longer timeout for UI tests
    });
    const testsRoot = path.resolve(__dirname, '.');
    console.log(`Looking for test files in: ${testsRoot}`);
    return new Promise((resolve, reject) => {
        // Use the promisified version of glob
        (0, glob_1.glob)('**/**.test.js', { cwd: testsRoot })
            .then((files) => {
            // Add files to the test suite
            console.log(`Found ${files.length} test files:`);
            files.forEach((f) => {
                console.log(`- Adding test file: ${f}`);
                mocha.addFile(path.resolve(testsRoot, f));
            });
            try {
                // Run the mocha test
                console.log('Starting mocha test run...');
                mocha.run((failures) => {
                    if (failures > 0) {
                        reject(new Error(`${failures} tests failed.`));
                    }
                    else {
                        resolve();
                    }
                });
            }
            catch (err) {
                console.error('Error running tests:', err);
                reject(err);
            }
        })
            .catch((err) => {
            console.error('Error finding test files:', err);
            reject(err);
        });
    });
}
exports.run = run;
//# sourceMappingURL=index.js.map