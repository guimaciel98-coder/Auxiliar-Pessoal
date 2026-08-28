"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";
import styles from "./Routine.module.css";

// ─── Constantes ───────────────────────────────────────────────────────────────
const DAYS_SHORT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const DAYS_FULL  = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];

const CAT = {
  treino:      { color: "#a855f7", label: "Treino"   },
  trabalho:    { color: "#3b82f6", label: "Trabalho" },
  pdv:         { color: "#f97316", label: "PDV"      },
  estudo:      { color: "#22d3ee", label: "Estudo"   },
  pessoal:     { color: "#94a3b8", label: "Pessoal"  },
  sono:        { color: "#6366f1", label: "Sono"     },
  livre:       { color: "#10b981", label: "Livre"    },
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

// Retorna a chave de categoria visual (inclui sono/estudo/pdv como virtuais)
function effectiveCat(activity, category) {
  const a = (activity ?? "").toLowerCase();
  if (/acordar|dormir/.test(a))  return "sono";
  if (/estudo/.test(a))          return "estudo";
  if (/ponto de vista/.test(a))  return "pdv";
  return category;
}

function activityLabel(activity, category) {
  return CAT[effectiveCat(activity, category)]?.label ?? CAT[category]?.label ?? "Livre";
}

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

  const mins      = nowBRT();
  // Exclui o último bloco (Dormir) da contagem de "feito" e do isPast
  const dayBlocks = blocks.length > 1 ? blocks.slice(0, -1) : blocks;
  const donePct   = dayBlocks.length > 0 && isToday
    ? Math.round((dayBlocks.filter(b => b.minutes + b.duration <= mins).length / dayBlocks.length) * 100)
    : 0;

  function openNewBlock() {
    setEditing({ sheetRow: null, dia: selectedDay, atividade: "", categoria: "pessoal", inicio: "", fim: "" });
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      let res;
      if (editing.sheetRow) {
        res = await fetch("/api/routine/blocks", {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editing),
        });
      } else {
        res = await fetch("/api/routine/blocks", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dia:       editing.dia ?? selectedDay,
            inicio:    editing.inicio,
            fim:       editing.fim,
            atividade: editing.atividade,
            categoria: editing.categoria,
          }),
        });
      }
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "Erro");
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
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
              {editing.sheetRow ? "Editar Bloco" : "Novo Bloco"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>ATIVIDADE</div>
                <input value={editing.atividade} onChange={e => setEditing(p => ({ ...p, atividade: e.target.value }))} style={inputSt} autoFocus />
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
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {CAT_OPTIONS.map(c => (
                    <button key={c} onClick={() => setEditing(p => ({ ...p, categoria: c }))}
                      style={{ flex: "1 0 calc(33% - 6px)", padding: "7px 4px", borderRadius: 8, fontSize: 11, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
                        background: editing.categoria === c ? (CAT[c]?.color ?? "#484f58") + "22" : "rgba(255,255,255,0.04)",
                        color: editing.categoria === c ? (CAT[c]?.color ?? "#fff") : "rgba(255,255,255,0.4)",
                        border: `1px solid ${editing.categoria === c ? (CAT[c]?.color ?? "#484f58") + "55" : "rgba(255,255,255,0.08)"}`,
                      }}>
                      {CAT[c]?.label ?? c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>DIA DA SEMANA</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {DAYS_SHORT.map((short, idx) => (
                    <button key={idx} onClick={() => setEditing(p => ({ ...p, dia: idx }))}
                      style={{ flex: 1, padding: "6px 2px", borderRadius: 8, fontSize: 10, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
                        background: editing.dia === idx ? "rgba(129,140,248,0.2)" : "rgba(255,255,255,0.04)",
                        color: editing.dia === idx ? "#818cf8" : "rgba(255,255,255,0.35)",
                        border: `1px solid ${editing.dia === idx ? "rgba(129,140,248,0.4)" : "rgba(255,255,255,0.08)"}`,
                      }}>
                      {short}
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
        const cc = CAT[effectiveCat(current.activity, current.category)]?.color ?? "#818cf8";
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
                {activityLabel(current.activity, current.category)}
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
            const isPast = isToday && i < blocks.length - 1 && block.minutes + block.duration <= mins;
            const isCurr = isToday && current?.time === block.time;
            const cat    = CAT[effectiveCat(block.activity, block.category)] ?? CAT.livre;
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
                          {activityLabel(block.activity, block.category)}
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
                            setEditing({ sheetRow: block.sheetRow, dia: selectedDay, atividade: block.activity, categoria: block.category, inicio: block.time, fim: `${endHH}:${endMM}` });
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

      {!loading && !error && fromAppRotina && (
        <button className={styles.addBlockBtn} onClick={openNewBlock}>
          + Adicionar bloco
        </button>
      )}
    </>
  );
}

// ─── Aba: Semana ──────────────────────────────────────────────────────────────

function minsToLabel(m) {
  const h = Math.floor(m / 60), min = m % 60;
  return h > 0 ? (min > 0 ? `${h}h${String(min).padStart(2,"0")}` : `${h}h`) : `${min}m`;
}

function TabSemana({ onSelectDay }) {
  const todayIdx = todayIndexBRT();
  const [week, setWeek]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [mins, setMins]       = useState(nowBRT);

  useEffect(() => {
    const id = setInterval(() => setMins(nowBRT()), 60000);
    return () => clearInterval(id);
  }, []);

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
  if (!week) return null;

  // ── Barra geral da semana ──────────────────────────────────────────────────
  const catOrder = ["trabalho","pdv","treino","estudo","refeição","pessoal","sono","livre"];
  const totalCatMins = {};
  let totalWeekMins = 0;
  for (let d = 0; d <= 6; d++) {
    for (const b of (week[d] ?? [])) {
      const eff = effectiveCat(b.activity, b.category);
      totalCatMins[eff] = (totalCatMins[eff] || 0) + b.duration;
      totalWeekMins += b.duration;
    }
  }
  const weekSegs = catOrder
    .filter(c => totalCatMins[c] > 0)
    .map(c => ({ cat: c, mins: totalCatMins[c], pct: (totalCatMins[c] / totalWeekMins) * 100 }))
    .filter(s => Math.round(s.pct) > 0)
    .sort((a, b) => a.mins - b.mins);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* ── Card resumo semanal ── */}
      {weekSegs.length > 0 && (
        <div style={{
          margin: "0 0 20px",
          padding: "20px 20px 18px",
          borderRadius: 20,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}>
          {/* Título */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.09em", color: "rgba(255,255,255,0.35)" }}>
              Distribuição Semanal
            </span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-mono)" }}>
              {minsToLabel(totalWeekMins)} / semana
            </span>
          </div>

          {/* Barra principal */}
          <div style={{ display: "flex", height: 18, borderRadius: 10, overflow: "hidden", gap: 2 }}>
            {weekSegs.map(({ cat, pct }) => (
              <div key={cat}
                style={{ width: `${pct}%`, background: CAT[cat]?.color ?? "#484f58",
                         borderRadius: 4, transition: "width 0.4s ease", minWidth: pct > 3 ? undefined : 0 }}
              />
            ))}
          </div>

          {/* Legenda com percentuais */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 14px", marginTop: 14 }}>
            {weekSegs.map(({ cat, mins, pct }) => (
              <div key={cat} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: CAT[cat]?.color ?? "#484f58", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>
                  {CAT[cat]?.label ?? cat}
                </span>
                <span style={{ fontSize: 13, fontWeight: 800, color: CAT[cat]?.color ?? "#fff" }}>
                  {Math.round(pct)}%
                </span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-mono)" }}>
                  {minsToLabel(mins)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    <div className={styles.weekGrid}>
      {DAYS_SHORT.map((_, idx) => {
        const isT     = idx === todayIdx;
        const blocks  = week[idx] ?? [];
        const dateNum = getDateOfWeekday(idx);

        // Composição de categorias
        const catMins = {};
        for (const b of blocks) {
          const eff = effectiveCat(b.activity, b.category);
          catMins[eff] = (catMins[eff] || 0) + b.duration;
        }
        const totalMins = Object.values(catMins).reduce((s, v) => s + v, 0);
        const catSegs   = catOrder.filter(c => catMins[c]).map(c => ({
          cat: c, pct: (catMins[c] / totalMins) * 100,
        }));

        // Resumo textual: só categorias com ≥30min
        const catSummary = catOrder
          .filter(c => catMins[c] >= 30)
          .map(c => ({ cat: c, label: CAT[c]?.label ?? c, time: minsToLabel(catMins[c]) }))
          .slice(0, 5);

        // Bloco atual e % feito (apenas hoje)
        let nowBlock = null;
        let donePct  = 0;
        if (isT && blocks.length > 0) {
          nowBlock = blocks.find(b => {
            const end = b.minutes + b.duration;
            return end <= 1440
              ? b.minutes <= mins && mins < end
              : b.minutes <= mins || mins < end - 1440;
          });
          const wb = blocks.length > 1 ? blocks.slice(0, -1) : blocks;
          donePct = Math.round(
            (wb.filter(b => b.minutes + b.duration <= mins).length / wb.length) * 100
          );
        }
        const nowCat = nowBlock ? (CAT[nowBlock.category] ?? CAT.livre) : null;

        return (
          <div
            key={idx}
            className={`${styles.weekDayCard} ${isT ? styles.weekDayCardToday : ""}`}
            onClick={() => onSelectDay(idx)}
          >
            {/* ── Cabeçalho ── */}
            <div className={styles.weekDayTop}>
              <div className={styles.weekDayLeft}>
                <span className={`${styles.weekDayDate} ${isT ? styles.weekDayDateToday : ""}`}>{dateNum}</span>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className={`${styles.weekDayName} ${isT ? styles.weekDayNameToday : ""}`}>{DAYS_FULL[idx]}</span>
                    {isT && <span className={styles.weekDayBadge}>HOJE</span>}
                  </div>
                  {isT && nowBlock && (
                    <div className={styles.weekNowRow} style={{ color: nowCat.color }}>
                      <span className={styles.weekNowDot} style={{ background: nowCat.color }} />
                      {nowBlock.activity}
                    </div>
                  )}
                </div>
              </div>
              {isT && blocks.length > 0 ? (
                <span className={styles.weekDonePct}
                  style={{ color: donePct >= 80 ? "#10b981" : donePct >= 40 ? "#f59e0b" : "rgba(255,255,255,0.28)" }}>
                  {donePct}% feito
                </span>
              ) : (
                <span className={styles.weekDayBlocks}>{blocks.length} blocos</span>
              )}
            </div>

            {/* ── Barra de categorias ── */}
            {catSegs.length > 0 && (
              <div className={styles.weekCatBar}>
                {catSegs.map(({ cat, pct }) => (
                  <div key={cat} className={styles.weekCatSegment}
                    style={{ width: `${pct}%`, background: CAT[cat]?.color ?? "#484f58" }} />
                ))}
              </div>
            )}

            {/* ── Resumo de tempo por categoria ── */}
            {catSummary.length > 0 && (
              <div className={styles.weekCatSummary}>
                {catSummary.map(({ cat, label, time }) => (
                  <span key={cat} className={styles.weekCatChip}
                    style={{ color: CAT[cat]?.color, background: (CAT[cat]?.color ?? "#484f58") + "18",
                             borderColor: (CAT[cat]?.color ?? "#484f58") + "30" }}>
                    {label} <strong>{time}</strong>
                  </span>
                ))}
              </div>
            )}

            {blocks.length === 0 && (
              <span className={styles.weekEmpty}>Sem atividades</span>
            )}
          </div>
        );
      })}
    </div>
    </div>
  );
}

// ─── (Férias movido para /routine/ferias/page.js) ─────────────────────────────
// ─── (TabFerias removida — agora é subpágina) ─────────────────────────────────
const __FERIAS_DAYS_OLD_REMOVED = [
  { day:1,  date:"2026-07-01", wd:"Qua", title:"Burocracia pesada", blocks:[
    {p:"manhã",text:"CIN (Carteira de Identidade)"},{p:"tarde",text:"Marcar médicos"},{p:"academia",text:"Academia"}]},
  { day:2,  date:"2026-07-02", wd:"Qui", title:"Compras + organização", blocks:[
    {p:"manhã",text:"Agendar natação e pilates"},{p:"tarde",text:"Compras — sunga, perfume, suporte gabinete"}]},
  { day:3,  date:"2026-07-03", wd:"Sex", title:"Resolver e relaxar", blocks:[
    {p:"manhã",text:"FUP gabinete"},{p:"tarde",text:"Arrumar tela"},{p:"noite",text:"Jantar fora (Pinheiros/Vila Madalena)"}]},
  { day:4,  date:"2026-07-04", wd:"Sáb", title:"Cultura + gastronomia", blocks:[
    {p:"manhã",text:"Pilates"},{p:"tarde",text:"Pinacoteca (grátis no sábado)"},{p:"noite",text:"Rodízio japonês"}]},
  { day:5,  date:"2026-07-05", wd:"Dom", title:"Ar livre + lazer", blocks:[
    {p:"manhã",text:"Corrida no parque"},{p:"tarde",text:"Piquenique"},{p:"noite",text:"Jogos em casa"}]},
  { day:6,  date:"2026-07-06", wd:"Seg", title:"Treino + cozinha", blocks:[
    {p:"academia",text:"Academia"},{p:"tarde",text:"Tarde livre"},{p:"noite",text:"Cozinhar receita nova juntos"}]},
  { day:7,  date:"2026-07-07", wd:"Ter", title:"Museu + cinema", blocks:[
    {p:"academia",text:"Academia"},{p:"tarde",text:"MASP (grátis na terça)"},{p:"noite",text:"Cinema"}]},
  { day:8,  date:"2026-07-08", wd:"Qua", title:"Esporte + cultura", blocks:[
    {p:"manhã",text:"Natação"},{p:"tarde",text:"Museu do Futebol"},{p:"noite",text:"Série em casa"}]},
  { day:9,  date:"2026-07-09", wd:"Qui", title:"Social + passeio", blocks:[
    {p:"manhã",text:"Café da manhã fora"},{p:"tarde",text:"Ver Projeto Social"},{p:"noite",text:"Passeio noturno"}]},
  { day:10, date:"2026-07-10", wd:"Sex", title:"Dia livre total", blocks:[
    {p:"manhã",text:"Acordar sem pressa"},{p:"tarde",text:"Maratona de série"},{p:"noite",text:"Delivery"}]},
  { day:11, date:"2026-07-11", wd:"Sáb", title:"Feira + jantar", blocks:[
    {p:"manhã",text:"Pilates"},{p:"tarde",text:"Feira da Liberdade"},{p:"noite",text:"Jantar no bairro"}]},
  { day:12, date:"2026-07-12", wd:"Dom", title:"Casa + corrida", blocks:[
    {p:"manhã",text:"Faxina da casa"},{p:"tarde",text:"Corrida + tarde em casa"}]},
  { day:13, date:"2026-07-13", wd:"Seg", title:"Saúde + agenda", blocks:[
    {p:"academia",text:"Academia"},{p:"tarde",text:"Consultas médicas"},{p:"noite",text:"Agendar psicóloga"}]},
  { day:14, date:"2026-07-14", wd:"Ter", title:"Trabalho + cultura", blocks:[
    {p:"academia",text:"Academia"},{p:"tarde",text:"Pagamento PDV + MASP"},{p:"noite",text:"Jantar especial"}]},
  { day:15, date:"2026-07-15", wd:"Qua", title:"Encerramento", blocks:[
    {p:"academia",text:"Academia"},{p:"tarde",text:"Tarde livre no parque"},{p:"noite",text:"Rodízio japonês (encerramento)"}]},
];

const PERIOD_META = {
  "manhã":    { color: "#f59e0b", bg: "rgba(245,158,11,0.10)", icon: "☀" },
  "tarde":    { color: "#3b82f6", bg: "rgba(59,130,246,0.10)", icon: "🌤" },
  "noite":    { color: "#8b5cf6", bg: "rgba(139,92,246,0.10)", icon: "🌙" },
  "academia": { color: "#10b981", bg: "rgba(16,185,129,0.10)", icon: "💪" },
};

const LS_FER_CHK  = "ferias_checked_2026";
const LS_FER_EDIT = "ferias_edits_2026";

function TabFerias() {
  const todayISO = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  })();
  const todayIdx = _FERIAS_DAYS_OLD.findIndex(d => d.date === todayISO);

  const [sel, setSel] = useState(todayIdx >= 0 ? todayIdx : 0);
  const [checked, setChecked] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_FER_CHK) || "{}"); } catch { return {}; }
  });
  const [edits, setEdits] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_FER_EDIT) || "{}"); } catch { return {}; }
  });
  const [editing, setEditing] = useState(null);

  useEffect(() => { try { localStorage.setItem(LS_FER_CHK, JSON.stringify(checked)); } catch {} }, [checked]);
  useEffect(() => { try { localStorage.setItem(LS_FER_EDIT, JSON.stringify(edits)); } catch {} }, [edits]);

  function toggleCheck(di, bi) {
    const k = `${di}-${bi}`;
    setChecked(p => { const n = { ...p }; if (n[k]) delete n[k]; else n[k] = true; return n; });
  }
  function saveEdit(di, bi, text) {
    const k = `${di}-${bi}`;
    const orig = _FERIAS_DAYS_OLD[di].blocks[bi].text;
    setEdits(p => { const n = { ...p }; if (text === orig || !text.trim()) delete n[k]; else n[k] = text; return n; });
    setEditing(null);
  }
  function blockText(di, bi) { return edits[`${di}-${bi}`] || _FERIAS_DAYS_OLD[di].blocks[bi].text; }

  const completedDays = _FERIAS_DAYS_OLD.filter((d, di) =>
    d.blocks.length > 0 && d.blocks.every((_, bi) => checked[`${di}-${bi}`])
  ).length;
  const totalBlocks  = _FERIAS_DAYS_OLD.reduce((s, d) => s + d.blocks.length, 0);
  const checkedCount = Object.keys(checked).length;
  const pct = totalBlocks > 0 ? Math.round((checkedCount / totalBlocks) * 100) : 0;

  const cur = _FERIAS_DAYS_OLD[sel];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Progresso geral */}
      <div style={{ padding: "18px 20px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 900, color: "#f59e0b" }}>🏖 Férias Jul 2026</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>{completedDays} de 15 dias</span>
        </div>
        <div style={{ height: 6, borderRadius: 99, overflow: "hidden", background: "rgba(255,255,255,0.06)" }}>
          <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: "linear-gradient(90deg,#f59e0b,#10b981)", transition: "width 0.4s" }} />
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 6, textAlign: "right" }}>
          {checkedCount} de {totalBlocks} atividades · {pct}%
        </div>
      </div>

      {/* Seletor de dia */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button onClick={() => setSel(Math.max(0, sel - 1))} disabled={sel === 0}
          style={{ background: "none", border: "none", fontSize: 18, color: sel > 0 ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.1)", cursor: sel > 0 ? "pointer" : "default", padding: "4px 2px", flexShrink: 0 }}>◀</button>
        <div style={{ flex: 1, display: "flex", gap: 4, overflowX: "auto", paddingBottom: 4 }}>
          {_FERIAS_DAYS_OLD.map((d, i) => {
            const isSel = i === sel;
            const isT   = d.date === todayISO;
            const isDone = d.blocks.length > 0 && d.blocks.every((_, bi) => checked[`${i}-${bi}`]);
            return (
              <button key={i} onClick={() => setSel(i)} style={{
                flexShrink: 0, width: 32, height: 32, borderRadius: 99,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 800, cursor: "pointer",
                border: isT ? "2px solid #f59e0b" : isSel ? "2px solid rgba(255,255,255,0.3)" : "1px solid rgba(255,255,255,0.08)",
                background: isDone ? "rgba(16,185,129,0.15)" : isSel ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.03)",
                color: isDone ? "#10b981" : isSel ? "#fff" : "rgba(255,255,255,0.35)",
              }}>{d.day}</button>
            );
          })}
        </div>
        <button onClick={() => setSel(Math.min(14, sel + 1))} disabled={sel === 14}
          style={{ background: "none", border: "none", fontSize: 18, color: sel < 14 ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.1)", cursor: sel < 14 ? "pointer" : "default", padding: "4px 2px", flexShrink: 0 }}>▶</button>
      </div>

      {/* Card do dia */}
      {cur && (
        <div style={{
          padding: "18px 20px", borderRadius: 16, background: "rgba(255,255,255,0.03)",
          border: `1px solid ${cur.date === todayISO ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.08)"}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: cur.date === todayISO ? "#f59e0b" : "rgba(255,255,255,0.8)" }}>
                Dia {cur.day}
              </span>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>{cur.wd}, {parseInt(cur.date.split("-")[2])} jul</span>
              {cur.date === todayISO && (
                <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 99, background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}>HOJE</span>
              )}
            </div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.3)", marginBottom: 16, fontStyle: "italic" }}>{cur.title}</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cur.blocks.map((block, bi) => {
              const k = `${sel}-${bi}`;
              const done = !!checked[k];
              const meta = PERIOD_META[block.p] || PERIOD_META["tarde"];
              const isEd = editing === k;
              const txt = blockText(sel, bi);
              return (
                <div key={bi} style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "12px 14px", borderRadius: 12,
                  background: done ? "rgba(16,185,129,0.04)" : meta.bg,
                  border: `1px solid ${done ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)"}`,
                  opacity: done ? 0.55 : 1, transition: "all 0.2s",
                }}>
                  <button onClick={() => toggleCheck(sel, bi)} style={{
                    flexShrink: 0, width: 22, height: 22, borderRadius: 6,
                    border: `2px solid ${done ? "#10b981" : meta.color}`,
                    background: done ? "rgba(16,185,129,0.2)" : "transparent",
                    color: done ? "#10b981" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", fontSize: 12, fontWeight: 900, marginTop: 1,
                  }}>{done ? "✓" : ""}</button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                      <span style={{ fontSize: 11 }}>{meta.icon}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: meta.color }}>{block.p}</span>
                    </div>
                    {isEd ? (
                      <input autoFocus defaultValue={txt}
                        onBlur={e => saveEdit(sel, bi, e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
                        style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "5px 8px", color: "#f0f0f8", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                      />
                    ) : (
                      <div onClick={() => setEditing(k)} style={{
                        fontSize: 13, fontWeight: 500, cursor: "text", lineHeight: 1.4,
                        color: done ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.75)",
                        textDecoration: done ? "line-through" : "none",
                      }}>{txt}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
