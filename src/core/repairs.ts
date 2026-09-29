export const REPAIR_STATUSES = ['pending_evaluation', 'repairing', 'pending_shelving'] as const;

export type RepairStatus = (typeof REPAIR_STATUSES)[number];

export const STATUS_LABELS: Record<RepairStatus, string> = {
  pending_evaluation: '待评估',
  repairing: '修补中',
  pending_shelving: '待上架',
};

export const INSPECTION_ITEMS = [
  '破损部位已修复',
  '书页完整、无松动脱落',
  '装订和书脊牢固',
  '封面、封底平整洁净',
  '馆藏标识和书号清晰',
] as const;

export type InspectionItem = (typeof INSPECTION_ITEMS)[number];
export type InspectionChecklist = Record<InspectionItem, boolean>;

export type TimelineEventType = 'registered' | 'status_changed' | 'inspection_completed';

export interface TimelineEvent {
  at: string;
  type: TimelineEventType;
  actor: string;
  detail: string;
}

export interface InspectionResult {
  at: string;
  inspector: string;
  checklist: InspectionChecklist;
}

export interface RepairRecord {
  id: string;
  bookNumber: string;
  damageLocation: string;
  photoNote: string;
  repairSteps: string[];
  handler: string;
  status: RepairStatus;
  inspection: InspectionResult | null;
  timeline: TimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface RepairInput {
  bookNumber: string;
  damageLocation: string;
  photoNote: string;
  repairSteps: string[];
  handler: string;
}

export interface InspectionInput {
  inspector: string;
  checklist: InspectionChecklist;
}

export interface TodoStats {
  total: number;
  pendingEvaluation: number;
  repairing: number;
  pendingShelving: number;
  awaitingInspection: number;
  available: number;
  todo: number;
}

export class RepairValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepairValidationError';
  }
}

const NEXT_STATUS: Partial<Record<RepairStatus, RepairStatus>> = {
  pending_evaluation: 'repairing',
  repairing: 'pending_shelving',
};

export function normalizeBookNumber(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

export function normalizeLines(lines: string | string[]): string[] {
  const source = Array.isArray(lines) ? lines : lines.split(/\r?\n/);
  return source.map((line) => line.trim()).filter(Boolean);
}

export function requireText(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new RepairValidationError(`请填写${fieldName}`);
  }
  return normalized;
}

export function validateRepairInput(input: RepairInput): RepairInput {
  const repairSteps = normalizeLines(input.repairSteps);
  if (repairSteps.length === 0) {
    throw new RepairValidationError('请至少填写一条修补步骤');
  }

  return {
    bookNumber: requireText(input.bookNumber, '书号'),
    damageLocation: requireText(input.damageLocation, '破损位置'),
    photoNote: requireText(input.photoNote, '照片说明'),
    repairSteps,
    handler: requireText(input.handler, '处理人'),
  };
}

export function createRepairRecord(input: RepairInput, id: string, now: string): RepairRecord {
  const validInput = validateRepairInput(input);
  const bookNumber = normalizeBookNumber(validInput.bookNumber);

  return {
    id,
    bookNumber,
    damageLocation: validInput.damageLocation,
    photoNote: validInput.photoNote,
    repairSteps: validInput.repairSteps,
    handler: validInput.handler,
    status: 'pending_evaluation',
    inspection: null,
    timeline: [
      {
        at: now,
        type: 'registered',
        actor: validInput.handler,
        detail: '登记破损，进入待评估',
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

export function advanceStatus(record: RepairRecord, now: string): RepairRecord {
  const nextStatus = NEXT_STATUS[record.status];
  if (!nextStatus) {
    throw new RepairValidationError('当前状态不能继续流转');
  }

  return {
    ...record,
    status: nextStatus,
    updatedAt: now,
    timeline: [
      ...record.timeline,
      {
        at: now,
        type: 'status_changed',
        actor: record.handler,
        detail: `${STATUS_LABELS[record.status]} → ${STATUS_LABELS[nextStatus]}`,
      },
    ],
  };
}

export function createEmptyChecklist(): InspectionChecklist {
  return INSPECTION_ITEMS.reduce((checklist, item) => {
    checklist[item] = false;
    return checklist;
  }, {} as InspectionChecklist);
}

export function completeInspection(
  record: RepairRecord,
  input: InspectionInput,
  now: string,
): RepairRecord {
  if (record.status !== 'pending_shelving') {
    throw new RepairValidationError('只有待上架的图书才能完成上架检查');
  }
  if (record.inspection) {
    throw new RepairValidationError('这本书已经完成检查');
  }

  const inspector = requireText(input.inspector, '检查人');
  const missingItems = INSPECTION_ITEMS.filter((item) => input.checklist[item] !== true);
  if (missingItems.length > 0) {
    throw new RepairValidationError(`请完成全部检查项：${missingItems.join('、')}`);
  }

  const inspection: InspectionResult = {
    at: now,
    inspector,
    checklist: { ...input.checklist },
  };

  return {
    ...record,
    inspection,
    updatedAt: now,
    timeline: [
      ...record.timeline,
      {
        at: now,
        type: 'inspection_completed',
        actor: inspector,
        detail: '完成上架检查，图书可借',
      },
    ],
  };
}

export function canBorrow(record: RepairRecord): boolean {
  return record.status === 'pending_shelving' && record.inspection !== null;
}

export function findRecordsByBookNumber(records: RepairRecord[], bookNumber: string): RepairRecord[] {
  const keyword = normalizeBookNumber(bookNumber);
  return records
    .filter((record) => !keyword || record.bookNumber.includes(keyword))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getTodoStats(records: RepairRecord[]): TodoStats {
  const stats: TodoStats = {
    total: records.length,
    pendingEvaluation: 0,
    repairing: 0,
    pendingShelving: 0,
    awaitingInspection: 0,
    available: 0,
    todo: 0,
  };

  for (const record of records) {
    if (record.status === 'pending_evaluation') {
      stats.pendingEvaluation += 1;
    }
    if (record.status === 'repairing') {
      stats.repairing += 1;
    }
    if (record.status === 'pending_shelving') {
      stats.pendingShelving += 1;
      if (canBorrow(record)) {
        stats.available += 1;
      } else {
        stats.awaitingInspection += 1;
      }
    }
  }

  stats.todo = stats.pendingEvaluation + stats.repairing + stats.awaitingInspection;
  return stats;
}

function escapeCsvCell(value: string): string {
  let safeValue = value;
  if (/^[=+\-@|\t\r]/.test(safeValue)) {
    safeValue = `'${safeValue}`;
  }
  return `"${safeValue.replace(/"/g, '""')}"`;
}

export function recordsToCsv(records: RepairRecord[]): string {
  const headers = [
    '书号',
    '状态',
    '可否外借',
    '处理人',
    '破损位置',
    '照片说明',
    '修补步骤',
    '检查人',
    '检查项目',
    '登记时间',
    '最近更新时间',
  ];

  const rows = records.map((record) => [
    record.bookNumber,
    STATUS_LABELS[record.status],
    canBorrow(record) ? '是' : '否',
    record.handler,
    record.damageLocation,
    record.photoNote,
    record.repairSteps.join('；'),
    record.inspection?.inspector ?? '',
    record.inspection ? INSPECTION_ITEMS.filter((item) => record.inspection?.checklist[item]).join('；') : '',
    record.createdAt,
    record.updatedAt,
  ]);

  return [headers, ...rows].map((row) => row.map(String).map(escapeCsvCell).join(',')).join('\r\n');
}
