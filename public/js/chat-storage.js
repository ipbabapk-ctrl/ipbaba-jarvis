const DB_NAME = "IPBABA_JARVIS_LOCAL";
const DB_VERSION = 1;
const STORE_NAME = "conversations";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id"
        });

        store.createIndex("userId", "userId");
        store.createIndex("updatedAt", "updatedAt");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveConversation(userId, conversation) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");

    tx.objectStore(STORE_NAME).put({
      ...conversation,
      userId,
      updatedAt: Date.now()
    });

    tx.oncomplete = () => {
      db.close();
      resolve(true);
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function getConversations(userId) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME)
      .index("userId")
      .getAll(userId);

    request.onsuccess = () => {
      db.close();

      resolve(
        request.result.sort(
          (a, b) => b.updatedAt - a.updatedAt
        )
      );
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function deleteConversation(id, userId) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      const item = request.result;

      if (item && item.userId === userId) {
        store.delete(id);
      }
    };

    tx.oncomplete = () => {
      db.close();
      resolve(true);
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
