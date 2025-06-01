# SQL IN Clause Generator for Azure Data Studio & VS Code

![SQL IN Clause Generator Logo](images/logo.png)

## Description

SQL IN Clause Generator is a powerful extension for Azure Data Studio and VS Code that streamlines the creation of SQL `IN` and `NOT IN` clauses. Instantly generate SQL IN/NOT IN clauses from lists, Excel, or tabular data. It supports smart data type detection, batch processing, deduplication, and advanced formatting, making it ideal for working with large datasets and complex queries.

---

## Feature Overview

| Feature                                 | Description                                                                                  |
|------------------------------------------|----------------------------------------------------------------------------------------------|
| IN/NOT IN Clause Generation              | Convert selected text or clipboard content into SQL `IN`/`NOT IN` clauses                    |
| Batch/Table Data Processing              | Select a column from tabular data (with headers) to generate an IN clause                    |
| Paste Special Dropdown                   | Access advanced paste options (IN, NOT IN, column-based, deduplication toggle)               |
| Data Type Detection                      | Automatically formats numbers, dates, GUIDs, and more                                        |
| Deduplication (Distinct)                 | Optionally remove duplicate values (configurable globally and per-use)                       |
| Custom Formatting                        | One value per line, max values per line, indentation, and more                               |
| Status Bar Customization                 | Quick access to extension features via a configurable status bar dropdown                    |
| Preview & Feedback                       | Preview generated statements and receive feedback on duplicates removed                      |
| Keyboard Shortcuts                       | Fast access to core features                                                                 |
| Error Handling & Guidance                | User-friendly messages and tips for best results                                             |

---

## Installation

1. Open Azure Data Studio or VS Code
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

### 3. **Paste Special In Statement**

- Right-click and select **Paste Special In Statement** for advanced options:
  - **Paste IN Statement**: Standard IN clause.
  - **Paste NOT IN Statement**: Standard NOT IN clause.
  - **Paste Column + IN Statement**: Select a column from tabular data (with headers).
  - **Paste Column + NOT IN Statement**: Same as above, but for NOT IN.
- You will be prompted to choose whether to remove duplicates (distinct) for this operation.

### 4. **Process Table Data as IN Statement**

- Select tabular data (with headers) in your editor.
- Right-click and select **Process Table Data as IN Statement** (or use Ctrl+Shift+B).
- Select the column for the IN clause and optionally specify a column name.

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
- 📄 **[Privacy Statement](https://github.com/yterterian/In-Query-Generator-AZ/blob/main/docs/PrivacyStatement.md)** — Learn what data we collect, what we don’t, and how you can control your privacy.

---

## Changelog

See the [GitHub Releases](https://github.com/yterterian/AZDataStudioExtension/releases) for version history and updates.
