// src/app/components/tabs/AuthorsTab.jsx
import React, { useMemo, useState, useEffect } from "react";
import { Card, CardBody } from "../../components/primitives/Card";
import { useProjectData } from "../../../hooks/useProjectData";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
  LabelList,
} from "recharts";

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

const truncate = (str, max = 28) => {
  const s = String(str || "");
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
};

const splitAuthors = (raw) => {
  const s = String(raw ?? "").trim();
  if (!s) return [];
  return s
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean);
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

const computeHIndex = (citations) => {
  if (!citations || !citations.length) return 0;
  const sorted = [...citations].sort((a, b) => b - a);
  let h = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] >= i + 1) h = i + 1;
    else break;
  }
  return h;
};

const getInitials = (name) => {
  const parts = String(name || "")
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/* ========= Hook: derived author stats ========= */

function useAuthorStats(docs) {
  return useMemo(() => {
    const authorsMap = new Map();
    let totalAuthorships = 0;

    docs.forEach((r) => {
      const rawAuthors = pick(
        r.raw,
        ["AU", "Authors", "Author(s)", "Author Names"],
        ""
      );
      const authorsRawList = splitAuthors(rawAuthors);
      const authors = authorsRawList
        .map((a) => titleCaseSmart(normalizeStr(a)))
        .filter(Boolean);

      if (!authors.length) return;

      const cited = getCited(r);
      const year = getYear(r);
      const sourceRaw = pick(r.raw, ["Source title", "SO"], "");
      const source = sourceRaw ? prettifySource(sourceRaw) : "";
      const title =
        r.title ||
        pick(r.raw, ["Title", "TI", "Article Title"], "(untitled)");
      const doiRaw = pick(r.raw, ["DOI", "doi", "DOI Number"], "").trim();

      const docRef = {
        id: r.id,
        title,
        year,
        cited,
        source,
        doi: doiRaw || "",
      };

      totalAuthorships += authors.length;

      for (const name of authors) {
        if (!authorsMap.has(name)) {
          authorsMap.set(name, {
            name,
            docsCount: 0,
            citedSum: 0,
            citedList: [],
            yearCounts: new Map(),
            coauthors: new Set(),
            docRefs: [],
          });
        }
      }

      for (const name of authors) {
        const entry = authorsMap.get(name);
        entry.docsCount += 1;
        entry.citedSum += cited;
        entry.citedList.push(cited);
        entry.docRefs.push(docRef);

        if (year != null) {
          entry.yearCounts.set(
            year,
            (entry.yearCounts.get(year) || 0) + 1
          );
        }
        for (const other of authors) {
          if (other !== name) entry.coauthors.add(other);
        }
      }
    });

    const authorListRaw = Array.from(authorsMap.values()).map((a) => {
      // dedupe docs apenas para a lista
      const seen = new Set();
      const docsList = [];
      for (const d of a.docRefs) {
        const key = d.id || `${d.title}|${d.year || ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        docsList.push(d);
      }
      docsList.sort(
        (x, y) =>
          (y.year || 0) - (x.year || 0) ||
          (y.cited || 0) - (x.cited || 0)
      );

      const yearsArr = Array.from(a.yearCounts.keys()).sort(
        (x, y) => x - y
      );
      const firstYear = yearsArr[0] ?? null;
      const lastYear = yearsArr[yearsArr.length - 1] ?? null;
      const hIndex = computeHIndex(a.citedList);

      // número oficial de documentos = docsCount
      const docs = a.docsCount || docsList.length || 0;
      const avgCitations = docs ? a.citedSum / docs : 0;
      const coauthorsCount = a.coauthors.size;

      return {
        name: a.name,
        docs,
        citedSum: a.citedSum,
        avgCitations,
        hIndex,
        firstYear,
        lastYear,
        coauthorsCount,
        yearCounts: a.yearCounts,
        docsList,
      };
    });

    const sortedAuthors = authorListRaw
      .slice()
      .sort(
        (a, b) =>
          b.docs - a.docs ||
          b.citedSum - a.citedSum ||
          a.name.localeCompare(b.name)
      );

    const topAuthors = sortedAuthors.slice(0, 10).map((a, idx) => ({
      ...a,
      rank: idx + 1,
      nameShort: truncate(a.name),
      labelRight: fmtInt(a.citedSum),
    }));

    const totalAuthors = sortedAuthors.length;
    const singlePaperAuthors = sortedAuthors.filter(
      (a) => a.docs === 1
    ).length;
    const avgAuthorsPerDoc = docs.length
      ? totalAuthorships / docs.length
      : 0;

    return {
      totalAuthors,
      totalAuthorships,
      avgAuthorsPerDoc,
      singlePaperAuthors,
      authorList: sortedAuthors,
      topAuthors,
    };
  }, [docs]);
}

/* ========= Charts ========= */

function TopAuthorsChart({ data }) {
  if (!data.length) return null;

  const height = Math.max(260, 40 * data.length + 80);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          barCategoryGap={10}
          margin={{ top: 8, right: 32, left: 12, bottom: 8 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--moon-200)"
          />
          <XAxis
            type="number"
            tick={{ fill: "var(--ink-600)", fontSize: 12 }}
            tickMargin={6}
            axisLine={{ stroke: "var(--moon-200)" }}
            tickLine={{ stroke: "var(--moon-200)" }}
            domain={[0, "dataMax + 1"]}
            tickFormatter={fmtInt}
          />
          <YAxis
            type="category"
            dataKey="nameShort"
            width={200}
            tick={{ fill: "var(--ink-800)", fontSize: 12 }}
          />
          <Tooltip
            wrapperStyle={{ zIndex: 10 }}
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const row = payload[0].payload;
              return (
                <div style={tipBox}>
                  <div
                    style={{
                      fontWeight: 700,
                      marginBottom: 4,
                    }}
                  >
                    {row.name}
                  </div>
                  <div>
                    Documents: <b>{fmtInt(row.docs)}</b>
                  </div>
                  <div>
                    Citations (total):{" "}
                    <b>{fmtInt(row.citedSum)}</b>
                  </div>
                  <div>
                    Citations / doc:{" "}
                    <b>{fmt2(row.avgCitations)}</b>
                  </div>
                  <div>h-index: {row.hIndex}</div>
                  {row.firstYear && row.lastYear && (
                    <div>
                      Active: {row.firstYear}–{row.lastYear}
                    </div>
                  )}
                </div>
              );
            }}
          />
          <Bar
            dataKey="docs"
            name="Documents"
            stroke="var(--gold-600)"
            fill="var(--gold-500)"
            radius={[6, 6, 6, 6]}
          >
            <LabelList
              dataKey="labelRight"
              position="right"
              style={{ fill: "var(--ink-900)", fontSize: 12 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AuthorTimelineChart({ author }) {
  if (!author || !author.yearCounts) return null;
  const entries = Array.from(author.yearCounts.entries()).sort(
    (a, b) => a[0] - b[0]
  );
  const data = entries.map(([year, count]) => ({
    year: String(year),
    docs: count,
  }));
  if (!data.length) {
    return (
      <p className="muted">
        No yearly data available for this author.
      </p>
    );
  }

  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--moon-200)"
          />
          <XAxis
            dataKey="year"
            tick={{ fill: "var(--ink-600)", fontSize: 12 }}
            tickMargin={8}
            axisLine={{ stroke: "var(--moon-200)" }}
            tickLine={{ stroke: "var(--moon-200)" }}
          />
          <YAxis
            tickFormatter={fmtInt}
            tick={{ fill: "var(--ink-600)", fontSize: 12 }}
            tickMargin={6}
            axisLine={{ stroke: "var(--moon-200)" }}
            tickLine={{ stroke: "var(--moon-200)" }}
            allowDecimals={false}
            domain={[0, "auto"]}
          />
          <Tooltip
            formatter={(value) => [fmtInt(value), "Documents"]}
            labelFormatter={(label) => `Year: ${label}`}
          />
          <Area
            type="monotone"
            dataKey="docs"
            name="Documents"
            stroke="var(--gold-500)"
            strokeWidth={3}
            fill="var(--gold-500)"
            fillOpacity={0.2}
            dot={false}
            isAnimationActive
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ========= Main tab component ========= */

export default function AuthorsTab() {
  const { usefulItems } = useProjectData();
  const docs = usefulItems || [];

  const { authorList, topAuthors } = useAuthorStats(docs);

  const [tab, setTab] = useState("top"); // "top" | "table" | "details"
  const [selectedAuthorName, setSelectedAuthorName] = useState(
    () => topAuthors[0]?.name || authorList[0]?.name || ""
  );
  const [authorFilter, setAuthorFilter] = useState("");

  useEffect(() => {
    if (!selectedAuthorName && authorList.length) {
      setSelectedAuthorName(authorList[0].name);
    }
  }, [authorList, selectedAuthorName]);

  const selectedAuthor =
    authorList.find((a) => a.name === selectedAuthorName) || null;

  const filteredAuthors = useMemo(() => {
    const q = authorFilter.trim().toLowerCase();
    if (!q) return authorList;
    return authorList.filter((a) =>
      a.name.toLowerCase().includes(q)
    );
  }, [authorFilter, authorList]);

  // paginação da tabela
  const PAGE_SIZE = 10;
  const PAGE_TOTAL = Math.max(
    1,
    Math.ceil(authorList.length / PAGE_SIZE || 1)
  );
  const [page, setPage] = useState(1);
  useEffect(() => {
    if (page > PAGE_TOTAL) setPage(PAGE_TOTAL);
  }, [PAGE_TOTAL, page]);
  const start = (page - 1) * PAGE_SIZE;
  const currentRows = authorList.slice(start, start + PAGE_SIZE);

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
            { id: "top", label: "Top authors" },
            { id: "table", label: "Authors table" },
            { id: "details", label: "Author details" },
          ].map((t) => (
            <button
              key={t.id}
              className={`btn ${tab === t.id ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {docs.length === 0 ? (
          <p className="muted" style={{ textAlign: "center" }}>
            No selected articles yet. Mark items as useful in the screening
            view to see author metrics here.
          </p>
        ) : (
          <>
            {/* ===== TOP AUTHORS ===== */}
            {tab === "top" && (
              <>
                <h2
                  style={{
                    textAlign: "center",
                    marginTop: 0,
                    marginBottom: 4,
                  }}
                >
                  Top authors (by documents)
                </h2>
                <p
                  className="muted"
                  style={{
                    textAlign: "center",
                    margin: "0 auto 1rem",
                    maxWidth: 720,
                  }}
                >
                  Top 10 authors ranked by <b>number of documents</b>.
                  Bars represent document count, and the label at the end
                  of each bar shows the <b>total number of citations</b>.
                </p>

                {!topAuthors.length ? (
                  <p className="muted" style={{ textAlign: "center" }}>
                    No authors could be extracted from the current dataset.
                  </p>
                ) : (
                  <TopAuthorsChart data={topAuthors} />
                )}
              </>
            )}

            {/* ===== AUTHORS TABLE ===== */}
            {tab === "table" && (
              <>
                <h2
                  style={{
                    textAlign: "center",
                    marginTop: 0,
                    marginBottom: 4,
                  }}
                >
                  Authors table
                </h2>
                <p
                  className="muted"
                  style={{
                    textAlign: "center",
                    margin: "0 auto 1rem",
                    maxWidth: 720,
                  }}
                >
                  Complete list of authors ordered by{" "}
                  <b>number of documents</b>. Use the pagination controls to
                  navigate through the list.
                </p>

                {!authorList.length ? (
                  <p className="muted" style={{ textAlign: "center" }}>
                    No authors found.
                  </p>
                ) : (
                  <>
                    <div
                      style={{
                        marginTop: 4,
                        overflowX: "auto",
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
                        <thead>
                          <tr>
                            <th style={thStyleSmall}>#</th>
                            <th style={thStyleSmall}>Author</th>
                            <th style={thStyleSmall}>Docs</th>
                            <th style={thStyleSmall}>Citations</th>
                            <th style={thStyleSmall}>Citations / doc</th>
                            <th style={thStyleSmall}>h-index</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentRows.map((a, idx) => (
                            <tr
                              key={a.name}
                              style={{ background: "var(--moon-050)" }}
                            >
                              <td style={tdStyleSmall}>
                                {start + idx + 1}
                              </td>
                              <td
                                style={{
                                  ...tdStyleSmall,
                                  textAlign: "left",
                                  fontWeight: 600,
                                }}
                              >
                                {a.name}
                              </td>
                              <td style={tdStyleSmall}>
                                {fmtInt(a.docs)}
                              </td>
                              <td style={tdStyleSmall}>
                                {fmtInt(a.citedSum)}
                              </td>
                              <td style={tdStyleSmall}>
                                {fmt2(a.avgCitations)}
                              </td>
                              <td style={tdStyleSmall}>
                                {a.hIndex}
                              </td>
                            </tr>
                          ))}
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
                          Math.min(start + PAGE_SIZE, authorList.length)
                        )}{" "}
                        of {fmtInt(authorList.length)} authors
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

            {/* ===== AUTHOR DETAILS ===== */}
            {tab === "details" && (
              <>
                <h2
                  style={{
                    textAlign: "center",
                    marginTop: 0,
                    marginBottom: 4,
                  }}
                >
                  Author details
                </h2>
                <p
                  className="muted"
                  style={{
                    textAlign: "center",
                    margin: "0 auto 1rem",
                    maxWidth: 720,
                  }}
                >
                  Authors on the left are ordered by <b>number of documents</b>. Select a name to
                  explore their <b>impact metrics</b>, <b>publication timeline</b>, and
                  <b> associated documents</b>.
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(210px, 24%) minmax(0, 1fr)",
                    gap: 20,
                    alignItems: "stretch",
                  }}
                >
                  {/* Left: painel de autores ocupando o height */}
                  <div
                    style={{
                      border: "1px solid var(--moon-150)",
                      borderRadius: 12,
                      background: "var(--paper)",
                      padding: 8,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      maxHeight: "700px",
                      overflowY: "auto", 
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        padding: "0 4px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: ".9rem",
                          fontWeight: 600,
                          color: "var(--ink-900)",
                        }}
                      >
                        Authors
                      </div>
                      <div
                        className="muted"
                        style={{ fontSize: ".8rem" }}
                      >
                        {fmtInt(authorList.length)} authors • click to
                        inspect details.
                      </div>
                      <input
                        className="input"
                        style={{ marginTop: 4, fontSize: ".85rem" }}
                        placeholder="Search author…"
                        value={authorFilter}
                        onChange={(e) =>
                          setAuthorFilter(e.target.value)
                        }
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
                      {filteredAuthors.length === 0 ? (
                        <div
                          className="muted"
                          style={{
                            fontSize: ".85rem",
                            padding: "4px 6px",
                          }}
                        >
                          No authors match this search.
                        </div>
                      ) : (
                        filteredAuthors.map((a) => {
                          const selected =
                            selectedAuthorName === a.name;
                          return (
                            <button
                              key={a.name}
                              type="button"
                              onClick={() =>
                                setSelectedAuthorName(a.name)
                              }
                              style={{
                                width: "100%",
                                border: "none",
                                background: selected
                                  ? "var(--moon-100)"
                                  : "transparent",
                                borderRadius: 8,
                                cursor: "pointer",
                                padding: "6px 8px",
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                marginBottom: 2,
                              }}
                            >
                              <div
                                style={{
                                  width: 26,
                                  height: 26,
                                  borderRadius: "999px",
                                  background: "var(--moon-200)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: ".75rem",
                                  fontWeight: 700,
                                  color: "var(--ink-900)",
                                }}
                              >
                                {getInitials(a.name)}
                              </div>
                              <div
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  textAlign: "left",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: ".9rem",
                                    fontWeight: selected
                                      ? 700
                                      : 500,
                                    color: "var(--ink-900)",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {a.name}
                                </div>
                                <div
                                  className="muted"
                                  style={{ fontSize: ".8rem" }}
                                >
                                  {fmtInt(a.docs)} docs
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Right: dashboard do autor */}
                  <div>
                    {!selectedAuthor ? (
                      <p className="muted">
                        Select an author on the left to see details.
                      </p>
                    ) : (
                      <div
                        style={{
                          display: "grid",
                          gap: 16,
                          gridTemplateRows: "auto auto auto",
                        }}
                      >
                        {/* Cabeçalho + métricas */}
                        <section
                          style={{
                            padding: "10px 12px 12px",
                            borderRadius: 12,
                            border: "1px solid var(--moon-150)",
                            background: "var(--moon-025)",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: "1.1rem",
                              marginBottom: 8,
                            }}
                          >
                            {selectedAuthor.name}
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit, minmax(130px, 1fr))",
                              gap: 10,
                              fontSize: ".9rem",
                            }}
                          >
                            <DetailMetric
                              label="Documents"
                              value={fmtInt(selectedAuthor.docs)}
                            />
                            <DetailMetric
                              label="Citations (total)"
                              value={fmtInt(selectedAuthor.citedSum)}
                            />
                            <DetailMetric
                              label="Citations / doc"
                              value={fmt2(
                                selectedAuthor.avgCitations
                              )}
                            />
                            <DetailMetric
                              label="h-index"
                              value={selectedAuthor.hIndex}
                            />
                            <DetailMetric
                              label="Co-authors"
                              value={fmtInt(
                                selectedAuthor.coauthorsCount
                              )}
                            />
                            {selectedAuthor.firstYear && (
                              <DetailMetric
                                label="Active period"
                                value={
                                  selectedAuthor.firstYear +
                                  (selectedAuthor.lastYear &&
                                  selectedAuthor.lastYear !==
                                    selectedAuthor.firstYear
                                    ? `–${selectedAuthor.lastYear}`
                                    : "")
                                }
                              />
                            )}
                          </div>
                        </section>

                        {/* Timeline */}
                        <section>
                          <h4
                            style={{
                              margin: "4px 0 8px",
                              fontSize: ".95rem",
                              fontWeight: 600,
                            }}
                          >
                            Publication timeline
                          </h4>
                          <AuthorTimelineChart
                            author={selectedAuthor}
                          />
                        </section>

                        {/* Lista de documentos do autor */}
                        <section>
                          <h4
                            style={{
                              margin: "4px 0 8px",
                              fontSize: ".95rem",
                              fontWeight: 600,
                            }}
                          >
                            Documents by this author
                          </h4>
                          {selectedAuthor.docsList &&
                          selectedAuthor.docsList.length ? (
                            <div
                              style={{
                                maxHeight: 240,
                                overflowY: "auto",
                                borderRadius: 10,
                                border:
                                  "1px solid var(--moon-150)",
                                background: "var(--paper)",
                              }}
                            >
                              <table
                                style={{
                                  width: "100%",
                                  borderCollapse: "separate",
                                  borderSpacing: "0 4px",
                                  fontSize: ".85rem",
                                }}
                              >
                                <thead>
                                  <tr>
                                    <th
                                      style={{
                                        ...thStyleSmall,
                                        textAlign: "left",
                                      }}
                                    >
                                      Title
                                    </th>
                                    <th style={thStyleSmall}>Year</th>
                                    <th style={thStyleSmall}>
                                      Citations
                                    </th>
                                    <th style={thStyleSmall}>
                                      Source
                                    </th>
                                    <th style={thStyleSmall}>DOI</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {selectedAuthor.docsList.map(
                                    (d, idx) => {
                                      const href = d.doi
                                        ? d.doi.startsWith("10.")
                                          ? `https://doi.org/${d.doi}`
                                          : d.doi
                                        : "";
                                      return (
                                        <tr
                                          key={
                                            d.id ||
                                            `${d.title}-${idx}`
                                          }
                                          style={{
                                            background:
                                              idx % 2 === 0
                                                ? "var(--moon-025)"
                                                : "var(--moon-050)",
                                          }}
                                        >
                                          <td
                                            style={{
                                              ...tdStyleSmall,
                                              textAlign: "left",
                                            }}
                                          >
                                            {d.title}
                                          </td>
                                          <td style={tdStyleSmall}>
                                            {d.year || "—"}
                                          </td>
                                          <td style={tdStyleSmall}>
                                            {fmtInt(
                                              Number(d.cited) || 0
                                            )}
                                          </td>
                                          <td
                                            style={{
                                              ...tdStyleSmall,
                                              textAlign: "left",
                                            }}
                                          >
                                            {d.source || "—"}
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
                                                  padding:
                                                    "4px 8px",
                                                }}
                                              >
                                                Open DOI
                                              </a>
                                            ) : (
                                              <span className="muted">
                                                —
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    }
                                  )}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="muted">
                              No individual documents found for this
                              author.
                            </p>
                          )}
                        </section>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

/* pequenos helpers de UI */

function DetailMetric({ label, value }) {
  return (
    <div>
      <span className="muted">{label}</span>
      <br />
      <strong>{value}</strong>
    </div>
  );
}

/* estilos auxiliares */

const tipBox = {
  background: "rgba(255,255,255,.9)",
  border: "1px solid var(--moon-200)",
  borderRadius: 8,
  padding: "8px 10px",
  boxShadow: "0 6px 18px rgba(0,0,0,.06)",
  fontSize: 12,
  color: "var(--ink-900)",
};

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
