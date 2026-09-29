import type { ExpenseState } from '../types';

export function createSampleState(): ExpenseState {
  const now = new Date().toISOString();
  const nowLocal = new Date();
  const month = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}`;
  return {
    version: 1,
    people: [
      { id: 'person_lin', name: '小林' },
      { id: 'person_chen', name: '阿陈' },
      { id: 'person_zhou', name: '周周' },
    ],
    bills: [
      {
        id: 'bill_rent',
        date: `${month}-01`,
        category: 'rent',
        title: '本月房租',
        amount: 600000,
        method: 'equal',
        participantIds: ['person_lin', 'person_chen', 'person_zhou'],
        shares: {},
        paid: { person_lin: 600000 },
        note: '含物业，已和房东确认。',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'bill_utilities',
        date: `${month}-08`,
        category: 'utilities',
        title: '水电燃气和网络',
        amount: 36735,
        method: 'percent',
        participantIds: ['person_lin', 'person_chen', 'person_zhou'],
        shares: { person_lin: 40, person_chen: 35, person_zhou: 25 },
        paid: { person_chen: 36735 },
        note: '小林在家办公，比例已提前确认。',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'bill_groceries',
        date: `${month}-15`,
        category: 'groceries',
        title: '共同采购清洁用品和食材',
        amount: 42860,
        method: 'fixed',
        participantIds: ['person_lin', 'person_chen', 'person_zhou'],
        shares: { person_lin: 16000, person_chen: 13240, person_zhou: 13620 },
        paid: { person_lin: 20000, person_zhou: 22860 },
        note: '周周垫付部分已拍照留档。',
        createdAt: now,
        updatedAt: now,
      },
    ],
    payments: [],
    settlements: [],
  };
}
