// src/app/routes/Filtering.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";

import { Navbar } from "../components/layout/Navbar";
import { Container } from "../components/layout/Container";
import { Card, CardBody } from "../components/primitives/Card";
import FormField from "../components/primitives/FormField";
import Input from "../components/primitives/Input";
import Button from "../components/primitives/Button";

// Panels & Utils
import ListPanel from "../components/biblio/ListPanel";
import DetailPanel from "../components/biblio/DetailPanel";
import SelectedPanel from "../components/biblio/SelectedPanel";
import StatsPanel from "../components/biblio/StatsPanel";
import { useNotify } from "../../hooks/useNotify";
import { normalizeRow, csvEscape } from "../../utils/csv";
import { makeHighlighter } from "../../utils/html";

// UI persistence (LOCAL)
import { useProjectState } from "../../hooks/useProjectState";
import artemis from "../../assets/artemis.svg";

// Per-project CSV (local)
import {
  loadProjectFile,
  saveProjectFile,
  clearProjectFile,
} from "../../services/projectFile";

// Projects (local store)
import { deleteProject } from "../../services/projects";

import { useNavigate } from "react-router";

// helper: wipe all local keys related to a project
function wipeProjectLocalKeys(projectId) {
  try {
    const toDelete = new Set();

    // legacy global keys (old versions)
    [
      "biblio:ui",
      "biblio:lastFileRaw",
      "biblio:query",
      "biblio:sort",
      "biblio:currentId",
      "biblio:hidden",
      "biblio:useful",
    ].forEach((k) => toDelete.add(k));

    // per-project keys (new)
    toDelete.add(`biblio:ui:${projectId}`);
    toDelete.add(`biblio:results:tab:${projectId}`);

    // defensive sweep: any other biblio:* key containing the id
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      // only touch this app's keys
      if (!k.startsWith("biblio:")) continue;
      if (k.endsWith(`:${projectId}`) || k.includes(`:${projectId}:`) || k.includes(projectId)) {
        toDelete.add(k);
      }
    }

    toDelete.forEach((k) => localStorage.removeItem(k));
  } catch {""}
}

/* ===========================================================
   Lightweight confirmation modal
   (Good candidate to live in its own component file)
   =========================================================== */
function ConfirmModal({
  open,
  title = "Confirm action",
  description = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "danger",
  onConfirm,
  onClose,
  loading = false,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      try {
        dialogRef.current?.querySelector("button[data-role='confirm']")?.focus();
      } catch {""}
    }, 0);
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "grid",
        placeItems: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        className="modal-card"
        style={{
          width: "100%",
          maxWidth: 520,
          background: "var(--surface, #fff)",
          color: "var(--ink-900, #111827)",
          borderRadius: 12,
          boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: 20, borderBottom: "1px solid var(--ink-200,#e5e7eb)" }}>
          <h3 id="confirm-title" style={{ margin: 0, fontSize: 24, textAlign: "center", fontWeight: 700 }}>
            {title}
          </h3>
        </div>
        <div style={{ padding: 20 }}>
          <p style={{ margin: 0, textAlign: "center", lineHeight: 1.5 }}>{description}</p>
        </div>
        <div
          style={{
            padding: 16,
            display: "flex",
            gap: 8,
            justifyContent: "space-around",
            borderTop: "1px solid var(--ink-200,#e5e7eb)",
          }}
        >
          <Button type="button" variant="primary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            data-role="confirm"
            onClick={onConfirm}
            disabled={loading}
            style={{ minWidth: 120 }}
          >
            {loading ? "Deleting…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ============================
   Main page: Filtering
   (The component is large; CSV/state logic could be extracted
   to custom hooks if it grows further.)
   ============================ */
export default function Filtering() {
  const navigate = useNavigate();

  // ==== projectId via URL or localStorage ====
  const search =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();

  const projectId =
    search.get("project") ||
    (typeof window !== "undefined"
      ? localStorage.getItem("biblio:activeProject") || ""
      : "");

  // whenever there is a valid projectId, persist it as active
  useEffect(() => {
    if (!projectId) return;
    try {
      localStorage.setItem("biblio:activeProject", projectId);
    } catch {""}
  }, [projectId]);

  // ==== Persisted UI state (100% local) ====
  const initialPersist = useMemo(
    () => ({
      query: "",
      sortMode: "cit_desc",
      currentId: null,
      hiddenIdsArr: [],
      usefulIdsArr: [],
    }),
    []
  );

  const {
    state: persist,
    setState: setPersist,
    loading: loadingPersist,
  } = useProjectState({
    key: "biblio:ui",
    initialValue: initialPersist,
    projectId,
  });

  // safe destructuring
  const query = persist?.query ?? "";
  const sortMode = persist?.sortMode ?? "cit_desc";
  const currentId = persist?.currentId ?? null;
  const hiddenIdsArr = Array.isArray(persist?.hiddenIdsArr) ? persist.hiddenIdsArr : [];
  const usefulIdsArr = Array.isArray(persist?.usefulIdsArr) ? persist.usefulIdsArr : [];

  const setQuery = useCallback((v) => setPersist((s) => ({ ...s, query: v })), [setPersist]);
  const setSortMode = useCallback((v) => setPersist((s) => ({ ...s, sortMode: v })), [setPersist]);
  const setCurrentId = useCallback((v) => setPersist((s) => ({ ...s, currentId: v })), [setPersist]);
  const setHiddenIdsArr = useCallback(
    (arr) => setPersist((s) => ({ ...s, hiddenIdsArr: Array.isArray(arr) ? arr : [] })),
    [setPersist]
  );
  const setUsefulIdsArr = useCallback(
    (arr) => setPersist((s) => ({ ...s, usefulIdsArr: Array.isArray(arr) ? arr : [] })),
    [setPersist]
  );

  const hiddenIds = useMemo(() => new Set(hiddenIdsArr), [hiddenIdsArr]);
  const usefulIds = useMemo(() => new Set(usefulIdsArr), [usefulIdsArr]);

  const setHiddenIds = useCallback(
    (updater) => {
      const next = typeof updater === "function" ? updater(new Set(hiddenIdsArr)) : updater;
      setHiddenIdsArr(Array.from(next));
    },
    [hiddenIdsArr, setHiddenIdsArr]
  );

  const setUsefulIds = useCallback(
    (updater) => {
      const next = typeof updater === "function" ? updater(new Set(usefulIdsArr)) : updater;
      setUsefulIdsArr(Array.from(next));
    },
    [usefulIdsArr, setUsefulIdsArr]
  );

  // ==== CSV (session data) ====
  const [allRows, setAllRows] = useState([]); // {id,title,abstract,cited,doi,raw}
  const [rawHeaders, setRawHeaders] = useState([]);
  const [loadingCsv, setLoadingCsv] = useState(false);

  const fileRef = useRef(null);
  const dropRef = useRef(null);
  const notify = useNotify();

  // ==== Delete modal ====
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ==== Derived values ====
  const highlight = useMemo(() => makeHighlighter(query), [query]);

  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    const list = allRows.filter(
      (r) =>
        !hiddenIds.has(r.id) &&
        !usefulIds.has(r.id) &&
        (!q || r.title.toLowerCase().includes(q) || r.abstract.toLowerCase().includes(q))
    );
    list.sort((a, b) => {
      if (sortMode === "cit_desc") return b.cited - a.cited;
      if (sortMode === "cit_asc") return a.cited - b.cited;
      if (sortMode === "title_az") return a.title.localeCompare(b.title);
      if (sortMode === "title_za") return b.title.localeCompare(a.title);
      return 0;
    });
    return list;
  }, [allRows, hiddenIds, usefulIds, query, sortMode]);

  const current = useMemo(
    () => filtered.find((x) => x.id === currentId) ?? filtered[0] ?? null,
    [filtered, currentId]
  );

  const usefulItems = useMemo(() => allRows.filter((x) => usefulIds.has(x.id)), [allRows, usefulIds]);

  const pendingCount = useMemo(
    () => Math.max(0, allRows.length - hiddenIds.size - usefulIds.size),
    [allRows.length, hiddenIds.size, usefulIds.size]
  );

  // ==== Ensure a valid currentId ====
  useEffect(() => {
    if (!filtered.length) {
      if (currentId !== null) setCurrentId(null);
      return;
    }
    if (!filtered.some((x) => x.id === currentId)) {
      setCurrentId(filtered[0].id);
    }
  }, [filtered, currentId, setCurrentId]);

  // ==== Restore CSV: PRIORITY PROJECT (local) > local cache ====
  useEffect(() => {
    let cancelled = false;

    const parseCsvTextAndSet = async (text) =>
      new Promise((resolve, reject) => {
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (res) => {
            const data = res.data || [];
            if (!data.length) {
              setAllRows([]);
              setRawHeaders([]);
              resolve();
              return;
            }
            const rows = data.map((row, i) => normalizeRow(row, i));
            setAllRows(rows);
            setRawHeaders(Array.isArray(res.meta?.fields) ? res.meta.fields : Object.keys(data[0]));
            resolve();
          },
          error: (err) => {
            console.error("Papa.parse error:", err);
            reject(err);
          },
        });
      });

    const restoreFromProject = async () => {
      setLoadingCsv(true);
      try {
        const text = await loadProjectFile(projectId);
        if (text && text.length) {
          await parseCsvTextAndSet(text);
          if (!cancelled) notify("Project file loaded (local).");
          return true;
        }
        return false;
      } catch (e) {
        console.warn("Failed to load project CSV:", e);
        return false;
      } finally {
        if (!cancelled) setLoadingCsv(false);
      }
    };

    const restoreFromLocal = async () => {
      try {
        const raw = localStorage.getItem("biblio:lastFileRaw");
        if (!raw) return false;
        const { data = [], headers = [] } = JSON.parse(raw);
        if (!Array.isArray(data) || !data.length) return false;

        const rows = data.map((row, i) => normalizeRow(row, i));
        if (!cancelled) {
          setAllRows(rows);
          setRawHeaders(headers.length ? headers : Object.keys(data[0] || {}));
          notify("File restored from local cache.");
        }
        return true;
      } catch (e) {
        console.warn("Failed to restore local cache:", e);
        return false;
      }
    };

    (async () => {
      if (projectId) {
        const ok = await restoreFromProject();
        if (!ok) await restoreFromLocal();
      } else {
        await restoreFromLocal();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, notify]);

  // ==== Drag & drop ====
  useEffect(() => {
    const onDrag = (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const onDrop = (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFile(file);
    };
    const el = dropRef.current || document;
    el.addEventListener("dragenter", onDrag);
    el.addEventListener("dragover", onDrag);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragenter", onDrag);
      el.removeEventListener("dragover", onDrag);
      el.removeEventListener("drop", onDrop);
    };
  }, []); // eslint-disable-line

  // ==== Load new CSV ====
  const handleFile = useCallback(
    (file) => {
      if (!/\.csv$/i.test(file.name)) {
        notify("Please select a .csv file.");
        return;
      }
      setLoadingCsv(true);

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
        complete: async (res) => {
          try {
            const data = res.data || [];
            const headers = Array.isArray(res.meta?.fields)
              ? res.meta.fields
              : data[0]
              ? Object.keys(data[0])
              : [];

            if (!data.length) {
              setAllRows([]);
              setRawHeaders([]);
              notify("Empty file.");
              return;
            }

            const rows = data.map((row, i) => normalizeRow(row, i));
            setAllRows(rows);
            setRawHeaders(headers);
            notify("File loaded!");

            const text = await file.text();

            if (projectId) {
              await saveProjectFile({
                projectId,
                csvText: text,
                csvHeaders: headers,
                itemsCount: rows.length,
                lastFilename: file.name || "data.csv",
              });
            } else {
              try {
                const toSave = {
                  headers,
                  data,
                  savedAt: Date.now(),
                  filename: file.name || "",
                };
                localStorage.setItem("biblio:lastFileRaw", JSON.stringify(toSave));
              } catch {""}
            }
          } catch (err) {
            console.error(err);
            notify("Failed to process CSV.");
          } finally {
            setLoadingCsv(false);
            if (fileRef.current) fileRef.current.value = "";
          }
        },
        error: (err) => {
          console.error(err);
          setLoadingCsv(false);
          notify("Failed to read CSV. Check the browser console for details.");
          if (fileRef.current) fileRef.current.value = "";
        },
      });
    },
    [notify, projectId]
  );

  const onFileInput = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = "";
    },
    [handleFile]
  );

  // ==== Actions ====
  const copyRef = useCallback(
    async (id) => {
      const r = allRows.find((x) => x.id === id);
      if (!r) return;
      const text = `${r.title} — DOI: ${r.doi || "N/A"} — Citations: ${r.cited}`;
      try {
        await navigator.clipboard.writeText(text);
        notify("Reference copied!");
      } catch {
        notify("Could not copy.");
      }
    },
    [allRows, notify]
  );

  const markNotUseful = useCallback(
    (id) => {
      setHiddenIds((s) => new Set([...s, id]));
      setUsefulIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      notify("Article removed from the list.");
    },
    [setHiddenIds, setUsefulIds, notify]
  );

  const addUseful = useCallback(
    (id) => {
      setUsefulIds((s) => new Set([...s, id]));
      notify("Added to useful.");
    },
    [setUsefulIds, notify]
  );

  const removeUseful = useCallback(
    (id) =>
      setUsefulIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      }),
    [setUsefulIds]
  );

  // ==== Download CSV (only useful items) ====
  const downloadUsefulCsv = useCallback(() => {
    if (!usefulItems.length) {
      notify("No useful items to download.");
      return;
    }

    const headers = rawHeaders.length ? rawHeaders : Object.keys(usefulItems[0].raw || {});
    const lines = [headers.join(",")];
    for (const r of usefulItems) {
      const raw = r.raw || {};
      const cols = headers.map((h) => csvEscape(raw[h] ?? ""));
      lines.push(cols.join(","));
    }

    const BOM = "\uFEFF";
    const csvText = BOM + lines.join("\r\n");

    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "selected_items.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [usefulItems, rawHeaders, notify]);

  // ==== RESET SESSION ====
  const handleFinalize = useCallback(() => {
    try {
      localStorage.removeItem("biblio:lastFileRaw");
      localStorage.removeItem("biblio:ui");
      localStorage.removeItem("biblio:query");
      localStorage.removeItem("biblio:sort");
      localStorage.removeItem("biblio:currentId");
      localStorage.removeItem("biblio:hidden");
      localStorage.removeItem("biblio:useful");
      if (projectId) clearProjectFile(projectId).catch(() => {});
    } catch {""}

    setPersist(() => ({
      query: "",
      sortMode: "cit_desc",
      currentId: null,
      itemsCount: 0,
      hiddenIdsArr: [],
      usefulIdsArr: [],
    }));

    setAllRows([]);
    setRawHeaders([]);
    notify("Session cleared: selected items, hidden items, and file have been reset.");

    if (fileRef.current) fileRef.current.value = "";
  }, [setPersist, notify, projectId]);

  // ==== Navigation: Back & Results ====
  const handleBack = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const handleResults = useCallback(() => {
    navigate("/results");
  }, [navigate]);

  // ==== Delete project (open modal) ====
  const handleDeleteProject = useCallback(() => {
    if (!projectId) {
      notify("No active project to delete.");
      return;
    }
    setDeleteOpen(true);
  }, [projectId, notify]);

  // ==== Confirm delete (modal action) ====
  const confirmDeleteProject = useCallback(
    async () => {
      if (!projectId) {
        setDeleteOpen(false);
        return;
      }
      try {
        setDeleteLoading(true);

        // 1) delete project CSV file (if any)
        await clearProjectFile(projectId).catch(() => {});

        // 2) remove the project from the list
        await deleteProject(projectId);

        // 3) clear active project + all related local keys
        try {
          localStorage.removeItem("biblio:activeProject");
          wipeProjectLocalKeys(projectId);
        } catch {""}

        // 4) reset state
        setPersist(() => ({ ...initialPersist }));
        setAllRows([]);
        setRawHeaders([]);

        notify("Project deleted successfully.");
        setDeleteOpen(false);
        navigate("/");
      } catch (err) {
        console.error("Error deleting project:", err);
        notify("Failed to delete project. Check the console for details.");
        setDeleteOpen(false);
      } finally {
        setDeleteLoading(false);
      }
    },
    [projectId, setPersist, initialPersist, notify, navigate]
  );

  // ==== Logo -> Home ====
  const handleLogoClick = useCallback((e) => {
    e.preventDefault();
    if (window?.location) window.location.assign("/");
  }, []);

  const showDeleteButton = Boolean(projectId); // show even if CSV is not loaded

  return (
    <div className="page-full" ref={dropRef}>
      {/* NAVBAR */}
      <Navbar>
        <a className="brand" href="/" onClick={handleLogoClick}>
          <img src={artemis} alt="Artemis logo" style={{ height: 32 }} />
          <span>ARTEMIS • BiblioSelect</span>
        </a>
        <div className="spacer" />

        <input
          ref={fileRef}
          id="fileInput"
          type="file"
          accept=".csv,text/csv"
          onChange={onFileInput}
          style={{ display: "none" }}
        />

        {allRows.length > 0 ? (
          <>
            <Button type="button" variant="secondary" onClick={handleBack}>
              Back
            </Button>

            <Button
              type="button"
              variant="primary"
              onClick={handleFinalize}
              style={{ marginLeft: 8 }}
            >
              Reset
            </Button>

            {showDeleteButton && (
              <Button
                type="button"
                variant="red"
                onClick={handleDeleteProject}
                style={{ marginLeft: 8 }}
                title="Delete current project and clear data"
              >
                Delete Project
              </Button>
            )}

            <Button
              type="button"
              variant="copper"
              onClick={handleResults}
              disabled={pendingCount !== 0}
              style={{ marginLeft: 8 }}
              title={
                pendingCount === 0
                  ? "Open results"
                  : `Classify all items first (${pendingCount} pending)`
              }
            >
              Results
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileRef.current?.click()}
              disabled={loadingCsv}
            >
              {loadingCsv ? "Loading…" : (
                <>
                  Upload <strong>CSV</strong>
                </>
              )}
            </Button>

            {showDeleteButton && (
              <Button
                type="button"
                variant="red"
                onClick={handleDeleteProject}
                style={{ marginLeft: 8 }}
                title="Delete current project and clear data"
              >
                Delete Project
              </Button>
            )}
          </>
        )}
      </Navbar>

      {/* MAIN */}
      <main style={{ minHeight: 0, paddingBottom: 24 }}>
        <Container style={{ maxWidth: "none", paddingLeft: 16, paddingRight: 16 }}>
          {/* Toolbar */}
          <Card className="surface" style={{ marginBottom: 16 }}>
            <CardBody>
              <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                <div className="row" style={{ flex: 1, gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <FormField
                      label={`Search ${loadingPersist ? "(loading…)" : ""}`}
                      htmlFor="q"
                      help="in titles and abstracts (e.g., irrigation, IoT, tensiometry)"
                    >
                      <Input
                        id="q"
                        placeholder="Search…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoComplete="off"
                        disabled={loadingPersist}
                      />
                    </FormField>
                  </div>
                  <div>
                    <FormField label="Sort by" htmlFor="sort">
                      <select
                        id="sort"
                        className="input"
                        value={sortMode}
                        onChange={(e) => setSortMode(e.target.value)}
                        disabled={loadingPersist}
                      >
                        <option value="cit_desc">Citations (↓)</option>
                        <option value="cit_asc">Citations (↑)</option>
                        <option value="title_az">Title (A–Z)</option>
                        <option value="title_za">Title (Z–A)</option>
                      </select>
                    </FormField>
                  </div>
                </div>
                <Button type="button" variant="secondary" onClick={() => setQuery("")} disabled={loadingPersist}>
                  Clear
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* Stats */}
          <StatsPanel
            total={allRows.length}
            filtered={filtered.length}
            useful={usefulItems.length}
            notUseful={hiddenIds.size}
          />

          {/* Main grid */}
          <div className="grid-container">
            <ListPanel
              items={filtered}
              currentId={current?.id ?? null}
              onSelect={setCurrentId}
              highlight={highlight}
            />
            <DetailPanel
              current={current}
              highlight={highlight}
              onCopyRef={copyRef}
              onMarkNotUseful={markNotUseful}
              onAddUseful={addUseful}
            />
            <SelectedPanel items={usefulItems} onRemove={removeUseful} onDownload={downloadUsefulCsv} />
          </div>
        </Container>
      </main>

      {/* Confirmation modal */}
      <ConfirmModal
        open={deleteOpen}
        loading={deleteLoading}
        title="Delete project?"
        description="This action is irreversible and will delete all local files for this project."
        confirmLabel="Delete project"
        cancelLabel="Cancel"
        confirmVariant="red"
        onConfirm={confirmDeleteProject}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  );
}
