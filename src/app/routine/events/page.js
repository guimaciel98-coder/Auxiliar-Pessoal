"use client";
import { useState, useEffect } from "react";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";
import styles from "../Routine.module.css";

export default function EventosPage() {
  const [events,   setEvents]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    fetch("/api/routine?agenda=1", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (d.ok) setEvents(d.events); })
      .finally(() => setLoading(false));
  }, []);

  const past     = events.filter(e => e.isPast);
  const upcoming = events.filter(e => !e.isPast);

  const byMonth = {};
  for (const e of upcoming) {
    if (!byMonth[e.monthYear]) byMonth[e.monthYear] = [];
    byMonth[e.monthYear].push(e);
  }

  function urgency(e) {
    if (e.isToday)          return { color: "#10b981", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.28)", accent: true,  label: "HOJE" };
    if (e.isTomorrow)       return { color: "#f59e0b", bg: "rgba(245,158,11,0.09)", border: "rgba(245,158,11,0.28)", accent: true,  label: "AMANHÃ" };
    if (e.daysFromNow <= 3) return { color: "#f97316", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.22)", accent: true,  label: `${e.daysFromNow} DIAS` };
    if (e.isThisWeek)       return { color: "#60a5fa", bg: "rgba(96,165,250,0.07)", border: "rgba(96,165,250,0.18)", accent: false, label: `${e.daysFromNow} DIAS` };
    return { color: "var(--text-muted)", bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.07)", accent: false, label: `${e.daysFromNow}d` };
  }

  const today = new Date();

  return (
    <div className={styles.container}>
      <ModuleHeader title="Eventos" />
      <Navigation />

      <header className={styles.header}>
        <h1>Eventos</h1>
        <p>{today.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
      </header>

      {loading && <div className={styles.loading}>Carregando eventos...</div>}

      {!loading && (
        <div style={{ paddingBottom: 80 }}>
          {upcoming.length === 0 && past.length === 0 && (
            <div className={styles.empty}>
              <p>Nenhum evento cadastrado.</p>
              <p style={{ fontSize: 12, marginTop: 6, opacity: 0.5 }}>
                Edite a aba <strong>App_Eventos</strong> na planilha da Rotina.
              </p>
            </div>
          )}

          {Object.entries(byMonth).map(([month, evts]) => (
            <div key={month} style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "rgba(255,255,255,0.3)", marginBottom: 10, paddingLeft: 2 }}>
                {month}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {evts.map((e, i) => {
                  const u = urgency(e);
                  return (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "14px 16px", borderRadius: 14,
                      background: u.bg,
                      border: `1px solid ${u.border}`,
                      borderLeft: u.accent ? `3px solid ${u.color}` : `1px solid ${u.border}`,
                    }}>
                      <div style={{ textAlign: "center", minWidth: 40, flexShrink: 0 }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: u.color, letterSpacing: "0.07em", lineHeight: 1, marginBottom: 2 }}>{u.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: u.color, lineHeight: 1 }}>{e.dateLabel.split("/")[0]}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1, marginTop: 1 }}>/{e.dateLabel.split("/")[1]}</div>
                      </div>
                      <div style={{ width: 1, height: 36, background: u.border, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {e.activity}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, textTransform: "capitalize" }}>
                          {e.weekday}{e.tipo ? ` · ${e.tipo}` : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {past.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <button
                onClick={() => setShowPast(p => !p)}
                style={{ fontSize: 12, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "4px 0 8px", display: "flex", alignItems: "center", gap: 6 }}
              >
                <span style={{ fontSize: 10 }}>{showPast ? "▲" : "▼"}</span>
                {past.length} evento{past.length !== 1 ? "s" : ""} passado{past.length !== 1 ? "s" : ""}
              </button>
              {showPast && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, opacity: 0.4 }}>
                  {[...past].reverse().slice(0, 15).map((e, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)", minWidth: 38, flexShrink: 0 }}>{e.dateLabel}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)", textDecoration: "line-through", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.activity}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
