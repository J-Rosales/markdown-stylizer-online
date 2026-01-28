const DB_NAME = "mso";
const DB_VERSION = 1;
const STORE_NAME = "images";

export type StoredImage = {
  id: string;
  name: string;
  mime: string;
  size: number;
  createdAt: number;
  blob: Blob;
};

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export const putImage = async (record: StoredImage): Promise<void> => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
};

export const getImage = async (id: string): Promise<StoredImage | null> => {
  const db = await openDb();
  const result = await new Promise<StoredImage | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve((request.result as StoredImage) ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
};
