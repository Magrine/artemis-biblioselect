export function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM

  const rows = [];
  let row = [];
  const parts = [];
  let inQuotes = false;
  let i = 0;
  let chunkStart = 0;
  const n = text.length;

  const flushField = (end) => {
    parts.push(text.slice(chunkStart, end));
    row.push(parts.length === 1 ? parts[0] : parts.join(""));
    parts.length = 0;
  };

  while (i < n) {
    if (inQuotes) {
      const q = text.indexOf('"', i);
      if (q === -1) {
        parts.push(text.slice(chunkStart, n));
        chunkStart = i = n;
        break;
      }
      if (text[q + 1] === '"') {
        parts.push(text.slice(chunkStart, q + 1)); // keep one literal quote
        i = chunkStart = q + 2;
        continue;
      }
      parts.push(text.slice(chunkStart, q));
      inQuotes = false;
      i = chunkStart = q + 1;
      continue;
    }

    const c = text[i];
    if (c === '"') {
      // entering a quoted span; anything buffered so far in this field
      // (e.g. unquoted prefix) is flushed as-is, quote itself is not kept
      parts.push(text.slice(chunkStart, i));
      inQuotes = true;
      i = chunkStart = i + 1;
      continue;
    }
    if (c === ",") {
      flushField(i);
      i = chunkStart = i + 1;
      continue;
    }
    if (c === "\r" || c === "\n") {
      flushField(i);
      rows.push(row);
      row = [];
      i += c === "\r" && text[i + 1] === "\n" ? 2 : 1;
      chunkStart = i;
      continue;
    }
    i += 1;
  }

  if (chunkStart < n || row.length || parts.length) {
    flushField(n);
  }
  if (row.length > 1 || (row.length === 1 && row[0] !== "")) {
    rows.push(row);
  }

  return rows;
}

/** Escapes one field per RFC4180 (quotes only when needed). */
export function escapeField(value) {
  const s = value == null ? "" : String(value);
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** Serializes rows (array of array-of-strings) back into CSV text (CRLF, UTF-8 BOM). */
export function writeCSV(rows) {
  const BOM = "﻿";
  const body = rows.map((r) => r.map(escapeField).join(",")).join("\r\n");
  return BOM + body + "\r\n";
}
