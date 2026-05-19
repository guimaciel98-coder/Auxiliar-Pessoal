"use client";
/**
 * useFinance — contexto compartilhado para dados de /api/finance.
 *
 * O FinanceProvider é montado no layout de /finance/** (finance/layout.js)
 * e persiste durante toda a navegação dentro do módulo financeiro.
 * Isso garante que cada sub-página leia do cache em vez de fazer
 * um fetch independente à API da planilha.
 *
 * Exposição:
 *   data     — payload completo de /api/finance ({ summary, ganhos, gastos, poupanca, ... })
 *   loading  — boolean
 *   error    — string | null
 *   refetch  — função para recarregar (usar após mutações como registrar gasto)
 */

import { createContext, useContext, useReducer, useRef, useState, useEffect, useCallback } from "react";

const TTL_MS = 3 * 60 * 1000;

// ── Estado inicial ────────────────────────────────────────────────────────────
const INITIAL = { data: null, loading: true, error: null };

// ── Reducer ───────────────────────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {
    case "FETCH":   return { ...state, loading: true,  error: null };
    case "SUCCESS": return { data: action.data, loading: false, error: null };
    case "ERROR":   return { ...state, loading: false, error: action.error };
    default:        return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────
const FinanceContext = createContext(null);

// ── Provider — montado no layout de /finance ──────────────────────────────────
export function FinanceProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [hideNumbers, setHideNumbers] = useState(false);
  const toggleHide = useCallback(() => setHideNumbers(h => !h), []);
  const lastFetchedAt = useRef(0);

  const refetch = useCallback(async () => {
    dispatch({ type: "FETCH" });
    try {
      const r    = await fetch("/api/finance", { cache: "no-store" });
      const json = await r.json();
      if (!json.ok) throw new Error(json.error ?? "Erro desconhecido");
      lastFetchedAt.current = Date.now();
      dispatch({ type: "SUCCESS", data: json });
    } catch (e) {
      dispatch({ type: "ERROR", error: e.message });
    }
  }, []);

  // Fetch ao montar
  useEffect(() => { refetch(); }, [refetch]);

  // Re-fetch automático ao voltar para a aba ou ganhar foco
  // (cobre o caso de atualizar a planilha diretamente e voltar pro app)
  useEffect(() => {
    const stale = () => Date.now() - lastFetchedAt.current > TTL_MS;
    const onVisible = () => { if (document.visibilityState === "visible" && stale()) refetch(); };
    const onFocus   = () => { if (stale()) refetch(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [refetch]);

  return (
    <FinanceContext.Provider value={{ ...state, refetch, hideNumbers, toggleHide }}>
      {children}
    </FinanceContext.Provider>
  );
}

// ── Hook público ──────────────────────────────────────────────────────────────
export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) {
    throw new Error(
      "useFinance deve ser usado dentro de <FinanceProvider>. " +
      "Verifique se finance/layout.js está envolvendo as sub-páginas."
    );
  }
  return ctx; // { data, loading, error, refetch, hideNumbers, toggleHide }
}
