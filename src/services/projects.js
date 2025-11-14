// src/services/projects.js

const LS_KEY = "biblio:projects";
const ACTIVE_KEY = "biblio:activeProject";

/* ================= utils ================= */

function nowTs() {
  return new Date().toISOString();
}

function uid() {
  // id curto e suficiente para uso local
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

function readAll() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? safeParse(raw, []) : [];
  } catch {
    return [];
  }
}

function writeAll(arr) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
  } catch {
    // Se falhar (quota etc.), não interrompe a UI.
  }
  // notifica a MESMA aba (o evento 'storage' só dispara em OUTRAS abas)
  try {
    window.dispatchEvent(new CustomEvent("projects:changed"));
  } catch {
    // silencioso
  }
}

function sortByUpdatedAtDesc(a, b) {
  return (b.updatedAt || "").localeCompare(a.updatedAt || "");
}

/* ================= API ================= */

/**
 * Assina a lista de projetos salvos localmente.
 * @param {*} _uidIgnored — Sem auth: ignorado
 * @param {(items: any[]) => void} onNext
 * @param {(err: any) => void} onError
 * @returns {() => void} unsubscribe
 */
export function listenUserProjects(_uidIgnored, onNext, onError) {
  try {
    const emit = () => {
      const items = readAll().sort(sortByUpdatedAtDesc);
      onNext?.(items);
    };

    // Emite imediatamente
    emit();

    // Reage a mudanças:
    // - de outras abas (storage)
    // - desta mesma aba (evento custom)
    const onStorage = (e) => {
      // e.key null em clear(); emite mesmo assim
      if (e.key && e.key !== LS_KEY) return;
      emit();
    };
    const onLocal = () => emit();

    window.addEventListener("storage", onStorage);
    window.addEventListener("projects:changed", onLocal);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("projects:changed", onLocal);
    };
  } catch (err) {
    onError?.(err);
    return () => {};
  }
}

/**
 * Cria um novo projeto local.
 * @param {{ name: string, itemsCount?: number, meta?: any }} input
 * @returns {{ id: string }}
 */
export async function createProject(input) {
  const name = (input?.name || "").trim();
  if (!name) throw new Error("Nome do projeto é obrigatório.");

  const all = readAll();
  const now = nowTs();

  const project = {
    id: uid(),
    name,
    itemsCount: Number.isFinite(input?.itemsCount) ? input.itemsCount : 0,
    meta: input?.meta ?? null,
    createdAt: now,
    updatedAt: now,
  };

  all.push(project);
  writeAll(all);

  return { id: project.id };
}

/**
 * Atualiza parcialmente um projeto.
 * @param {string} id
 * @param {object} patch
 */
export async function updateProject(id, patch) {
  const all = readAll();
  const idx = all.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error("Projeto não encontrado.");

  all[idx] = {
    ...all[idx],
    ...patch,
    updatedAt: nowTs(),
  };

  writeAll(all);
}

/**
 * Remove um projeto da store local.
 * (Opcional) se ele estiver como ativo em biblio:activeProject, limpa a chave.
 * @param {string} id
 */
export async function deleteProject(id) {
  const all = readAll();
  const next = all.filter((p) => p.id !== id);
  writeAll(next);

  try {
    const active = localStorage.getItem(ACTIVE_KEY);
    if (active && active === id) {
      localStorage.removeItem(ACTIVE_KEY);
    }
  } catch {
    // silencioso
  }
}

/**
 * Lê um projeto específico por id.
 * @param {string} id
 * @returns {Promise<any|null>}
 */
export async function getProject(id) {
  const all = readAll();
  return all.find((p) => p.id === id) || null;
}

/**
 * Atualiza a contagem de itens (e o updatedAt).
 * @param {string} id
 * @param {number} count
 */
export async function setItemsCount(id, count) {
  await updateProject(id, { itemsCount: Number(count) || 0 });
}
