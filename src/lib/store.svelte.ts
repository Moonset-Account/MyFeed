import type { CareEvent, CareType, Plant, Postponement } from './types';
import type { BackupData } from './backup';
import { addDays, todayStr } from './care';

const STORAGE_KEY = 'balcony-plant-calendar-v1';

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function seedData(): BackupData {
  const today = todayStr();
  const monstera: Plant = {
    id: uid(),
    name: '龟背竹',
    species: 'Monstera deliciosa',
    icon: '🪴',
    light: 'bright-indirect',
    waterIntervalDays: 7,
    fertilizeIntervalDays: 30,
    createdAt: addDays(today, -40)
  };
  const succulent: Plant = {
    id: uid(),
    name: '玉露',
    species: 'Haworthia cooperi',
    icon: '🌵',
    light: 'half-sun',
    waterIntervalDays: 12,
    fertilizeIntervalDays: null,
    createdAt: addDays(today, -60)
  };
  const events: CareEvent[] = [
    { id: uid(), plantId: monstera.id, type: 'water', date: addDays(today, -8), note: '' },
    { id: uid(), plantId: monstera.id, type: 'fertilize', date: addDays(today, -20), note: '稀释液肥' },
    { id: uid(), plantId: succulent.id, type: 'water', date: addDays(today, -5), note: '' },
    { id: uid(), plantId: succulent.id, type: 'repot', date: addDays(today, -60), note: '换入颗粒土' }
  ];
  return { plants: [monstera, succulent], events, postponements: [] };
}

function load(): BackupData {
  if (typeof localStorage === 'undefined') return seedData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = seedData();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    const data = JSON.parse(raw) as BackupData;
    return {
      plants: data.plants ?? [],
      events: data.events ?? [],
      postponements: data.postponements ?? []
    };
  } catch {
    return seedData();
  }
}

function createStore() {
  const initial = load();
  let plants = $state<Plant[]>(initial.plants);
  let events = $state<CareEvent[]>(initial.events);
  let postponements = $state<Postponement[]>(initial.postponements);

  function persist() {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ plants, events, postponements }));
  }

  return {
    get plants() {
      return plants;
    },
    get events() {
      return events;
    },
    get postponements() {
      return postponements;
    },

    addPlant(input: Omit<Plant, 'id' | 'createdAt'>): Plant {
      const plant: Plant = { ...input, id: uid(), createdAt: todayStr() };
      plants = [...plants, plant];
      persist();
      return plant;
    },

    updatePlant(id: string, patch: Partial<Omit<Plant, 'id'>>) {
      plants = plants.map((p) => (p.id === id ? { ...p, ...patch } : p));
      persist();
    },

    removePlant(id: string) {
      plants = plants.filter((p) => p.id !== id);
      events = events.filter((e) => e.plantId !== id);
      postponements = postponements.filter((p) => p.plantId !== id);
      persist();
    },

    /** 记录一次实际完成的养护 */
    addEvent(plantId: string, type: CareType, date: string, note = '') {
      events = [...events, { id: uid(), plantId, type, date, note }];
      persist();
    },

    removeEvent(eventId: string) {
      events = events.filter((e) => e.id !== eventId);
      persist();
    },

    /** 阴雨顺延：只新增顺延记录，不产生浇水事件，待办仍然挂起 */
    postpone(plantId: string, days: number, reason: string) {
      postponements = [
        ...postponements,
        { id: uid(), plantId, days, reason, createdAt: todayStr() }
      ];
      persist();
    },

    exportData(): BackupData {
      return { plants, events, postponements };
    },

    importData(data: BackupData) {
      plants = data.plants;
      events = data.events;
      postponements = data.postponements;
      persist();
    }
  };
}

export const store = createStore();
