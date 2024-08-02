# In-Query Generator for Azure Data Studio

## Description

The In-Query Generator is a powerful extension for Azure Data Studio that simplifies the process of creating IN clauses for SQL queries. It allows you to quickly convert selected data or clipboard content into properly formatted IN statements, saving time and reducing errors in your query writing process.

This extension is particularly useful when working with large datasets or when you need to create queries based on multiple values from query results. It handles both numeric and string data types, automatically formatting them correctly for use in SQL IN clauses.

## Features

- Convert selected text to an IN clause directly in the editor
- Generate IN clauses from clipboard content
- Automatically handle both numeric and string data types
- Escape single quotes in string values
- Support for NULL values in the IN clause

## Installation

1. Open Azure Data Studio
2. Go to the Extensions view (Ctrl+Shift+X)
3. Search for "In-Query Generator"
4. Click Install

## How to Use

### Method 1: Copy and Paste as IN Statement

1. In the query results grid, select the cells containing the values you want to use in your IN clause.
2. Copy the selected cells to your clipboard (Ctrl+C or right-click > Copy).
3. In your SQL editor, place your cursor where you want to insert the IN clause.
4. Right-click to open the context menu and select "Paste as IN Statement".
5. The extension will format the clipboard content and paste it as a properly formatted IN clause.

### Method 2: Generate IN Statement from Selected Text

1. In your SQL editor, select the text containing the values you want to use in your IN clause.
2. Right-click to open the context menu and select "Copy as IN Statement".
3. The extension will format the selected text and copy it to your clipboard as a properly formatted IN clause.
4. You can then paste (Ctrl+V) the IN clause wherever you need it in your query.

## Examples

If you copy or select the following values:
1234
5678
ABC123
NULL
User's Name

The extension will generate:

```sql
IN ('1234', '5678', 'ABC123', NULL, 'User''s Name')

Notes

The extension automatically handles string escaping, wrapping strings in single quotes and escaping any existing single quotes within the strings.
Numeric values are not wrapped in quotes, allowing them to be treated as numbers in your queries.
NULL values are included in the IN clause without quotes.
The extension can handle data copied directly from Azure Data Studio's results grid, making it easy to use query results in subsequent queries.

Feedback and Contributions
We welcome your feedback and contributions! If you encounter any issues or have suggestions for improvements, please visit our GitHub repository to submit an issue or pull request.
License
This project is licensed under the MIT License - see the LICENSE file for details.
Author
Created by Yakov T