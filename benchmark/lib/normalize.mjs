export const FIELD_MAP = {
  title: ["Title", "Document Title", "TI"],
  abstract: ["Abstract", "AB"],
  cited: ["Cited by", "Times Cited", "TC"],
  doi: ["DOI", "DI"],
};

export function getField(o, keys) {
  for (const k of keys) {
    if (k in o && o[k] != null && String(o[k]).trim() !== "") return o[k];
  }
  return "";
}

export function normalizeRow(o, id) {
  const title = String(getField(o, FIELD_MAP.title)).trim();
  const abstract = String(getField(o, FIELD_MAP.abstract)).trim();
  let cited = getField(o, FIELD_MAP.cited);
  cited = cited === "" ? 0 : Number(String(cited).replace(/[^0-9.-]/g, "")) || 0;
  const doiRaw = String(getField(o, FIELD_MAP.doi)).trim();
  const doi = doiRaw.replace(/^https?:\/\/doi.org\//i, "");
  return { id, title, abstract, cited, doi, raw: o };
}
