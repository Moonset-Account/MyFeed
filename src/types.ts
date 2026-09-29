export type SplitMethod = 'equal' | 'percent' | 'fixed';

export type Category = 'rent' | 'utilities' | 'groceries' | 'other';

export interface Person {
  id: string;
  name: string;
}

export interface Bill {
  id: string;
  date: string;
  category: Category;
  title: string;
  amount: number;
  method: SplitMethod;
  participantIds: string[];
  /** Percent values for `percent`, yuan-cent amounts for `fixed`. */
  shares: Record<string, number>;
  /** Actual amounts paid, in yuan cents. */
  paid: Record<string, number>;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  date: string;
  payerId: string;
  payeeId: string;
  amount: number;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlySettlement {
  month: string;
  settledAt: string;
  note: string;
  invalidated?: boolean;
}

export interface ExpenseState {
  version: 1;
  people: Person[];
  bills: Bill[];
  payments: Payment[];
  settlements: MonthlySettlement[];
}

export interface PersonSummary {
  personId: string;
  name: string;
  shouldPay: number;
  paid: number;
  billBalance: number;
  settlementOut: number;
  settlementIn: number;
  netBalance: number;
}

export interface SettlementSuggestion {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
}

export interface BillValidationResult {
  valid: boolean;
  errors: string[];
}
