import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const LS_NS = "biblio:ui";
const evName = "biblio:ui:changed";

function buildKey(baseKey, projectId) {
  const k = (baseKey || LS_NS).trim();
  return projectId ? `${k}:${projectId}` : k;
}
function makeStamp() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function useProjectState({ key = LS_NS, initialValue, projectId }) {
  const lsKey = useMemo(() => buildKey(key, projectId), [key, projectId]);

  const [state, setState] = useState(initialValue || {});
  const [loading, setLoading] = useState(true);

  // Refs para evitar loops
  const lastJsonRef = useRef("");       // última versão salva (JSON)
  const lastStampRef = useRef("");      // último stamp que EU emiti
  const mountedRef  = useRef(false);

  // Carregar do localStorage ao montar/trocar de projeto
  useEffect(() => {
    setLoading(true);
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setState({ ...initialValue, ...parsed });
        lastJsonRef.current = raw; // alinha o ponteiro de comparação
      } else {
        const json = JSON.stringify(initialValue || {});
        setState(initialValue || {});
        lastJsonRef.current = json;
        // salva inicial apenas se não existir nada
        localStorage.setItem(lsKey, json);
      }
    } catch {
      const json = JSON.stringify(initialValue || {});
      setState(initialValue || {});
      lastJsonRef.current = json;
      try { localStorage.setItem(lsKey, json); } catch {}
    } finally {
      setLoading(false);
      mountedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lsKey]);

  // Persistir mudanças (evita escrita redundante + evita loop de evento)
  useEffect(() => {
    if (!mountedRef.current) return; // evita a corrida do primeiro load
    if (loading) return;

    const json = JSON.stringify(state);
    if (json === lastJsonRef.current) {
      // nada mudou de verdade => não escreve, não dispara evento
      return;
    }

    try {
      localStorage.setItem(lsKey, json);
      lastJsonRef.current = json;

      const stamp = makeStamp();
      lastStampRef.current = stamp;
      window.dispatchEvent(new CustomEvent(evName, { detail: { key: lsKey, stamp } }));
    } catch {
      // noop
    }
  }, [lsKey, state, loading]);

  // Sincronizar com outras abas e outros componentes (sem loop)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key && e.key !== lsKey) return;
      try {
        const raw = localStorage.getItem(lsKey);
        if (!raw || raw === lastJsonRef.current) return; // igual ao que já temos
        lastJsonRef.current = raw;
        const parsed = JSON.parse(raw);
        setState(parsed);
      } catch {}
    };

    const onLocal = (e) => {
      const { detail } = e || {};
      if (!detail || detail.key !== lsKey) return;
      // Se o evento foi emitido por ESTE hook, ignore (evita loop)
      if (detail.stamp && detail.stamp === lastStampRef.current) return;

      try {
        const raw = localStorage.getItem(lsKey);
        if (!raw || raw === lastJsonRef.current) return; // nada novo
        lastJsonRef.current = raw;
        const parsed = JSON.parse(raw);
        setState(parsed);
      } catch {}
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(evName, onLocal);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(evName, onLocal);
    };
  }, [lsKey]);

  return {
    state,
    setState,
    source: "local",
    loading,
  };
}
