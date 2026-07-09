import React from "react";
import { Card, CardBody } from "../../components/primitives/Card";

export default function ListPanel({ items, currentId, onSelect, highlight }) {
  return (
    <Card
      className="shadow-md list-articles-loaded"
      aria-label="Publications list"
    >
      <CardBody style={{ display: "grid", gap: 16 }}>
        <h2 style={{ margin: 0, textAlign: "center" }}>Loaded</h2>

        <div role="listbox" className="listbox" aria-live="polite">
          {items.length === 0 && (
            <div className="empty">No results.</div>
          )}

          {items.map((r) => (
            <button
              key={r.id}
              type="button"
              role="option"
              aria-selected={currentId === r.id}
              aria-label={r.title}
              onClick={() => onSelect(r.id)}
              className="list-item"
            >
              {/* Title */}
              <div
                className="title"
                dangerouslySetInnerHTML={{ __html: highlight(r.title) }}
              />

              {/* DOI indicator + citation count */}
              <div className="meta">
                <span className="muted">
                  {r.doi ? "DOI available" : "No DOI"}
                </span>
                <span className="badge" title="Citations">
                  {r.cited ?? 0}
                </span>
              </div>
            </button>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
