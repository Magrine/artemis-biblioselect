import { updateProject } from "./projects";
import { idbGet, idbSet, idbDelete } from "./idb";

// Project CSV files are persisted in IndexedDB, not localStorage: a single
// Scopus export already exceeds the browser's ~5-10MB localStorage quota
// at realistic sizes (1,000 rows ~= 15MB of raw CSV text), which silently
// failed here before and left the Results dashboard permanently empty.

export async function loadProjectFile(projectId) {
  if (!projectId) return null;
  try {
    const obj = await idbGet(projectId);
    return obj?.csvText || null;
  } catch {
    return null;
  }
}

export async function saveProjectFile({ projectId, csvText, csvHeaders = [], itemsCount = 0, lastFilename = "" }) {
  if (!projectId) return;
  const payload = {
    csvText: String(csvText || ""),
    csvHeaders: Array.isArray(csvHeaders) ? csvHeaders : [],
    itemsCount: Number(itemsCount) || 0,
    lastFilename: lastFilename || "data.csv",
    savedAt: Date.now(),
  };
  try {
    await idbSet(projectId, payload);
    // opcional: refletir contagem no projeto (serviço local de projetos)
    try { await updateProject(projectId, { itemsCount: payload.itemsCount }); } catch {}
    // notificar mesma aba
    window.dispatchEvent(new CustomEvent("biblio:project:file:changed", { detail: { projectId } }));
  } catch (e) {
    console.warn("Falha ao salvar arquivo do projeto:", e);
  }
}

export async function clearProjectFile(projectId) {
  if (!projectId) return;
  try {
    await idbDelete(projectId);
    window.dispatchEvent(new CustomEvent("biblio:project:file:changed", { detail: { projectId } }));
  } catch {}
}
