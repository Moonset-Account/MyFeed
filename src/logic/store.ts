import type { ProjectState } from '../types';
import { DEFAULT_THRESHOLDS } from './rules';

const STORAGE_KEY = 'accessible-home-checklist/v1';

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULT_AREAS = ['玄关', '客厅', '走廊', '卫生间', '卧室', '厨房', '阳台'];

export function emptyMeasurement() {
  return { doorWidth: null, passageWidth: null, hasStep: false, stepHeight: 0, note: '' };
}

export function createInitialState(): ProjectState {
  return {
    thresholds: { ...DEFAULT_THRESHOLDS },
    areas: DEFAULT_AREAS.map((name) => ({
      id: uid(),
      name,
      measurement: emptyMeasurement(),
    })),
    issues: [],
  };
}

export function loadState(): ProjectState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as ProjectState;
    if (!Array.isArray(parsed.areas) || !Array.isArray(parsed.issues) || !parsed.thresholds) {
      return createInitialState();
    }
    return parsed;
  } catch {
    return createInitialState();
  }
}

export function saveState(state: ProjectState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** 将图片文件压缩为 dataURL，避免 localStorage 超限 */
export function fileToPhotoDataUrl(file: File, maxSide = 960): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('图片解析失败'));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
