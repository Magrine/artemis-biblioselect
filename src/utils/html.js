export function escapeHTML(s) {
return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}


export function makeHighlighter(query) {
const q = String(query || "").trim();
if (!q) return (text) => escapeHTML(text);
let rx;
try {
rx = new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\$&") + ")", "ig");
} catch {
return (text) => escapeHTML(text);
}
return (text) => escapeHTML(text).replace(rx, '<mark>$1</mark>');
}