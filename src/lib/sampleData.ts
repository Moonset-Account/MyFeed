import type { CompletionRecord, Pet, TaskTemplate } from './types';
import { makeInstanceId, shiftDateKey, toDateKey } from './careLogic';

/** 示例数据均为虚构宠物与虚构照护人 */
export const SAMPLE_PETS: Pet[] = [
  { id: 'pet-buding', name: '布丁', species: '英短猫', emoji: '🐱', note: '挑食，猫粮需拌半勺罐头' },
  { id: 'pet-kele', name: '可乐', species: '柯基犬', emoji: '🐶', note: '后腿关节弱，遛狗避免爬楼梯' },
  { id: 'pet-xueqiu', name: '雪球', species: '垂耳兔', emoji: '🐰', note: '肠胃敏感，提摩西草不限量' }
];

export const SAMPLE_CAREGIVERS: string[] = ['小林', '阿梅', '老周', '阿凯'];

export const SAMPLE_TEMPLATES: TaskTemplate[] = [
  { id: 't-kele-walk-am', petId: 'pet-kele', type: 'walking', title: '晨间遛狗', time: '07:00', instruction: '小区南门草坪，20 分钟，避开大型犬' },
  { id: 't-kele-feed-am', petId: 'pet-kele', type: 'feeding', title: '可乐早餐', time: '07:30', instruction: '狗粮 120g，加关节营养粉一勺' },
  { id: 't-buding-feed-am', petId: 'pet-buding', type: 'feeding', title: '布丁早餐', time: '08:00', instruction: '猫粮 40g 拌半勺鸡肉罐头' },
  { id: 't-xueqiu-feed', petId: 'pet-xueqiu', type: 'feeding', title: '雪球补草与蔬菜', time: '09:00', instruction: '提摩西草加满，油麦菜两片洗净擦干' },
  { id: 't-buding-clean', petId: 'pet-buding', type: 'cleaning', title: '清理猫砂盆', time: '10:00', instruction: '结团铲净，不足时补豆腐砂至 5cm' },
  { id: 't-xueqiu-med', petId: 'pet-xueqiu', type: 'medication', title: '雪球肠胃药', time: '12:00', instruction: '益生菌半包拌入少量温水，针管喂服' },
  { id: 't-xueqiu-clean', petId: 'pet-xueqiu', type: 'cleaning', title: '清洁兔笼', time: '16:00', instruction: '更换厕所垫料，刷洗水壶并换凉白开' },
  { id: 't-kele-feed-pm', petId: 'pet-kele', type: 'feeding', title: '可乐晚餐', time: '18:00', instruction: '狗粮 120g，饭后半小时内不要剧烈运动' },
  { id: 't-buding-feed-pm', petId: 'pet-buding', type: 'feeding', title: '布丁晚餐', time: '18:30', instruction: '猫粮 40g，观察食欲并记录' },
  { id: 't-kele-walk-pm', petId: 'pet-kele', type: 'walking', title: '傍晚遛狗', time: '19:30', instruction: '沿河步道 30 分钟，回家擦脚' },
  { id: 't-buding-med', petId: 'pet-buding', type: 'medication', title: '布丁滴眼液', time: '21:00', instruction: '左右眼各一滴，滴后轻按眼角 10 秒' }
];

/** 生成演示用的历史交接记录（相对今天的前两天/昨天/今天） */
export function seedRecords(now: Date = new Date()): CompletionRecord[] {
  const today = toDateKey(now);
  const yesterday = shiftDateKey(today, -1);
  const dayBefore = shiftDateKey(today, -2);

  const at = (date: string, time: string) => new Date(`${date}T${time}:00`).toISOString();

  const mk = (
    templateId: string,
    date: string,
    taskTitle: string,
    petName: string,
    time: string,
    by: string,
    note: string,
    duplicate = false
  ): CompletionRecord => ({
    id: `seed-${templateId}-${date}-${time.replace(':', '')}`,
    instanceId: makeInstanceId(templateId, date),
    date,
    taskTitle,
    petName,
    completedAt: at(date, time),
    completedBy: by,
    note,
    duplicate
  });

  return [
    mk('t-kele-walk-am', dayBefore, '晨间遛狗', '可乐', '07:15', '老周', '在草坪玩了会儿飞盘'),
    mk('t-kele-feed-am', dayBefore, '可乐早餐', '可乐', '07:45', '老周', '营养粉已拌入'),
    mk('t-buding-feed-am', dayBefore, '布丁早餐', '布丁', '08:10', '阿梅', '罐头只吃了三分之二'),
    mk('t-xueqiu-med', dayBefore, '雪球肠胃药', '雪球', '12:05', '小林', '喂服顺利'),
    mk('t-kele-walk-am', yesterday, '晨间遛狗', '可乐', '07:10', '小林', '下过雨，走了短圈'),
    mk('t-buding-feed-am', yesterday, '布丁早餐', '布丁', '08:05', '阿梅', ''),
    mk('t-buding-clean', yesterday, '清理猫砂盆', '布丁', '10:20', '阿梅', '已补新砂'),
    mk('t-xueqiu-clean', yesterday, '清洁兔笼', '雪球', '16:30', '老周', '水壶已刷洗'),
    mk('t-kele-walk-pm', yesterday, '傍晚遛狗', '可乐', '19:40', '阿凯', '回家已擦脚'),
    mk('t-buding-med', yesterday, '布丁滴眼液', '布丁', '21:05', '阿梅', '左眼有点红，继续观察'),
    mk('t-buding-med', yesterday, '布丁滴眼液', '布丁', '21:40', '小林', '不知道已滴过，补滴了一次', true),
    mk('t-kele-walk-am', today, '晨间遛狗', '可乐', '07:20', '老周', '精神状态好'),
    mk('t-buding-feed-am', today, '布丁早餐', '布丁', '08:00', '阿梅', '今天胃口不错')
  ];
}
