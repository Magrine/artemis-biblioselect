import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { useProjectState } from "../hooks/useProjectState";
import { loadProjectFile } from "../services/projectFile";
import { loadLocalCacheFile } from "../services/localCacheFile";

// mesma normalização usada no Filtering
import { normalizeRow } from "../utils/csv";

/**
 * Lê:
 * - projectId (URL ?project= ou localStorage)
 * - UI do projeto (úteis/descartados)
 * - CSV do projeto (projectFile.local) ou cache local anônimo
 * Retorna allRows (normalizados), usefulIdsArr/hiddenIdsArr e usefulItems prontos.
 */
export function useProjectData() {
  const search =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();

  const projectId =
    search.get("project") ||
    (typeof window !== "undefined"
      ? localStorage.getItem("biblio:activeProject") || ""
      : "");

  // sempre que identificar um projeto válido, persiste como ativo
  useEffect(() => {
    if (!projectId) return;
    try { localStorage.setItem("biblio:activeProject", projectId); } catch {}
  }, [projectId]);

  // estado leve (úteis/descartados/currentId/etc.)
  const { state: ui } = useProjectState({
    key: "biblio:ui",
    initialValue: {
      query: "",
      sortMode: "cit_desc",
      currentId: null,
      hiddenIdsArr: [],
      usefulIdsArr: [],
    },
    projectId,
  });

  const usefulIdsArr = Array.isArray(ui?.usefulIdsArr) ? ui.usefulIdsArr : [];
  const hiddenIdsArr = Array.isArray(ui?.hiddenIdsArr) ? ui.hiddenIdsArr : [];

  // CSV
  const [allRows, setAllRows] = useState([]); // [{id,title,abstract,cited,doi,raw}]
  const [rawHeaders, setRawHeaders] = useState([]);
  const [loadingCsv, setLoadingCsv] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fromProject = async () => {
      setLoadingCsv(true);
      try {
        const text = await loadProjectFile(projectId);
        if (text) {
          const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
          const data = parsed.data || [];
          if (data.length) {
            const rows = data.map((row, i) => normalizeRow(row, i));
            if (!cancelled) {
              setAllRows(rows);
              setRawHeaders(Array.isArray(parsed.meta?.fields) ? parsed.meta.fields : Object.keys(data[0]));
            }
            return true;
          }
        }
        return false;
      } finally {
        if (!cancelled) setLoadingCsv(false);
      }
    };

    const fromLocalCache = async () => {
      try {
        const cached = await loadLocalCacheFile();
        if (!cached) return false;
        const { data = [], headers = [] } = cached;
        if (!Array.isArray(data) || !data.length) return false;
        const rows = data.map((row, i) => normalizeRow(row, i));
        if (!cancelled) {
          setAllRows(rows);
          setRawHeaders(headers.length ? headers : Object.keys(data[0]));
        }
        return true;
      } catch {
        return false;
      }
    };

    (async () => {
      if (projectId) {
        const ok = await fromProject();
        if (!ok) await fromLocalCache();
      } else {
        await fromLocalCache();
      }
    })();

    return () => { cancelled = true; };
  }, [projectId]);

  const usefulSet = useMemo(() => new Set(usefulIdsArr), [usefulIdsArr]);
  const usefulItems = useMemo(() => allRows.filter(r => usefulSet.has(r.id)), [allRows, usefulSet]);

  return {
    projectId,
    loadingCsv,
    allRows,
    rawHeaders,
    usefulItems,
    usefulIdsArr,
    hiddenIdsArr,
  };
}