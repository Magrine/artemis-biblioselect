"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Card, CardBody } from "../../components/primitives/Card";
import { useProjectData } from "../../../hooks/useProjectData";

/* ========= Helpers ========= */

const fmtInt = (n) => (Number.isFinite(n) ? n.toLocaleString() : "—");
const fmt2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : "—");

const pick = (obj, keys, def = "") => {
  for (const k of keys) {
    if (obj && obj[k] != null && String(obj[k]).trim() !== "") return obj[k];
  }
  return def;
};

const normalizeStr = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const titleCaseSmart = (s) => {
  if (!s) return s;
  const words = String(s)
    .toLowerCase()
    .split(" ")
    .filter(Boolean);
  return words
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
};

const prettifySource = (raw) =>
  titleCaseSmart(normalizeStr(String(raw || "")));

const truncate = (str, max = 80) => {
  const s = String(str || "");
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
};

const getYear = (r) => {
  const y = Number(
    pick(r.raw, ["PY", "Year", "year", "Publication Year", "PubYear"], "")
  );
  return Number.isFinite(y) && y > 0 ? y : null;
};

const getCited = (r) => {
  const raw = r?.cited ?? pick(r.raw, ["TC", "Times Cited", "Cited by"], 0);
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const splitAuthors = (raw) => {
  const s = String(raw ?? "").trim();
  if (!s) return [];
  return s
    .split(/[;|]/g)
    .flatMap((t) => t.split(/\s+and\s+|,\s*/gi))
    .map((x) => x.trim())
    .filter(Boolean);
};

const extractKeywordsFromRecord = (r) => {
  const raw =
    pick(r.raw, ["Author Keywords", "DE", "Keywords", "ID", "Index Keywords"], "") ||
    "";
  if (!raw) return [];
  return String(raw)
    .split(/[;,\|/]/g)
    .map((s) => titleCaseSmart(normalizeStr(s)))
    .filter(Boolean);
};

/* ========= Hook: enrich docs ========= */

function useEnrichedDocs(docs) {
  return useMemo(() => {
    return (docs || []).map((r, idx) => {
      const title =
        r.title ||
        pick(r.raw, ["Title", "TI", "Article Title"], "(untitled)");
      const year = getYear(r);
      const cited = getCited(r);
      const sourceRaw = pick(r.raw, ["Source title", "SO"], "");
      const source = sourceRaw ? prettifySource(sourceRaw) : "";
      const abstract =
        pick(r.raw, ["Abstract", "AB"], "") || r.abstract || "";
      const authorsRaw = pick(
        r.raw,
        ["AU", "Authors", "Author(s)", "Author Names"],
        ""
      );
      const authorsList = splitAuthors(authorsRaw);
      const authorsStr = authorsList.join("; ");
      const doiRaw = pick(r.raw, ["DOI", "doi", "DOI Number"], "").trim();
      const doi = doiRaw || "";
      const keywords = extractKeywordsFromRecord(r);

      return {
        id: r.id || String(idx),
        title,
        year,
        cited,
        source,
        abstract,
        authorsStr,
        authorsList,
        doi,
        keywords,
        raw: r.raw || {},
      };
    });
  }, [docs]);
}

/* ========= Hook: keyword stats for word map ========= */

function useKeywordStats(enrichedDocs) {
  return useMemo(() => {
    const counts = new Map();
    let total = 0;

    for (const doc of enrichedDocs) {
      const kws = doc.keywords || [];
      for (const kw of kws) {
        const prev = counts.get(kw) || 0;
        counts.set(kw, prev + 1);
        total += 1;
      }
    }

    const rows = Array.from(counts.entries())
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword));

    return {
      rows,
      total,
    };
  }, [enrichedDocs]);
}

/* ========= Main tab component ========= */

export default function DocumentsTab() {
  const { usefulItems } = useProjectData();
  const docs = usefulItems || [];

  const enrichedDocs = useEnrichedDocs(docs);
  const { rows: keywordRows, total: totalKeywords } =
    useKeywordStats(enrichedDocs);

  const [tab, setTab] = useState("wordmap"); // "wordmap" | "table" | "details"

  // estado para table
  const [tableQuery, setTableQuery] = useState("");
  const [tableSort, setTableSort] = useState("cited_desc");

  // estado para details
  const [currentDocId, setCurrentDocId] = useState(
    () => enrichedDocs[0]?.id || null
  );
  useEffect(() => {
    if (!currentDocId && enrichedDocs.length) {
      setCurrentDocId(enrichedDocs[0].id);
    }
  }, [enrichedDocs, currentDocId]);

  const currentDoc =
    enrichedDocs.find((d) => d.id === currentDocId) || null;

  // derived para tabela
  const filteredTableDocs = useMemo(() => {
    let list = [...enrichedDocs];
    const q = tableQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          (d.authorsStr || "").toLowerCase().includes(q) ||
          (d.source || "").toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (tableSort === "cited_desc") return b.cited - a.cited;
      if (tableSort === "year_desc") return (b.year || 0) - (a.year || 0);
      if (tableSort === "title_az")
        return a.title.localeCompare(b.title);
      return 0;
    });
    return list;
  }, [enrichedDocs, tableQuery, tableSort]);

  // paginação tabela
  const PAGE_SIZE = 10;
  const PAGE_TOTAL = Math.max(
    1,
    Math.ceil(filteredTableDocs.length / PAGE_SIZE || 1)
  );
  const [page, setPage] = useState(1);
  useEffect(() => {
    if (page > PAGE_TOTAL) setPage(PAGE_TOTAL);
  }, [PAGE_TOTAL, page]);
  const start = (page - 1) * PAGE_SIZE;
  const currentRows = filteredTableDocs.slice(start, start + PAGE_SIZE);

  return (
    <Card>
      <CardBody>
        {/* Subtabs */}
        <div
          className="row"
          style={{
            gap: 8,
            marginBottom: 12,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {[
            { id: "wordmap", label: "Word map" },
            { id: "table", label: "Documents table" },
            { id: "details", label: "Document details" },
          ].map((t) => (
            <button
              key={t.id}
              className={`btn ${
                tab === t.id ? "btn-primary" : "btn-ghost"
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {docs.length === 0 ? (
          <p className="muted" style={{ textAlign: "center" }}>
            No selected articles yet. Mark items as useful in the screening
            view to see document metrics here.
          </p>
        ) : (
          <>
            {/* ========== WORD MAP ========== */}
            {tab === "wordmap" && (
              <>
                <h2
                  style={{
                    textAlign: "center",
                    marginTop: 0,
                    marginBottom: 4,
                  }}
                >
                  Keyword map
                </h2>
                <p
                  className="muted"
                  style={{
                    textAlign: "center",
                    margin: "0 auto 1rem",
                    maxWidth: 720,
                  }}
                >
                  Visual overview of the <b>most frequent author keywords</b>{" "}
                  across all selected documents. Bigger words appear more often
                  in the corpus. Click a keyword to see the related documents in
                  the table.
                </p>

                {keywordRows.length === 0 ? (
                  <p className="muted" style={{ textAlign: "center" }}>
                    No keywords found in the current dataset.
                  </p>
                ) : (
                  <WordMap
                    keywordRows={keywordRows}
                    onSelectKeyword={(kw) => {
                      setTab("table");
                      setTableQuery(kw);
                    }}
                  />
                )}

                <div
                  className="muted"
                  style={{
                    marginTop: 12,
                    fontSize: ".85rem",
                    textAlign: "center",
                  }}
                >
                  {fmtInt(keywordRows.length)} distinct keywords •{" "}
                  {fmtInt(totalKeywords)} total keyword occurrences
                </div>
              </>
            )}

            {/* ========== DOCUMENTS TABLE ========== */}
            {tab === "table" && (
              <>
                <h2
                  style={{
                    textAlign: "center",
                    marginTop: 0,
                    marginBottom: 4,
                  }}
                >
                  Documents table
                </h2>
                <p
                  className="muted"
                  style={{
                    textAlign: "center",
                    margin: "0 auto 1rem",
                    maxWidth: 720,
                  }}
                >
                  Complete list of selected documents, including{" "}
                  <b>title</b>, <b>year</b>, <b>citations</b>,{" "}
                  <b>source</b> and <b>DOI</b>. Use search and sorting to
                  explore the corpus.
                </p>

                <div
                  className="row"
                  style={{
                    gap: 12,
                    marginBottom: 10,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <input
                      className="input"
                      placeholder="Search by title, author or source…"
                      value={tableQuery}
                      onChange={(e) => setTableQuery(e.target.value)}
                    />
                  </div>
                  <div>
                    <label
                      className="muted"
                      style={{ fontSize: ".8rem", marginRight: 6 }}
                    >
                      Sort by:
                    </label>
                    <select
                      className="input"
                      value={tableSort}
                      onChange={(e) => setTableSort(e.target.value)}
                    >
                      <option value="cited_desc">
                        Citations (↓)
                      </option>
                      <option value="year_desc">
                        Year (↓)
                      </option>
                      <option value="title_az">
                        Title (A–Z)
                      </option>
                    </select>
                  </div>
                </div>

                {!filteredTableDocs.length ? (
                  <p className="muted" style={{ textAlign: "center" }}>
                    No documents match the current filters.
                  </p>
                ) : (
                  <>
                    <div
                      style={{
                        overflowX: "auto",
                        marginTop: 4,
                      }}
                    >
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "separate",
                          borderSpacing: "0 6px",
                          fontSize: ".9rem",
                        }}
                      >
                        <colgroup>
                          <col style={{ width: 64 }} />
                          <col />
                          <col style={{ width: 72 }} />
                          <col style={{ width: 110 }} />
                          <col style={{ width: 180 }} />
                          <col style={{ width: 220 }} />
                          <col style={{ width: 120 }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th style={thStyleSmall}>#</th>
                            <th style={thStyleSmall}>Title</th>
                            <th style={thStyleSmall}>Year</th>
                            <th style={thStyleSmall}>Citations</th>
                            <th style={thStyleSmall}>Source</th>
                            <th style={thStyleSmall}>Authors</th>
                            <th style={thStyleSmall}>DOI</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentRows.map((d, idx) => {
                            const href = d.doi
                              ? d.doi.startsWith("10.")
                                ? `https://doi.org/${d.doi}`
                                : d.doi
                              : "";
                            return (
                              <tr
                                key={d.id}
                                style={{
                                  background:
                                    idx % 2 === 0
                                      ? "var(--moon-025)"
                                      : "var(--moon-050)",
                                }}
                              >
                                <td style={tdStyleSmall}>
                                  {start + idx + 1}
                                </td>
                                <td
                                  style={{
                                    ...tdStyleSmall,
                                    textAlign: "left",
                                  }}
                                  title={d.title}
                                >
                                  {truncate(d.title, 90)}
                                </td>
                                <td style={tdStyleSmall}>
                                  {d.year || "—"}
                                </td>
                                <td style={tdStyleSmall}>
                                  {fmtInt(d.cited)}
                                </td>
                                <td
                                  style={{
                                    ...tdStyleSmall,
                                    textAlign: "left",
                                  }}
                                >
                                  {d.source || "—"}
                                </td>
                                <td
                                  style={{
                                    ...tdStyleSmall,
                                    textAlign: "left",
                                  }}
                                  title={d.authorsStr}
                                >
                                  {truncate(d.authorsStr, 60) || "—"}
                                </td>
                                <td style={tdStyleSmall}>
                                  {href ? (
                                    <a
                                      href={href}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="btn btn-ghost small"
                                      style={{
                                        fontSize: ".75rem",
                                        padding: "4px 8px",
                                      }}
                                    >
                                      Open DOI
                                    </a>
                                  ) : (
                                    <span className="muted">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Paginação */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: 12,
                      }}
                    >
                      <button
                        className="btn btn-ghost"
                        onClick={() =>
                          setPage((p) => Math.max(1, p - 1))
                        }
                        disabled={page <= 1}
                      >
                        ◀︎ Previous
                      </button>
                      <div
                        className="muted"
                        style={{ fontSize: ".95rem" }}
                      >
                        Page {page} of {PAGE_TOTAL} — showing{" "}
                        {fmtInt(start + 1)}–
                        {fmtInt(
                          Math.min(
                            start + PAGE_SIZE,
                            filteredTableDocs.length
                          )
                        )}{" "}
                        of {fmtInt(filteredTableDocs.length)} documents
                      </div>
                      <button
                        className="btn btn-ghost"
                        onClick={() =>
                          setPage((p) =>
                            Math.min(PAGE_TOTAL, p + 1)
                          )
                        }
                        disabled={page >= PAGE_TOTAL}
                      >
                        Next ▶︎
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {/* ========== DOCUMENT DETAILS ========== */}
            {tab === "details" && (
              <>
                <h2
                  style={{
                    textAlign: "center",
                    marginTop: 0,
                    marginBottom: 4,
                  }}
                >
                  Document details
                </h2>
                <p
                  className="muted"
                  style={{
                    textAlign: "center",
                    margin: "0 auto 1rem",
                    maxWidth: 720,
                  }}
                >
                  Browse the list of documents on the left and select a
                  title to inspect its <b>abstract</b>, <b>citations</b>,{" "}
                  <b>source</b> and <b>DOI</b> on the right.
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(220px, 26%) minmax(0, 1fr)",
                    gap: 20,
                    alignItems: "stretch",
                    minHeight: 320,
                  }}
                >
                  {/* LEFT: lista de docs */}
                  <DocListPanel
                    docs={enrichedDocs}
                    currentDocId={currentDocId}
                    onSelect={setCurrentDocId}
                  />

                  {/* RIGHT: detalhes */}
                  <DocDetailPanel
                    doc={currentDoc}
                    onKeywordClick={(kw) => {
                      setTab("table");
                      setTableQuery(kw);
                    }}
                  />
                </div>
              </>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

/* ========= Word map "manual" (sem react-wordcloud) ========= */

const COLOR_SCHEMES = {
  warm: ["#B51F5B", "#E35D6A", "#F29F80", "#F5C16C"],
  cool: ["#174A7A", "#2C7BB6", "#4DA8DA", "#90CAF9"],
  contrast: ["#222222", "#555555", "#999999", "#DD2C00"],
  pastel: ["#A5D8FF", "#BBD0FF", "#FFC9DE", "#FFE3B3"],
  forest: ["#145A32", "#196F3D", "#27AE60", "#82E0AA"],
  ocean: ["#0E4D92", "#1B6CA8", "#2E86DE", "#74B9FF"],
  sunset: ["#FF6B6B", "#FF8E53", "#FFC857", "#FFE29F"],
};

function WordMap({ keywordRows, onSelectKeyword }) {
  const [maxWords, setMaxWords] = useState(50);
  const [fontPreset, setFontPreset] = useState("system");
  const [colorPreset, setColorPreset] = useState("warm");

  /* ========= PREPARA PALAVRAS ========= */

  const safeRows = useMemo(() => {
    if (!Array.isArray(keywordRows)) return [];
    return keywordRows
      .filter(
        (r) =>
          r &&
          r.keyword != null &&
          String(r.keyword).trim() !== "" &&
          Number.isFinite(r.count)
      )
      .sort((a, b) => b.count - a.count) // mais citadas primeiro
      .slice(0, maxWords);
  }, [keywordRows, maxWords]);

  const words = useMemo(
    () => safeRows.map((r) => ({ text: String(r.keyword), value: r.count })),
    [safeRows]
  );

  const palette = COLOR_SCHEMES[colorPreset] ?? null;

  const fontFamily = useMemo(() => {
    if (fontPreset === "serif") {
      return '"Georgia", "Times New Roman", serif';
    }
    if (fontPreset === "mono") {
      return '"SF Mono", Menlo, Monaco, Consolas, monospace';
    }
    return "-apple-system, BlinkMacSystemFont, system-ui, sans-serif";
  }, [fontPreset]);

  /* ========= LAYOUT: GRAVIDADE + OVAL ========= */

  const layoutWords = useMemo(() => {
    if (!words.length) return [];

    const N = words.length;

    // escala global: mais palavras -> tudo menor
    let globalScale = 1;
    if (N > 160) globalScale = 0.55;
    else if (N > 120) globalScale = 0.6;
    else if (N > 80) globalScale = 0.7;
    else if (N > 50) globalScale = 0.8;
    else if (N > 30) globalScale = 0.9;

    const CANVAS_W = 1000;
    const CANVAS_H = 420;
    const cx = CANVAS_W / 2;
    const cy = CANVAS_H / 2;

    // fator pra ficar mais oval (mais largo que alto)
    const OVAL_X = 1.3;
    const OVAL_Y = 0.85;

    const values = words.map((w) => w.value);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);

    const fontForValue = (v) => {
      if (maxV === minV) return 28 * globalScale;
      const t = (v - minV) / (maxV - minV); // 0–1
      const eased = Math.pow(t, 0.8);
      const base = 16 + eased * (46 - 16); // 16–46
      return base * globalScale;
    };

    const measure = (text, size) => {
      const w = size * text.length * 0.58; // largura estimada
      const h = size * 1.25;
      return { w, h };
    };

    // parâmetros pra deixar mais compacto
    const padding = 1.25; // espaçamento mínimo entre palavras
    const angleStepBase = 0.18; // mais ângulos testados = mais denso
    const radiusStep = 2.5; // abre os anéis devagar
    const maxRadius = 900;
    const maxAttempts = 5000;

    const collides = (a, b) => {
      return !(
        a.x + a.w <= b.x ||
        a.x >= b.x + b.w ||
        a.y + a.h <= b.y ||
        a.y >= b.y + b.h
      );
    };

    const fitsInside = (rect) =>
      rect.x >= 0 &&
      rect.y >= 0 &&
      rect.x + rect.w <= CANVAS_W &&
      rect.y + rect.h <= CANVAS_H;

    const placed = [];

    // mais citada primeiro, cada nova tenta ficar o mais perto do centro
    words.forEach((w, idx) => {
      const fontSize = fontForValue(w.value);
      const { w: bw, h: bh } = measure(w.text, fontSize);

      let bestRect = null;
      let radius = 0;
      let attempts = 0;

      while (!bestRect && radius < maxRadius && attempts < maxAttempts) {
        const angleStep = angleStepBase;
        const steps = Math.max(24, Math.floor((2 * Math.PI) / angleStep));

        for (let i = 0; i < steps; i++) {
          const angle = i * angleStep;

          // oval: mais largo no eixo x
          const x = cx + radius * Math.cos(angle) * OVAL_X;
          const y = cy + radius * Math.sin(angle) * OVAL_Y;

          const rect = {
            x: x - bw / 2,
            y: y - bh / 2,
            w: bw,
            h: bh,
          };

          if (!fitsInside(rect)) {
            attempts++;
            continue;
          }

          let ok = true;
          for (const other of placed) {
            const expanded = {
              x: other.rect.x - padding,
              y: other.rect.y - padding,
              w: other.rect.w + padding * 2,
              h: other.rect.h + padding * 2,
            };
            if (collides(rect, expanded)) {
              ok = false;
              break;
            }
          }

          if (ok) {
            bestRect = rect;
            break;
          }

          attempts++;
        }

        radius += radiusStep;
      }

      if (!bestRect) return;

      placed.push({
        text: w.text,
        value: w.value,
        fontSize,
        color: palette ? palette[idx % palette.length] : "var(--ink-900)",
        rect: bestRect,
      });
    });

    if (!placed.length) return [];

    // ==== recentraliza tudo pra ficar no meio do container ====
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    placed.forEach(({ rect }) => {
      minX = Math.min(minX, rect.x);
      maxX = Math.max(maxX, rect.x + rect.w);
      minY = Math.min(minY, rect.y);
      maxY = Math.max(maxY, rect.y + rect.h);
    });

    const usedW = maxX - minX;
    const usedH = maxY - minY;
    const centerUsedX = minX + usedW / 2;
    const centerUsedY = minY + usedH / 2;

    const shiftX = cx - centerUsedX;
    const shiftY = cy - centerUsedY;

    return placed.map(({ text, value, fontSize, color, rect }) => {
      const x = rect.x + shiftX + rect.w / 2;
      const y = rect.y + shiftY + rect.h / 2;

      return {
        text,
        value,
        fontSize,
        color,
        leftPct: (x / CANVAS_W) * 100,
        topPct: (y / CANVAS_H) * 100,
      };
    });
  }, [words, colorPreset]);

  /* ========= RENDER ========= */

  return (
    <div>
      {/* nuvem */}
      <div
        style={{
          border: "1px solid var(--moon-150)",
          borderRadius: 12,
          padding: "8px 10px",
          height: 420,
          width: "100%",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {layoutWords.map((w, i) => (
          <button
            key={w.text + i}
            type="button"
            onClick={() => onSelectKeyword?.(w.text)}
            style={{
              position: "absolute",
              left: `${w.leftPct}%`,
              top: `${w.topPct}%`,
              transform: "translate(-50%, -50%)",
              fontFamily,
              fontSize: w.fontSize,
              color: w.color,
              border: "none",
              background: "transparent",
              padding: 0,
              margin: 0,
              cursor: "pointer",
              whiteSpace: "nowrap",
              lineHeight: 1.1,
            }}
            title={`${w.text} (${w.value})`}
          >
            {w.text}
          </button>
        ))}
      </div>

      {/* controles */}
      <div
        style={{
          marginTop: 10,
          padding: "8px 10px",
          borderRadius: 10,
          border: "1px dashed var(--moon-150)",
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: ".8rem",
        }}
      >
        <div style={{ minWidth: 160 }}>
          <div className="muted" style={{ marginBottom: 4 }}>
            Number of words
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="range"
              min={20}
              max={200}
              step={10}
              value={maxWords}
              onChange={(e) =>
                setMaxWords(parseInt(e.target.value, 10))
              }
              style={{ flex: 1 }}
            />
            <span style={{ width: 36, textAlign: "right" }}>
              {maxWords}
            </span>
          </div>
        </div>

        <div style={{ minWidth: 150 }}>
          <div className="muted" style={{ marginBottom: 4 }}>
            Font
          </div>
          <select
            className="input"
            style={{ fontSize: ".8rem", padding: "4px 6px" }}
            value={fontPreset}
            onChange={(e) => setFontPreset(e.target.value)}
          >
            <option value="system">System</option>
            <option value="serif">Serif</option>
            <option value="mono">Monospace</option>
          </select>
        </div>

        <div style={{ minWidth: 170 }}>
          <div className="muted" style={{ marginBottom: 4 }}>
            Color palette
          </div>
          <select
            className="input"
            style={{ fontSize: ".8rem", padding: "4px 6px" }}
            value={colorPreset}
            onChange={(e) => setColorPreset(e.target.value)}
          >
            <option value="warm">Warm</option>
            <option value="cool">Cool</option>
            <option value="contrast">High contrast</option>
            <option value="pastel">Pastel</option>
            <option value="forest">Forest</option>
            <option value="ocean">Ocean</option>
            <option value="sunset">Sunset</option>
          </select>
        </div>
      </div>
    </div>
  );
}

/* ========= Left panel (doc list) ========= */

function DocListPanel({ docs, currentDocId, onSelect }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...docs];
    if (q) {
      list = list.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          (d.authorsStr || "").toLowerCase().includes(q)
      );
    }
    list.sort(
      (a, b) =>
        b.cited - a.cited ||
        (b.year || 0) - (a.year || 0) ||
        a.title.localeCompare(b.title)
    );
    return list;
  }, [docs, query]);

  useEffect(() => {
    if (!currentDocId && filtered.length) {
      onSelect(filtered[0].id);
    }
  }, [filtered, currentDocId, onSelect]);

  return (
    <div
      style={{
        border: "1px solid var(--moon-150)",
        borderRadius: 12,
        background: "var(--paper)",
        padding: 8,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        height: "auto",
        maxHeight: 800,
      }}
    >
      <div style={{ padding: "0 4px 4px" }}>
        <div
          style={{
            fontSize: ".9rem",
            fontWeight: 600,
            color: "var(--ink-900)",
          }}
        >
          Documents
        </div>
        <div className="muted" style={{ fontSize: ".8rem" }}>
          {fmtInt(docs.length)} documents • ordered by citations.
        </div>
        <input
          className="input"
          style={{ marginTop: 6, fontSize: ".85rem" }}
          placeholder="Filter by title or author…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div
        style={{
          marginTop: 4,
          overflowY: "auto",
          paddingRight: 4,
          flex: 1,
        }}
      >
        {filtered.length === 0 ? (
          <div
            className="muted"
            style={{ fontSize: ".85rem", padding: "4px 6px" }}
          >
            No documents match this filter.
          </div>
        ) : (
          filtered.map((d) => {
            const selected = currentDocId === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onSelect(d.id)}
                style={{
                  width: "100%",
                  border: "none",
                  background: selected
                    ? "var(--moon-100)"
                    : "transparent",
                  borderRadius: 8,
                  cursor: "pointer",
                  padding: "6px 8px",
                  textAlign: "left",
                  marginBottom: 3,
                }}
              >
                <div
                  style={{
                    fontSize: ".9rem",
                    fontWeight: selected ? 700 : 500,
                    color: "var(--ink-900)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {d.title}
                </div>
                <div
                  className="muted"
                  style={{ fontSize: ".8rem", marginTop: 2 }}
                >
                  {d.year || "—"} • {fmtInt(d.cited)} citations
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ========= Right panel (doc details) ========= */

function DocDetailPanel({ doc, onKeywordClick }) {
  if (!doc) {
    return (
      <div
        className="surface"
        style={{
          borderRadius: "var(--radius-lg)",
          padding: 18,
          minHeight: 260,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <p className="muted">
          Select a document on the left to see details here.
        </p>
      </div>
    );
  }

  const href = doc.doi
    ? doc.doi.startsWith("10.")
      ? `https://doi.org/${doc.doi}`
      : doc.doi
    : "";

  const handleCopyRef = async () => {
    const text = `${doc.title} — ${doc.authorsStr || ""} — ${
      doc.year || ""
    } — DOI: ${doc.doi || "N/A"}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* silencioso */
    }
  };

  const authors =
    doc.authorsList && doc.authorsList.length
      ? doc.authorsList
      : doc.authorsStr
      ? [doc.authorsStr]
      : [];

  return (
    <div
      className="surface shadow-md"
      style={{
        borderRadius: "var(--radius-lg)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minHeight: 260,
        height: "100%",
      }}
    >
      {/* Header */}
      <header>
        <h3
          style={{
            margin: 0,
            lineHeight: 1.35,
          }}
        >
          {doc.title}
        </h3>
        <div className="chips chips--clamp">
            {doc.keywords && doc.keywords.length > 0 && (
            <InfoRow label="Keywords">
              {/* sem maxHeight aqui também; chips clicáveis */}
              <div className="chips">
                {doc.keywords.map((kw, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="chip"
                    style={{
                      fontSize: ".8rem",
                      cursor: "pointer",
                    }}
                    onClick={() => onKeywordClick?.(kw)}
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </InfoRow>
          )}
        </div>
        <div
          style={{
            marginTop: 10,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <StatPill label="Year" value={doc.year || "—"} />
          <StatPill label="Citations" value={fmtInt(doc.cited)} />
          <StatPill label="Source" value={doc.source || "—"} />
        </div>

        <div
          style={{
            marginTop: 10,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary small"
              style={{
                fontSize: ".85rem",
                padding: "8px 14px",
                textDecoration: "none", // <-- sem underline
              }}
            >
              Open DOI
            </a>
          )}
          <button
            type="button"
            className="btn btn-ghost small"
            onClick={handleCopyRef}
            style={{ fontSize: ".85rem", padding: "8px 12px" }}
          >
            Copy reference
          </button>
        </div>
      </header>

      {/* Corpo: abstract + meta */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14,
          flex: 1,
          minHeight: 0,
          alignItems: "stretch",
        }}
      >
        {/* Abstract */}
        <section
          className="surface"
          style={{
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--moon-200)",
            padding: 12,
            background: "var(--paper)",
            height: "auto"
          }}
        >
          <div
            className="muted"
            style={{
              fontSize: ".78rem",
              textTransform: "uppercase",
              letterSpacing: ".12em",
              marginBottom: 6,
            }}
          >
            Abstract
          </div>
          {doc.abstract ? (
            <p
              style={{
                margin: 0,
                fontSize: ".9rem",
                lineHeight: 1.5,
                textAlign: "justify",
              }}
            >
              {doc.abstract}
            </p>
          ) : (
            <p className="muted" style={{ margin: 0, fontSize: ".9rem" }}>
              No abstract available for this document.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}


/* ========= small UI helpers, alinhados ao CSS global ========= */

function InfoRow({ label, children }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <span
        className="muted"
        style={{
          fontSize: ".78rem",
          textTransform: "uppercase",
          letterSpacing: ".08em",
        }}
      >
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}

function StatPill({ label, value }) {
  return (
    <div
      className="badge olive pill"
      style={{
        fontSize: ".8rem",
        padding: "6px 10px",
      }}
    >
      <span className="dot" />
      <span
        style={{
          textTransform: "uppercase",
          fontSize: ".7rem",
          letterSpacing: ".1em",
        }}
      >
        {label}
      </span>
      <span>{value}</span>
    </div>
  );
}

function MetaItem({ label, value }) {
  return (
    <div>
      <span className="muted" style={{ fontSize: ".8rem" }}>
        {label}
      </span>
      <br />
      <span>{value}</span>
    </div>
  );
}

const thStyleSmall = {
  textAlign: "center",
  padding: "6px 8px",
  fontSize: ".8rem",
  color: "var(--ink-700)",
  borderBottom: "1px solid var(--moon-200)",
};

const tdStyleSmall = {
  padding: "6px 8px",
  textAlign: "center",
  fontSize: ".85rem",
  color: "var(--ink-900)",
};
