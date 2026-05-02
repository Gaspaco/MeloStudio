/**
 * IndexedDB store for audio/video clip blobs.
 * Blob URLs (blob:http://...) die on page reload — we persist the raw Blob
 * here so clips survive refreshes and navigation.
 */

const DB_NAME    = "melostudio-clips";
const STORE_NAME = "clips";
const DB_VERSION = 1;

let _db: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess  = () => { _db = req.result; resolve(_db); };
    req.onerror    = () => reject(req.error);
  });
}

/** Persist a file/blob under a clip ID. */
export async function storeClip(clipId: string, blob: Blob): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(blob, clipId);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

/**
 * Restore a clip from IDB.
 * Returns a fresh blob URL (caller is responsible for revoking it),
 * or null if the clip was never stored.
 */
export async function loadClip(clipId: string): Promise<string | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, "readonly")
                  .objectStore(STORE_NAME)
                  .get(clipId);
    req.onsuccess = () => {
      if (!req.result) { resolve(null); return; }
      resolve(URL.createObjectURL(req.result as Blob));
    };
    req.onerror = () => reject(req.error);
  });
}

/** Remove a clip's blob from IDB (call when the clip is deleted). */
export async function removeClip(clipId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(clipId);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}
