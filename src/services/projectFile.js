import { updateProject } from "./projects";

const KEY = (projectId) => `biblio:project:${projectId}:file`;

export async function loadProjectFile(projectId) {
  if (!projectId) return null;
  try {
    const raw = localStorage.getItem(KEY(projectId));
    if (!raw) return null;
    const obj = JSON.parse(raw);
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
    localStorage.setItem(KEY(projectId), JSON.stringify(payload));
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
    localStorage.removeItem(KEY(projectId));
    window.dispatchEvent(new CustomEvent("biblio:project:file:changed", { detail: { projectId } }));
  } catch {}
}
