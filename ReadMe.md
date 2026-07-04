# SQL IN Clause Generator for VS Code

![SQL IN Clause Generator Logo](images/logo.png)

## Description

SQL IN Clause Generator is a powerful extension for VS Code that streamlines the creation of SQL `IN` and `NOT IN` clauses. Instantly generate SQL IN/NOT IN clauses from lists, Excel, or tabular data. It supports smart data type detection, batch processing, deduplication, and advanced formatting, making it ideal for working with large datasets and complex queries.

> **Note:** Azure Data Studio was retired on February 28, 2026. This extension now focuses exclusively on VS Code. Existing users can continue using the extension in VS Code with identical functionality.

---

## What's New In v0.16.2

- Collapsed Paste Special into a faster 2-stage flow that defaults to your configured deduplication setting.
- Added an inline Stage 1 modifier so you can switch between distinct and all values for a single run without changing saved settings.
- Added extension-host coverage for the new Paste Special flow, including focus retention and one-run duplicate overrides.
- Aligned the status bar setting docs with the current behaviour: when multiple pinned commands are configured, only the first is shown.
- Kept the telemetry and schema-contract hardening from `0.16.1` intact while tightening release metadata and docs for this patch release.

---

## Feature Overview

| Feature                                 | Description                                                                                      |
|------------------------------------------|--------------------------------------------------------------------------------------------------|
| IN/NOT IN Clause Generation              | Convert selected text or clipboard content into SQL `IN`/`NOT IN` clauses                        |
| Batch/Table Data Processing              | Select a column from tabular data (with headers) to generate an IN clause                        |
| Paste Special Dropdown                   | Access advanced paste options (IN, NOT IN, column-based, deduplication toggle, data type mode)   |
| Data Type Detection                      | Automatically formats numbers, dates, GUIDs, and more                                            |
| **Data Type Override**             | Force values as text or numbers - perfect for numeric IDs that should be quoted                  |
| Deduplication (Distinct)                 | Optionally remove duplicate values (configurable globally and per-use)                           |
| NULL-safe `NOT IN` Handling              | Blank and `NULL`-like inputs are removed from `NOT IN` clauses to avoid always-false predicates |
| Custom Formatting                        | One value per line, max values per line, indentation, and more                                   |
| Status Bar Customization                 | Quick access to extension features via a configurable status bar dropdown                        |
| Preview & Feedback                       | Preview generated statements and receive feedback on duplicates removed or `NULL` handling       |
| Keyboard Shortcuts                       | Fast access to core features                                                                     |
| Privacy-first Telemetry                  | Optional aggregate telemetry with hashed install IDs, coarse value buckets, and no SQL payloads  |
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

### 3. **Paste Special In Statement** (2-Stage Flow)

- Right-click and select **Paste Special In Statement** (or use Ctrl+Alt+V) for advanced options with a 2-stage workflow:

  **Stage 1: Action Selection**
  - The menu defaults to your configured `inQueryGenerator.distinctValues` setting.
  - Use the first row in the list to switch between **Distinct values** and **All values** for the current run only.
  - **Paste IN Statement**: Standard IN clause.
  - **Paste NOT IN Statement**: Standard NOT IN clause.
  - **Paste Column + IN Statement**: Select a column from tabular data (with headers).
  - **Paste Column + NOT IN Statement**: Same as above, but for NOT IN.

  **Stage 2: Data Type Override**
  - **Auto-detect (Smart)**: Default behavior - automatically detects and formats numbers, dates, GUIDs, and text appropriately.
  - **Force Text (Quote All)**: Forces ALL values to be quoted as text - perfect for numeric IDs like `123` that should be `'123'`.
  - **Force Number (Unquote All)**: Forces all values to be unquoted as numbers (non-numeric values are automatically quoted as fallback).

### 4. **Process Table Data as IN Statement**

- Select tabular data (with headers) in your editor.
- Open the Command Palette and run **Process Table Data as IN Statement**.
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

- Which SQL-generation command path was used
- Which clause type and data type mode were selected
- Whether deduplication was used and how many duplicates were removed
- A coarse bucket for unique value count rather than the exact count
- Aggregate session summaries and classified error events

It does not send SQL values, clipboard contents, file names, workspace identifiers, raw error messages, or raw error stacks.

You can disable telemetry at any time via `inQueryGenerator.telemetry.enabled`. For the current policy, see [docs/PrivacyStatement.md](docs/PrivacyStatement.md).

---

## Deduplication (Distinct Values)

- **Global Setting:**  
  - `inQueryGenerator.distinctValues` (default: true): Remove duplicate values before generating statements.
  - `inQueryGenerator.distinctCaseSensitive`: Treat values as distinct if their case differs.
  - `inQueryGenerator.distinctTrimWhitespace`: Ignore leading/trailing whitespace when deduplicating.

- **Per-Use Override:**  
  - When using **Paste Special In Statement**, the first row in the Stage 1 menu lets you switch between distinct and all values for that operation without changing your saved setting.

- **Feedback:**  
  - The extension displays a message indicating how many duplicates were removed.

---

## Status Bar Customization

- The status bar provides quick access to extension features.
- Use `inQueryGenerator.statusBarActions` to show the default dropdown or pin a specific command.
- If you provide multiple command IDs, the current implementation displays the first configured pinned action.

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
- `inQueryGenerator.statusBarActions`: Status bar mode. Use `["dropdown"]` for the default menu, or put a command ID first to pin that action. If you provide multiple command IDs, only the first is currently used.
- `inQueryGenerator.distinctValues`: Remove duplicate values before generating statements.
- `inQueryGenerator.distinctCaseSensitive`: Case sensitivity for deduplication.
- `inQueryGenerator.distinctTrimWhitespace`: Ignore whitespace when deduplicating.
- `inQueryGenerator.globalKeybindings`: Enable shortcuts in all file types instead of only SQL-family editors.

---

## Keyboard Shortcuts

- Ctrl+Shift+I (Cmd+Shift+I): Copy selected text as IN statement in SQL-family editors
- Ctrl+Shift+V (Cmd+Shift+V): Paste clipboard content as IN statement in SQL-family editors
- **Ctrl+Alt+V (Cmd+Alt+V): Paste Special In Statement** - Access the 2-stage workflow with inline deduplication toggle and data type override in SQL-family editors
- No default shortcut is assigned to **Process Table Data as IN Statement**

By default, shortcuts apply only in SQL-family editors so they do not override VS Code shortcuts in other languages. If you also use the extension in untitled or plain-text tabs, enable `inQueryGenerator.globalKeybindings` to restore the old global shortcut behaviour.

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

### Data Type Override Example

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
- If you are generating a `NOT IN` clause, leave blank rows out of the source data where possible; the extension will drop them and warn when needed.
- Adjust configuration settings to match your workflow and data conventions.
- The extension provides feedback on duplicates removed and errors encountered.

---

## Troubleshooting

- If you see "Clipboard data does not appear to be tabular with headers," ensure you copied both the header and data rows.
- For large datasets, the extension will warn you if processing may take time.
- If a `NOT IN` clause would contain blank or `NULL`-like values, the extension removes them because `NOT IN (..., NULL, ...)` can return no rows.
- If you encounter issues, check your configuration settings and review the feedback messages.

---

## Documentation & Support

- All features and configuration options are documented in this ReadMe and in the extension's settings UI.
- For further help or to report issues, visit the [GitHub repository](https://github.com/yterterian/In-Query-Generator-AZ/issues).
- 📄 **[Privacy Statement](docs/PrivacyStatement.md)** — Learn what data we collect, what we don’t, and how you can control your privacy.

---

## Changelog

### Version 0.16.2 - July 2026

#### Paste Special Flow

- Collapsed Paste Special from a 3-stage flow to a 2-stage flow by defaulting to the configured `inQueryGenerator.distinctValues` setting.
- Added an inline Stage 1 modifier row so users can switch between distinct and all values for the current run only.
- Preserved focus-safe quick-pick behaviour in both stages and added regression coverage for the new interaction.

#### Documentation And Packaging

- Updated the README, settings text, and privacy statement to reflect the new Paste Special flow and current status bar behaviour.
- Synced package metadata for the `0.16.2` release package.

### Version 0.16.1 - July 2026

#### Keyboard Shortcut Polishing

- Scoped default keyboard shortcuts to SQL-family editors so they no longer override common VS Code shortcuts in unrelated languages.
- Added the `inQueryGenerator.globalKeybindings` setting for users who want the old everywhere behaviour back with one toggle.
- Removed the conflicting default `Ctrl+Shift+B` binding while keeping the batch command available from the command palette.
- Added a one-time upgrade notice explaining the shortcut scope change and how to re-enable global bindings.

#### Telemetry And Reliability

- Hardened Supabase telemetry delivery with a bounded in-memory queue, retry limit, permanent-error drop behaviour, and a re-entrancy-safe flush path.
- Added privacy-safe per-generation telemetry for command path, clause type, data type mode, deduplication, and coarse value-count buckets.
- Persisted session summaries locally during use so aggregate session events can be recovered on the next activation instead of depending on shutdown-time network I/O.
- Added schema-contract tests that assert the telemetry insert payload matches the checked-in Supabase table contract.

#### SQL Correctness

- `NOT IN` generation now removes blank and `NULL`-like values that would otherwise make the predicate return no rows.
- Added clearer user warnings when copied data contains `NULL`-like values.

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

See the [GitHub Releases](https://github.com/yterterian/In-Query-Generator-AZ/releases) for complete version history.
