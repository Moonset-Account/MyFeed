import type { BoardState, Caregiver, CareTask, CompletionRecord, Pet } from './types';
import { shiftDate, todayKey } from './logic';

/** 虚构宠物与照护人，仅用于本地演示 */
export const SAMPLE_PETS: Pet[] = [
  { id: 'pet-buding', name: '布丁', species: '橘猫', avatar: '🐈', note: '3 岁，已绝育，有点挑食' },
  { id: 'pet-doudou', name: '豆豆', species: '柯基犬', avatar: '🐕', note: '5 岁，髋关节需要保养' },
  { id: 'pet-xueqiu', name: '雪球', species: '垂耳兔', avatar: '🐇', note: '1 岁，胆小，怕突然的噪音' },
];

export const SAMPLE_CAREGIVERS: Caregiver[] = [
  { id: 'cg-xiaolin', name: '小林' },
  { id: 'cg-amei', name: '阿梅' },
  { id: 'cg-laozhou', name: '老周' },
];

function dayTasks(date: string): CareTask[] {
  return [
    { id: `task-${date}-buding-feed-am`, petId: 'pet-buding', category: 'feeding', title: '早餐：猫粮 40g', date, time: '08:00', detail: '干粮为主，可拌少量冻干' },
    { id: `task-${date}-doudou-feed-am`, petId: 'pet-doudou', category: 'feeding', title: '早餐：狗粮 120g', date, time: '08:30' },
    { id: `task-${date}-doudou-walk-am`, petId: 'pet-doudou', category: 'walking', title: '晨间遛狗 20 分钟', date, time: '09:00', detail: '携带拾便袋，避开正午高温' },
    { id: `task-${date}-xueqiu-clean`, petId: 'pet-xueqiu', category: 'cleaning', title: '清理兔笼、更换垫料', date, time: '10:00' },
    { id: `task-${date}-buding-clean`, petId: 'pet-buding', category: 'cleaning', title: '铲猫砂并补充新砂', date, time: '10:30' },
    { id: `task-${date}-xueqiu-feed`, petId: 'pet-xueqiu', category: 'feeding', title: '提摩西草与兔粮', date, time: '12:00', detail: '牧草不限量，兔粮一小把，换新鲜饮水' },
    { id: `task-${date}-doudou-med`, petId: 'pet-doudou', category: 'medication', title: '关节保护剂 1 粒', date, time: '18:30', detail: '混在晚餐里喂服，观察是否吐出' },
    { id: `task-${date}-buding-feed-pm`, petId: 'pet-buding', category: 'feeding', title: '晚餐：猫粮 35g', date, time: '19:00' },
    { id: `task-${date}-doudou-feed-pm`, petId: 'pet-doudou', category: 'feeding', title: '晚餐：狗粮 120g', date, time: '19:00' },
    { id: `task-${date}-doudou-walk-pm`, petId: 'pet-doudou', category: 'walking', title: '晚间遛狗 30 分钟', date, time: '20:00' },
    { id: `task-${date}-buding-med`, petId: 'pet-buding', category: 'medication', title: '化毛膏 2cm', date, time: '21:00', detail: '直接喂食或抹在鼻尖' },
  ];
}

function at(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm).toISOString();
}

/**
 * 以参考日期（默认今天）为中心生成前后三天的示例数据，
 * 其中包含若干已完成记录和一条重复确认记录，便于演示提示效果。
 */
export function createSampleState(referenceDate: string = todayKey()): BoardState {
  const prev = shiftDate(referenceDate, -1);
  const next = shiftDate(referenceDate, 1);
  const tasks = [...dayTasks(prev), ...dayTasks(referenceDate), ...dayTasks(next)];

  const records: CompletionRecord[] = [
    { id: `rec-${prev}-01`, taskId: `task-${prev}-buding-feed-am`, completedAt: at(prev, '08:12'), completedBy: '小林', note: '吃得很干净', duplicate: false },
    { id: `rec-${prev}-02`, taskId: `task-${prev}-doudou-feed-am`, completedAt: at(prev, '08:40'), completedBy: '小林', note: '', duplicate: false },
    { id: `rec-${prev}-03`, taskId: `task-${prev}-doudou-walk-am`, completedAt: at(prev, '09:25'), completedBy: '阿梅', note: '排便正常', duplicate: false },
    { id: `rec-${prev}-04`, taskId: `task-${prev}-xueqiu-clean`, completedAt: at(prev, '10:15'), completedBy: '老周', note: '', duplicate: false },
    { id: `rec-${prev}-05`, taskId: `task-${prev}-doudou-med`, completedAt: at(prev, '18:45'), completedBy: '阿梅', note: '混在晚餐里吃完了', duplicate: false },
    { id: `rec-${prev}-06`, taskId: `task-${prev}-doudou-walk-pm`, completedAt: at(prev, '20:35'), completedBy: '老周', note: '', duplicate: false },
    { id: `rec-${prev}-07`, taskId: `task-${prev}-doudou-walk-pm`, completedAt: at(prev, '20:50'), completedBy: '小林', note: '没看到老周的记录，又确认了一次', duplicate: true },
    { id: `rec-${referenceDate}-01`, taskId: `task-${referenceDate}-buding-feed-am`, completedAt: at(referenceDate, '08:05'), completedBy: '阿梅', note: '剩了一点，已收走', duplicate: false },
    { id: `rec-${referenceDate}-02`, taskId: `task-${referenceDate}-doudou-walk-am`, completedAt: at(referenceDate, '09:20'), completedBy: '小林', note: '', duplicate: false },
  ];

  return {
    pets: SAMPLE_PETS.map((p) => ({ ...p })),
    caregivers: SAMPLE_CAREGIVERS.map((c) => ({ ...c })),
    tasks,
    records,
  };
}
