import type { Book, ClubState, Member } from '../types';
import { toISODate } from './reading';

function id(): string {
  return crypto.randomUUID();
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

/** 示例书目：讨论日期相对载入当天生成，保证提醒面板开箱可见 */
export function createSampleState(now: Date): ClubState {
  const lin: Member = { id: id(), name: '林澜' };
  const chen: Member = { id: id(), name: '陈默' };
  const su: Member = { id: id(), name: '苏晴' };

  const sapiens: Book = {
    id: id(),
    title: '人类简史',
    author: '尤瓦尔·赫拉利',
    createdAt: now.toISOString(),
    chapters: [
      { id: id(), title: '第一章 认知革命', order: 1, discussionDate: toISODate(addDays(now, -2)) },
      { id: id(), title: '第二章 农业革命', order: 2, discussionDate: toISODate(addDays(now, 1)) },
      { id: id(), title: '第三章 人类的融合统一', order: 3, discussionDate: toISODate(addDays(now, 4)) },
      { id: id(), title: '第四章 科学革命', order: 4, discussionDate: toISODate(addDays(now, 8)) },
    ],
  };
  const [c1, c2, c3] = sapiens.chapters;
  c1.minutes =
    '讨论纪要（第一章）：\n1. 大家一致认为「互为主体的现实」是全书的核心概念，国家、货币、公司都建立其上。\n2. 陈默提出：虚构能力是协作规模化的前提，但也可能带来盲从。\n3. 下次讨论聚焦「小麦驯化人类」的反转视角，请带好第二章的摘录。';

  const xiangtu: Book = {
    id: id(),
    title: '乡土中国',
    author: '费孝通',
    createdAt: now.toISOString(),
    chapters: [
      { id: id(), title: '乡土本色', order: 1 },
      { id: id(), title: '文字下乡', order: 2 },
      { id: id(), title: '差序格局', order: 3 },
      { id: id(), title: '礼治秩序', order: 4 },
    ],
  };

  const t = now.toISOString();
  return {
    books: [sapiens, xiangtu],
    members: [lin, chen, su],
    currentMemberId: lin.id,
    progress: [
      { memberId: lin.id, bookId: sapiens.id, chapterId: c1.id, status: 'done', updatedAt: t },
      { memberId: lin.id, bookId: sapiens.id, chapterId: c2.id, status: 'reading', updatedAt: t },
      { memberId: chen.id, bookId: sapiens.id, chapterId: c1.id, status: 'done', updatedAt: t },
      { memberId: chen.id, bookId: sapiens.id, chapterId: c2.id, status: 'done', updatedAt: t },
      { memberId: chen.id, bookId: sapiens.id, chapterId: c3.id, status: 'reading', updatedAt: t },
      { memberId: su.id, bookId: sapiens.id, chapterId: c1.id, status: 'reading', updatedAt: t },
    ],
    excerpts: [
      {
        id: id(),
        bookId: sapiens.id,
        chapterId: c1.id,
        memberId: lin.id,
        text: '国家、金钱和公司，本质上都是集体想象。',
        note: '「互为主体的现实」这一节值得反复读。',
        createdAt: t,
        comments: [
          { id: id(), memberId: chen.id, text: '联想到品牌：消费者共同相信，它才存在。', createdAt: t },
          { id: id(), memberId: su.id, text: '那「想象」崩塌时会怎样？比如货币信用危机。', createdAt: t },
        ],
      },
      {
        id: id(),
        bookId: sapiens.id,
        chapterId: c2.id,
        memberId: chen.id,
        text: '我们并没有驯化小麦，反而是小麦驯化了我们。',
        createdAt: t,
        comments: [
          { id: id(), memberId: su.id, text: '这句话可以当作第二章讨论的引子。', createdAt: t },
        ],
      },
    ],
    questions: [
      {
        id: id(),
        bookId: sapiens.id,
        chapterId: c1.id,
        memberId: su.id,
        text: '「想象的现实」和谎言的边界在哪里？',
        createdAt: t,
      },
      {
        id: id(),
        bookId: sapiens.id,
        chapterId: c3.id,
        memberId: chen.id,
        text: '货币统一全球的故事，放到数字货币时代还成立吗？',
        createdAt: t,
      },
    ],
  };
}
