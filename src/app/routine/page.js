"use client";
import { useState, useEffect, useCallback } from "react";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";
import styles from "./Routine.module.css";

// ─── Constantes ───────────────────────────────────────────────────────────────
const DAYS_SHORT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const DAYS_FULL  = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];

const CAT = {
  treino:      { color: "#a855f7", label: "Treino"   },
  trabalho:    { color: "#3b82f6", label: "Trabalho" },
  pessoal:     { color: "#10b981", label: "Pessoal"  },
  livre:       { color: "#94a3b8", label: "Livre"    },
  "refeição":  { color: "#f59e0b", label: "Refeição" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function nowBRT() {
  const d = new Date(Date.now() - 3 * 3600 * 1000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function todayIndexBRT() {
  return new Date(Date.now() - 3 * 3600 * 1000).getUTCDay();
}

function getDateOfWeekday(jsDay) {
  const today  = new Date();
  const todayJs = today.getDay();
  const diff   = jsDay - todayJs;
  const d      = new Date(today);
  d.setDate(today.getDate() + diff);
  return d.getDate();
}

// Retorna os N blocos mais representativos de um dia para o resumo da semana
function keyBlocks(blocks, n = 3) {
  // Prioriza trabalho, treino, pessoal sobre livre e refeição
  const priority = ["treino", "trabalho", "pessoal", "livre", "refeição"];
  const sorted = [...blocks]
    .filter(b => b.activity && b.activity !== "—")
    .sort((a, b) => priority.indexOf(a.category) - priority.indexOf(b.category));

  const seen  = new Set();
  const result = [];
  for (const b of sorted) {
    if (!seen.has(b.activity)) {
      seen.add(b.activity);
      result.push(b);
    }
    if (result.length >= n) break;
  }
  return result;
}

const CAT_OPTIONS = ["pessoal","trabalho","treino","livre","refeição"];

// ─── Aba: Dia ─────────────────────────────────────────────────────────────────
function TabDia({ selectedDay, onDayChange }) {
  const todayIdx = todayIndexBRT();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [tick, setTick]       = useState(0);
  const [editing,  setEditing]  = useState(null); // { sheetRow, atividade, categoria, inicio, fim }
  const [saving,   setSaving]   = useState(false);

  const load = useCallback(async (day) => {
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`/api/routine?day=${day}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(selectedDay); }, [selectedDay, load]);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const isToday = selectedDay === todayIdx;
  const blocks  = data?.blocks ?? [];
  const current = data?.current ?? null;
  const next    = data?.next    ?? null;
  const progressPct = data?.progressPct ?? 0;
  const fromAppRotina = data?.fromAppRotina ?? false;

  const mins    = nowBRT();
  const donePct = blocks.length > 0 && isToday
    ? Math.round((blocks.filter(b => b.minutes + b.duration <= mins).length / blocks.length) * 100)
    : 0;

  async function handleSaveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch("/api/routine/blocks", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      setEditing(null);
      load(selectedDay);
    } finally { setSaving(false); }
  }

  async function handleDeleteBlock() {
    if (!editing?.sheetRow) return;
    setSaving(true);
    try {
      await fetch("/api/routine/blocks", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetRow: editing.sheetRow }),
      });
      setEditing(null);
      load(selectedDay);
    } finally { setSaving(false); }
  }

  const inputSt = { width: "100%", padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#f0f0f8", fontSize: 13, fontFamily: "inherit", outline: "none" };

  return (
    <>
      {/* Modal de edição */}
      {editing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: 24, width: "100%", maxWidth: 380 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Editar Bloco</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>ATIVIDADE</div>
                <input value={editing.atividade} onChange={e => setEditing(p => ({ ...p, atividade: e.target.value }))} style={inputSt} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>INÍCIO</div>
                  <input value={editing.inicio} onChange={e => setEditing(p => ({ ...p, inicio: e.target.value }))} placeholder="HH:MM" style={inputSt} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>FIM</div>
                  <input value={editing.fim} onChange={e => setEditing(p => ({ ...p, fim: e.target.value }))} placeholder="HH:MM" style={inputSt} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>CATEGORIA</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                  {CAT_OPTIONS.map(c => (
                    <button key={c} onClick={() => setEditing(p => ({ ...p, categoria: c }))}
                      style={{ padding: "6px 4px", borderRadius: 8, fontSize: 11, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
                        background: editing.categoria === c ? (CAT[c]?.color ?? "#484f58") + "22" : "rgba(255,255,255,0.04)",
                        color: editing.categoria === c ? (CAT[c]?.color ?? "#fff") : "rgba(255,255,255,0.4)",
                        border: `1px solid ${editing.categoria === c ? (CAT[c]?.color ?? "#484f58") + "55" : "rgba(255,255,255,0.08)"}`,
                      }}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              {editing.sheetRow && (
                <button onClick={handleDeleteBlock} disabled={saving}
                  style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.07)", color: "#ef4444", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  Remover
                </button>
              )}
              <button onClick={() => setEditing(null)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Cancelar
              </button>
              <button onClick={handleSaveEdit} disabled={saving}
                style={{ flex: 2, padding: "10px 0", borderRadius: 10, border: "none", background: saving ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg,#818cf8,#6366f1)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Seletor de dias */}
      <div className={styles.daySelector}>
        {DAYS_SHORT.map((short, idx) => {
          const isSelected = idx === selectedDay;
          const isT        = idx === todayIdx;
          const dateNum    = getDateOfWeekday(idx);
          return (
            <button
              key={idx}
              onClick={() => onDayChange(idx)}
              className={`${styles.dayBtn} ${isT ? styles.dayBtnToday : ""} ${isSelected ? styles.dayBtnSelected : ""}`}
            >
              <span className={`${styles.dayShort} ${isSelected ? styles.dayShortSelected : ""}`}>{short}</span>
              <span className={`${styles.dayNum} ${isT ? styles.dayNumToday : ""} ${isSelected ? styles.dayNumSelected : ""}`}>{dateNum}</span>
            </button>
          );
        })}
      </div>

      {/* Header do dia */}
      <div className={styles.dayHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className={styles.dayTitle}>{DAYS_FULL[selectedDay]}</span>
          {isToday && <span className={styles.todayBadge}>HOJE</span>}
        </div>
        {isToday && blocks.length > 0 && (
          <div className={styles.dayRight}>
            <span className={styles.dayCount}>{donePct}% feito</span>
          </div>
        )}
      </div>

      {/* Barra de progresso do dia */}
      {isToday && blocks.length > 0 && (
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${donePct}%` }} />
        </div>
      )}

      {/* Bloco atual */}
      {isToday && current && !loading && (() => {
        const cc = CAT[current.category]?.color ?? "#818cf8";
        return (
          <div className={styles.currentBlock} style={{ borderColor: cc + "30", background: `linear-gradient(135deg, ${cc}12, ${cc}06)` }}>
            {/* Glow */}
            <div className={styles.currentGlow} style={{ background: cc }} />

            {/* Topo */}
            <div className={styles.currentBlockTop} style={{ borderBottomColor: cc + "18" }}>
              <div className={styles.currentLabel} style={{ color: cc }}>
                <span className={styles.currentDot} style={{ background: cc }} />
                Agora
              </div>
              <span className={styles.currentTimeRange}>{current.time}{next ? ` → ${next.time}` : ""}</span>
            </div>

            {/* Corpo */}
            <div className={styles.currentBlockBody}>
              <div className={styles.currentCatTag} style={{ color: cc, background: cc + "1a", borderColor: cc + "40" }}>
                {CAT[current.category]?.label ?? "Livre"}
              </div>
              <div className={styles.currentActivity}>{current.activity}</div>
              {next && (
                <div className={styles.currentNext}>
                  A seguir: <span className={styles.currentNextName}>{next.activity}</span>
                </div>
              )}
              {current.duration > 0 && (
                <div className={styles.blockProgressWrap}>
                  <div className={styles.blockProgressMeta}>
                    <span>progresso do bloco</span>
                    <span>{progressPct}%</span>
                  </div>
                  <div className={styles.blockProgress}>
                    <div className={styles.blockProgressFill} style={{ width: `${progressPct}%`, background: cc, boxShadow: `0 0 8px ${cc}80` }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Loading / Erro */}
      {loading && <div className={styles.loading}>Carregando rotina...</div>}
      {error && !loading && (
        <div className={styles.errorCard}>
          <p style={{ fontWeight: 700, marginBottom: 6 }}>⚠ Não foi possível carregar</p>
          <p style={{ fontSize: 12, opacity: 0.7 }}>{error}</p>
          <button onClick={() => load(selectedDay)} className={styles.retryBtn}>Tentar novamente</button>
        </div>
      )}

      {/* Timeline */}
      {!loading && !error && blocks.length > 0 && (
        <div className={styles.timeline}>
          <div className={styles.timelineLine} />
          {blocks.map((block, i) => {
            const isPast = isToday && block.minutes + block.duration <= mins;
            const isCurr = isToday && current?.time === block.time;
            const cat    = CAT[block.category] ?? CAT.livre;
            const dur    = block.duration < 60
              ? `${block.duration}m`
              : block.duration % 60 === 0
                ? `${block.duration / 60}h`
                : `${Math.floor(block.duration/60)}h${block.duration%60}m`;

            return (
              <div key={i} className={`${styles.timelineItem} ${isPast ? styles.timelineItemDone : ""}`}>
                <div className={styles.timeCol}>
                  <span className={`${styles.timeLabel} ${isCurr ? styles.timeLabelCurrent : ""} ${isPast ? styles.timeLabelPast : ""}`}>
                    {block.time}
                  </span>
                </div>
                <div className={styles.dotCol}>
                  <div
                    className={`${styles.timelineDot} ${isCurr ? styles.timelineDotCurrent : ""}`}
                    style={{
                      background: isPast ? cat.color + "44" : isCurr ? cat.color : "rgba(255,255,255,0.1)",
                      color: cat.color,
                    }}
                  />
                </div>
                <div className={styles.itemContent}>
                  <div
                    className={styles.itemRow}
                    style={{
                      background:      cat.color + (isCurr ? "30" : "18"),
                      borderColor:     cat.color + (isCurr ? "60" : "35"),
                      borderLeftColor: cat.color + (isCurr ? "ff" : "aa"),
                    }}
                  >
                    <span className={`${styles.itemName} ${isPast ? styles.itemNameDone : ""}`}>
                      {block.activity}
                    </span>
                    <div className={styles.itemMeta}>
                      <span className={styles.itemDur}>{dur}</span>
                      {!isPast && (
                        <span className={styles.categoryTag} style={{ color: cat.color, background: cat.color + "18" }}>
                          {cat.label}
                        </span>
                      )}
                      {fromAppRotina && block.sheetRow && (
                        <span
                          className={styles.editBtn}
                          onClick={e => {
                            e.stopPropagation();
                            const endMin = block.minutes + block.duration;
                            const endHH  = String(Math.floor(endMin / 60) % 24).padStart(2, "0");
                            const endMM  = String(endMin % 60).padStart(2, "0");
                            setEditing({ sheetRow: block.sheetRow, atividade: block.activity, categoria: block.category, inicio: block.time, fim: `${endHH}:${endMM}` });
                          }}
                        >✎</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && blocks.length === 0 && (
        <div className={styles.empty}>
          <p>Nenhuma atividade para {DAYS_FULL[selectedDay]}.</p>
        </div>
      )}
    </>
  );
}

// ─── Aba: Semana ──────────────────────────────────────────────────────────────
function TabSemana({ onSelectDay }) {
  const todayIdx = todayIndexBRT();
  const [week, setWeek]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null);
      try {
        const res  = await fetch("/api/routine?week=1", { cache: "no-store" });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error);
        setWeek(json.week);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className={styles.loading}>Carregando semana...</div>;
  if (error)   return (
    <div className={styles.errorCard}>
      <p style={{ fontWeight: 700, marginBottom: 6 }}>⚠ Erro ao carregar</p>
      <p style={{ fontSize: 12, opacity: 0.7 }}>{error}</p>
    </div>
  );
  if (!week)   return null;

  return (
    <div className={styles.weekGrid}>
      {DAYS_SHORT.map((short, idx) => {
        const isT     = idx === todayIdx;
        const blocks  = week[idx] ?? [];
        const key3    = keyBlocks(blocks, 3);
        const dateNum = getDateOfWeekday(idx);

        // Composição de categorias para a barra colorida
        const catMins = {};
        for (const b of blocks) catMins[b.category] = (catMins[b.category] || 0) + b.duration;
        const totalMins = Object.values(catMins).reduce((s, v) => s + v, 0);
        const catOrder  = ["trabalho","treino","pessoal","livre"];
        const catSegs   = catOrder.filter(c => catMins[c]).map(c => ({ cat: c, pct: (catMins[c] / totalMins) * 100 }));

        return (
          <div
            key={idx}
            className={`${styles.weekDayCard} ${isT ? styles.weekDayCardToday : ""}`}
            onClick={() => onSelectDay(idx)}
          >
            <div className={styles.weekDayTop}>
              <div className={styles.weekDayLeft}>
                <span className={`${styles.weekDayDate} ${isT ? styles.weekDayDateToday : ""}`}>{dateNum}</span>
                <div className={styles.weekDayInfo}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className={`${styles.weekDayName} ${isT ? styles.weekDayNameToday : ""}`}>{DAYS_FULL[idx]}</span>
                    {isT && <span className={styles.weekDayBadge}>HOJE</span>}
                  </div>
                </div>
              </div>
              <span className={styles.weekDayBlocks}>{blocks.length} blocos</span>
            </div>

            {/* Barra de composição de categorias */}
            {catSegs.length > 0 && (
              <div className={styles.weekCatBar}>
                {catSegs.map(({ cat, pct }) => (
                  <div key={cat} className={styles.weekCatSegment}
                    style={{ width: `${pct}%`, background: CAT[cat]?.color ?? "#484f58" }} />
                ))}
              </div>
            )}

            {key3.length > 0 ? (
              <div className={styles.weekActivities}>
                {key3.map((b, i) => {
                  const cat = CAT[b.category] ?? CAT.livre;
                  return (
                    <span key={i} className={styles.weekActivityPill}>
                      <span className={styles.weekActivityDot} style={{ background: cat.color }} />
                      {b.activity}
                    </span>
                  );
                })}
              </div>
            ) : (
              <span className={styles.weekEmpty}>Sem atividades</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── (Eventos movido para /routine/events/page.js) ────────────────────────────
function _TabEventos_REMOVED() {
  const [events,   setEvents]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    fetch("/api/routine?agenda=1", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (d.ok) setEvents(d.events); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.loading}>Carregando eventos...</div>;

  const past     = events.filter(e => e.isPast);
  const upcoming = events.filter(e => !e.isPast);

  const byMonth = {};
  for (const e of upcoming) {
    if (!byMonth[e.monthYear]) byMonth[e.monthYear] = [];
    byMonth[e.monthYear].push(e);
  }

  function urgency(e) {
    if (e.isToday)          return { color: "#10b981", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.28)", accent: true, label: "HOJE" };
    if (e.isTomorrow)       return { color: "#f59e0b", bg: "rgba(245,158,11,0.09)", border: "rgba(245,158,11,0.28)", accent: true, label: "AMANHÃ" };
    if (e.daysFromNow <= 3) return { color: "#f97316", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.22)", accent: true, label: `${e.daysFromNow} DIAS` };
    if (e.isThisWeek)       return { color: "#60a5fa", bg: "rgba(96,165,250,0.07)", border: "rgba(96,165,250,0.18)", accent: false, label: `${e.daysFromNow} DIAS` };
    return { color: "var(--text-muted)", bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.07)", accent: false, label: `${e.daysFromNow}d` };
  }

  return (
    <div style={{ padding: "4px 0 80px" }}>
      {upcoming.length === 0 && past.length === 0 && (
        <div className={styles.empty}>
          <p>Nenhum evento cadastrado.</p>
          <p style={{ fontSize: 12, marginTop: 6, opacity: 0.5 }}>
            Crie a aba <strong>App_Eventos</strong> na planilha da Rotina com colunas:<br />
            A = Data (DD/MM/YYYY) · B = Evento · C = Tipo
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
                  transition: "background 0.2s",
                }}>
                  {/* Data */}
                  <div style={{ textAlign: "center", minWidth: 40, flexShrink: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: u.color, letterSpacing: "0.07em", lineHeight: 1, marginBottom: 2 }}>
                      {u.label}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: u.color, lineHeight: 1 }}>
                      {e.dateLabel.split("/")[0]}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1, marginTop: 1 }}>
                      /{e.dateLabel.split("/")[1]}
                    </div>
                  </div>
                  {/* Separador */}
                  <div style={{ width: 1, height: 36, background: u.border, flexShrink: 0 }} />
                  {/* Conteúdo */}
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
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function RoutinePage() {
  const todayIdx = todayIndexBRT();
  const [tab, setTab]             = useState("dia");
  const [selectedDay, setSelectedDay] = useState(todayIdx);

  function handleDayFromWeek(dayIdx) {
    setSelectedDay(dayIdx);
    setTab("dia");
  }

  const today    = new Date();
  const dateLabel = today.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className={styles.container}>
      <ModuleHeader title="Rotina" />

      <header className={styles.header}>
        <h1>Minha Rotina</h1>
        <p>{dateLabel}</p>
      </header>

      {/* Tabs */}
      <div className={styles.tabs}>
        {[["dia","Dia"],["semana","Semana"]].map(([key,label]) => (
          <button
            key={key}
            className={`${styles.tab} ${tab === key ? styles.tabActive : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "dia"    && <TabDia selectedDay={selectedDay} onDayChange={setSelectedDay} />}
      {tab === "semana" && <TabSemana onSelectDay={handleDayFromWeek} />}

      <Navigation />
    </div>
  );
}
