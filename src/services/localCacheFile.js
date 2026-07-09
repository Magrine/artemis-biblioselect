import { idbGet, idbSet, idbDelete } from "./idb";

// Same fix as projectFile.js, for the "no active project" fallback path:
// this used to store the whole imported CSV (data + headers) under
// localStorage["biblio:lastFileRaw"], hitting the same ~5-10MB quota wall
// on any realistically sized Scopus export. Moved to IndexedDB.
const KEY = "__anonymous_cache__";

export async function loadLocalCacheFile() {
  try {
    const obj = await idbGet(KEY);
    if (!obj) return null;
    return {
      data: Array.isArray(obj.data) ? obj.data : [],
      headers: Array.isArray(obj.headers) ? obj.headers : [],
    };
  } catch {
    return null;
  }
}

export async function saveLocalCacheFile({ data, headers, filename = "" }) {
  try {
    await idbSet(KEY, {
      data: Array.isArray(data) ? data : [],
      headers: Array.isArray(headers) ? headers : [],
      filename,
      savedAt: Date.now(),
    });
  } catch (e) {
    console.warn("Falha ao salvar cache local:", e);
  }
}

export async function clearLocalCacheFile() {
  try {
    await idbDelete(KEY);
  } catch {}
}
