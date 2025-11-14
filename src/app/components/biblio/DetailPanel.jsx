import React from "react";
import { Card, CardBody } from "../primitives/Card";
import Button from "../primitives/Button";

export default function DetailPanel({
  current,
  highlight,
  onMarkNotUseful,
  onAddUseful,
}) {
  return (
    <Card className="shadow-md" aria-label="Details & actions">
      <CardBody>
        {!current ? (
          <div className="empty">
            <p>
              Upload a CSV file to get started. Then click a title to see the
              abstract and DOI.
            </p>
          </div>
        ) : (
          <div>
            {/* Header with main actions + DOI access */}
            <div
              role="toolbar"
              aria-label="Article actions"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                padding: "8px 10px",
                margin: "0 0 12px 0",
                borderBottom: "1px solid var(--ink-200, #e5e7eb)",
                background: "var(--paper, #fff)",
                borderRadius: 8,
              }}
            >
              {/* Primary actions */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button type="button" onClick={() => onAddUseful(current.id)}>
                  Useful
                </Button>
                <Button
                  type="button"
                  variant="red"
                  onClick={() => onMarkNotUseful(current.id)}
                >
                  Not useful
                </Button>
              </div>

              {/* External access (DOI) */}
              <div>
                {current.doi ? (
                  <a
                    href={
                      current.doi.startsWith("10.")
                        ? `https://doi.org/${current.doi}`
                        : current.doi
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button variant="copper">Open DOI</Button>
                  </a>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled
                    title="No DOI available"
                  >
                    No DOI
                  </Button>
                )}
              </div>
            </div>

            {/* Title */}
            <h1
              style={{ marginTop: 0, fontSize: "clamp(1.1rem, 2vw, 1.5rem)" }}
            >
              {current.title}
            </h1>

            {/* Justified abstract with highlight */}
            {current.abstract ? (
              <p
                style={{ textAlign: "justify" }}
                dangerouslySetInnerHTML={{
                  __html: highlight(current.abstract),
                }}
              />
            ) : (
              <p className="muted">No abstract.</p>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
