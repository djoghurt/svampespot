const DB_NAME = 'svampespot-field-v3';
const DB_VERSION = 1;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore('state');
      database.createObjectStore('photos');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact(storeName, mode, action) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = action(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export const loadState = (key) => transact('state', 'readonly', (store) => store.get(key));
export const saveState = (key, value) => transact(
  'state', 'readwrite', (store) => store.put(value, key),
);
export const savePhoto = (visitId, photo) => transact(
  'photos', 'readwrite', (store) => store.put(photo, visitId),
);
export const loadPhoto = (visitId) => transact(
  'photos', 'readonly', (store) => store.get(visitId),
);
