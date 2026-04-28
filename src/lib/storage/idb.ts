// Tiny Promise-wrapper over IndexedDB. No deps.
// One DB, one object store ("audio"): key = assetId (sha256), value = ArrayBuffer.

const DB_NAME = "melo-audio-cache";
const DB_VERSION = 1;
const STORE = "audio";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDB().then((db) => db.transaction(STORE, mode).objectStore(STORE));
}

export async function idbGet(key: string): Promise<ArrayBuffer | null> {
  const store = await tx("readonly");
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve((req.result as ArrayBuffer | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPut(key: string, value: ArrayBuffer): Promise<void> {
  const store = await tx("readwrite");
  return new Promise((resolve, reject) => {
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function idbDelete(key: string): Promise<void> {
  const store = await tx("readwrite");
  return new Promise((resolve, reject) => {
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function idbHas(key: string): Promise<boolean> {
  const store = await tx("readonly");
  return new Promise((resolve, reject) => {
    const req = store.getKey(key);
    req.onsuccess = () => resolve(req.result !== undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function idbClearAll(): Promise<void> {
  const store = await tx("readwrite");
  return new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Approximate total bytes used by the whole origin (browser-reported). */
export async function idbEstimateBytes(): Promise<number> {
  if (!navigator.storage?.estimate) return 0;
  const { usage } = await navigator.storage.estimate();
  return usage ?? 0;
}
