import { writable } from 'svelte/store';

/** 当前正在拖拽的宾客 id（dragover 阶段读不到 dataTransfer，故用 store 传递） */
export const draggedGuestId = writable<string | null>(null);
