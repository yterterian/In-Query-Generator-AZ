# Dialect Support Decision Gate

Evaluate after 30 days of `v0.16.3+` telemetry, excluding `is_dev = true`.

## Build Gates

- Slice A: SQL Server `N''` string prefixing
  Build if `dialect_family = 'sqlserver'` accounts for at least `25%` of `sql_generation` events and at least `20%` of distinct users.

- Slice B: Oracle `DATE` literal formatting
  Build if `dialect_family = 'oracle'` accounts for at least `10%` of `sql_generation` events.

- No slice
  If `generic_sql + non_sql_text >= 80%` of `sql_generation` events, treat users as dialect-agnostic in practice and defer dialect formatting for two release cycles.

## Qualitative Override

- Five or more independent GitHub issues, discussion replies, or review comments that identify a concrete dialect-specific formatting break can open that slice regardless of telemetry share.

## Scope Guard

- Chunking remains separate. A max-values-per-clause setting is dialect-agnostic and should be governed by `value_count_bucket`, not this gate.
- If a gate opens, ship one dialect behaviour only. Do not introduce a general dialect system until a second independently-gated slice exists.
- Default behaviour should continue to infer from editor context. Any future override setting must remain optional and narrow.
