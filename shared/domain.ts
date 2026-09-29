/** 订单状态:接单后依次流转 清洗 -> 质检 -> 待领取 -> 已取件 */
export type OrderStatus = 'washing' | 'inspecting' | 'ready' | 'picked_up';

export const STATUS_LABELS: Record<OrderStatus, string> = {
  washing: '清洗中',
  inspecting: '质检中',
  ready: '待领取',
  picked_up: '已取件',
};

export const STATUS_ORDER: OrderStatus[] = ['washing', 'inspecting', 'ready', 'picked_up'];

/** 服务项目价目表(单位:分/件),金额为服务端权威计算 */
export interface ServiceItem {
  id: string;
  name: string;
  priceCents: number;
}

export const SERVICE_CATALOG: ServiceItem[] = [
  { id: 'wash', name: '水洗', priceCents: 1200 },
  { id: 'dry', name: '干洗', priceCents: 2500 },
  { id: 'iron', name: '熨烫', priceCents: 800 },
  { id: 'stain', name: '去渍处理', priceCents: 1500 },
];

export function serviceById(id: string): ServiceItem | undefined {
  return SERVICE_CATALOG.find((s) => s.id === id);
}

export interface OrderHistoryEntry {
  at: string; // ISO 时间
  action: string; // 动作标识,如 create / fail_qc
  label: string; // 人类可读描述
  from: OrderStatus | null;
  to: OrderStatus;
  note?: string; // 备注,质检退回时必填
}

export interface Order {
  id: string;
  code: string; // 取件单号,如 L-0001
  customerName: string;
  phone: string;
  itemCount: number; // 衣物件数
  serviceIds: string[]; // 服务项目
  pickupDate: string; // 约定取件日期 YYYY-MM-DD
  stainNotes: string; // 特殊污渍备注
  amountCents: number; // 金额(分)
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  history: OrderHistoryEntry[];
}

export type TransitionAction = 'finish_wash' | 'pass_qc' | 'fail_qc' | 'pickup';

export interface TransitionDef {
  from: OrderStatus;
  to: OrderStatus;
  label: string;
  requiresNote?: boolean;
}

export const TRANSITIONS: Record<TransitionAction, TransitionDef> = {
  finish_wash: { from: 'washing', to: 'inspecting', label: '清洗完成,送质检' },
  pass_qc: { from: 'inspecting', to: 'ready', label: '质检通过,待领取' },
  fail_qc: { from: 'inspecting', to: 'washing', label: '质检不通过,退回重洗', requiresNote: true },
  pickup: { from: 'ready', to: 'picked_up', label: '顾客已取件' },
};

/** 当前状态下可执行的动作 */
export function availableActions(status: OrderStatus): TransitionAction[] {
  return (Object.keys(TRANSITIONS) as TransitionAction[]).filter(
    (a) => TRANSITIONS[a].from === status,
  );
}

/** 金额 = 所选服务项目单价之和 x 衣物件数 */
export function computeAmountCents(serviceIds: string[], itemCount: number): number {
  const unit = serviceIds.reduce((sum, id) => sum + (serviceById(id)?.priceCents ?? 0), 0);
  return unit * itemCount;
}

/** 逾期取件:超过约定取件日期且尚未取走 */
export function isOverdue(
  order: Pick<Order, 'pickupDate' | 'status'>,
  today: string,
): boolean {
  return order.status !== 'picked_up' && order.pickupDate < today;
}

export interface OrderSummary {
  totalOrders: number;
  activeOrders: number; // 未取件
  byStatus: Record<OrderStatus, number>;
  readyAmountCents: number; // 待领取金额
  pickedUpAmountCents: number; // 已取件(已回款)金额
  activeAmountCents: number; // 在途金额(未取件合计)
  overdueCount: number;
  overdueAmountCents: number;
}

export function summarize(orders: Order[], today: string): OrderSummary {
  const byStatus: Record<OrderStatus, number> = {
    washing: 0,
    inspecting: 0,
    ready: 0,
    picked_up: 0,
  };
  const summary: OrderSummary = {
    totalOrders: orders.length,
    activeOrders: 0,
    byStatus,
    readyAmountCents: 0,
    pickedUpAmountCents: 0,
    activeAmountCents: 0,
    overdueCount: 0,
    overdueAmountCents: 0,
  };
  for (const o of orders) {
    byStatus[o.status] += 1;
    if (o.status === 'picked_up') {
      summary.pickedUpAmountCents += o.amountCents;
    } else {
      summary.activeOrders += 1;
      summary.activeAmountCents += o.amountCents;
      if (o.status === 'ready') summary.readyAmountCents += o.amountCents;
    }
    if (isOverdue(o, today)) {
      summary.overdueCount += 1;
      summary.overdueAmountCents += o.amountCents;
    }
  }
  return summary;
}

/** 分 -> 人民币元显示 */
export function formatYuan(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

/** 本地时区的 YYYY-MM-DD */
export function todayString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
