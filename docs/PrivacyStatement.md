# Privacy Statement - SQL IN Clause Generator

**Last updated:** 05/07/2026

---

## Overview

This privacy statement explains what telemetry the VS Code extension **"SQL IN Clause Generator"** may collect, how that telemetry is used, and how you can disable it.

Telemetry is optional. If VS Code telemetry is disabled globally, or if the extension-specific telemetry setting is turned off, this extension does not send telemetry events.

---

## Data Collection

### What We Collect

When telemetry is enabled, the extension may collect:

- **Feature Usage:** Which extension commands are used
- **Per-Action Usage Signals:** Which SQL-generation flows are used, whether duplicates were removed, which clause type was generated, a coarse bucket of how many unique values were included, and an allow-listed SQL dialect family inferred from the active editor language
- **Aggregate Session Metrics:** Counts of SQL generation actions, clause-type usage, deduplication totals, approximate session duration and delivery metadata for recovered session summaries
- **Error Classification:** Error names, optional error codes and a short calling-context label
- **System Information:** VS Code version, extension version and operating system platform
- **Activation Signals:** Whether the extension was activated or deactivated in a VS Code session
- **Configuration Usage:** Settings choices that directly affect SQL generation behaviour

### What We **Do Not** Collect

The extension does not send:

- Personal information such as names, email addresses or contact details
- SQL code, generated SQL statements, pasted values or database content
- File contents, file names, file paths or workspace names
- Clipboard contents or copied table data
- Database connection details
- Raw error stacks or full error messages

---

## How We Use Your Data

Telemetry is used to:

- Understand which workflows and commands are most useful
- Measure aggregate product behaviour such as generation counts and session summaries
- Classify recurring errors without capturing SQL content or file details
- Guide maintenance and future product improvements

---

## Your Privacy Controls

### Opt-Out Options

You can disable telemetry in either of these ways.

#### VS Code Global Setting

- Open **Settings** and search for `"telemetry"`
- Set `telemetry.telemetryLevel` to `"off"`

#### Extension-Specific Setting

- Open **Settings** and search for `"inQueryGenerator.telemetry"`
- Disable `inQueryGenerator.telemetry.enabled`

---

## Data Anonymisation

- The extension uses a one-way SHA-256 hash to generate an anonymous installation identifier
- Session identifiers are temporary and scoped to the current VS Code session
- Value counts are bucketed into coarse ranges rather than sent as exact counts
- Telemetry is designed for aggregate analysis and does not include SQL content, clipboard data or workspace identifiers
- Editor language IDs are never transmitted verbatim for this signal; they are reduced to a small allow-listed dialect family such as `sqlserver`, `postgres`, or `generic_sql`

---

## Data Storage And Delivery

- Telemetry is sent over HTTPS to **Supabase**
- The extension batches telemetry in memory and sends it asynchronously
- Failed sends are retried only in a bounded, best-effort way within the current running session
- Session summaries are persisted locally during use and may be delivered on the next VS Code activation if shutdown interrupts delivery
- The extension does not embed SQL content, clipboard data, file names or workspace identifiers in telemetry payloads

---

## Data Retention

Telemetry retention is managed in the backend telemetry store rather than enforced by the extension itself.

The extension code in this repository does not control or guarantee a specific backend retention period.

---

## Your Rights

You may:

- Disable telemetry at any time
- Ask what categories of telemetry the extension collects
- Request deletion of data associated with your anonymous identifier where that backend data is still retained

---

## Changes To This Policy

This document may be updated when telemetry behaviour changes. The **Last updated** date will be revised when that happens.

---

## Contact

If you have questions about this privacy statement or the extension’s telemetry behaviour:

- **GitHub Issues:** [https://github.com/yterterian/In-Query-Generator-AZ/issues](https://github.com/yterterian/In-Query-Generator-AZ/issues)
- **Repository:** [https://github.com/yterterian/In-Query-Generator-AZ](https://github.com/yterterian/In-Query-Generator-AZ)

---

## Extension Information

- **Extension Name:** SQL IN Clause Generator
- **Publisher:** YakovT
- **Version:** 0.16.2
- **License:** MIT

---

## Compliance Direction

This extension is designed to follow:

- VS Code telemetry controls
- Data-minimisation principles
- Industry privacy best practices

---

> **Your Privacy Matters:**  
> The goal is to measure product usage without collecting personal identity, SQL content or workspace data.
