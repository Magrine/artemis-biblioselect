import React, { useMemo } from "react";
import { Card, CardBody } from "../../components/primitives/Card";

export default function StatsPanel({ total, useful, notUseful }) {
  const { remaining, pct } = useMemo(() => {
    const reviewed = useful + notUseful;
    const remaining = Math.max(0, total - reviewed);
    const pct = total ? Math.round((reviewed / total) * 100) : 0;
    return { remaining, pct };
  }, [total, useful, notUseful]);

  return (
    <Card className="surface list-articles-loaded" style={{ marginBottom: 16 }}>
      <CardBody>
        {/* Basic Stats */}
        <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
          <div className="badge">
            <strong>{total}</strong>&nbsp;loaded
          </div>
          <div className="badge olive">
            <strong>{useful}</strong>&nbsp;useful
          </div>
          <div className="badge">
            <strong>{notUseful}</strong>&nbsp;not useful
          </div>
          <div className="badge copper">
            <strong>{remaining}</strong>&nbsp;pending
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              height: 10,
              background: "var(--moon-200)",
              borderRadius: 999,
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                borderRadius: 999,
                background: "var(--olive-600)",
              }}
            />
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            {pct}% reviewed
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
