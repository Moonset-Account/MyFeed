import { writable } from 'svelte/store';
import {
  allocationsFromTemplate,
  chargedCount,
  createId,
  createReturnItem,
  departWithGear,
  evaluateTrip,
  normalizeAllocation,
  normalizeGear,
  normalizeReturnItem,
  readyCount,
  repairTodosFromReturn,
  returnGear,
  summarizeReturn,
  toCount
} from './inventory';
import { loadData, saveData, STORAGE_KEY } from './storage';
import type {
  Allocation,
  AllocationIssue,
  AppData,
  Gear,
  ReturnItem,
  Template,
  Trip
} from './types';

const initialData = loadData();

function persist(data: AppData): AppData {
  saveData(data);
  return data;
}

function update(mutator: (draft: AppData) => AppData | void) {
  store.update((data) => {
    const draft: AppData = structuredClone(data);
    const result = mutator(draft);
    return persist(result ?? draft);
  });
}

function gearMap(gears: Gear[]): Map<string, Gear> {
  return new Map(gears.map((gear) => [gear.id, gear]));
}

export const store = writable<AppData>(initialData);

export const actions = {
  resetDemo() {
    localStorage.removeItem(STORAGE_KEY);
    store.set(loadData());
  },

  replaceData(data: AppData) {
    store.set(persist(structuredClone(data)));
  },

  addGear(input: Omit<Gear, 'id'>) {
    update((data) => {
      data.gears.push(normalizeGear({ ...input, id: createId('gear') }));
    });
  },

  updateGear(id: string, patch: Partial<Gear>) {
    update((data) => {
      const index = data.gears.findIndex((gear) => gear.id === id);
      if (index >= 0) data.gears[index] = normalizeGear({ ...data.gears[index], ...patch, id });
    });
  },

  deleteGear(id: string) {
    update((data) => {
      data.gears = data.gears.filter((gear) => gear.id !== id);
      for (const trip of data.trips) {
        trip.allocations = trip.allocations.filter((allocation) => allocation.gearId !== id);
        if (trip.returnItems) {
          trip.returnItems = trip.returnItems.filter((item) => item.gearId !== id);
        }
      }
      for (const template of data.templates) {
        template.allocations = template.allocations.filter((allocation) => allocation.gearId !== id);
      }
    });
  },

  chargeGear(id: string) {
    update((data) => {
      const gear = data.gears.find((item) => item.id === id);
      if (gear && gear.usesBatteries) gear.uncharged = 0;
    });
  },

  repairOne(id: string) {
    update((data) => {
      const gear = data.gears.find((item) => item.id === id);
      if (gear && gear.damaged > 0) gear.damaged -= 1;
    });
  },

  addTrip(input: { name: string; destination: string; date: string; templateId?: string }) {
    let tripId = '';
    update((data) => {
      const template = data.templates.find((item) => item.id === input.templateId);
      const trip: Trip = {
        id: createId('trip'),
        name: input.name.trim() || '未命名行程',
        destination: input.destination.trim(),
        date: input.date,
        status: '准备中',
        allocations: template ? allocationsFromTemplate(template, data.gears) : []
      };
      tripId = trip.id;
      data.trips.unshift(trip);
    });
    return tripId;
  },

  updateTrip(id: string, patch: Partial<Pick<Trip, 'name' | 'destination' | 'date'>>) {
    update((data) => {
      const trip = data.trips.find((item) => item.id === id);
      if (trip) Object.assign(trip, patch);
    });
  },

  deleteTrip(id: string) {
    update((data) => {
      data.trips = data.trips.filter((trip) => trip.id !== id);
    });
  },

  setAllocation(tripId: string, gearId: string, patch: Partial<Allocation>) {
    update((data) => {
      const trip = data.trips.find((item) => item.id === tripId);
      const gear = data.gears.find((item) => item.id === gearId);
      if (!trip || !gear || trip.status !== '准备中') return;

      const current = trip.allocations.find((item) => item.gearId === gearId);
      const next = normalizeAllocation(gear, {
        gearId,
        quantity: current?.quantity ?? 0,
        charged: current?.charged ?? 0,
        ...patch
      });

      trip.allocations = trip.allocations.filter((item) => item.gearId !== gearId);
      if (next.quantity > 0) trip.allocations.push(next);
    });
  },

  startTrip(tripId: string) {
    update((data) => {
      const trip = data.trips.find((item) => item.id === tripId);
      if (!trip || trip.status !== '准备中') return;

      const gearsBefore = gearMap(data.gears);
      const issues = evaluateTrip([...gearsBefore.values()], trip.allocations);
      if (issues.some((issue) => issue.shortage > 0)) return;

      trip.returnItems = trip.allocations
        .filter((allocation) => allocation.quantity > 0)
        .map((allocation) => createReturnItem(gearsBefore.get(allocation.gearId)!, allocation));

      data.gears = data.gears.map((gear) => {
        const allocation = trip.allocations.find((item) => item.gearId === gear.id);
        return allocation ? departWithGear(gear, allocation) : gear;
      });

      trip.status = '出行中';
      trip.startedAt = new Date().toISOString();
    });
  },

  setReturnItem(tripId: string, gearId: string, patch: Partial<ReturnItem>) {
    update((data) => {
      const trip = data.trips.find((item) => item.id === tripId);
      const gear = data.gears.find((item) => item.id === gearId);
      if (!trip || !gear || trip.status !== '出行中') return;

      const current = trip.returnItems?.find((item) => item.gearId === gearId);
      if (!current) return;
      const index = trip.returnItems!.findIndex((item) => item.gearId === gearId);
      trip.returnItems![index] = normalizeReturnItem(gear, { ...current, ...patch, gearId });
    });
  },

  completeReturn(tripId: string) {
    update((data) => {
      const trip = data.trips.find((item) => item.id === tripId);
      if (!trip || trip.status !== '出行中' || !trip.returnItems) return;

      trip.returnItems = trip.returnItems.map((item) => ({ ...item, checked: true }));
      data.gears = data.gears.map((gear) => {
        const item = trip.returnItems?.find((returnItem) => returnItem.gearId === gear.id);
        return item ? returnGear(gear, item) : gear;
      });

      data.repairTodos.push(...repairTodosFromReturn(trip, data.gears, new Date().toISOString()));
      trip.status = '已归来';
      trip.returnedAt = new Date().toISOString();
    });
  },

  saveTripAsTemplate(tripId: string, name: string) {
    update((data) => {
      const trip = data.trips.find((item) => item.id === tripId);
      if (!trip) return;
      const template: Template = {
        id: createId('template'),
        name: name.trim() || `${trip.name}模板`,
        description: `从 ${trip.name} 保存`,
        allocations: trip.allocations.map((item) => ({ ...item }))
      };
      data.templates.unshift(template);
    });
  },

  updateTemplate(id: string, patch: Partial<Pick<Template, 'name' | 'description'>>) {
    update((data) => {
      const template = data.templates.find((item) => item.id === id);
      if (template) Object.assign(template, patch);
    });
  },

  deleteTemplate(id: string) {
    update((data) => {
      data.templates = data.templates.filter((template) => template.id !== id);
    });
  },

  addRepairTodo(input: { gearId: string; quantity: number; note: string }) {
    update((data) => {
      const { gearId } = input;
      const gear = data.gears.find((item) => item.id === gearId);
      if (!gear) return;
      const reserved = data.repairTodos
        .filter((todo) => !todo.resolved && todo.gearId === gearId)
        .reduce((sum, todo) => sum + todo.quantity, 0);
      const quantity = Math.min(toCount(input.quantity), gear.damaged - reserved);
      if (quantity <= 0) return;
      data.repairTodos.unshift({
        id: createId('repair'),
        gearId,
        quantity,
        note: input.note.trim() || '待维修',
        resolved: false,
        createdAt: new Date().toISOString()
      });
    });
  },

  resolveRepairTodo(id: string) {
    update((data) => {
      const todo = data.repairTodos.find((item) => item.id === id);
      const gear = todo ? data.gears.find((item) => item.id === todo.gearId) : undefined;
      if (!todo || !gear || todo.resolved) return;
      gear.damaged = Math.max(0, gear.damaged - todo.quantity);
      todo.resolved = true;
      todo.resolvedAt = new Date().toISOString();
    });
  },

  reopenRepairTodo(id: string) {
    update((data) => {
      const todo = data.repairTodos.find((item) => item.id === id);
      const gear = todo ? data.gears.find((item) => item.id === todo.gearId) : undefined;
      if (!todo || !gear || !todo.resolved) return;
      gear.damaged = Math.min(gear.total, gear.damaged + todo.quantity);
      todo.resolved = false;
      todo.resolvedAt = undefined;
    });
  },

  deleteRepairTodo(id: string) {
    update((data) => {
      data.repairTodos = data.repairTodos.filter((todo) => todo.id !== id);
    });
  }
};

export function issuesForTrip(gears: Gear[], trip: Trip): AllocationIssue[] {
  return evaluateTrip(gears, trip.allocations);
}

export function returnSummaryForTrip(trip: Trip) {
  return summarizeReturn(trip.returnItems ?? []);
}

export function gearAvailability(gear: Gear) {
  return {
    ready: readyCount(gear),
    charged: chargedCount(gear)
  };
}
