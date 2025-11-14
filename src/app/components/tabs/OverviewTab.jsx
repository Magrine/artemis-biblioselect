import React, { useMemo, useState } from "react";
import { Card, CardBody } from "../../components/primitives/Card";
import { useProjectData } from "../../../hooks/useProjectData";
import IndicatorCard from "../primitives/IndicatorCard";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

/* =============== Helpers ================= */
const pick = (obj, keys, def = "") => {
  for (const k of keys)
    if (obj && obj[k] != null && String(obj[k]).trim() !== "") return obj[k];
  return def;
};

const splitList = (val) => {
  const s = String(val ?? "").trim();
  if (!s) return [];
  return s
    .split(/[;|]+/g)
    .flatMap((t) => t.split(/\s*,\s*(?=[^)]*(?:\(|$))/g))
    .map((x) => x.trim())
    .filter(Boolean);
};

// split ONLY by semicolon/pipe for affiliations
const splitAffs = (val) =>
  String(val ?? "")
    .split(/[;|]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

// split ONLY by semicolon for references
const splitRefs = (val) =>
  String(val ?? "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

const normalizeStr = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.;:,]+$/g, "")
    .trim();

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

const normalizeCountry = (c) => {
  const t = normalizeStr(String(c).replace(/\.+$/, ""));
  if (!t) return "";
  if (
    ["usa", "u.s.a", "united states of america", "u s a"].includes(t)
  )
    return "united states";
  if (["uk", "u.k"].includes(t)) return "united kingdom";
  return t;
};

/* =============== Derived data ================= */
function useDerivedData(docs) {
  return useMemo(() => {
    const nowY = new Date().getFullYear();

    const map = new Map();
    for (const r of docs) {
      const y = getYear(r);
      if (y == null) continue;
      const cited = getCited(r);
      const prev = map.get(y) || { year: y, count: 0, citedSum: 0 };
      prev.count += 1;
      prev.citedSum += cited;
      map.set(y, prev);
    }
    const yearBuckets = Array.from(map.values()).sort(
      (a, b) => a.year - b.year
    );

    const analysisPeriod = yearBuckets.length
      ? `${yearBuckets[0].year}–${yearBuckets.at(-1).year}`
      : "—";

    const sourcesSet = new Set();
    for (const r of docs) {
      const s = pick(r.raw, ["Source title"], "");
      if (!s) continue;
      const norm = normalizeStr(s);
      if (norm) sourcesSet.add(norm);
    }
    const sourcesDistinct = sourcesSet.size;

    const authorsSet = new Set();
    let totalAuthorsSum = 0;
    let singleAuthorDocs = 0;
    for (const r of docs) {
      const authors = splitList(
        pick(r.raw, ["AU", "Authors", "Author(s)", "Author Names"], "")
      )
        .map(normalizeStr)
        .filter(Boolean);

      authors.forEach((a) => authorsSet.add(a));
      totalAuthorsSum += authors.length;
      if (authors.length === 1) singleAuthorDocs += 1;
    }

    const totalAuthorsDistinct = authorsSet.size;
    const authorsPerDoc = docs.length
      ? totalAuthorsSum / docs.length
      : 0;

    let intl = 0,
      counted = 0;
    const countriesByDoc = [];

    for (const r of docs) {
      const affRaw = pick(
        r.raw,
        ["C1", "Affiliations", "Author Address"],
        ""
      );
      if (!affRaw) continue;

      const countries = new Set();
      for (const aff of splitAffs(affRaw)) {
        const parts = aff
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (!parts.length) continue;
        const maybeCountry = parts.at(-1);
        const country = normalizeCountry(maybeCountry);
        if (country) countries.add(country);
      }

      if (!countries.size) continue;
      counted += 1;
      countriesByDoc.push([...countries]);
      if (countries.size > 1) intl += 1;
    }

    const internationalCoauthorshipPct = counted
      ? (intl / counted) * 100
      : 0;

    const keywordsSet = new Set();
    for (const r of docs) {
      splitList(
        pick(
          r.raw,
          ["DE", "Author Keywords", "Author Keywords (DE)"],
          ""
        )
      )
        .map(normalizeStr)
        .forEach((k) => k && keywordsSet.add(k));
    }
    const authorKeywordsDistinct = keywordsSet.size;

    const refsSet = new Set();
    for (const r of docs) {
      const refsRaw = pick(r.raw, ["CR", "References"], "");
      const perDocSet = new Set();
      for (const ref of splitRefs(refsRaw)) {
        const norm = normalizeStr(ref);
        if (norm) perDocSet.add(norm);
      }
      perDocSet.forEach((ref) => refsSet.add(ref));
    }
    const uniqueReferencesCount = refsSet.size;

    const ages = docs
      .map((r) => {
        const y = getYear(r);
        return y != null ? nowY - y : null;
      })
      .filter((v) => v != null);

    const avgAgeYears = ages.length
      ? ages.reduce((s, n) => s + n, 0) / ages.length
      : 0;

    const citedList = docs.map(getCited);
    const avgCitationsPerDoc = docs.length
      ? citedList.reduce((s, n) => s + n, 0) / docs.length
      : 0;

    let annualGrowthRate = 0;
    const arr = yearBuckets.filter((x) => x.count > 0);
    if (arr.length >= 2) {
      const first = arr[0].count;
      const last = arr.at(-1).count;
      const years = arr.at(-1).year - arr[0].year || 1;
      if (first > 0)
        annualGrowthRate = (Math.pow(last / first, 1 / years) - 1) * 100;
    }

    const annualChartsData = yearBuckets.map(
      ({ year, count, citedSum }) => {
        const meanTCperArt = count ? citedSum / count : 0;
        const citableYears = Math.max(1, nowY - year + 1);
        const meanTCperYear = meanTCperArt / citableYears;
        return {
          year: String(year),
          docs: count,
          avgCitationsPerYear: meanTCperYear,
        };
      }
    );

    return {
      analysisPeriod,
      sourcesDistinct,
      totalDocs: docs.length,
      annualGrowthRate,
      totalAuthorsDistinct,
      authorsPerDoc,
      singleAuthorDocs,
      internationalCoauthorshipPct,
      authorKeywordsDistinct,
      uniqueReferencesCount,
      avgAgeYears,
      avgCitationsPerDoc,
      annualChartsData,
    };
  }, [docs]);
}

/* =============== Tabs metadata ================= */
const TABS = {
  summary: {
    id: "summary",
    label: "Summary",
    helpText:
      "A consolidated overview of the selected publications, including publication period, productivity, authorship structure, international collaboration, and citation performance.",
  },
  prod: {
    id: "prod",
    label: "Annual output",
    helpText:
      "Displays how many documents were published each year, helping you identify trends and growth in scientific production.",
  },
  avgCitations: {
    id: "avgCitations",
    label: "Citations per year",
    helpText:
      "Shows the average number of citations per year, indicating the visibility and impact of the publications over time.",
  },
};

/* =============== Reusable chart ================= */
function MetricAreaChart({ data, dataKey, seriesName }) {
  return (
    <ResponsiveContainer width="100%" height={440}>
      <AreaChart
        data={data}
        margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
      >
        <defs>
          <linearGradient id="chartBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="100%" stopColor="white" stopOpacity={1} />
          </linearGradient>
          <linearGradient id="gradMetric" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--gold-500)"
              stopOpacity={0.28}
            />
            <stop
              offset="100%"
              stopColor="var(--gold-500)"
              stopOpacity={0.05}
            />
          </linearGradient>
        </defs>

        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--moon-200)"
          fill="url(#chartBg)"
        />
        <XAxis
          dataKey="year"
          tick={{ fill: "var(--ink-600)", fontSize: 12 }}
          tickMargin={8}
          axisLine={{ stroke: "var(--moon-200)" }}
          tickLine={{ stroke: "var(--moon-200)" }}
        />
        <YAxis
          tick={{ fill: "var(--ink-600)", fontSize: 12 }}
          tickMargin={6}
          axisLine={{ stroke: "var(--moon-200)" }}
          tickLine={{ stroke: "var(--moon-200)" }}
        />
        <Tooltip />
        <Area
          type="monotone"
          dataKey={dataKey}
          name={seriesName}
          stroke="var(--gold-500)"
          strokeWidth={3}
          fill="url(#gradMetric)"
          dot={false}
          isAnimationActive
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* =============== Component ================= */
export default function OverviewTab() {
  const { usefulItems } = useProjectData();
  const docs = usefulItems;
  const [tab, setTab] = useState("summary");

  const {
    analysisPeriod,
    sourcesDistinct,
    totalDocs,
    annualGrowthRate,
    totalAuthorsDistinct,
    authorsPerDoc,
    singleAuthorDocs,
    internationalCoauthorshipPct,
    authorKeywordsDistinct,
    uniqueReferencesCount,
    avgAgeYears,
    avgCitationsPerDoc,
    annualChartsData,
  } = useDerivedData(docs);

  return (
    <Card>
      <CardBody>
        {/* Tabs */}
        <div
          className="row"
          style={{
            gap: 8,
            marginBottom: 4,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {Object.values(TABS).map((t) => (
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

        {/* Help text */}
        <p
          className="muted"
          style={{
            textAlign: "center",
            maxWidth: 720,
            margin: "0 auto 16px",
            fontSize: "0.9rem",
            paddingTop: 16,  
          }}
        >
          {TABS[tab].helpText}
        </p>

        {tab === "summary" ? (
          <>
            <h3
              style={{
                textAlign: "center",
                fontSize: "1.5rem",
              }}
            >
              Overview
            </h3>
            {totalDocs === 0 ? (
              <p className="muted">
                No articles selected yet. Mark items as useful to see results here.
              </p>
            ) : (
              <div
                className="indicadores-grid"
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(260px, 1fr))",
                }}
              >
                <IndicatorCard
                  title="Analysis period"
                  value={analysisPeriod}
                  description="Time window covered by the selected publications."
                  tone="olive"
                />
                <IndicatorCard
                  title="Sources"
                  value={fmtInt(sourcesDistinct)}
                  description="Distinct journals, conferences, or books where the documents were published."
                  tone="olive"
                />
                <IndicatorCard
                  title="Documents"
                  value={fmtInt(totalDocs)}
                  description="Total number of selected publications."
                  tone="olive"
                />
                <IndicatorCard
                  title="Annual growth rate"
                  value={fmtPct2(annualGrowthRate)}
                  description="Compound annual growth rate (CAGR) of the publication output."
                  tone="olive"
                />

                <IndicatorCard
                  title="Authors"
                  value={fmtInt(totalAuthorsDistinct)}
                  description="Distinct authors appearing in the selected documents."
                  tone="olive"
                />
                <IndicatorCard
                  title="Single-author documents"
                  value={fmtInt(singleAuthorDocs)}
                  description="Documents written by only one author."
                  tone="olive"
                />
                <IndicatorCard
                  title="International co-authorship"
                  value={fmtPct2(internationalCoauthorshipPct)}
                  description="Percentage of publications authored by researchers from more than one country."
                  tone="olive"
                />
                <IndicatorCard
                  title="Authors per document"
                  value={fmt2(authorsPerDoc)}
                  description="Average number of authors per publication."
                  tone="olive"
                />

                <IndicatorCard
                  title="Author keywords"
                  value={fmtInt(authorKeywordsDistinct)}
                  description="Distinct keywords provided by authors."
                  tone="olive"
                />
                <IndicatorCard
                  title="References (unique)"
                  value={fmtInt(uniqueReferencesCount)}
                  description="Unique referenced works cited across all documents."
                  tone="olive"
                />
                <IndicatorCard
                  title="Average document age"
                  value={fmt2(avgAgeYears)}
                  description="Average age (in years) of the selected publications."
                  tone="olive"
                />
                <IndicatorCard
                  title="Average citations per document"
                  value={fmt2(avgCitationsPerDoc)}
                  description="Average number of citations received by each publication."
                  tone="olive"
                />
              </div>
            )}
          </>
        ) : tab === "prod" ? (
          <>
            <h3
              style={{
                textAlign: "center",
                fontSize: "1.5rem",
              }}
            >
              Annual scientific output
            </h3>
            {totalDocs === 0 ? (
              <p className="muted">No selected articles to plot.</p>
            ) : (
              <div style={{ width: "100%", height: 420 }}>
                <MetricAreaChart
                  data={annualChartsData}
                  dataKey="docs"
                  seriesName="Documents"
                />
              </div>
            )}
          </>
        ) : (
          <>
            <h3
              style={{
                textAlign: "center",
                fontSize: "1.5rem",
              }}
            >
              Average citations per year
            </h3>
            {totalDocs === 0 ? (
              <p className="muted">No selected articles to plot.</p>
            ) : (
              <div style={{ width: "100%", height: 420 }}>
                <MetricAreaChart
                  data={annualChartsData}
                  dataKey="avgCitationsPerYear"
                  seriesName="Citations/year (average)"
                />
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

const fmtInt = (n) =>
  Number.isFinite(Number(n)) ? Number(n).toLocaleString() : String(n ?? "—");

const fmt2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : "—");

const fmtPct2 = (n) =>
  Number.isFinite(n) ? `${n.toFixed(1)}%` : "—";
