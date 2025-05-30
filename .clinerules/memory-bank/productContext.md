# Product Context

**Purpose:** Explains why this project exists.
**Role:** Documents the problems it solves, how it should work, and user experience goals.

---

## Problem Statement

### Manual SQL IN Clause Creation is Time-Consuming and Error-Prone

SQL developers frequently need to create `IN` and `NOT IN` clauses when working with lists of values from various sources (spreadsheets, reports, other queries, or manual lists). The current manual process involves:

* **Time-consuming formatting**: Converting lists of values into proper SQL syntax with quotes, commas, and escaping
* **Error-prone manual typing**: Syntax errors from missing quotes, improper escaping, or malformed statements
* **Repetitive work**: Performing the same formatting task dozens of times per day
* **Data type confusion**: Incorrectly formatting dates, numbers, or strings leading to query failures
* **Large dataset challenges**: Difficulty processing hundreds or thousands of values efficiently
* **Inconsistent formatting**: Different developers using different formatting approaches within teams

**Real-world Impact**: A typical developer spends 15–30 minutes daily on manual IN clause formatting, with a 20–30% error rate requiring debugging and rework.

---

## Solution Overview

### Intelligent SQL IN Clause Generation with One-Click Simplicity

The **Enhanced In-Query Statement Generator** transforms any data source into properly formatted SQL `IN`/`NOT IN` clauses instantly:

* **Universal Input Processing**: Accepts data from clipboard, selected text, CSV/Excel copies, or tabular data with headers
* **Smart Data Type Detection**: Automatically identifies and formats numbers, dates, timestamps, GUIDs, and strings according to SQL standards
* **Intelligent Deduplication**: Removes duplicate values with configurable case sensitivity and whitespace handling
* **Column-Aware Processing**: Extracts specific columns from tabular data for targeted IN clause generation
* **Flexible Output Formatting**: Configurable formatting options (single line, one per line, grouped formatting)
* **Seamless IDE Integration**: Works directly within VS Code and Azure Data Studio with context menus and keyboard shortcuts

**Core Value Proposition**: Reduce SQL IN clause creation time from minutes to seconds while eliminating formatting errors entirely.

---

## User Experience Goals

* **Effortless Operation**: Generate SQL IN clauses with a single right-click or keyboard shortcut
* **Intelligent Defaults**: Smart data type detection and formatting without user intervention
* **Flexible Input Handling**: Accept data from any source without format restrictions
* **Instant Preview**: Show generated SQL before insertion with option to modify
* **Non-Disruptive Integration**: Enhance existing workflows without changing development habits
* **Contextual Help**: Provide helpful feedback and error messages when input is malformed
* **Customisable Behaviour**: Allow users to configure formatting, deduplication, and data type handling preferences
* **Performance Transparency**: Handle large datasets quickly without blocking the IDE interface

---

## Key Features

### Core Generation Features

* **Multi-Source Input Processing**: Clipboard, selected text, and tabular data support
* **Smart Data Type Formatting**: Automatic detection of numbers, dates, GUIDs, and strings
* **Dual Clause Support**: Generate both `IN` and `NOT IN` statements
* **Advanced Deduplication**: Remove duplicates with case and whitespace sensitivity options
* **Column Selection**: Choose specific columns from CSV/Excel-style data with headers

### User Interface Features

* **Context Menu Integration**: Right-click access to all major functions
* **Keyboard Shortcuts**: Quick access via `Ctrl+Shift+I`, `Ctrl+Shift+V`, `Ctrl+Shift+B`
* **Status Bar Tools**: Configurable status bar dropdown or pinned commands
* **Preview System**: Optional preview with copy/insert options before final placement
* **Settings Integration**: Full VS Code settings panel with all configuration options

### Quality of Life Features

* **Paste Special Menu**: Advanced paste options with distinct choice between `IN`/`NOT IN`
* **Batch Processing**: Handle large datasets (1000+ values) efficiently
* **Error Recovery**: Clear error messages with suggestions for malformed input
* **Usage Analytics**: Smart rating prompts based on usage patterns
* **Cross-Platform Consistency**: Identical behaviour across Windows, macOS, and Linux

---

## Usage Scenarios

### Scenario 1: Data Analyst – Excel to SQL Query

**Context**: Data analyst needs to filter database results based on customer IDs from an Excel report

**Process**:

* Copy customer ID column from Excel (including header)
* Right-click in SQL editor → *"Paste Column + IN Statement"*
* Select *Customer\_ID* column from dropdown

**Generated**: `Customer_ID IN (12345, 67890, 11223, 44556)`
**Outcome**: 30-second task instead of 10-minute manual formatting

---

### Scenario 2: Backend Developer – API Response Processing

**Context**: Developer needs to create SQL query based on array of IDs from API response

**Process**:

* Copy JSON array values from debugging tool
* Select values in VS Code
* `Ctrl+Shift+I` to copy as IN statement
* Preview shows: `IN (101, 102, 103, 104)`
* Paste into SQL query

**Outcome**: Immediate SQL generation with data type detection

---

### Scenario 3: Database Administrator – Large Dataset Migration

**Context**: DBA needs to create `NOT IN` clause for 500+ excluded record IDs

**Process**:

* Export excluded IDs from database management tool
* Select all values in text editor
* Right-click → *"Copy as IN Statement"* → Choose `NOT IN`
* Enable deduplication to remove any duplicates

**Outcome**: Handles large dataset with performance optimisation and duplicate removal

---

### Scenario 4: SQL Developer – Mixed Data Types

**Context**: Developer working with product codes that include dates, numbers, and strings

**Process**:

* Paste mixed data from requirements document
* Extension automatically detects: `DATE '2024-01-15'`, `12345`, `'PROD-ABC'`, `GUID`

**Generated**: `IN (DATE '2024-01-15', 12345, 'PROD-ABC', '550e8400-e29b-41d4-a716-446655440000')`
**Outcome**: Proper SQL formatting for each data type without manual intervention

---

### Scenario 5: Team Lead – Code Review Optimisation

**Context**: Reviewing team's SQL queries and finding manually typed IN clauses with formatting issues

**Process**:

* Identify problematic IN clauses during code review
* Select malformed clause
* Use extension to reformat with proper escaping and data types
* Share extension with team for consistent formatting standards

**Outcome**: Improved code quality and team productivity standardisation

---

> *Update this document as the product vision evolves.*
