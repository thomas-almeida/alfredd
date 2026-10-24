"use client";

const DB_NAME = "alfredd-preferences";
const STORE_NAME = "handles";
const HANDLE_KEY = "download-directory";

type DirectoryHandleLike = {
  name: string;
  queryPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState>;
  getFileHandle: (name: string, options: { create: boolean }) => Promise<{
    createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
  }>;
};

function supported() {
  return typeof window !== "undefined" && "showDirectoryPicker" in window && typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Não foi possível abrir as preferências locais."));
  });
}

async function readHandle(): Promise<DirectoryHandleLike | null> {
  if (!supported()) return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(HANDLE_KEY);
    request.onsuccess = () => resolve((request.result as DirectoryHandleLike | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Não foi possível ler a pasta configurada."));
  });
}

async function writeHandle(handle: DirectoryHandleLike) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(handle, HANDLE_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Não foi possível salvar a pasta configurada."));
  });
}

async function permission(handle: DirectoryHandleLike, request: boolean) {
  const options = { mode: "readwrite" as const };
  const current = await handle.queryPermission?.(options);
  if (current === "granted") return true;
  if (!request || !handle.requestPermission) return false;
  return (await handle.requestPermission(options)) === "granted";
}

export function canChooseDownloadDirectory() {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export async function chooseDownloadDirectory(): Promise<string> {
  if (!supported()) throw new Error("Seu navegador não permite escolher uma pasta de download.");
  const picker = (window as Window & { showDirectoryPicker?: (options?: { mode: "readwrite" }) => Promise<DirectoryHandleLike> }).showDirectoryPicker;
  if (!picker) throw new Error("Seu navegador não permite escolher uma pasta de download.");
  const handle = await picker({ mode: "readwrite" });
  if (!(await permission(handle, true))) throw new Error("Permissão negada para gravar nessa pasta.");
  await writeHandle(handle);
  return handle.name;
}

export async function getDownloadDirectoryName(): Promise<string | null> {
  const handle = await readHandle();
  return handle && await permission(handle, false) ? handle.name : null;
}

/** Tenta salvar localmente; retorna false para usar o download padrão do navegador. */
export async function saveToDownloadDirectory(blob: Blob, fileName: string): Promise<boolean> {
  const handle = await readHandle();
  if (!handle || !(await permission(handle, true))) return false;
  const file = await handle.getFileHandle(fileName, { create: true });
  const writable = await file.createWritable();
  await writable.write(blob);
  await writable.close();
  return true;
}
