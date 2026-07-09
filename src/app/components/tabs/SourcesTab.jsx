// src/app/components/tabs/SourcesTab.jsx
import React, { useMemo, useState, useEffect, useRef } from "react";
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
  LabelList,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import WORLD_TOPO_URL from "../../../assets/countries-110m.json";

/* ================== Config & helpers ================== */

const nfInt = new Intl.NumberFormat("pt-BR");
const nf1 = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const fmtInt = (n) => (Number.isFinite(n) ? nfInt.format(n) : "—");
const fmtPct1 = (n) => (Number.isFinite(n) ? `${nf1.format(n)}%` : "—");

const pick = (obj, keys, def = "") => {
  for (const k of keys)
    if (obj && obj[k] != null && String(obj[k]).trim() !== "") return obj[k];
  return def;
};
const normalizeStr = (s) => String(s || "").replace(/\s+/g, " ").trim();
const stripParensSuffix = (label) =>
  String(label).replace(/\s*\([^)]+\)\s*$/, "").trim();
const titleCaseSmart = (s) => {
  if (!s) return s;
  const allUpper = s === s.toUpperCase();
  if (!allUpper) return s;
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length >= 3 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
};
const prettifySource = (raw) =>
  titleCaseSmart(stripParensSuffix(normalizeStr(raw)));
const truncate = (str, max = 34) =>
  String(str || "").length > max
    ? String(str).slice(0, max - 1) + "…"
    : str;
const getYear = (r) => {
  const y = Number(
    pick(r.raw, ["PY", "Year", "year", "Publication Year", "PubYear"], "")
  );
  return Number.isFinite(y) && y > 0 ? y : null;
};
function estimateYAxisWidth(rows) {
  const maxLen = rows.reduce(
    (m, r) => Math.max(m, String(r.sourceShort || r.kwShort || "").length),
    0
  );
  return Math.round(maxLen * 7.2) + 24;
}

// palette reused by other tabs
const palette = [
  { stroke: "var(--sky-500)", fill: "var(--sky-500)" },
  { stroke: "var(--gold-500)", fill: "var(--gold-500)" },
  { stroke: "var(--rose-500)", fill: "var(--rose-500)" },
  { stroke: "var(--olive-400)", fill: "var(--olive-400)" },
  { stroke: "var(--moon-400)", fill: "var(--moon-400)" },
];

const EPS = 1e-6;
// lightweight country normalization
const COUNTRY_ALIASES = {
  usa: "United States of America",
  "united states": "United States of America",
  uk: "United Kingdom",
  "u.k.": "United Kingdom",
  england: "United Kingdom",
  "south korea": "Korea, Republic of",
  "north korea": "Korea, Democratic People's Republic of",
  russia: "Russian Federation",
  "viet nam": "Vietnam",
  iran: "Iran, Islamic Republic of",
  uae: "United Arab Emirates",
  tanzania: "Tanzania, United Republic of",
  "czech republic": "Czechia",
  brasil: "Brazil",
  méxico: "Mexico",
  españa: "Spain",
};

// extract possible countries from a record
function extractCountriesFromRecord(r) {
  const raw =
    pick(
      r.raw,
      [
        "Country",
        "Countries",
        "Affiliations",
        "C1",
        "AU_CO",
        "Authors with affiliations",
        "Corresponding Author's Country",
      ],
      ""
    ) || "";
  if (!raw) return [];
  const parts = String(raw)
    .split(/[;,\|]/g)
    .map((s) => normalizeStr(s))
    .filter(Boolean);
  const out = new Set();
  for (let p of parts) {
    let key = p.toLowerCase();
    const paren = p.match(/\(([^)]+)\)\s*$/);
    if (paren && paren[1]) key = paren[1].toLowerCase();
    if (COUNTRY_ALIASES[key]) {
      out.add(COUNTRY_ALIASES[key]);
      continue;
    }
    if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}$/.test(p)) out.add(p);
  }
  return Array.from(out);
}

/* ===== Keywords ===== */
function extractKeywordsFromRecord(r) {
  const raw =
    pick(
      r.raw,
      [
        "Author Keywords",
        "DE",
        "Keywords",
        "ID",
        "Index Keywords",
        "AuthorKeywords",
      ],
      ""
    ) || "";
  if (!raw) return [];
  return String(raw)
    .split(/[;,\|/]/g)
    .map((s) => normalizeStr(s))
    .filter(Boolean)
    .map((s) => titleCaseSmart(s));
}

/* === Gradient based on number of distinct sources by country === */
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? {
        r: parseInt(m[1], 16),
        g: parseInt(m[2], 16),
        b: parseInt(m[3], 16),
      }
    : { r: 45, g: 106, b: 79 };
}
function rgbToHex({ r, g, b }) {
  const toHex = (v) => v.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}
const BASE_GREEN = hexToRgb("#2d6a4f");
function rampGreen(count, max) {
  if (!count || max <= 0) return "transparent";
  const t = Math.max(0, Math.min(1, count / max));
  const r = lerp(255, BASE_GREEN.r, t);
  const g = lerp(255, BASE_GREEN.g, t);
  const b = lerp(255, BASE_GREEN.b, t);
  return rgbToHex({ r, g, b });
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/* ================== Component ================== */
export default function SourcesTab() {
  const { usefulItems } = useProjectData();
  const docs = usefulItems || [];

  const [tab, setTab] = useState("chart");
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const [hiddenSeries, setHiddenSeries] = useState({});

  // ======== Keywords (simplified) ========
  const [kwSource, setKwSource] = useState("");

  const {
    totalDocs,
    allSources, // [{label,count}]
    top10Chart,
    evolutionSources,
    evolutionData,
    mapCountriesBySource, // Map source -> Map(country -> count)
    keywordsBySource, // Map source -> Map(keyword -> count)
  } = useMemo(() => {
    const total = docs.length;

    const sourceCount = new Map();
    const sourceYearCount = new Map();
    let minY = Infinity,
      maxY = -Infinity;

    const mapCountriesBySource = new Map(); // source -> Map(country -> count)
    const keywordsBySource = new Map(); // source -> Map(keyword -> count)

    for (const r of docs) {
      const rawSrc = pick(r.raw, ["Source title", "SO"], "");
      if (!rawSrc) continue;
      const src = prettifySource(rawSrc);
      if (!src) continue;

      sourceCount.set(src, (sourceCount.get(src) || 0) + 1);

      const y = getYear(r);
      if (y != null) {
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        const bySrc = sourceYearCount.get(y) || new Map();
        bySrc.set(src, (bySrc.get(src) || 0) + 1);
        sourceYearCount.set(y, bySrc);
      }

      const countries = extractCountriesFromRecord(r);
      for (const c of countries) {
        const bySource = mapCountriesBySource.get(src) || new Map();
        bySource.set(c, (bySource.get(c) || 0) + 1);
        mapCountriesBySource.set(src, bySource);
      }

      const kws = extractKeywordsFromRecord(r);
      if (kws.length) {
        const mapKw = keywordsBySource.get(src) || new Map();
        for (const kw of kws) mapKw.set(kw, (mapKw.get(kw) || 0) + 1);
        keywordsBySource.set(src, mapKw);
      }
    }

    const all = Array.from(sourceCount.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    const top10 = all.slice(0, 10).map((s, i) => ({
      rank: i + 1,
      source: s.label,
      sourceShort: truncate(s.label),
      count: s.count,
      percent: total ? (s.count / total) * 100 : 0,
      labelRight: `${fmtInt(s.count)} (${fmtPct1(
        total ? (s.count / total) * 100 : 0
      )})`,
    }));

    const topSources = all.slice(0, 5).map((s) => s.label);
    const years =
      Number.isFinite(minY) &&
      Number.isFinite(maxY) &&
      minY <= maxY
        ? Array.from({ length: maxY - minY + 1 }, (_, k) => minY + k)
        : [];
    const evoData = years.map((y) => {
      const row = { year: String(y) };
      const bySrc = sourceYearCount.get(y) || new Map();
      for (const src of topSources) row[src] = bySrc.get(src) || 0;
      return row;
    });

    return {
      totalDocs: total,
      allSources: all,
      top10Chart: top10,
      evolutionSources: topSources,
      evolutionData: evoData,
      mapCountriesBySource,
      keywordsBySource,
    };
  }, [docs]);

  // default source for keywords tab
  useEffect(() => {
    if (!kwSource && allSources.length) setKwSource(allSources[0].label);
  }, [allSources, kwSource]);

  const evolutionDataAnimated = useMemo(() => {
    if (!evolutionData.length) return evolutionData;
    return evolutionData.map((row) => {
      const out = { ...row };
      for (const src of evolutionSources)
        if (hiddenSeries[src]) out[src] = EPS;
      return out;
    });
  }, [evolutionData, evolutionSources, hiddenSeries]);

  const handleLegendClick = (entry) => {
    const key = entry?.dataKey || entry?.value;
    if (!key) return;
    setHiddenSeries((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const PAGE_TOTAL = Math.max(1, Math.ceil(allSources.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const currentRows = allSources.slice(start, start + PAGE_SIZE);

  const chartHeight = Math.max(280, 44 * Math.max(1, top10Chart.length) + 80);

  // ======== country -> set of sources (ALL sources) ========
  const countryToSources = useMemo(() => {
    const m = new Map();
    for (const [src, countryMap] of mapCountriesBySource.entries()) {
      for (const [country, count] of countryMap.entries()) {
        if (count <= 0) continue;
        const set = m.get(country) || new Set();
        set.add(src);
        m.set(country, set);
      }
    }
    return m;
  }, [mapCountriesBySource]);

  const maxDistinctSources = useMemo(() => {
    let max = 0;
    for (const set of countryToSources.values())
      max = Math.max(max, set.size);
    return max;
  }, [countryToSources]);

  // ======== Keywords by source (fixed Top 10) ========
  const kwStats = useMemo(() => {
    if (!kwSource) return { rows: [], total: 0 };
    const mapKw = keywordsBySource.get(kwSource);
    if (!mapKw) return { rows: [], total: 0 };

    const total = Array.from(mapKw.values()).reduce((a, b) => a + b, 0);
    const rows = Array.from(mapKw.entries())
      .map(([kw, count]) => ({
        kw,
        kwShort: truncate(kw, 36),
        count,
        pct: total ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count || a.kw.localeCompare(b.kw))
      .slice(0, 10); // fixed Top 10

    return { rows, total };
  }, [kwSource, keywordsBySource]);

  /* ================= Map tooltip (smart positioning) ================= */
  const [mapTip, setMapTip] = useState(null);
  const tipRef = useRef(null);

  useEffect(() => {
    const OFFSET = { x: 18, y: 18 };
    const MARGIN = 8;

    function placeTip(x, y) {
      if (!tipRef.current) return;
      const el = tipRef.current;

      const prevVis = el.style.visibility;
      el.style.visibility = "hidden";
      el.style.left = "0px";
      el.style.top = "0px";

      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const left = clamp(x + OFFSET.x, MARGIN, vw - rect.width - MARGIN);
      const top = clamp(y + OFFSET.y, MARGIN, vh - rect.height - MARGIN);

      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.visibility = prevVis || "visible";
    }

    const onMove = (e) => placeTip(e.clientX, e.clientY);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("scroll", onMove, { passive: true });
    window.addEventListener("resize", onMove);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onMove);
      window.removeEventListener("resize", onMove);
    };
  }, []);

  // legend labels for map
  const legendTicks = useMemo(() => {
    const candidates = [0, 1, 2, 3, 5, 10, 20, 50, maxDistinctSources];
    return Array.from(
      new Set(
        candidates.filter(
          (v) =>
            Number.isFinite(v) && v >= 0 && v <= (maxDistinctSources || 0)
        )
      )
    ).sort((a, b) => a - b);
  }, [maxDistinctSources]);

  return (
    <Card>
      <CardBody>
        {/* Tabs */}
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
            { id: "chart", label: "Top sources" },
            { id: "table", label: "Sources table" },
            { id: "evolution", label: "Temporal evolution" },
            { id: "keywords", label: "Keywords by source" },
            { id: "map", label: "Sources map" },
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

        {/* ============ MAP ============ */}
        {tab === "map" && (
          <>
            <h3
              style={{
                textAlign: "center",
                fontSize: "1.5rem",
                padding: "0.5rem",
              }}
            >
              Distribution of sources by country
            </h3>
            <p
              className="muted"
              style={{
                textAlign: "center",
                margin: "-1rem auto 1rem",
                maxWidth: "800px",
              }}
            >
              This map shows the{" "}
              <b>geographical distribution of publication sources</b>, highlighting
              the{" "}
              <b>countries with the greatest diversity of journals and conferences</b>{" "}
              identified in the dataset.
            </p>

            <div
              style={{
                width: "100%",
                height: 560,
                position: "relative",
              }}
            >
              <ComposableMap
                projectionConfig={{ scale: 155 }}
                style={{ width: "100%", height: "100%" }}
              >
                <Geographies geography={WORLD_TOPO_URL}>
                  {({ geographies }) =>
                    geographies.map((geo) => {
                      const name = geo.properties.name;
                      const set = countryToSources.get(name);
                      const count = set ? set.size : 0;
                      const color = rampGreen(count, maxDistinctSources);
                      const list = set
                        ? Array.from(set).sort((a, b) =>
                            a.localeCompare(b)
                          )
                        : [];
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          onMouseEnter={() =>
                            setMapTip({ name, count, list })
                          }
                          onMouseLeave={() => setMapTip(null)}
                          style={{
                            default: {
                              fill: color,
                              outline: "none",
                              stroke: "var(--moon-300)",
                              strokeWidth: 0.5,
                            },
                            hover: {
                              fill: count
                                ? "#4d8c71"
                                : "rgba(45,106,79,.15)",
                              outline: "none",
                              cursor: "pointer",
                            },
                            pressed: {
                              fill: "#2d6a4f",
                              outline: "none",
                            },
                          }}
                        />
                      );
                    })
                  }
                </Geographies>
              </ComposableMap>

              {/* Legend */}
              <div
                style={{
                  position: "absolute",
                  right: 12,
                  bottom: 12,
                  background: "rgba(255,255,255,.92)",
                  border: "1px solid var(--moon-200)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  fontSize: 12,
                  minWidth: 220,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 8 }}>
                  Distinct sources
                </div>
                <div
                  style={{
                    height: 18,
                    background:
                      "linear-gradient(90deg, rgba(45,106,79,0) 0%, #2d6a4f 100%)",
                    border: "1px solid var(--moon-300)",
                    borderRadius: 8,
                    marginBottom: 8,
                    minWidth: 220,
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 6,
                    fontSize: 12,
                  }}
                >
                  {legendTicks.map((t) => (
                    <span
                      key={t}
                      style={{ color: "var(--ink-700)" }}
                    >
                      {fmtInt(t)}
                    </span>
                  ))}
                </div>
              </div>

              {/* Tooltip */}
              <div
                ref={tipRef}
                style={{
                  position: "fixed",
                  pointerEvents: "none",
                  zIndex: 20,
                  display: mapTip ? "block" : "none",
                }}
              >
                {mapTip && (
                  <div style={tipBox}>
                    <div
                      style={{ fontWeight: 700, marginBottom: 4 }}
                    >
                      {mapTip.name}
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      Distinct sources:{" "}
                      <b>{fmtInt(mapTip.count)}</b>
                    </div>
                    {mapTip.list && mapTip.list.length > 0 ? (
                      <>
                        <div
                          className="muted"
                          style={{
                            fontSize: 12,
                            marginBottom: 4,
                          }}
                        >
                          Sources:
                        </div>
                        <div style={{ maxWidth: 360 }}>
                          {mapTip.list.slice(0, 12).map((s) => (
                            <div
                              key={s}
                              style={{
                                fontSize: 12,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              • {s}
                            </div>
                          ))}
                          {mapTip.list.length > 12 && (
                            <div
                              className="muted"
                              style={{ fontSize: 12 }}
                            >
                              +{mapTip.list.length - 12} more…
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div
                        className="muted"
                        style={{ fontSize: 12 }}
                      >
                        No sources detected.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ============ Keywords by source (Top 10, table only) ============ */}
        {tab === "keywords" && (
          <>
            <h3
              style={{
                textAlign: "center",
                fontSize: "1.5rem",
                padding: "0.5rem",
              }}
            >
              Keywords by publication source
            </h3>
            <p
              className="muted"
              style={{
                textAlign: "center",
                margin: "-1rem auto 1rem",
                maxWidth: "800px",
              }}
            >
              This table presents the{" "}
              <b>main keywords associated with each publication source</b>,
              helping to identify the{" "}
              <b>most recurrent themes</b> within each journal or conference.
            </p>

            {/* Source selector */}
            <div
              className="row"
              style={{
                gap: 8,
                justifyContent: "center",
                alignItems: "center",
                margin: "12px 0 6px",
              }}
            >
              <label className="muted">Source:</label>
              <select
                className="input"
                value={kwSource}
                onChange={(e) => setKwSource(e.target.value)}
              >
                {allSources.map((s) => (
                  <option key={s.label} value={s.label}>
                    {s.label} ({fmtInt(s.count)})
                  </option>
                ))}
              </select>
            </div>

            {/* Top 10 table */}
            {!kwStats.rows.length ? (
              <p
                className="muted"
                style={{ textAlign: "center", marginTop: 12 }}
              >
                No keywords found for this source.
              </p>
            ) : (
              <div
                style={{
                  overflowX: "auto",
                  marginTop: 8,
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "separate",
                    borderSpacing: "0 8px",
                  }}
                >
                  <colgroup>
                    <col style={{ width: 72 }} />
                    <col />
                    <col style={{ width: 14 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={thStyle}>#</th>
                      <th style={thStyle}>Keyword</th>
                      <th style={thStyle}>Occurrences</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kwStats.rows.map((r, i) => (
                      <tr
                        key={`${r.kw}-${i}`}
                        style={{ background: "var(--moon-050)" }}
                      >
                        <td style={tdStyle}>{i + 1}</td>
                        <td
                          style={{ ...tdStyle, fontWeight: 600 }}
                          title={r.kw}
                        >
                          {r.kw}
                        </td>
                        <td style={tdStyle}>{fmtInt(r.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ====== Top sources chart ====== */}
        {tab === "chart" && (
          <>
            <h3
              style={{
                textAlign: "center",
                fontSize: "1.5rem",
                padding: "0.5rem",
              }}
            >
              Sources with highest presence in the dataset
            </h3>
            <p
              className="muted"
              style={{
                textAlign: "center",
                margin: "-1rem auto 1rem auto",
                maxWidth: 800,
              }}
            >
              This chart shows the <b>main publication sources</b> in the
              analyzed dataset. The bar length reflects the{" "}
              <b>number of documents</b> per source, while the label displays
              the <b>absolute count</b> and the{" "}
              <b>percentage of participation</b> in the total.
            </p>
            <div style={{ width: "100%", height: chartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={top10Chart}
                  layout="vertical"
                  barCategoryGap={12}
                  margin={{
                    top: 8,
                    right: 24,
                    left: 12,
                    bottom: 8,
                  }}
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
                    dataKey="sourceShort"
                    width={Math.min(
                      360,
                      Math.max(160, estimateYAxisWidth(top10Chart))
                    )}
                    tick={{ fill: "var(--ink-800)", fontSize: 12 }}
                  />
                  <Tooltip
                    wrapperStyle={{ zIndex: 10 }}
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length)
                        return null;
                      const row = payload[0].payload;
                      return (
                        <div style={tipBox}>
                          <div
                            style={{ fontWeight: 700, marginBottom: 6 }}
                          >
                            {row.source}
                          </div>
                          <div>
                            Publications: <b>{fmtInt(row.count)}</b>
                          </div>
                          <div>
                            Share: <b>{fmtPct1(row.percent)}</b>
                          </div>
                          <div>Rank: #{row.rank}</div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="count"
                    name="Publications"
                    stroke="var(--gold-600)"
                    fill="var(--gold-500)"
                    radius={[6, 6, 6, 6]}
                  >
                    <LabelList
                      dataKey="labelRight"
                      position="right"
                      style={{
                        fill: "var(--ink-900)",
                        fontSize: 12,
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {/* ====== Temporal evolution ====== */}
        {tab === "evolution" && (
          <>
            <h3
              style={{
                textAlign: "center",
                fontSize: "1.5rem",
                padding: "0.5rem",
              }}
            >
              Publication trend by source
            </h3>
            <p
              className="muted"
              style={{
                textAlign: "center",
                margin: "-1rem auto 1rem",
                maxWidth: "800px",
              }}
            >
              This chart shows the{" "}
              <b>temporal evolution of the main publication sources</b>, with
              the <b>number of documents per year</b> for each source. The{" "}
              <b>areas are not stacked</b>, and you can{" "}
              <b>toggle individual sources</b> by clicking the legend.
            </p>
            <div style={{ width: "100%", height: 440 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={evolutionDataAnimated}
                  margin={{
                    top: 8,
                    right: 16,
                    left: 8,
                    bottom: 8,
                  }}
                >
                  <defs>
                    <linearGradient
                      id="chartBg_src"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="100%"
                        stopColor="white"
                        stopOpacity={1}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--moon-200)"
                    fill="url(#chartBg_src)"
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
                    formatter={(value, name) => [
                      fmtInt(value < 1 ? 0 : value),
                      name,
                    ]}
                    labelFormatter={(label) => `Year: ${label}`}
                  />
                  <Legend
                    onClick={(entry) => handleLegendClick(entry)}
                    wrapperStyle={{ cursor: "pointer" }}
                    formatter={(value) => (
                      <span
                        style={{
                          opacity: hiddenSeries[value] ? 0.45 : 1,
                          textDecoration: hiddenSeries[value]
                            ? "line-through"
                            : "none",
                        }}
                      >
                        {value}
                      </span>
                    )}
                  />
                  {evolutionSources.map((src, idx) => (
                    <Area
                      key={src}
                      type="monotone"
                      dataKey={src}
                      name={src}
                      stroke={palette[idx % palette.length].stroke}
                      fill={palette[idx % palette.length].fill}
                      fillOpacity={hiddenSeries[src] ? 0.06 : 0.22}
                      strokeOpacity={hiddenSeries[src] ? 0.25 : 1}
                      strokeWidth={2.5}
                      dot={false}
                      isAnimationActive
                      animationDuration={520}
                      animationEasing="ease-in-out"
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {/* ====== Table of sources ====== */}
        {tab === "table" && (
          <>
            <h3
              style={{
                textAlign: "center",
                fontSize: "1.5rem",
                padding: "0.5rem",
              }}
            >
              Publication sources list
            </h3>
            <p
              className="muted"
              style={{
                textAlign: "center",
                margin: "-1rem auto 1rem",
                maxWidth: "800px",
              }}
            >
              The table below lists <b>all publication sources</b> in the
              dataset, showing the <b>absolute number</b> of documents and the{" "}
              <b>percentage share</b> of each.
            </p>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "separate",
                  borderSpacing: "0 8px",
                }}
              >
                <colgroup>
                  <col style={{ width: 72 }} />
                  <col />
                  <col style={{ width: 160 }} />
                  <col style={{ width: 120 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>Source</th>
                    <th style={thStyle}>Publications</th>
                    <th style={thStyle}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {currentRows.map((s, idx) => {
                    const absoluteIndex = start + idx;
                    const pct = totalDocs
                      ? (s.count / totalDocs) * 100
                      : 0;
                    return (
                      <tr
                        key={`${s.label}-${absoluteIndex}`}
                        style={{ background: "var(--moon-050)" }}
                      >
                        <td style={tdStyle}>
                          {absoluteIndex + 1}
                        </td>
                        <td
                          style={{ ...tdStyle, fontWeight: 600 }}
                        >
                          {s.label}
                        </td>
                        <td style={tdStyle}>{fmtInt(s.count)}</td>
                        <td style={tdStyle}>{fmtPct1(pct)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination: 10 items per page */}
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
                  Math.min(start + PAGE_SIZE, allSources.length)
                )}{" "}
                of {fmtInt(allSources.length)}
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
      </CardBody>
    </Card>
  );
}

/* ===== inline styles ===== */
const tipBox = {
  background: "rgba(255,255,255,.7)",
  backdropFilter: "blur(2px)",
  border: "1px solid var(--moon-200)",
  borderRadius: 10,
  padding: "10px 12px",
  boxShadow: "0 6px 18px rgba(0,0,0,.06)",
  color: "var(--ink-900)",
};
const thStyle = {
  textAlign: "center",
  padding: "10px 12px",
  fontSize: ".9rem",
  color: "var(--ink-700)",
  borderBottom: "1px solid var(--moon-200)",
};
const tdStyle = {
  padding: "10px 12px",
  textAlign: "center",
  fontSize: ".95rem",
  color: "var(--ink-900)",
};
