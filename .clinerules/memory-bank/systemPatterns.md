# System Architecture & Technical Design

**Purpose:** Documents system architecture and key technical decisions.
**Role:** Captures design patterns, component relationships, and architectural choices.

---

## System Architecture

### Layered Architecture with Pure Function Core

The extension follows a cleanly separated layered architecture, isolating UI concerns from business logic:

```txt
┌─────────────────────────────────────┐
│           VS Code UI Layer          │
│    (Context Menus, Commands,        │
│     Status Bar, Settings)           │
├─────────────────────────────────────┤
│         Extension Logic Layer       │
│   (extension.ts - orchestration,    │
│    configuration, user feedback)    │
├─────────────────────────────────────┤
│          Pure Logic Layer           │
│     (pure.ts - core algorithms,     │
│      no external dependencies)      │
├─────────────────────────────────────┤
│         Data Processing Layer       │
│   (parsing, formatting, validation) │
└─────────────────────────────────────┘
```

---

## Module Structure

* `src/extension.ts`: Entry point and VS Code API integration
* `src/pure.ts`: Framework-agnostic core logic (pure functions)
* `src/test/suite/`: Unit and integration tests
* **Configuration Layer**: Type-safe VS Code settings integration

---

## Key Technical Decisions

### 1. Pure Function Architecture

* **Decision**: Separate core logic in `pure.ts` with zero VS Code dependencies
* **Rationale**:

  * Enables isolated testing
  * Simplifies debugging and maintenance
  * Supports reuse in CLI/web apps

### 2. TypeScript with Strict Configuration

* **Decision**: Enforce strict typing and use source maps
* **Rationale**:

  * Early error detection
  * Better IntelliSense and refactoring
  * Debuggable in VS Code host

### 3. Configuration-Driven Behaviour

* **Decision**: All user options defined in VS Code settings
* **Rationale**:

  * Aligns with VS Code ecosystem
  * Enables user customisation and type-safe access

### 4. Memory-Only State Management

* **Decision**: No persistence beyond settings
* **Rationale**:

  * Avoids unsupported browser APIs
  * Reduces complexity and security exposure

### 5. Comprehensive Error Handling Strategy

* **Decision**: Provide graceful degradation with user-friendly messages
* **Rationale**:

  * Avoids extension crashes
  * Helps users diagnose issues
  * Ensures robustness

### 6. Smart Rating Prompt System

* **Decision**: Usage-based prompts with exponential backoff
* **Rationale**:

  * Encourages ratings without annoyance
  * Reflects actual usage behaviour
  * Offers "rate", "later", or "never" options

---

## Design Patterns

### 1. Strategy Pattern – Data Type Detection

```ts
if (/^-?\d+(\.\d+)?$/.test(item)) return item; // Number
if (/^\d{4}-\d{2}-\d{2}$/.test(item)) return `DATE '${item}'`; // Date
if (/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(item)) return `'${item}'`; // GUID
```

### 2. Command Pattern – Extension Commands

```ts
vscode.commands.registerCommand('extension.copyAsInStatement', async () => {
    await processSelection(context);
});
```

### 3. Template Method Pattern – Data Processing Pipeline

```ts
const formattedData = data.map(item => formatValue(item, detectDataTypes));
if (formatOptions.oneValuePerLine) { /* strategy A */ }
else if (formatOptions.maxValuesPerLine > 0) { /* strategy B */ }
```

### 4. Factory Pattern – Input Parsing

```ts
if (splitOnWhitespace) {
    result = text.split(/\s+/).map(item => item.trim()).filter(item => item !== '');
} else {
    result = text.split(/[\r\n\t]+/).map(item => item.trim()).filter(item => item !== '');
}
```

### 5. Observer Pattern – Configuration Changes

```ts
vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('inQueryGenerator')) {
        updateStatusBarItem();
    }
});
```

### 6. Decorator Pattern – Status Bar Enhancement

* Enhances status bar with dropdown or pinned actions
* Dynamically adjusts based on user settings

---

## Component Relationships

### Core Data Flow

```txt
User Input → Input Parser → Data Validator → Type Detector → Formatter → Output Generator → VS Code Editor
                                ↑                                               ↓
                    VS Code Settings ← User Preferences ← Settings Panel
```

### Component Dependencies

* Extension Layer ⟶ Pure Logic Layer (unidirectional)
* Pure Logic Layer ⟶ no external dependencies
* Test Suite ⟶ independent coverage for both layers
* Configuration System bridges user preferences across layers

### Error Handling Flow

```txt
Component Error → Error Boundary → User Notification → Graceful Degradation → Continue Operation
```

### Status Bar Integration

```txt
Configuration Changes → Status Bar Update → User Interaction → Command Execution → Feedback Loop
```

---

## Evolution & Rationale

### Version 1.0 – Initial Implementation

* Monolithic structure in `extension.ts`
* **Limitation**: tightly coupled, hard to test

### Version 2.0 – Pure Function Extraction

* **Change**: extracted logic to `pure.ts`
* **Outcome**: modular, testable, and maintainable

### Version 3.0 – Enhanced Configuration System

* **Change**: full settings integration with type safety
* **Benefit**: better UX and consistent behaviour

### Current Version – Mature Architecture

* Stable layered boundaries
* Scalable performance with large data
* Refined UX based on feedback

### Future Evolution Considerations

* Plugin Architecture: Enable pluggable data type formatters
* Async Processing: Non-blocking handling for large inputs
* Caching Layer: Memoisation for repeated operations
* Streaming Parser: Low-memory handling for extreme input sizes

---

## Architectural Principles

* **Single Responsibility**: Each module has a focused role
* **Open/Closed Principle**: Extensible without modifying core logic
* **Dependency Inversion**: High-level logic avoids low-level dependency
* **Interface Segregation**: Narrow, purpose-driven interfaces
* **DRY Principle**: Shared functionality abstracted into pure functions

---

> **Note**: Update this document as the system evolves and new patterns or considerations emerge.
