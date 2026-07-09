import { chromium } from "playwright";
import { performance } from "node:perf_hooks";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCSV } from "./lib/csv.mjs";
import { normalizeRow } from "./lib/normalize.mjs";
import { summarize, fmtMs, fmtMB } from "./lib/stats.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DATASETS_DIR = path.join(__dirname, "datasets");

function parseArgs(argv) {
  const out = { baseUrl: "http://localhost:4173", reps: 5, datasets: null, sample: 30, outDir: path.join(__dirname, "results"), headed: false };
  for (const a of argv) {
    const [k, v] = a.replace(/^--/, "").split("=");
    if (k === "base-url") out.baseUrl = v;
    else if (k === "reps") out.reps = Number(v);
    else if (k === "datasets") out.datasets = v.split(",").map((s) => s.trim());
    else if (k === "sample") out.sample = Number(v);
    else if (k === "out") out.outDir = path.isAbsolute(v) ? v : path.join(ROOT, v);
    else if (k === "headed") out.headed = true;
  }
  return out;
}

function discoverDatasets(dir) {
  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".csv"));
  if (!files.length) throw new Error(`No .csv files found in ${dir}`);
  return files
    .map((f) => ({ label: f.replace(/\.csv$/i, ""), file: path.join(dir, f) }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}

function loadDatasetMeta(file) {
  const text = readFileSync(file, "utf8");
  const rows = parseCSV(text);
  const header = rows[0];
  const normalized = rows.slice(1).map((r, i) => {
    const obj = {};
    header.forEach((h, idx) => (obj[h] = r[idx]));
    return normalizeRow(obj, i);
  });

  // pick a search term appearing in roughly 5-40% of records (closest to 15%)
  const termCounts = new Map();
  for (const r of normalized) {
    const words = new Set(`${r.title} ${r.abstract}`.toLowerCase().match(/[a-z]{5,}/g) || []);
    for (const w of words) termCounts.set(w, (termCounts.get(w) || 0) + 1);
  }
  let term = null;
  let bestScore = -Infinity;
  const n = normalized.length;
  for (const [w, c] of termCounts) {
    const frac = c / n;
    if (frac < 0.05 || frac > 0.4) continue;
    const score = -Math.abs(frac - 0.15);
    if (score > bestScore) {
      bestScore = score;
      term = w;
    }
  }
  if (!term) throw new Error(`Could not find a representative search term in ${file}`);

  const expectedFilteredCount = normalized.filter(
    (r) => r.title.toLowerCase().includes(term) || r.abstract.toLowerCase().includes(term)
  ).length;

  return { rowCount: normalized.length, term, expectedFilteredCount };
}

async function sampleWhile(client, fn) {
  const samples = [];
  let stop = false;
  const sampler = (async () => {
    while (!stop) {
      try {
        const { metrics } = await client.send("Performance.getMetrics");
        const heap = metrics.find((m) => m.name === "JSHeapUsedSize")?.value ?? 0;
        samples.push(heap);
      } catch {
        // page mid-navigation; skip this tick
      }
      await new Promise((r) => setTimeout(r, 150));
    }
  })();

  const t0 = performance.now();
  const result = await fn();
  const ms = performance.now() - t0;
  stop = true;
  await sampler;

  return { result, ms, peakHeapBytes: samples.length ? Math.max(...samples) : 0 };
}

async function createProject(page, baseUrl, name) {
  await page.goto(`${baseUrl}/#/`);
  await page.locator("#projectName").fill(name);
  await page.getByRole("button", { name: "Create Project", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#projectName")?.value === "");
  const projectId = await page.evaluate(() => localStorage.getItem("biblio:activeProject"));
  if (!projectId) throw new Error("Project creation failed: no active project id in localStorage.");
  return projectId;
}

async function gotoHash(page, hash) {
  await page.evaluate((h) => {
    window.location.hash = h;
  }, hash);
}

async function importCsv(page, projectId, filePath, expectedCount) {
  await gotoHash(page, `/filtering?project=${encodeURIComponent(projectId)}`);
  await page.getByRole("button", { name: /Upload/ }).waitFor({ state: "visible" });
  await page.locator("#fileInput").setInputFiles(filePath);
  await page.waitForFunction(
    (expected) => {
      const el = document.querySelectorAll(".badge:not(.olive):not(.copper) strong")[0];
      return !!el && el.textContent.trim() === String(expected);
    },
    expectedCount,
    { timeout: 180000 }
  );
}

// NOTE: ListPanel's <Card aria-label="Publications list"> never reaches the
// DOM -- Card.jsx (src/app/components/primitives/Card.jsx) only forwards
// {children, className, style}, silently dropping every other prop
// (including aria-label). That's a real accessibility bug in the app
// itself, independent of this benchmark. We select on structure instead:
// ListPanel renders each row as <button role="option">, SelectedPanel
// renders <div role="option"> -- so `button[role="option"]` is unambiguous.
async function measureFilter(page, term, expectedCount) {
  await page.locator("#q").fill(term);
  await page.waitForFunction(
    (expected) => document.querySelectorAll('button[role="option"]').length === expected,
    expectedCount,
    { timeout: 60000 }
  );
}

async function clearFilter(page, totalCount) {
  await page.locator("#q").fill("");
  await page.waitForFunction(
    (expected) => document.querySelectorAll('button[role="option"]').length === expected,
    totalCount,
    { timeout: 60000 }
  );
}

async function measureScreeningLatency(page, sampleSize) {
  const timings = [];
  const usefulBtn = page.getByRole("toolbar", { name: "Article actions" }).getByRole("button", { name: "Useful", exact: true });
  for (let i = 1; i <= sampleSize; i++) {
    const t0 = performance.now();
    await usefulBtn.click();
    await page.waitForFunction(
      (expected) => {
        const el = document.querySelector(".badge.olive strong");
        return !!el && el.textContent.trim() === String(expected);
      },
      i,
      { timeout: 30000 }
    );
    timings.push(performance.now() - t0);
  }
  return timings;
}

// Seeds usefulIdsArr = all rows directly into the project's UI-state
// localStorage entry, then nudges the already-mounted useProjectState hook
// to pick it up via the same "biblio:ui:changed" CustomEvent it dispatches
// internally on same-tab changes (see src/hooks/useProjectState.js). This
// avoids a page.reload(), which would otherwise re-parse the whole CSV a
// second time (real cost at 10k rows) just to apply the seed.
async function seedFullyUseful(page, projectId, rowCount) {
  const ids = Array.from({ length: rowCount }, (_, i) => i);
  await page.evaluate(
    ({ key, ids }) => {
      const state = { query: "", sortMode: "cit_desc", currentId: null, hiddenIdsArr: [], usefulIdsArr: ids };
      localStorage.setItem(key, JSON.stringify(state));
      window.dispatchEvent(new CustomEvent("biblio:ui:changed", { detail: { key, stamp: `benchmark-seed-${Date.now()}` } }));
    },
    { key: `biblio:ui:${projectId}`, ids }
  );
  await page.waitForFunction(
    (expected) => {
      const el = document.querySelector(".badge.olive strong");
      return !!el && el.textContent.trim() === String(expected);
    },
    rowCount,
    { timeout: 60000 }
  );
}

async function measureExport(page) {
  const t0 = performance.now();
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 60000 }),
    page.getByRole("button", { name: "Download (.csv)", exact: true }).click(),
  ]);
  const ms = performance.now() - t0;
  return { ms, suggestedFilename: download.suggestedFilename() };
}

// A rendered tab is either: (a) it mounted a chart/table, or (b) for
// Overview's default "Summary" sub-view, a healthy amount of text content
// with no "nothing selected" placeholder. Checking only for svg/canvas/table
// misses Overview's Summary sub-view, which is stat cards/text, not a chart.
function isTabReady(id) {
  const panel = document.querySelector(`#panel-${id}`);
  if (!panel) return false;
  if (panel.querySelector("svg, canvas, table")) return true;
  const text = panel.innerText || "";
  return text.length > 200 && !text.includes("No articles selected yet");
}

async function measureResultsRendering(page, projectId) {
  const results = {};

  const t0 = performance.now();
  await gotoHash(page, `/results?project=${encodeURIComponent(projectId)}&tab=overview`);
  await page.waitForFunction(isTabReady, "overview", { timeout: 120000 });
  results.overview = performance.now() - t0;

  for (const [tabKey, label] of [
    ["sources", "Sources"],
    ["authors", "Authors"],
    ["documents", "Documents"],
  ]) {
    const t1 = performance.now();
    await page.getByRole("tab", { name: label, exact: true }).click();
    await page.waitForFunction(isTabReady, tabKey, { timeout: 120000 });
    results[tabKey] = performance.now() - t1;
  }

  return results;
}

async function runOneRepetition(browser, baseUrl, dataset, meta, rep, sampleSize) {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send("Performance.enable");

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  const record = { dataset: dataset.label, size: meta.rowCount, rep, consoleErrors: 0 };

  try {
    const projectId = await createProject(page, baseUrl, `bench-${dataset.label}-${rep}-${Date.now()}`);

    const importPhase = await sampleWhile(client, () => importCsv(page, projectId, dataset.file, meta.rowCount));
    record.importMs = importPhase.ms;
    record.importPeakHeapBytes = importPhase.peakHeapBytes;

    const filterPhase = await sampleWhile(client, () => measureFilter(page, meta.term, meta.expectedFilteredCount));
    record.filterMs = filterPhase.ms;
    record.filterPeakHeapBytes = filterPhase.peakHeapBytes;

    await clearFilter(page, meta.rowCount);

    const screeningPhase = await sampleWhile(client, () => measureScreeningLatency(page, sampleSize));
    record.screeningLatenciesMs = screeningPhase.result;
    record.screeningPeakHeapBytes = screeningPhase.peakHeapBytes;

    await seedFullyUseful(page, projectId, meta.rowCount);

    const exportPhase = await sampleWhile(client, () => measureExport(page));
    record.exportMs = exportPhase.result.ms;
    record.exportPeakHeapBytes = exportPhase.peakHeapBytes;

    const renderPhase = await sampleWhile(client, () => measureResultsRendering(page, projectId));
    record.renderOverviewMs = renderPhase.result.overview;
    record.renderSourcesMs = renderPhase.result.sources;
    record.renderAuthorsMs = renderPhase.result.authors;
    record.renderDocumentsMs = renderPhase.result.documents;
    record.renderPeakHeapBytes = renderPhase.peakHeapBytes;

    const storageEstimate = await page.evaluate(async () => {
      if (!navigator.storage?.estimate) return null;
      const { usage, quota } = await navigator.storage.estimate();
      return { usage, quota };
    });
    record.storageEstimate = storageEstimate;
  } finally {
    record.consoleErrors = consoleErrors.length;
    record.consoleErrorSample = consoleErrors.slice(0, 5);
    await context.close();
  }

  return record;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const allDatasets = discoverDatasets(DATASETS_DIR);
  const datasets = args.datasets ? allDatasets.filter((d) => args.datasets.includes(d.label)) : allDatasets;

  if (!datasets.length) {
    console.error("No datasets selected. Available:", allDatasets.map((d) => d.label).join(", "));
    process.exit(1);
  }

  mkdirSync(args.outDir, { recursive: true });

  console.log(`BiblioSelect scalability benchmark`);
  console.log(`base URL: ${args.baseUrl} | reps: ${args.reps} | screening sample: ${args.sample}`);
  console.log(`datasets found in ${DATASETS_DIR}: ${datasets.map((d) => d.label).join(", ")}`);
  console.log("");

  const browser = await chromium.launch({ headless: !args.headed });
  const allRecords = [];

  try {
    for (const dataset of datasets) {
      console.log(`Loading dataset metadata: ${dataset.file}`);
      const meta = loadDatasetMeta(dataset.file);
      console.log(`  rows=${meta.rowCount} searchTerm="${meta.term}" expectedFilteredCount=${meta.expectedFilteredCount}`);

      for (let rep = 1; rep <= args.reps; rep++) {
        process.stdout.write(`  [${dataset.label}] rep ${rep}/${args.reps} ... `);
        const record = await runOneRepetition(browser, args.baseUrl, dataset, meta, rep, args.sample);
        allRecords.push(record);
        console.log(`import=${fmtMs(record.importMs)} export=${fmtMs(record.exportMs)} overview=${fmtMs(record.renderOverviewMs)} errors=${record.consoleErrors}`);
      }
    }
  } finally {
    await browser.close();
  }

  const rawPath = path.join(args.outDir, `raw-${Date.now()}.json`);
  writeFileSync(rawPath, JSON.stringify(allRecords, null, 2), "utf8");
  console.log(`\nRaw results written to ${rawPath}`);
  console.log(`Run: node benchmark/aggregate-results.mjs "${rawPath}"  to produce the summary table.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
