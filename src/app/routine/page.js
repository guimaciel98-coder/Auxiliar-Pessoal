"use client";
// Rotina > Minha Rotina — visual no padrão do redesign (mesma base de Financeiro).
import { useState, useEffect, useCallback } from "react";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";
import Ring from "@/components/ui/Ring";
import ex from "../finance/expenses/Expenses.module.css";
import rt from "./RoutineDay.module.css";

// ─── Constantes ───────────────────────────────────────────────────────────────
const DAYS_SHORT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const DAYS_FULL  = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];

const CAT = {
  treino:      { color: "#a78bfa", label: "Treino"   },
  trabalho:    { color: "#38bdf8", label: "Trabalho" },
  pdv:         { color: "#fb923c", label: "PDV"      },
  estudo:      { color: "#22d3ee", label: "Estudo"   },
  pessoal:     { color: "#94a3b8", label: "Pessoal"  },
  sono:        { color: "#818cf8", label: "Sono"     },
  livre:       { color: "#34d399", label: "Livre"    },
  "refeição":  { color: "#fbbf24", label: "Refeição" },
};
const CAT_ORDER   = ["trabalho","pdv","treino","estudo","refeição","pessoal","sono","livre"];
const CAT_OPTIONS = ["pessoal","trabalho","treino","livre","refeição"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function nowBRT() {
  const d = new Date(Date.now() - 3 * 3600 * 1000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}
function todayIndexBRT() {
  return new Date(Date.now() - 3 * 3600 * 1000).getUTCDay();
}
function getDateOfWeekday(jsDay) {
  const today = new Date();
  const d     = new Date(today);
  d.setDate(today.getDate() + (jsDay - today.getDay()));
  return d.getDate();
}
// Categoria visual (sono/estudo/pdv são derivadas do nome da atividade)
function effectiveCat(activity, category) {
  const a = (activity ?? "").toLowerCase();
  if (/acordar|dormir/.test(a))  return "sono";
  if (/estudo/.test(a))          return "estudo";
  if (/ponto de vista/.test(a))  return "pdv";
  return category;
}
function catOf(block) { return CAT[effectiveCat(block.activity, block.category)] ?? CAT.livre; }
function activityLabel(activity, category) {
  return CAT[effectiveCat(activity, category)]?.label ?? CAT[category]?.label ?? "Livre";
}
function minsToLabel(m) {
  const h = Math.floor(m / 60), min = m % 60;
  return h > 0 ? (min > 0 ? `${h}h${String(min).padStart(2,"0")}` : `${h}h`) : `${min}m`;
}
// Minutos por categoria de uma lista de blocos
function catTotals(blocks) {
  const t = {}; let total = 0;
  for (const b of blocks) {
    const c = effectiveCat(b.activity, b.category);
    t[c] = (t[c] || 0) + b.duration; total += b.duration;
  }
  const segs = CAT_ORDER.filter(c => t[c] > 0).map(c => ({ cat: c, mins: t[c], pct: total > 0 ? (t[c] / total) * 100 : 0 }));
  return { segs, total };
}

// Barra empilhada + legenda por categoria
function Distribution({ blocks, title, aside, wide }) {
  const { segs, total } = catTotals(blocks);
  if (!segs.length) return null;
  const sorted = [...segs].sort((a, b) => b.mins - a.mins);
  return (
    <div className={ex.panel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div className={ex.panelTitle}>{title}</div>
        <span className={ex.muted}>{aside ?? minsToLabel(total)}</span>
      </div>
      <div className={rt.stack}>
        {sorted.map(s => <span key={s.cat} style={{ width: `${s.pct}%`, background: CAT[s.cat]?.color }} />)}
      </div>
      <div className={wide ? rt.legendWide : rt.legend}>
        {sorted.map(s => (
          <div key={s.cat} className={rt.legRow}>
            <i style={{ background: CAT[s.cat]?.color }} />
            <span>{CAT[s.cat]?.label ?? s.cat}</span>
            <b>{minsToLabel(s.mins)}</b>
            <em style={{ color: CAT[s.cat]?.color }}>{Math.round(s.pct)}%</em>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Aba: Dia ─────────────────────────────────────────────────────────────────
function TabDia({ selectedDay, onDayChange }) {
  const todayIdx = todayIndexBRT();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [, setTick]           = useState(0);
  const [editing,  setEditing]  = useState(null); // { sheetRow, dia, atividade, categoria, inicio, fim }
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

  const isToday       = selectedDay === todayIdx;
  const blocks        = data?.blocks ?? [];
  const current       = data?.current ?? null;
  const next          = data?.next    ?? null;
  const progressPct   = data?.progressPct ?? 0;
  const fromAppRotina = data?.fromAppRotina ?? false;

  const mins      = nowBRT();
  // O último bloco (Dormir) não conta como "feito"
  const dayBlocks = blocks.length > 1 ? blocks.slice(0, -1) : blocks;
  const doneCount = isToday ? dayBlocks.filter(b => b.minutes + b.duration <= mins).length : 0;
  const donePct   = dayBlocks.length > 0 && isToday ? Math.round((doneCount / dayBlocks.length) * 100) : 0;

  function openNewBlock() {
    setEditing({ sheetRow: null, dia: selectedDay, atividade: "", categoria: "pessoal", inicio: "", fim: "" });
  }
  function openEdit(block) {
    const endMin = block.minutes + block.duration;
    const endHH  = String(Math.floor(endMin / 60) % 24).padStart(2, "0");
    const endMM  = String(endMin % 60).padStart(2, "0");
    setEditing({ sheetRow: block.sheetRow, dia: selectedDay, atividade: block.activity, categoria: block.category, inicio: block.time, fim: `${endHH}:${endMM}` });
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

  const fmtDur = d => d < 60 ? `${d}m` : d % 60 === 0 ? `${d / 60}h` : `${Math.floor(d / 60)}h${d % 60}m`;
  const cc = current ? catOf(current).color : "#38bdf8";

  return (
    <>
      {/* Janela de bloco (novo / editar) */}
      {editing && (
        <div className={ex.overlay} onClick={() => setEditing(null)}>
          <div className={ex.modal} onClick={e => e.stopPropagation()}>
            <div className={ex.modalTop}>
              <h3 className={ex.modalTitle}>{editing.sheetRow ? "Editar bloco" : "Novo bloco"}</h3>
              <button type="button" className={ex.closeBtn} onClick={() => setEditing(null)} title="Fechar">✕</button>
            </div>
            <p className={ex.modalSub}>{editing.sheetRow ? "Altere o que precisar e salve." : "Adicione uma atividade à rotina."}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label className={rt.lbl}>Atividade</label>
                <input value={editing.atividade} onChange={e => setEditing(p => ({ ...p, atividade: e.target.value }))} className={rt.input} placeholder="Ex: Academia" autoFocus />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className={rt.lbl}>Início</label>
                  <input type="time" value={editing.inicio} onChange={e => setEditing(p => ({ ...p, inicio: e.target.value }))} className={rt.input} />
                </div>
                <div>
                  <label className={rt.lbl}>Fim</label>
                  <input type="time" value={editing.fim} onChange={e => setEditing(p => ({ ...p, fim: e.target.value }))} className={rt.input} />
                </div>
              </div>
              <div>
                <label className={rt.lbl}>Categoria</label>
                <div className={rt.pick}>
                  {CAT_OPTIONS.map(c => (
                    <button key={c} type="button" onClick={() => setEditing(p => ({ ...p, categoria: c }))}
                      className={`${rt.pickBtn} ${editing.categoria === c ? rt.pickOn : ""}`} style={{ "--c": CAT[c]?.color }}>
                      <i />{CAT[c]?.label ?? c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={rt.lbl}>Dia da semana</label>
                <div className={rt.dayPick}>
                  {DAYS_SHORT.map((short, idx) => (
                    <button key={idx} type="button" onClick={() => setEditing(p => ({ ...p, dia: idx }))} className={editing.dia === idx ? rt.on : ""}>{short}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className={rt.mBtns}>
              {editing.sheetRow && <button type="button" onClick={handleDeleteBlock} disabled={saving} className={rt.del}>Remover</button>}
              <button type="button" onClick={() => setEditing(null)} className={rt.cancel}>Cancelar</button>
              <button type="button" onClick={handleSaveEdit} disabled={saving} className={rt.save}>{saving ? "Salvando…" : "Salvar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Dias da semana */}
      <div className={rt.days}>
        {DAYS_SHORT.map((short, idx) => (
          <button key={idx} onClick={() => onDayChange(idx)}
            className={`${rt.day} ${idx === todayIdx ? rt.dayToday : ""} ${idx === selectedDay ? rt.daySel : ""}`}>
            <span>{short}</span>
            <b>{getDateOfWeekday(idx)}</b>
          </button>
        ))}
      </div>

      {loading && <div className={ex.loading}>Carregando rotina…</div>}
      {error && !loading && (
        <div className={ex.errorBox}>
          <p><b>Não foi possível carregar.</b> {error}</p>
          <button onClick={() => load(selectedDay)} className={ex.retryBtn}>Tentar novamente</button>
        </div>
      )}

      {!loading && !error && (
        <div className={ex.layout}>
          {/* Linha do tempo */}
          <div className={ex.mainArea}>
            <section className={ex.listPanel}>
              <div className={ex.sectionHead}>
                <span className={ex.sectionDot} style={{ background: "#38bdf8", boxShadow: "0 0 10px #38bdf8" }} />
                <span className={ex.sectionName}>{DAYS_FULL[selectedDay]}</span>
                {isToday ? <span className={rt.todayTag}>HOJE</span> : <span className={ex.sectionCount}>{blocks.length} blocos</span>}
                <span className={ex.sectionTotal}>{isToday && blocks.length > 0 ? `${doneCount}/${dayBlocks.length} feitos` : ""}</span>
              </div>
              {blocks.length === 0 ? (
                <p className={ex.empty}>Nenhuma atividade para {DAYS_FULL[selectedDay]}.</p>
              ) : blocks.map((block, i) => {
                const isPast = isToday && i < blocks.length - 1 && block.minutes + block.duration <= mins;
                const isCurr = isToday && current?.time === block.time;
                const cat    = catOf(block);
                return (
                  <div key={i} className={`${rt.blk} ${isPast ? rt.blkPast : ""} ${isCurr ? rt.blkNow : ""}`} style={{ "--c": cat.color }}>
                    <span className={rt.time}>{block.time}</span>
                    <i className={rt.dot} />
                    <div className={rt.name}>
                      <b>{block.activity}</b>
                      <small>{isCurr ? "agora · " : ""}{activityLabel(block.activity, block.category)}</small>
                    </div>
                    <span className={rt.dur}>{fmtDur(block.duration)}</span>
                    {fromAppRotina && block.sheetRow ? (
                      <button onClick={() => openEdit(block)} title="Editar" className={ex.iconBtn}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
                      </button>
                    ) : <span />}
                  </div>
                );
              })}
              {fromAppRotina && <button className={rt.addRow} onClick={openNewBlock}>+ Adicionar bloco</button>}
            </section>
          </div>

          {/* Lateral */}
          <div className={ex.side}>
            {isToday && current && (
              <div className={ex.panel} style={{ background: `radial-gradient(120% 90% at 100% 0%, ${cc}22, transparent 65%), linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02))`, borderColor: `${cc}55` }}>
                <span className={rt.nowLbl} style={{ color: cc }}><i style={{ background: cc }} />Agora</span>
                <div className={rt.nowName}>{current.activity}</div>
                <div className={rt.nowMeta}>{activityLabel(current.activity, current.category)} · {current.time}{next ? ` → ${next.time}` : ""}</div>
                {current.duration > 0 && (
                  <div className={rt.nowBar}>
                    <div className={rt.nowBarMeta}><span>andamento do bloco</span><span>{progressPct}%</span></div>
                    <div className={ex.bar}><span style={{ width: `${progressPct}%`, background: cc }} /></div>
                  </div>
                )}
                {next && <div className={rt.next}>A seguir: <b>{next.activity}</b></div>}
              </div>
            )}

            {isToday && dayBlocks.length > 0 && (
              <div className={ex.panel}>
                <div className={ex.panelTitle}>Progresso do dia</div>
                <div className={ex.ringPanel}>
                  <Ring pct={donePct} color="#38bdf8" size={108} stroke={10}>
                    <span className={ex.ringPct}>{donePct}%</span>
                    <span className={ex.ringSub}>feito</span>
                  </Ring>
                  <div className={ex.ringInfo}>
                    <span className={ex.bigValue}>{doneCount}<span className={ex.muted}> / {dayBlocks.length}</span></span>
                    <span className={ex.muted}>blocos concluídos</span>
                  </div>
                </div>
              </div>
            )}

            <Distribution blocks={blocks} title="Tempo do dia" />
          </div>
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

  if (loading) return <div className={ex.loading}>Carregando semana…</div>;
  if (error)   return <div className={ex.errorBox}><p><b>Erro ao carregar.</b> {error}</p></div>;
  if (!week) return null;

  const allBlocks = [0,1,2,3,4,5,6].flatMap(d => week[d] ?? []);

  return (
    <div className={rt.weekCol}>
      {/* Soma da semana no topo */}
      <Distribution blocks={allBlocks} title="Tempo da semana" wide />
      <div className={rt.weekGrid}>
          {DAYS_SHORT.map((_, idx) => {
            const isT    = idx === todayIdx;
            const blocks = week[idx] ?? [];
            const { segs } = catTotals(blocks);
            const chips  = segs.filter(s => s.mins >= 30).sort((a, b) => b.mins - a.mins).slice(0, 5);

            // Bloco atual e % feito (só hoje)
            let nowBlock = null, donePct = 0;
            if (isT && blocks.length > 0) {
              nowBlock = blocks.find(b => {
                const end = b.minutes + b.duration;
                return end <= 1440 ? b.minutes <= mins && mins < end : b.minutes <= mins || mins < end - 1440;
              });
              const wb = blocks.length > 1 ? blocks.slice(0, -1) : blocks;
              donePct = Math.round((wb.filter(b => b.minutes + b.duration <= mins).length / wb.length) * 100);
            }

            return (
              <button key={idx} className={`${rt.wday} ${isT ? rt.wdayToday : ""}`} onClick={() => onSelectDay(idx)}>
                <div className={rt.wTop}>
                  <span className={rt.wDate}>{getDateOfWeekday(idx)}</span>
                  <div className={rt.wName}>
                    <b>{DAYS_FULL[idx]}{isT && <span className={rt.todayTag}>HOJE</span>}</b>
                    <small style={nowBlock ? { color: catOf(nowBlock).color } : undefined}>
                      {nowBlock ? `agora: ${nowBlock.activity}` : blocks.length ? `${blocks.length} blocos` : "Sem atividades"}
                    </small>
                  </div>
                  {isT && blocks.length > 0 && (
                    <span className={rt.wRight} style={{ color: donePct >= 80 ? "#34d399" : donePct >= 40 ? "#fbbf24" : "rgba(255,255,255,0.45)" }}>{donePct}%</span>
                  )}
                </div>
                {segs.length > 0 && (
                  <div className={rt.stack}>
                    {segs.map(s => <span key={s.cat} style={{ width: `${s.pct}%`, background: CAT[s.cat]?.color }} />)}
                  </div>
                )}
                {chips.length > 0 && (
                  <div className={rt.chips}>
                    {chips.map(s => (
                      <span key={s.cat} className={rt.chip} style={{ "--c": CAT[s.cat]?.color }}>
                        {CAT[s.cat]?.label ?? s.cat} <strong>{minsToLabel(s.mins)}</strong>
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function RoutinePage() {
  const todayIdx = todayIndexBRT();
  const [tab, setTab]                 = useState("dia");
  const [selectedDay, setSelectedDay] = useState(todayIdx);

  function handleDayFromWeek(dayIdx) {
    setSelectedDay(dayIdx);
    setTab("dia");
  }

  const dateLabel = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className={ex.page} style={{ background: "radial-gradient(50% 35% at 85% 0%, rgba(56,189,248,0.10), transparent 70%), #07080c" }}>
      <ModuleHeader title="Rotina" hideOnDesktop />
      <Navigation />

      <header className={ex.top}>
        <div className={ex.topLeft}>
          <span className={ex.eyebrow}>Rotina · {dateLabel}</span>
          <h1 className={ex.title}>Minha Rotina</h1>
        </div>
        <div className={ex.topRight}>
          <div className={rt.switch}>
            {[["dia","Dia"],["semana","Semana"]].map(([key, label]) => (
              <button key={key} className={tab === key ? rt.on : ""} onClick={() => setTab(key)}>{label}</button>
            ))}
          </div>
        </div>
      </header>

      {tab === "dia"    && <TabDia selectedDay={selectedDay} onDayChange={setSelectedDay} />}
      {tab === "semana" && <TabSemana onSelectDay={handleDayFromWeek} />}
    </div>
  );
}
