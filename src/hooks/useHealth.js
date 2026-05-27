"use client";

import { createContext, useContext, useReducer, useCallback, useEffect } from "react";

const INITIAL = { data: null, loading: true, error: null };

function reducer(state, action) {
  switch (action.type) {
    case "FETCH":   return { ...state, loading: true,  error: null };
    case "SUCCESS": return { data: action.data, loading: false, error: null };
    case "ERROR":   return { ...state, loading: false, error: action.error };
    default:        return state;
  }
}

const HealthContext = createContext(null);

export function HealthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  const refetch = useCallback(async () => {
    dispatch({ type: "FETCH" });
    try {
      const r    = await fetch("/api/health", { cache: "no-store" });
      const json = await r.json();
      if (!json.ok) throw new Error(json.error ?? "Erro desconhecido");
      dispatch({ type: "SUCCESS", data: json });
    } catch (e) {
      dispatch({ type: "ERROR", error: e.message });
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return (
    <HealthContext.Provider value={{ ...state, refetch }}>
      {children}
    </HealthContext.Provider>
  );
}

export function useHealth() {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error("useHealth deve ser usado dentro de <HealthProvider>");
  return ctx;
}
