# techcontext.md

**Purpose:** Documents technologies used, development setup, technical constraints, and dependencies.
**Role:** Provides technical context for development and maintenance.

---

## Technologies Used

### Core Technologies

* **TypeScript 4.9.5**: Main development language with strict type checking
* **Node.js 14+**: Runtime environment for extension development and testing
* **VS Code Extension API 1.50.0+**: Primary platform integration layer
* **Azure Data Studio Compatibility**: Secondary target platform

### Build & Development Tools

* **TypeScript Compiler (tsc)**: Compiles TypeScript to JavaScript with source maps
* **ESLint 9.27.0**: Code quality and style enforcement with TypeScript-specific rules
* **Prettier/Lint-staged**: Code formatting and pre-commit hooks via Husky 9.1.7
* **VSCE (VS Code Extension CLI)**: Extension packaging and marketplace publishing

### Testing Framework

* **Mocha 10.2.0**: Primary test runner for unit and integration tests
* **@vscode/test-electron**: VS Code extension testing framework
* **C8**: Code coverage analysis with Istanbul integration
* **NYC**: Alternative coverage tool for complex scenarios

### Development Infrastructure

* **GitHub Actions**: CI/CD pipeline with matrix builds (Ubuntu, Windows, macOS)
* **npm**: Package management and script execution
* **Git**: Version control with conventional commit patterns
* **VS Code**: Primary development environment

---

## Development Setup

### Prerequisites

```bash
# Required software versions
Node.js >= 14.0.0
npm >= 6.0.0
VS Code >= 1.50.0
Git >= 2.0.0
```

### Initial Setup

```bash
# Clone repository
git clone <repository-url>
cd enhanced-in-query-generator

# Install dependencies
npm ci

# Compile TypeScript
npm run compile

# Run tests to verify setup
npm test

# Package extension for testing
npm run package
```

### Development Workflow

```bash
# Development mode with file watching
npm run watch

# Run specific test suites
npm run test:pure          # Pure function tests only
npm test                   # Full extension tests

# Code quality checks
npm run lint               # ESLint analysis
npm run lint:fix           # Auto-fix linting issues

# Coverage analysis
npm run coverage           # Generate coverage reports
npm run coverage:pure      # Coverage for pure functions only
```

### VS Code Debug Configuration

```json
// .vscode/launch.json (for extension debugging)
{
  "name": "Extension",
  "type": "extensionHost",
  "request": "launch",
  "args": ["--extensionDevelopmentPath=${workspaceFolder}"]
}
```

### Extension Testing

```bash
# Local extension testing
F5 in VS Code → Opens Extension Development Host
Ctrl+R → Reload extension during development

# Automated testing
npm test → Runs full test suite with VS Code integration
```

---

## Technical Constraints

### VS Code Extension Sandbox

* **No Browser APIs**: Cannot use localStorage, sessionStorage, or DOM APIs
* **Limited File System Access**: Must use VS Code workspace APIs for file operations
* **Security Restrictions**: All external communications must be explicitly declared
* **Memory Limitations**: Large dataset processing must be non-blocking

### Platform Compatibility Requirements

* **Cross-platform Consistency**: Must behave identically on Windows, macOS, and Linux
* **Node.js Version Support**: Compatible with Node.js versions supported by VS Code
* **Extension API Versioning**: Maintain compatibility with VS Code API 1.50.0+

### Performance Constraints

* **UI Thread Blocking**: Cannot block main thread for more than 50ms
* **Memory Usage**: Efficient handling of datasets up to 100,000+ items
* **Startup Time**: Extension activation must complete within 2 seconds
* **Bundle Size**: Keep extension package under 5MB for marketplace efficiency

### Security Constraints

* **No External Network Calls**: Extension operates entirely offline
* **Input Sanitisation**: All user input must be properly escaped and validated
* **No Eval/Dynamic Code**: Cannot execute dynamic JavaScript code
* **Dependency Security**: Regular dependency auditing required

### Marketplace Requirements

* **Content Policy Compliance**: Must meet VS Code marketplace guidelines
* **Privacy Requirements**: No user data collection or transmission
* **Accessibility Standards**: Support keyboard navigation and screen readers
* **Internationalisation**: Prepared for future localisation (English-first)

---

## Dependencies

### Production Dependencies

```json
{
  "azdata": "^1.0.0",
  "minimatch": "^10.0.1",
  "uuid": "^9.0.0"
}
```

### Development Dependencies

```json
{
  "@types/vscode": "^1.50.0",
  "@types/mocha": "^10.0.10",
  "@types/node": "^14.14.6",

  "@typescript-eslint/eslint-plugin": "^8.33.0",
  "@typescript-eslint/parser": "^8.33.0",

  "@vscode/test-electron": "^2.3.0",
  "@vscode/vsce": "^2.32.0",

  "c8": "^10.1.3",
  "mocha": "^10.2.0",
  "typescript": "^4.0.3",

  "husky": "^9.1.7",
  "lint-staged": "^15.5.2"
}
```

### Key Dependency Roles

#### Core Extension Framework

* `@types/vscode`: Provides TypeScript definitions for VS Code Extension API
* `azdata`: Enables Azure Data Studio compatibility and integration

#### Testing Infrastructure

* `@vscode/test-electron`: Runs tests in actual VS Code extension host environment
* `mocha`: Provides BDD/TDD testing framework with async support
* `c8`: Istanbul-based code coverage with V8 JavaScript engine integration

#### Code Quality Tools

* `@typescript-eslint/*`: TypeScript-aware linting with custom rule sets
* `husky` + `lint-staged`: Automated code quality checks on git commits

#### Build Tools

* `typescript`: Compiles TypeScript with source map support for debugging
* `@vscode/vsce`: Official tool for packaging and publishing VS Code extensions

---

## Integration Points

### VS Code Extension API Integration

```ts
// Primary integration points
vscode.commands.registerCommand()     // Command registration
vscode.window.createStatusBarItem()   // Status bar integration
vscode.workspace.getConfiguration()   // Settings management
vscode.env.clipboard                  // Clipboard access
vscode.window.showQuickPick()         // User input dialogs
```

### Azure Data Studio Compatibility

* **Shared Extension API**: Uses VS Code-compatible APIs that work in Azure Data Studio
* **SQL-Specific Context**: Enhanced relevance in database development environment
* **Settings Synchronisation**: Configuration works across both platforms

### System Clipboard Integration

```ts
// Cross-platform clipboard access
await vscode.env.clipboard.readText();   // Read clipboard content
await vscode.env.clipboard.writeText();  // Write to clipboard
```

### File System Integration (Limited)

* **Workspace File Access**: Read/write files within VS Code workspace
* **No Direct File System**: All file operations through VS Code API
* **Security Sandbox**: Cannot access files outside workspace without user permission

### Marketplace Integration

* **Automatic Updates**: VS Code handles extension updates from marketplace
* **Settings Sync**: User settings synchronised across VS Code instances
* **Usage Analytics**: Anonymous usage data through VS Code telemetry (opt-in)

### CI/CD Integration Points

```yaml
# GitHub Actions integration
- Platform Matrix: [ubuntu-latest, windows-latest, macos-latest]
- Node.js Matrix: [16, 18]
- Automated Testing: Full test suite on all platforms
- Package Generation: VSIX files for distribution
- Artifact Upload: Built extensions stored for releases
```

### Development Tool Integration

* **ESLint Integration**: Real-time linting in VS Code editor
* **TypeScript Language Service**: IntelliSense and error checking
* **Debugger Integration**: Breakpoint debugging in extension host
* **Git Integration**: Source control through VS Code Git features

---

> *Update this document as the technical context evolves.*
