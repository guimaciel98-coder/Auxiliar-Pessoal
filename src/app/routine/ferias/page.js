"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";
import styles from "../Routine.module.css";

const INIT_DAYS = [
  { day:1,  date:"2026-07-01", wd:"Qua", title:"Burocracia pesada", blocks:[
    {p:"manhã",t:"CIN (Carteira de Identidade)"},{p:"tarde",t:"Marcar médicos"},{p:"academia",t:"Academia"}]},
  { day:2,  date:"2026-07-02", wd:"Qui", title:"Compras + organização", blocks:[
    {p:"manhã",t:"Agendar natação e pilates"},{p:"tarde",t:"Compras — sunga, perfume, suporte gabinete"}]},
  { day:3,  date:"2026-07-03", wd:"Sex", title:"Resolver e relaxar", blocks:[
    {p:"manhã",t:"FUP gabinete"},{p:"tarde",t:"Arrumar tela"},{p:"noite",t:"Jantar fora (Pinheiros/Vila Madalena)"}]},
  { day:4,  date:"2026-07-04", wd:"Sáb", title:"Cultura + gastronomia", blocks:[
    {p:"manhã",t:"Pilates"},{p:"tarde",t:"Pinacoteca (grátis no sábado)"},{p:"noite",t:"Rodízio japonês"}]},
  { day:5,  date:"2026-07-05", wd:"Dom", title:"Ar livre + lazer", blocks:[
    {p:"manhã",t:"Corrida no parque"},{p:"tarde",t:"Piquenique"},{p:"noite",t:"Jogos em casa"}]},
  { day:6,  date:"2026-07-06", wd:"Seg", title:"Treino + cozinha", blocks:[
    {p:"academia",t:"Academia"},{p:"tarde",t:"Tarde livre"},{p:"noite",t:"Cozinhar receita nova juntos"}]},
  { day:7,  date:"2026-07-07", wd:"Ter", title:"Museu + cinema", blocks:[
    {p:"academia",t:"Academia"},{p:"tarde",t:"MASP (grátis na terça)"},{p:"noite",t:"Cinema"}]},
  { day:8,  date:"2026-07-08", wd:"Qua", title:"Esporte + cultura", blocks:[
    {p:"manhã",t:"Natação"},{p:"tarde",t:"Museu do Futebol"},{p:"noite",t:"Série em casa"}]},
  { day:9,  date:"2026-07-09", wd:"Qui", title:"Social + passeio", blocks:[
    {p:"manhã",t:"Café da manhã fora"},{p:"tarde",t:"Ver Projeto Social"},{p:"noite",t:"Passeio noturno"}]},
  { day:10, date:"2026-07-10", wd:"Sex", title:"Dia livre total", blocks:[
    {p:"manhã",t:"Acordar sem pressa"},{p:"tarde",t:"Maratona de série"},{p:"noite",t:"Delivery"}]},
  { day:11, date:"2026-07-11", wd:"Sáb", title:"Feira + jantar", blocks:[
    {p:"manhã",t:"Pilates"},{p:"tarde",t:"Feira da Liberdade"},{p:"noite",t:"Jantar no bairro"}]},
  { day:12, date:"2026-07-12", wd:"Dom", title:"Casa + corrida", blocks:[
    {p:"manhã",t:"Faxina da casa"},{p:"tarde",t:"Corrida + tarde em casa"}]},
  { day:13, date:"2026-07-13", wd:"Seg", title:"Saúde + agenda", blocks:[
    {p:"academia",t:"Academia"},{p:"tarde",t:"Consultas médicas"},{p:"noite",t:"Agendar psicóloga"}]},
  { day:14, date:"2026-07-14", wd:"Ter", title:"Trabalho + cultura", blocks:[
    {p:"academia",t:"Academia"},{p:"tarde",t:"Pagamento PDV + MASP"},{p:"noite",t:"Jantar especial"}]},
  { day:15, date:"2026-07-15", wd:"Qua", title:"Encerramento", blocks:[
    {p:"academia",t:"Academia"},{p:"tarde",t:"Tarde livre no parque"},{p:"noite",t:"Rodízio japonês (encerramento)"}]},
];

// "academia" é tratada como parte da manhã visualmente
const PM = {
  "manhã":    { color: "#f59e0b", bg: "rgba(245,158,11,0.10)", icon: "☀" },
  "tarde":    { color: "#3b82f6", bg: "rgba(59,130,246,0.10)", icon: "🌤" },
  "noite":    { color: "#8b5cf6", bg: "rgba(139,92,246,0.10)", icon: "🌙" },
  "academia": { color: "#f59e0b", bg: "rgba(245,158,11,0.10)", icon: "🏋" },
};
const PERIODS = ["manhã", "tarde", "noite"];
// Períodos de exibição (academia agrupada em manhã)
const DISP = ["manhã", "tarde", "noite"];
const DISP_META = {
  "manhã": { color: "#f59e0b", bg: "rgba(245,158,11,0.10)", icon: "☀", label: "Manhã" },
  "tarde": { color: "#3b82f6", bg: "rgba(59,130,246,0.10)", icon: "🌤", label: "Tarde" },
  "noite": { color: "#8b5cf6", bg: "rgba(139,92,246,0.10)", icon: "🌙", label: "Noite" },
};
const WEEKDAYS = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
const CAL_OFFSET = 2; // Jul 1, 2026 = quarta = índice 2 (Seg=0)

// academia → manhã para agrupamento visual
function dp(period) { return period === "academia" ? "manhã" : period; }

function defaultBlocks() {
  const b = {};
  INIT_DAYS.forEach((d, i) => { b[i] = d.blocks.map(x => ({ ...x })); });
  return b;
}
const DEFAULT_PEND = [
  { text: "Reservar restaurante rodízio japonês", done: false },
  { text: "Comprar sunga e perfume", done: false },
  { text: "Agendar natação e pilates", done: false },
  { text: "Agendar psicóloga", done: false },
  { text: "Verificar ingresso Pinacoteca/MASP", done: false },
];

export default function FeriasPage() {
  const todayISO = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
  const todayIdx = INIT_DAYS.findIndex(d => d.date === todayISO);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sel, setSel]         = useState(todayIdx >= 0 ? todayIdx : 0);
  const [blocks, setBlocks]   = useState(defaultBlocks);
  const [checked, setChecked] = useState({});
  const [notes, setNotes]     = useState({});
  const [pend, setPend]       = useState(DEFAULT_PEND);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding]   = useState(null);
  const [newPend, setNewPend] = useState("");
  const [isWide, setIsWide]   = useState(false);

  const hasLoaded = useRef(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    const c = () => setIsWide(window.innerWidth > 960);
    c();
    window.addEventListener("resize", c);
    return () => window.removeEventListener("resize", c);
  }, []);

  const loadFromServer = useCallback(async () => {
    try {
      const res = await fetch("/api/routine/ferias", { cache: "no-store" });
      const json = await res.json();
      if (json.ok && json.data) {
        if (json.data.blocks)  setBlocks(json.data.blocks);
        if (json.data.checked) setChecked(json.data.checked);
        if (json.data.notes)   setNotes(json.data.notes);
        if (json.data.pend)    setPend(json.data.pend);
      }
    } catch {}
    setLoading(false);
    hasLoaded.current = true;
  }, []);

  useEffect(() => { loadFromServer(); }, [loadFromServer]);

  // Recarrega automaticamente quando o usuário volta para a aba (sincronização entre dispositivos)
  useEffect(() => {
    const reload = () => { if (!saveTimer.current && hasLoaded.current) loadFromServer(); };
    const onVis  = () => { if (document.visibilityState === "visible") reload(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", reload);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", reload);
    };
  }, [loadFromServer]);

  const saveToServer = useCallback((b, c, n, p) => {
    if (!hasLoaded.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSyncing(true);
      try {
        await fetch("/api/routine/ferias", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blocks: b, checked: c, notes: n, pend: p }),
        });
      } catch {}
      setSyncing(false);
    }, 1200);
  }, []);

  useEffect(() => { saveToServer(blocks, checked, notes, pend); }, [blocks, checked, notes, pend, saveToServer]);

  // ── Ações ─────────────────────────────────────────────────────────────────
  const dayBlocks = (di) => blocks[di] ?? [];

  function toggleCheck(di, bi) {
    const k = `${di}-${bi}`;
    setChecked(p => { const n = { ...p }; if (n[k]) delete n[k]; else n[k] = true; return n; });
  }
  function addBlock(di, period, text) {
    if (!text.trim()) return;
    setBlocks(p => ({ ...p, [di]: [...(p[di] ?? []), { p: period, t: text.trim() }] }));
    setAdding(null);
  }
  function removeBlock(di, bi) {
    setBlocks(p => ({ ...p, [di]: (p[di] ?? []).filter((_, j) => j !== bi) }));
    setChecked(p => {
      const n = {};
      for (const [k, v] of Object.entries(p)) {
        const [d, b] = k.split("-").map(Number);
        if (d === di && b === bi) continue;
        if (d === di && b > bi) n[`${d}-${b - 1}`] = v;
        else n[k] = v;
      }
      return n;
    });
  }
  function moveBlock(fromDi, bi, toDi) {
    const block = dayBlocks(fromDi)[bi];
    if (!block) return;
    removeBlock(fromDi, bi);
    setBlocks(p => ({ ...p, [toDi]: [...(p[toDi] ?? []), { ...block }] }));
  }
  function saveEdit(di, bi, text) {
    if (!text.trim()) return setEditing(null);
    setBlocks(p => ({ ...p, [di]: (p[di] ?? []).map((b, j) => j === bi ? { ...b, t: text.trim() } : b) }));
    setEditing(null);
  }

  // Agrupa blocos por período de exibição (academia → manhã)
  function groupByDisp(blks) {
    const g = { "manhã": [], "tarde": [], "noite": [] };
    blks.forEach((b, bi) => { const d = dp(b.p); if (g[d]) g[d].push({ block: b, bi }); });
    return g;
  }

  const dayDone = (di) => { const b = dayBlocks(di); return b.length > 0 && b.every((_, bi) => checked[`${di}-${bi}`]); };
  const completedDays = INIT_DAYS.filter((_, di) => dayDone(di)).length;
  const totalBlocks   = INIT_DAYS.reduce((s, _, di) => s + dayBlocks(di).length, 0);
  const checkedCount  = Object.keys(checked).length;
  const pct = totalBlocks > 0 ? Math.round((checkedCount / totalBlocks) * 100) : 0;
  const cur = INIT_DAYS[sel];
  const curBlocks = dayBlocks(sel);

  // ── Calendário ────────────────────────────────────────────────────────────
  const renderCalendar = () => {
    const cells = Array(CAL_OFFSET).fill(null);
    for (let i = 0; i < 15; i++) cells.push(i);
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks = Array.from({ length: cells.length / 7 }, (_, wi) => cells.slice(wi * 7, wi * 7 + 7));

    return (
      <div style={{ marginBottom: 24 }}>
        {/* Cabeçalho dias da semana */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5, marginBottom: 5 }}>
          {WEEKDAYS.map(d => (
            <div key={d} style={{
              textAlign: "center", fontSize: 10, fontWeight: 800, padding: "3px 0",
              textTransform: "uppercase", letterSpacing: "0.04em",
              color: (d === "Sáb" || d === "Dom") ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.3)",
            }}>{d}</div>
          ))}
        </div>

        {/* Semanas */}
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5, marginBottom: 5 }}>
            {week.map((di, ci) => {
              if (di === null) return (
                <div key={ci} style={{ borderRadius: 12, minHeight: 90, background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.03)" }} />
              );
              const d      = INIT_DAYS[di];
              const isT    = d.date === todayISO;
              const done   = dayDone(di);
              const isSel  = di === sel;
              const blks   = dayBlocks(di);
              const isWknd = d.wd === "Sáb" || d.wd === "Dom";
              const g      = groupByDisp(blks);

              return (
                <button key={ci} onClick={() => setSel(di)} style={{
                  minHeight: 120, padding: "10px 9px 9px", borderRadius: 12, cursor: "pointer",
                  border: isSel
                    ? "2px solid rgba(255,255,255,0.45)"
                    : isT
                      ? "2px solid rgba(245,158,11,0.6)"
                      : done
                        ? "1px solid rgba(16,185,129,0.25)"
                        : "1px solid rgba(255,255,255,0.07)",
                  background: isSel
                    ? "rgba(255,255,255,0.09)"
                    : done
                      ? "rgba(16,185,129,0.06)"
                      : isWknd
                        ? "rgba(255,255,255,0.012)"
                        : "rgba(255,255,255,0.025)",
                  textAlign: "left", fontFamily: "inherit", outline: "none",
                  transition: "all 0.15s", display: "flex", flexDirection: "column", gap: 5,
                }}>
                  {/* Número do dia */}
                  <div style={{
                    fontSize: 17, fontWeight: 900, lineHeight: 1,
                    color: done ? "#10b981" : isT ? "#f59e0b" : isSel ? "#fff" : isWknd ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.72)",
                  }}>{done ? "✓" : d.day}</div>

                  {/* Faixas manhã / tarde / noite */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
                    {DISP.map(period => {
                      const items = g[period];
                      if (items.length === 0) return null;
                      const meta  = DISP_META[period];
                      const allDone = items.every(({ bi }) => checked[`${di}-${bi}`]);
                      return (
                        <div key={period} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          <div style={{ width: 3, height: 3, borderRadius: 99, background: allDone ? "rgba(255,255,255,0.15)" : meta.color, flexShrink: 0 }} />
                          <div style={{ display: "flex", gap: 2 }}>
                            {items.map(({ bi }) => (
                              <div key={bi} style={{
                                width: 4, height: 4, borderRadius: 99,
                                background: checked[`${di}-${bi}`] ? "rgba(255,255,255,0.08)" : meta.color,
                              }} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Contador */}
                  {blks.length > 0 && (
                    <div style={{
                      fontSize: 9, fontWeight: 700,
                      color: done ? "#10b981" : "rgba(255,255,255,0.2)",
                    }}>
                      {blks.filter((_, bi) => checked[`${di}-${bi}`]).length}/{blks.length}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // ── Card do dia ───────────────────────────────────────────────────────────
  const renderDayCard = () => {
    if (!cur) return null;
    const g = groupByDisp(curBlocks);

    return (
      <div style={{
        borderRadius: 16,
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${cur.date === todayISO ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.09)"}`,
        marginBottom: 14, overflow: "hidden",
      }}>
        {/* Cabeçalho */}
        <div style={{
          padding: "16px 20px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: cur.date === todayISO ? "rgba(245,158,11,0.04)" : "transparent",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: cur.date === todayISO ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.07)",
            fontSize: 20, fontWeight: 900,
            color: cur.date === todayISO ? "#f59e0b" : "rgba(255,255,255,0.75)",
          }}>{cur.day}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: cur.date === todayISO ? "#f59e0b" : "rgba(255,255,255,0.9)" }}>
                {cur.wd}, {parseInt(cur.date.split("-")[2])} jul
              </span>
              {cur.date === todayISO && (
                <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 99, background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)", letterSpacing: "0.06em" }}>HOJE</span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            <button onClick={() => setSel(Math.max(0, sel - 1))} disabled={sel === 0}
              style={{ background: "none", border: "none", color: sel > 0 ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.1)", cursor: sel > 0 ? "pointer" : "default", fontSize: 16, padding: "4px 6px" }}>◀</button>
            <button onClick={() => setSel(Math.min(14, sel + 1))} disabled={sel === 14}
              style={{ background: "none", border: "none", color: sel < 14 ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.1)", cursor: sel < 14 ? "pointer" : "default", fontSize: 16, padding: "4px 6px" }}>▶</button>
          </div>
        </div>

        {/* Seções por período */}
        <div style={{ padding: "16px 20px 18px", display: "flex", flexDirection: "column", gap: 18 }}>
          {DISP.map(period => {
            const meta = DISP_META[period];
            return (
              <div key={period}>
                {/* Header do período */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 3, height: 16, borderRadius: 99, background: meta.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.09em", color: meta.color }}>
                    {meta.icon} {meta.label}
                  </span>
                </div>

                {/* Atividades */}
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {g[period].map(({ block, bi }) => {
                    const k = `${sel}-${bi}`, done = !!checked[k];
                    const isEd = editing === k;
                    return (
                      <div key={bi} style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 12,
                        background: done ? "rgba(16,185,129,0.04)" : meta.bg,
                        border: `1px solid ${done ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.05)"}`,
                        opacity: done ? 0.5 : 1, transition: "all 0.2s",
                      }}>
                        <button onClick={() => toggleCheck(sel, bi)} style={{
                          flexShrink: 0, width: 22, height: 22, borderRadius: 6,
                          border: `2px solid ${done ? "#10b981" : meta.color}`,
                          background: done ? "rgba(16,185,129,0.2)" : "transparent",
                          color: done ? "#10b981" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "pointer", fontSize: 12, fontWeight: 900,
                        }}>{done ? "✓" : ""}</button>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          {isEd ? (
                            <input autoFocus defaultValue={block.t}
                              onBlur={e => saveEdit(sel, bi, e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setEditing(null); }}
                              style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "5px 9px", color: "#f0f0f8", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                          ) : (
                            <div style={{
                              fontSize: 14, fontWeight: 500, lineHeight: 1.4,
                              color: done ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.85)",
                              textDecoration: done ? "line-through" : "none",
                            }}>{block.t}</div>
                          )}
                        </div>

                        <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                          {/* Editar */}
                          <button onClick={() => setEditing(editing === k ? null : k)} title="Editar"
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "center",
                              width: 32, height: 32, borderRadius: 8, cursor: "pointer", border: "none",
                              background: editing === k ? "rgba(129,140,248,0.2)" : "rgba(255,255,255,0.06)",
                              color: editing === k ? "#818cf8" : "rgba(255,255,255,0.45)", fontSize: 14,
                            }}>✏</button>
                          {/* Reagendar */}
                          <div style={{ position: "relative" }}>
                            <select value="" onChange={e => { if (e.target.value !== "") moveBlock(sel, bi, Number(e.target.value)); }}
                              title="Reagendar para outro dia"
                              style={{
                                position: "absolute", inset: 0, opacity: 0, cursor: "pointer",
                                width: "100%", height: "100%", zIndex: 1,
                              }}>
                              <option value="" disabled>Reagendar</option>
                              {INIT_DAYS.map((d, di) => di !== sel && (
                                <option key={di} value={di} style={{ background: "#1a1a2e" }}>Dia {d.day} — {d.wd}</option>
                              ))}
                            </select>
                            <div style={{
                              display: "flex", alignItems: "center", justifyContent: "center",
                              width: 32, height: 32, borderRadius: 8,
                              background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)", fontSize: 14,
                              pointerEvents: "none",
                            }}>↗</div>
                          </div>
                          {/* Remover */}
                          <button onClick={() => { if (window.confirm("Remover?")) removeBlock(sel, bi); }} title="Remover"
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "center",
                              width: 32, height: 32, borderRadius: 8, cursor: "pointer", border: "none",
                              background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)", fontSize: 14,
                            }}>✕</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Adicionar */}
          {adding === sel ? (
            <AddBlockForm onAdd={(p, t) => addBlock(sel, p, t)} onCancel={() => setAdding(null)} />
          ) : (
            <button onClick={() => setAdding(sel)} style={{
              width: "100%", padding: "10px 0", borderRadius: 10, fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
              border: "1px dashed rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.3)",
            }}>+ Adicionar atividade</button>
          )}
        </div>
      </div>
    );
  };

  // ── Notas ─────────────────────────────────────────────────────────────────
  const renderNotes = () => (
    <div style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.22)", marginBottom: 8 }}>
        Notas — Dia {cur?.day}
      </div>
      <textarea value={notes[sel] ?? ""} onChange={e => setNotes(p => ({ ...p, [sel]: e.target.value }))}
        placeholder="Anotações, lembretes, ideias..." rows={3}
        style={{ width: "100%", background: "transparent", border: "none", color: "#f0f0f8", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical", minHeight: 56, lineHeight: 1.6, boxSizing: "border-box", padding: 0 }} />
    </div>
  );

  // ── Pendências ────────────────────────────────────────────────────────────

  if (loading) return (
    <div className={styles.container}>
      <ModuleHeader title="Férias" backTo="/routine" />
      <Navigation />
      <p style={{ textAlign: "center", padding: "60px 0", color: "rgba(255,255,255,0.2)", fontSize: 14 }}>Carregando...</p>
    </div>
  );

  return (
    <div className={styles.container}>
      <ModuleHeader title="Férias" backTo="/routine" />
      <Navigation />

      {/* Barra de progresso */}
      <div style={{ padding: "16px 22px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 900, color: "#f59e0b" }}>🏖 Férias Jul 2026</span>
            {syncing && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontWeight: 600 }}>salvando...</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={loadFromServer} title="Recarregar"
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: 14, padding: "2px 4px" }}>↻</button>
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>{completedDays}/15 dias</span>
          </div>
        </div>
        <div style={{ height: 6, borderRadius: 99, overflow: "hidden", background: "rgba(255,255,255,0.06)" }}>
          <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: "linear-gradient(90deg,#f59e0b,#10b981)", transition: "width 0.4s" }} />
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", marginTop: 6, textAlign: "right" }}>{checkedCount}/{totalBlocks} atividades · {pct}%</div>
      </div>

      {isWide ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
          <div>{renderCalendar()}</div>
          <div>
            {renderDayCard()}
            {renderNotes()}
          </div>
        </div>
      ) : (
        <>
          {renderCalendar()}
          {renderDayCard()}
          {renderNotes()}
        </>
      )}
    </div>
  );
}

function AddBlockForm({ onAdd, onCancel }) {
  const [period, setPeriod] = useState("manhã");
  const [text, setText]     = useState("");
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)" }}>
      <div style={{ width: 100 }}>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Período</div>
        <select value={period} onChange={e => setPeriod(e.target.value)}
          style={{ width: "100%", padding: "6px 8px", borderRadius: 7, fontSize: 13, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#f0f0f8", fontFamily: "inherit", outline: "none", appearance: "none", cursor: "pointer" }}>
          {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Atividade</div>
        <input autoFocus value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && text.trim()) onAdd(period, text); if (e.key === "Escape") onCancel(); }}
          placeholder="Descrição..."
          style={{ width: "100%", padding: "6px 9px", borderRadius: 7, fontSize: 13, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#f0f0f8", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
      </div>
      <button onClick={() => { if (text.trim()) onAdd(period, text); }} disabled={!text.trim()}
        style={{ padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 700, border: "none", cursor: text.trim() ? "pointer" : "default",
          background: text.trim() ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.04)",
          color: text.trim() ? "#10b981" : "rgba(255,255,255,0.2)", fontFamily: "inherit" }}>OK</button>
      <button onClick={onCancel}
        style={{ padding: "6px 10px", borderRadius: 7, fontSize: 12, border: "none", cursor: "pointer", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", fontFamily: "inherit" }}>✕</button>
    </div>
  );
}
