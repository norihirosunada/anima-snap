import type { AlbumPhoto, AnimismObject, Memory, PhotoLocation } from './types';

const COLLECTIONS_KEY = 'animism_snap_collections';
const MEMORIES_KEY = 'animism_snap_memories';

function createAlbumPhoto(url: string, timestamp: number, source: AlbumPhoto['source'], location?: PhotoLocation): AlbumPhoto {
  return {
    id: crypto.randomUUID(),
    url,
    timestamp,
    source,
    ...(location ? { location } : {}),
  };
}

function normalizeObject(obj: AnimismObject): { normalized: AnimismObject; changed: boolean } {
  let changed = false;
  const photos: AlbumPhoto[] = Array.isArray(obj.albumPhotos) ? [...obj.albumPhotos] : [];

  if (!Array.isArray(obj.albumPhotos)) {
    changed = true;
  }

  if (obj.snapshotUrl && !photos.some((photo) => photo.url === obj.snapshotUrl)) {
    photos.unshift(createAlbumPhoto(obj.snapshotUrl, obj.capturedAt || Date.now(), 'initial'));
    changed = true;
  }

  if (photos.length === 0 && obj.snapshotUrl) {
    photos.push(createAlbumPhoto(obj.snapshotUrl, obj.capturedAt || Date.now(), 'initial'));
    changed = true;
  }

  if (photos.length > 0 && obj.snapshotUrl !== photos[photos.length - 1].url) {
    changed = true;
  }

  const normalized: AnimismObject = {
    ...obj,
    albumPhotos: photos,
    snapshotUrl: photos.length > 0 ? photos[photos.length - 1].url : obj.snapshotUrl,
  };

  return { normalized, changed };
}

export function getCollections(): Record<string, AnimismObject> {
  try {
    const raw = localStorage.getItem(COLLECTIONS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, AnimismObject>) : {};
    let changed = false;
    const normalizedEntries = Object.entries(parsed).map(([id, obj]) => {
      const result = normalizeObject(obj);
      if (result.changed) changed = true;
      return [id, result.normalized] as const;
    });
    const normalized = Object.fromEntries(normalizedEntries);
    if (changed) {
      localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(normalized));
    }
    return normalized;
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
  collections[obj.id] = normalizeObject(obj).normalized;
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
}

export function deleteObject(id: string): void {
  const collections = getCollections();
  if (!collections[id]) return;

  delete collections[id];
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));

  const memories = getMemories().filter((memory) => memory.objectId !== id);
  localStorage.setItem(MEMORIES_KEY, JSON.stringify(memories));
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

export function addObjectPhoto(id: string, snapshotUrl: string, location?: PhotoLocation): AnimismObject | null {
  const collections = getCollections();
  const target = collections[id];
  if (!target) return null;

  const nextPhotos = [
    ...(target.albumPhotos ?? []),
    createAlbumPhoto(snapshotUrl, Date.now(), 're-encounter', location),
  ];

  const updated: AnimismObject = {
    ...target,
    snapshotUrl,
    albumPhotos: nextPhotos,
  };
  collections[id] = updated;
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
  return updated;
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
