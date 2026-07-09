import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { summarize, fmtMs, fmtMB } from "./lib/stats.mjs";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("Usage: node benchmark/aggregate-results.mjs <raw-results.json> [more.json ...]");
  process.exit(1);
}

const records = files.flatMap((f) => JSON.parse(readFileSync(f, "utf8")));

const byDataset = new Map();
for (const r of records) {
  if (!byDataset.has(r.dataset)) byDataset.set(r.dataset, []);
  byDataset.get(r.dataset).push(r);
}

const METRICS = [
  { key: "importMs", label: "CSV import & processing time", fmt: fmtMs },
  { key: "filterMs", label: "Filtering / search time", fmt: fmtMs },
  { key: "screeningLatencyMs", label: "Screening action latency (mean click-to-update)", fmt: fmtMs },
  { key: "exportMs", label: "Export time", fmt: fmtMs },
  { key: "renderOverviewMs", label: "Initial dashboard rendering time (Overview, cold)", fmt: fmtMs },
  { key: "renderSourcesMs", label: "Tab switch rendering time (Sources)", fmt: fmtMs },
  { key: "renderAuthorsMs", label: "Tab switch rendering time (Authors)", fmt: fmtMs },
  { key: "renderDocumentsMs", label: "Tab switch rendering time (Documents)", fmt: fmtMs },
  { key: "peakHeapBytes", label: "Peak JS heap usage (any phase)", fmt: fmtMB },
];

function collect(recs, key) {
  if (key === "screeningLatencyMs") {
    return recs.flatMap((r) => r.screeningLatenciesMs || []);
  }
  if (key === "peakHeapBytes") {
    return recs.map((r) =>
      Math.max(
        r.importPeakHeapBytes || 0,
        r.filterPeakHeapBytes || 0,
        r.screeningPeakHeapBytes || 0,
        r.exportPeakHeapBytes || 0,
        r.renderPeakHeapBytes || 0
      )
    );
  }
  return recs.map((r) => r[key]).filter((v) => typeof v === "number");
}

let md = "# BiblioSelect scalability benchmark -- summary\n\n";
md += `Generated from: ${files.join(", ")}\n\n`;

const datasetLabels = [...byDataset.keys()];
md += `| Metric | ${datasetLabels.map((d) => `${d} (n=${byDataset.get(d).length} runs)`).join(" | ")} |\n`;
md += `| --- | ${datasetLabels.map(() => "---").join(" | ")} |\n`;

for (const m of METRICS) {
  const cells = datasetLabels.map((d) => {
    const values = collect(byDataset.get(d), m.key);
    if (!values.length) return "n/a";
    const s = summarize(values);
    return `${m.fmt(s.mean)} ± ${m.fmt(s.stddev).replace(/^-/, "")} (n=${s.n})`;
  });
  md += `| ${m.label} | ${cells.join(" | ")} |\n`;
}

md += "\n## Console errors / page errors observed\n\n";
for (const d of datasetLabels) {
  const total = byDataset.get(d).reduce((a, r) => a + (r.consoleErrors || 0), 0);
  md += `- **${d}**: ${total} error(s) across ${byDataset.get(d).length} run(s).\n`;
}

md += "\n## Storage estimate (navigator.storage.estimate, last run per dataset)\n\n";
for (const d of datasetLabels) {
  const last = byDataset.get(d).at(-1);
  if (last?.storageEstimate) {
    md += `- **${d}**: usage=${fmtMB(last.storageEstimate.usage)}, quota=${fmtMB(last.storageEstimate.quota)}\n`;
  }
}

console.log(md);

const outPath = path.join(path.dirname(files[0]), "summary.md");
writeFileSync(outPath, md, "utf8");
console.error(`\nWritten to ${outPath}`);
