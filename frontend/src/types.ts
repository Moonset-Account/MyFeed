export type Severity = 'compatible' | 'breaking' | 'unknown';
export type Direction = 'request' | 'response';

export interface Finding {
  severity: Severity;
  kind: string;
  direction: Direction;
  message: string;
  oldLocation: string;
  newLocation: string;
  oldRefChain: string[];
  newRefChain: string[];
  constraint: string;
  failureExample: Record<string, unknown> | null;
}

export interface OperationReport {
  path: string;
  method: string;
  oldOperationId: string | null;
  newOperationId: string | null;
  severity: Severity;
  findings: Finding[];
}

export interface CompareResponse {
  errors?: string[];
  summary: {
    total: number;
    compatible: number;
    breaking: number;
    unknown: number;
  } | null;
  operations: OperationReport[];
}
