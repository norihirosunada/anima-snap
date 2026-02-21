import type { AnimismObject, Memory } from './types';

const COLLECTIONS_KEY = 'animism_snap_collections';
const MEMORIES_KEY = 'animism_snap_memories';

export function getCollections(): Record<string, AnimismObject> {
  try {
    const raw = localStorage.getItem(COLLECTIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getCollectionList(): AnimismObject[] {
  const collections = getCollections();
  return Object.values(collections).sort((a, b) => b.capturedAt - a.capturedAt);
}

export function getObject(id: string): AnimismObject | null {
  const collections = getCollections();
  return collections[id] ?? null;
}

export function saveObject(obj: AnimismObject): void {
  const collections = getCollections();
  collections[obj.id] = obj;
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
}

export function updateAffinity(id: string, delta: number): void {
  const collections = getCollections();
  if (!collections[id]) return;
  collections[id].affinity = Math.min(100, Math.max(0, collections[id].affinity + delta));
  collections[id].stats.lastSeenAt = Date.now();
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
}

export function recordEncounter(id: string): void {
  const collections = getCollections();
  if (!collections[id]) return;
  collections[id].stats.totalEncounters += 1;
  collections[id].stats.lastSeenAt = Date.now();
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
}

export function getMemories(objectId?: string): Memory[] {
  try {
    const raw = localStorage.getItem(MEMORIES_KEY);
    const all: Memory[] = raw ? JSON.parse(raw) : [];
    if (objectId) return all.filter((m) => m.objectId === objectId);
    return all;
  } catch {
    return [];
  }
}

export function addMemory(memory: Omit<Memory, 'id'>): Memory {
  const memories = getMemories();
  const newMemory: Memory = { ...memory, id: crypto.randomUUID() };
  memories.push(newMemory);
  // keep max 500 memories
  const trimmed = memories.slice(-500);
  localStorage.setItem(MEMORIES_KEY, JSON.stringify(trimmed));
  return newMemory;
}
