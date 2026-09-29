import type { AppState } from '../types';
import { DEFAULT_THRESHOLDS } from './rules';

const STORAGE_KEY = 'accessible-home-checklist/v1';

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createId(): string {
  return uid();
}

const DEFAULT_AREA_NAMES = ['玄关', '客厅', '卫生间', '卧室', '厨房', '阳台'];

export function createDefaultState(): AppState {
  return {
    version: 1,
    thresholds: { ...DEFAULT_THRESHOLDS },
    areas: DEFAULT_AREA_NAMES.map((name) => ({
      id: uid(),
      name,
      doorWidth: null,
      passageWidth: null,
      stepHeight: null,
      notes: '',
    })),
    issues: [],
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.version !== 1 || !Array.isArray(parsed.areas) || !Array.isArray(parsed.issues)) {
      return createDefaultState();
    }
    return { ...parsed, thresholds: { ...DEFAULT_THRESHOLDS, ...parsed.thresholds } };
  } catch {
    return createDefaultState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 照片较多时可能超出 localStorage 配额，静默失败避免打断操作
  }
}

/** 读取图片文件并压缩为 dataURL，控制本地存储体积 */
export function fileToPhotoDataUrl(file: File, maxSize = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('图片解析失败'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
