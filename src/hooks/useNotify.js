import { useCallback } from "react";
export function useNotify() {
const show = useCallback((msg) => {
const t = document.createElement("div");
t.textContent = msg;
Object.assign(t.style, { position: "fixed", bottom: "18px", left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,.8)", color: "#fff", padding: "10px 14px", borderRadius: "10px", zIndex: 50 });
document.body.appendChild(t);
setTimeout(() => t.remove(), 1400);
}, []);
return show;
}