import React from "react";
import { Card, CardBody } from "../primitives/Card";
import Button from "../primitives/Button";

export default function SelectedPanel({ items, onRemove, onDownload }) {
  return (
    <Card
      className="shadow-md list-articles-loaded"
      aria-label="Selected publications"
    >
      <CardBody style={{ display: "grid", gap: 16 }}>
        {/* Header */}
        <h2 style={{ margin: 0, textAlign: "center" }}>Selected</h2>

        {/* Download CSV */}
        <Button className="small" type="button" onClick={onDownload}>
          Download (.csv)
        </Button>

        {/* List */}
        <div role="listbox" className="listbox" aria-live="polite">
          {items.length === 0 && (
            <div className="empty">No items selected yet.</div>
          )}

          {items.map((x) => (
            <div
              key={x.id}
              role="option"
              className="list-item"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 8,
                alignItems: "center",
              }}
            >
              {/* Title only */}
              <div className="title">{x.title}</div>

              {/* Remove button */}
              <Button
                className="small"
                type="button"
                variant="secondary"
                aria-label={`Remove ${x.title}`}
                onClick={() => onRemove(x.id)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
