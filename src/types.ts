/** 金额一律以“分”为单位的整数存储，避免浮点误差。 */

export interface Member {
  id: string;
  name: string;
}

export type SplitType = 'equal' | 'ratio' | 'fixed';

export interface Share {
  memberId: string;
  /** 分摊金额（分） */
  amount: number;
}

export interface Bill {
  id: string;
  title: string;
  category: string;
  /** ISO 日期 YYYY-MM-DD */
  date: string;
  /** 账单总额（分） */
  totalCents: number;
  payerId: string;
  splitType: SplitType;
  /** 参与人均分摊的成员（splitType = equal 时使用） */
  participantIds: string[];
  /** 固定比例（splitType = ratio 时使用，权重为正数） */
  ratios: { memberId: string; weight: number }[];
  /** 计算结果：每人分摊金额，总和恒等于 totalCents */
  shares: Share[];
  note: string;
  createdAt: number;
  updatedAt: number;
}

/** 成员间付款记录（还款/转账），带备注 */
export interface Payment {
  id: string;
  date: string;
  fromId: string;
  toId: string;
  amountCents: number;
  note: string;
  createdAt: number;
}

/** 月结快照：某月结清时留存 */
export interface MonthSettlement {
  month: string; // YYYY-MM
  settledAt: number;
  note: string;
}

export interface LedgerState {
  members: Member[];
  bills: Bill[];
  payments: Payment[];
  settlements: MonthSettlement[];
}
