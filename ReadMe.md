# SQL IN Clause Generator for VS Code

![SQL IN Clause Generator Logo](images/logo.png)

## Description

SQL IN Clause Generator is a powerful extension for VS Code that streamlines the creation of SQL `IN` and `NOT IN` clauses. Instantly generate SQL IN/NOT IN clauses from lists, Excel, or tabular data. It supports smart data type detection, batch processing, deduplication, and advanced formatting, making it ideal for working with large datasets and complex queries.

> **Note:** Azure Data Studio was retired on February 28, 2026. This extension now focuses exclusively on VS Code. Existing users can continue using the extension in VS Code with identical functionality.

---

## What's New In v0.16.0

- Harder-to-break parsing for pasted SQL `IN (...)` and `NOT IN (...)` fragments, quoted values, leading-zero IDs, and mixed copied data.
- More conservative table and header detection so copied result sets are less likely to lose the first real value.
- Refactored extension-host workflow with better helper-module coverage and stronger Windows test reliability.
- Telemetry and privacy behaviour now align more closely: hashed anonymous identifiers, DST-correct Sydney timestamps, and no raw error messages or stacks in telemetry payloads.
- Local packaging verified as `0.16.0` for VS Code testing.

---

## Feature Overview

| Feature                                 | Description                                                                                      |
|------------------------------------------|--------------------------------------------------------------------------------------------------|
| IN/NOT IN Clause Generation              | Convert selected text or clipboard content into SQL `IN`/`NOT IN` clauses                        |
| Batch/Table Data Processing              | Select a column from tabular data (with headers) to generate an IN clause                        |
| Paste Special Dropdown                   | Access advanced paste options (IN, NOT IN, column-based, deduplication toggle)                   |
| Data Type Detection                      | Automatically formats numbers, dates, GUIDs, and more                                            |
| **Data Type Override**             | Force values as text or numbers - perfect for numeric IDs that should be quoted                  |
| Deduplication (Distinct)                 | Optionally remove duplicate values (configurable globally and per-use)                           |
| Custom Formatting                        | One value per line, max values per line, indentation, and more                                   |
| Status Bar Customization                 | Quick access to extension features via a configurable status bar dropdown                        |
| Preview & Feedback                       | Preview generated statements and receive feedback on duplicates removed                          |
| Keyboard Shortcuts                       | Fast access to core features                                                                     |
| Error Handling & Guidance                | User-friendly messages and tips for best results                                                 |

---

## Installation

1. Open VS Code
2. Go to the Extensions view (Ctrl+Shift+X)
3. Search for "SQL IN Clause Generator"
4. Click Install

---

## How to Use

### 1. **Paste as IN Statement**

- Copy values from a table, spreadsheet, or any source.
- In your SQL editor, right-click and select **Paste IN Statement** (or use Ctrl+Shift+V).
- The extension formats and inserts the values as an SQL IN clause.

### 2. **Copy as IN Statement**

- Select values in your editor.
- Right-click and select **Copy as IN Statement** (or use Ctrl+Shift+I).
- Preview the generated IN clause and choose to copy or insert it.

### 3. **Paste Special In Statement** (3-Stage Flow)

- Right-click and select **Paste Special In Statement** (or use Ctrl+Alt+V) for advanced options with a 3-stage workflow:

  **Stage 1: Deduplication Choice**
  - Choose whether to remove duplicate values (distinct) or keep all values for this operation.

  **Stage 2: Action Selection**
  - **Paste IN Statement**: Standard IN clause.
  - **Paste NOT IN Statement**: Standard NOT IN clause.
  - **Paste Column + IN Statement**: Select a column from tabular data (with headers).
  - **Paste Column + NOT IN Statement**: Same as above, but for NOT IN.

  **Stage 3: Data Type Override** ✨ NEW
  - **Auto-detect (Smart)**: Default behavior - automatically detects and formats numbers, dates, GUIDs, and text appropriately.
  - **Force Text (Quote All)**: Forces ALL values to be quoted as text - perfect for numeric IDs like `123` that should be `'123'`.
  - **Force Number (Unquote All)**: Forces all values to be unquoted as numbers (non-numeric values are automatically quoted as fallback).

### 4. **Process Table Data as IN Statement**

- Select tabular data (with headers) in your editor.
- Right-click and select **Process Table Data as IN Statement** (or use Ctrl+Shift+B).
- Select the column for the IN clause and optionally specify a column name.

---

## Data Type Override ✨ Introduced in v0.14.0

The Data Type Override feature gives you precise control over how values are formatted in SQL IN clauses. This is especially useful when working with numeric IDs or values that need special formatting.

### Use Cases

1. **Numeric IDs that should be text**: Some databases store IDs as VARCHAR even though they look like numbers (`123`, `456`). Use **Force Text** to ensure they're quoted: `IN ('123', '456', '789')`.

2. **Mixed data with specific requirements**: When you have data that auto-detection doesn't handle correctly, you can override the behavior.

3. **Consistency requirements**: Ensure all values follow the same formatting pattern regardless of their content.

### How It Works

When using **Paste Special In Statement**, you'll be prompted to choose a data type mode:

- **Auto-detect (Smart)** - Default behavior:
  - Numbers: `123` → `123` (unquoted)
  - Dates: `2024-01-15` → `'2024-01-15'` (quoted)
  - GUIDs: `550e8400-...` → `'550e8400-...'` (quoted)
  - Text: `abc` → `'abc'` (quoted)
  - NULL: `NULL` or empty → `NULL` (always unquoted)

- **Force Text (Quote All)**:
  - Everything: `123` → `'123'` (quoted)
  - NULL still handled: `NULL` → `NULL` (unquoted)

- **Force Number (Unquote All)**:
  - Valid numbers: `123` → `123` (unquoted)
  - Non-numeric values: `abc` → `'abc'` (automatic fallback to quoted)
  - NULL still handled: `NULL` → `NULL` (unquoted)

### Analytics & Telemetry

When telemetry is enabled, the extension records limited aggregate usage around this workflow:

- Which data type modes are selected
- Whether the feature was accessed through the Paste Special workflow
- How often deduplication is used alongside the feature

It does not send SQL values, clipboard contents, file names, workspace identifiers, raw error messages, or raw error stacks.

You can disable telemetry at any time via `inQueryGenerator.telemetry.enabled`.

---

## Deduplication (Distinct Values)

- **Global Setting:**  
  - `inQueryGenerator.distinctValues` (default: true): Remove duplicate values before generating statements.
  - `inQueryGenerator.distinctCaseSensitive`: Treat values as distinct if their case differs.
  - `inQueryGenerator.distinctTrimWhitespace`: Ignore leading/trailing whitespace when deduplicating.

- **Per-Use Override:**  
  - When using **Paste Special In Statement**, you can choose to remove duplicates or keep all values for that operation.

- **Feedback:**  
  - The extension displays a message indicating how many duplicates were removed.

---

## Status Bar Customization

- The status bar provides quick access to extension features.
- You can configure which actions appear via `inQueryGenerator.statusBarActions` (e.g., show a dropdown or pin a specific command).

---

## Configuration

This extension contributes the following settings:

- `inQueryGenerator.telemetry.enabled`: Enable or disable telemetry data collection for SQL IN Clause Generator. If disabled, no usage data will be sent.
- `inQueryGenerator.splitOnWhitespace`: Split values on whitespace when generating IN statements.
- `inQueryGenerator.useNotIn`: Generate NOT IN statements instead of IN statements.
- `inQueryGenerator.defaultColumnName`: Default column name to use in the IN clause.
- `inQueryGenerator.detectDataTypes`: Automatically detect and format dates, GUIDs, and numeric values.
- `inQueryGenerator.alwaysShowPreview`: Always show a preview of the generated IN statement before inserting or copying.
- `inQueryGenerator.formatOptions`: Formatting options for IN statements:
  - `oneValuePerLine`: Put each value on a separate line.
  - `maxValuesPerLine`: Maximum number of values per line when not using oneValuePerLine.
  - `indentSize`: Number of spaces to use for indentation in multi-line format.
- `inQueryGenerator.statusBarActions`: List of actions to show in the status bar (dropdown or pinned commands).
- `inQueryGenerator.distinctValues`: Remove duplicate values before generating statements.
- `inQueryGenerator.distinctCaseSensitive`: Case sensitivity for deduplication.
- `inQueryGenerator.distinctTrimWhitespace`: Ignore whitespace when deduplicating.

---

## Keyboard Shortcuts

- Ctrl+Shift+I (Cmd+Shift+I): Copy selected text as IN statement
- Ctrl+Shift+V (Cmd+Shift+V): Paste clipboard content as IN statement
- **Ctrl+Alt+V (Cmd+Alt+V): Paste Special In Statement** - Access the 3-stage workflow with data type override
- Ctrl+Shift+B (Cmd+Shift+B): Process selected table data as IN statement

---

## Examples

### Basic Example

**Input:**

```SQL
123
456
789
```

**Output:**

``` SQL
IN (123, 456, 789)
```

### Example with Duplicates

**Input:**

``` SQL
A
B
A
C
B
```

**Output (Distinct ON):**

``` SQL
IN ('A', 'B', 'C')
```

> Message: "2 duplicates removed."

**Output (Distinct OFF):**

```sql
IN ('A', 'B', 'A', 'C', 'B')
```

### Data Type Override Example ✨ NEW

**Input (numeric IDs stored as VARCHAR):**

```SQL
123
456
789
```

**Output with Auto-detect (default):**

```SQL
IN (123, 456, 789)
```

**Output with Force Text (Quote All):**

```SQL
IN ('123', '456', '789')
```

> Perfect for numeric IDs that should be treated as text in your database!

### Column-Based Example

**Input (copied with header):**

``` SQL
Asset_Number
1336
138804
8869
```

- Use **Paste Column + IN Statement** and select "Asset_Number".
- **Output:**

``` SQL
Asset_Number IN (1336, 138804, 8869)
```

---

## Best Practices & Tips

- **Copy with headers** for best results when using column-based features.
- Use the **Paste Special In Statement** for advanced options and deduplication control.
- Adjust configuration settings to match your workflow and data conventions.
- The extension provides feedback on duplicates removed and errors encountered.

---

## Troubleshooting

- If you see "Clipboard data does not appear to be tabular with headers," ensure you copied both the header and data rows.
- For large datasets, the extension will warn you if processing may take time.
- If you encounter issues, check your configuration settings and review the feedback messages.

---

## Documentation & Support

- All features and configuration options are documented in this ReadMe and in the extension's settings UI.
- For further help or to report issues, visit the [GitHub repository](https://github.com/yterterian/AZDataStudioExtension/issues).
- 📄 **[Privacy Statement](docs/PrivacyStatement.md)** — Learn what data we collect, what we don’t, and how you can control your privacy.

---

## Changelog

### Version 0.16.0 - May 2026

#### Hardening And Reliability

- Repaired the Windows extension-host test runner and made the local quality gate reliable.
- Removed duplicate legacy coverage helper scripts and simplified the supported test path.
- Reduced direct dependencies by removing unused legacy packages.

#### SQL And Clipboard Handling

- Hardened parsing for pasted SQL `IN (...)` and `NOT IN (...)` fragments, including quoted values, escaped quotes and bracketed identifiers.
- Preserved blank positions more faithfully in copied lists instead of silently collapsing them.
- Improved handling for leading-zero IDs so auto-detection does not misclassify them as numeric.
- Tightened table and header inference for copied tabular data, especially where the first row is real data rather than a header.

#### Privacy And Telemetry

- Replaced the previous weak anonymous identifier approach with a one-way hash.
- Corrected Sydney timestamp handling for daylight saving time.
- Reduced telemetry detail so raw error messages and stacks are not sent.
- Updated the privacy statement to match the implementation.

### Version 0.14.0 - January 2026 ✨

#### New Feature: Data Type Override

- Added 3-stage workflow for Paste Special with data type control
- Three data type modes:
  - Auto-detect (Smart) - Intelligent detection of numbers, dates, GUIDs, and text
  - Force Text (Quote All) - Perfect for numeric IDs that should be quoted
  - Force Number (Unquote All) - Force numeric formatting with automatic fallback
- NULL values always handled correctly regardless of mode
- Enhanced telemetry to track feature usage and improve user experience

#### Other Changes

- Improved pure function architecture with TypeScript enum for type safety
- Added comprehensive unit tests (51 tests passing)
- Added exhaustive switch pattern for compile-time safety
- Enhanced documentation with use cases and examples

See the [GitHub Releases](https://github.com/yterterian/AZDataStudioExtension/releases) for complete version history.
