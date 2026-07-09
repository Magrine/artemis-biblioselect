// src/app/components/primitives/Alert.jsx
import React from "react";

export default function Alert({ type = "error", children }) {
  const isError = type === "error";
  const bg = isError ? "#fdecec" : "#ecfdf5"; // vermelho claro | verde claro
  const border = isError ? "#f5c2c2" : "#a7f3d0"; // vermelho | verde
  const color = "#111"; // texto principal

  return (
    <div
      role={isError ? "alert" : "status"}
      style={{
        background: bg,
        border: `1px solid ${border}`,
        padding: "12px 16px",
        textAlign: "center",  
        borderRadius: 8,
        marginBottom: 12,
        fontSize: 14,
        color,
      }}
    >
      <strong></strong>{" "}
      <span>{children}</span>
    </div>
  );
}
