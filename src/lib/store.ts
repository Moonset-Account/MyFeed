import type {
  Book,
  Chapter,
  ClubState,
  Excerpt,
  ExcerptComment,
  Member,
  ProgressStatus,
  Question,
} from '../types';
import { parseBackup } from './reading';
import { createSampleState } from './sample';

export type Action =
  | { type: 'addBook'; book: Book }
  | { type: 'addChapter'; bookId: string; chapter: Chapter }
  | { type: 'setDiscussionDate'; bookId: string; chapterId: string; date?: string }
  | { type: 'setMinutes'; bookId: string; chapterId: string; minutes: string }
  | {
      type: 'setProgress';
      memberId: string;
      bookId: string;
      chapterId: string;
      status: ProgressStatus;
      now: string;
    }
  | { type: 'addExcerpt'; excerpt: Excerpt }
  | { type: 'addComment'; excerptId: string; comment: ExcerptComment }
  | { type: 'addQuestion'; question: Question }
  | { type: 'addMember'; member: Member }
  | { type: 'setCurrentMember'; memberId: string }
  | { type: 'replaceAll'; state: ClubState };

function patchChapter(
  state: ClubState,
  bookId: string,
  chapterId: string,
  patch: Partial<Chapter>,
): ClubState {
  return {
    ...state,
    books: state.books.map((b) =>
      b.id !== bookId
        ? b
        : {
            ...b,
            chapters: b.chapters.map((c) => (c.id === chapterId ? { ...c, ...patch } : c)),
          },
    ),
  };
}

export function reducer(state: ClubState, action: Action): ClubState {
  switch (action.type) {
    case 'addBook':
      return { ...state, books: [...state.books, action.book] };
    case 'addChapter':
      return {
        ...state,
        books: state.books.map((b) =>
          b.id === action.bookId ? { ...b, chapters: [...b.chapters, action.chapter] } : b,
        ),
      };
    case 'setDiscussionDate':
      return patchChapter(state, action.bookId, action.chapterId, {
        discussionDate: action.date,
      });
    case 'setMinutes':
      return patchChapter(state, action.bookId, action.chapterId, { minutes: action.minutes });
    case 'setProgress': {
      const rest = state.progress.filter(
        (p) => !(p.memberId === action.memberId && p.chapterId === action.chapterId),
      );
      return {
        ...state,
        progress: [
          ...rest,
          {
            memberId: action.memberId,
            bookId: action.bookId,
            chapterId: action.chapterId,
            status: action.status,
            updatedAt: action.now,
          },
        ],
      };
    }
    case 'addExcerpt':
      return { ...state, excerpts: [...state.excerpts, action.excerpt] };
    case 'addComment':
      return {
        ...state,
        excerpts: state.excerpts.map((e) =>
          e.id === action.excerptId
            ? { ...e, comments: [...e.comments, action.comment] }
            : e,
        ),
      };
    case 'addQuestion':
      return { ...state, questions: [...state.questions, action.question] };
    case 'addMember':
      return { ...state, members: [...state.members, action.member] };
    case 'setCurrentMember':
      return { ...state, currentMemberId: action.memberId };
    case 'replaceAll':
      return action.state;
    default:
      return state;
  }
}

export const STORAGE_KEY = 'reading-club-state-v1';

/** 启动时读取本地存档；无存档或存档损坏时载入示例书目 */
export function loadState(): ClubState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return parseBackup(raw);
  } catch {
    // 存档损坏时回退到示例数据
  }
  return createSampleState(new Date());
}
