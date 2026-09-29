export type ReviewStatus = 'compatible' | 'breaking' | 'unknown';
export type Direction = 'request' | 'response' | 'path' | 'operation';

export interface Finding {
  id?: string;
  status: ReviewStatus;
  subject: string;
  message: string;
  constraint: string;
  direction: Direction;
  oldLocation: string[];
  newLocation: string[];
  referenceChains: {
    old: string[];
    new: string[];
  };
  sample?: {
    oldRequest?: unknown;
    newResponse?: unknown;
    note?: string | null;
  };
}

export interface OperationGroup {
  method: string;
  path: string;
  status: ReviewStatus;
  findings: Finding[];
}

export interface ReviewResult {
  status: ReviewStatus;
  summary: Record<ReviewStatus, number>;
  operations: OperationGroup[];
  findings: Finding[];
}
