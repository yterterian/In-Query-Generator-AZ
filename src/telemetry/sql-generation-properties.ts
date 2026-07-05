import { TelemetryScalar } from './types';
import { bucketValueCount } from './privacy';

export interface SqlGenerationTelemetry {
  command: string;
  clauseType: 'IN' | 'NOT IN';
  dataTypeMode: string;
  usedDistinct: boolean;
  duplicatesRemoved: number;
  uniqueValueCount: number;
  dialectFamily: string;
  origin: 'direct' | 'paste_special' | 'column' | 'batch' | 'copy';
  source?: string;
}

export function buildSqlGenerationProperties(details: SqlGenerationTelemetry): Record<string, TelemetryScalar> {
  const properties: Record<string, TelemetryScalar> = {
    command: details.command,
    clause_type: details.clauseType,
    data_type_mode: details.dataTypeMode,
    used_distinct: details.usedDistinct,
    duplicates_removed: details.duplicatesRemoved,
    value_count_bucket: bucketValueCount(details.uniqueValueCount),
    dialect_family: details.dialectFamily,
    origin: details.origin
  };

  if (details.source !== undefined) {
    properties.source = details.source;
  }

  return properties;
}
