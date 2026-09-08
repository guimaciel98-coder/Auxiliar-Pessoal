"use client";
import { useState, useEffect, useCallback } from "react";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";
import styles from "../Routine.module.css";

// ── Helpers de data ──────────────────────────────────────────────────────────
const DAY_ABR  = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const MES_ABR  = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const MES_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function toISO(d) { return d.toISOString().slice(0, 10); }
function addDays(d, n) { const r = new Date(d); r.setDate(d.getDate() + n); return r; }
function startOfWeek(d) { // segunda-feira
  const r = new Date(d); r.setHours(0,0,0,0);
  const dow = r.getDay(); // 0=dom
  r.setDate(r.getDate() - (dow === 0 ? 6 : dow - 1));
  return r;
}

// ── Feriados SP com nomes ────────────────────────────────────────────────────
function calcEaster(year) {
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4;
  const f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3);
  const h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4;
  const l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
  const month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;
  return new Date(year,month-1,day);
}
function getHolidays(year) {
  const iso=(m,d)=>`${year}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const fixed = [
    [iso(1, 1),  "Confraternização Universal"],
    [iso(1,25),  "Aniversário de São Paulo"],
    [iso(4,21),  "Tiradentes"],
    [iso(5, 1),  "Dia do Trabalho"],
    [iso(7, 9),  "Revolução Constitucionalista"],
    [iso(9, 7),  "Independência do Brasil"],
    [iso(10,12), "Nossa Senhora Aparecida"],
    [iso(11, 2), "Finados"],
    [iso(11,15), "Proclamação da República"],
    [iso(11,20), "Consciência Negra"],
    [iso(12,25), "Natal"],
  ];
  const easter = calcEaster(year);
  const easterISO = d => { const x=new Date(easter); x.setDate(easter.getDate()+d); return toISO(x); };
  const mobile = [
    [easterISO(-48), "Carnaval — Segunda-feira"],
    [easterISO(-47), "Carnaval — Terça-feira"],
    [easterISO( -2), "Sexta-feira da Paixão"],
    [easterISO( 60), "Corpus Christi"],
  ];
  const map = {};
  for (const [k, v] of [...fixed, ...mobile]) map[k] = v;
  return map;
}

// ── Tipos / cores ────────────────────────────────────────────────────────────
const TIPO_OPTIONS = ["família","trabalho","saúde","social","lazer","pessoal","viagem","médico","outro"];
const TIPO_COLOR = {
  "família":  "#f59e0b", "trabalho": "#3b82f6", "saúde":   "#10b981",
  "social":   "#818cf8", "lazer":    "#60a5fa", "pessoal": "#00e5a0",
  "viagem":   "#f97316", "médico":   "#ef4444", "outro":   "#9ca3af",
};
function tipoColor(t) { return TIPO_COLOR[(t||"").toLowerCase()] ?? "#9ca3af"; }

// ── Formatação de hora ───────────────────────────────────────────────────────
function fmtHora(h) {
  if (!h) return null;
  const m = h.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return h;
  return `${m[1]}h${m[2] !== "00" ? m[2] : ""}`;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function EventosPage() {
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);
  const [form,    setForm]    = useState({ evento:"", tipo:"", horario:"", data:"" });
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState(null);
  const [tab,     setTab]     = useState("agenda"); // "agenda" | "feriados"

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(null), 2500); }

  const reload = useCallback(() => {
    setLoading(true);
    fetch("/api/routine?agenda=1", { cache:"no-store" })
      .then(r=>r.json())
      .then(d=>{ if(d.ok) setEvents(d.events); })
      .finally(()=>setLoading(false));
  }, []);

  useEffect(()=>{ reload(); }, [reload]);

  // ── Modal ──────────────────────────────────────────────────────────────────
  function openAdd(date) {
    const iso = date ? toISO(date) : toISO(new Date());
    const [y,m,d] = iso.split("-");
    setForm({ evento:"", tipo:"", horario:"", data:`${y}-${m}-${d}` });
    setModal({ editMode:false });
  }
  function openEdit(evt) {
    setForm({ evento: evt.activity, tipo: evt.tipo??"", horario: evt.horario??"", data: evt.date });
    setModal({ editMode:true, sheetRow: evt.sheetRow });
  }

  async function handleSave() {
    if (!form.evento.trim() || !form.data) return;
    setSaving(true);
    try {
      const [y,m,d] = form.data.split("-");
      const dataStr = `${d}/${m}/${y}`;
      const body = { data: dataStr, evento: form.evento.trim(), tipo: form.tipo, horario: form.horario };
      if (modal.editMode) {
        await fetch("/api/routine/events", { method:"PUT",  headers:{"Content-Type":"application/json"}, body: JSON.stringify({...body, sheetRow: modal.sheetRow}) });
      } else {
        await fetch("/api/routine/events", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) });
      }
      showToast(modal.editMode ? "✓ Evento atualizado" : "✓ Evento adicionado");
      setModal(null);
      reload();
    } finally { setSaving(false); }
  }

  async function handleDelete(sheetRow, name) {
    await fetch("/api/routine/events", { method:"DELETE", headers:{"Content-Type":"application/json"}, body: JSON.stringify({sheetRow}) });
    showToast(`🗑 ${name} removido`);
    reload();
  }

  // ── Dados derivados ────────────────────────────────────────────────────────
  const today = new Date(); today.setHours(0,0,0,0);
  const todayISO = toISO(today);

  // Feriados dos próximos 2 anos
  const holidayMap = { ...getHolidays(today.getFullYear()), ...getHolidays(today.getFullYear()+1) };

  // Map de ISO → eventos do usuário
  const eventsByDate = {};
  for (const e of events) {
    if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
    eventsByDate[e.date].push(e);
  }

  // ── Agenda: semanas ────────────────────────────────────────────────────────
  const weeks = [];
  const weekStart = startOfWeek(today);
  for (let w = 0; w < 12; w++) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, w * 7 + i);
      const iso = toISO(d);
      days.push({ date: d, iso, holiday: holidayMap[iso] ?? null, events: eventsByDate[iso] ?? [] });
    }
    // só inclui semanas com conteúdo a partir da semana 2
    const hasContent = days.some(d => d.holiday || d.events.length > 0 || d.iso >= todayISO);
    if (w === 0 || hasContent) weeks.push({ label: weekLabel(days[0].date, days[6].date), days });
  }

  function weekLabel(mon, sun) {
    if (mon.getMonth() === sun.getMonth())
      return `${mon.getDate()}–${sun.getDate()} ${MES_ABR[mon.getMonth()]}`;
    return `${mon.getDate()} ${MES_ABR[mon.getMonth()]} – ${sun.getDate()} ${MES_ABR[sun.getMonth()]}`;
  }

  // ── Feriados futuros para aba ─────────────────────────────────────────────
  const futureHolidays = Object.entries(holidayMap)
    .filter(([iso]) => iso >= todayISO)
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([iso, name]) => {
      const [y,m,d] = iso.split("-").map(Number);
      const date = new Date(y,m-1,d);
      const diff = Math.round((date-today)/86400000);
      return { iso, name, date, diff };
    });

  // ── Estilos ───────────────────────────────────────────────────────────────
  const inpSt = {
    width:"100%", padding:"9px 12px", borderRadius:10,
    background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)",
    color:"#f0f0f8", fontSize:14, fontFamily:"inherit", outline:"none",
  };

  return (
    <div className={styles.container}>
      <ModuleHeader title="Eventos" />
      <Navigation />

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", bottom:90, left:"50%", transform:"translateX(-50%)",
          background:"rgba(17,24,39,0.97)", border:"1px solid rgba(255,255,255,0.1)",
          color:"#f0f0f8", padding:"10px 20px", borderRadius:12,
          fontSize:13, fontWeight:600, zIndex:999, whiteSpace:"nowrap" }}>
          {toast}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:500,
          display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
          onClick={()=>setModal(null)}>
          <div style={{ background:"#111827", border:"1px solid rgba(255,255,255,0.12)",
            borderRadius:20, padding:24, width:"100%", maxWidth:380 }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>
              {modal.editMode ? "Editar Evento" : "Novo Evento"}
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {/* Data */}
              <div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginBottom:5 }}>DATA</div>
                <input type="date" value={form.data}
                  onChange={e=>setForm(p=>({...p, data:e.target.value}))}
                  style={{ ...inpSt, colorScheme:"dark" }} />
              </div>

              {/* Evento */}
              <div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginBottom:5 }}>EVENTO</div>
                <input autoFocus value={form.evento}
                  onChange={e=>setForm(p=>({...p, evento:e.target.value}))}
                  onKeyDown={e=>e.key==="Enter" && handleSave()}
                  placeholder="Ex: Consulta médica, Almoço família…"
                  style={inpSt} />
              </div>

              {/* Horário */}
              <div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginBottom:5 }}>HORÁRIO (opcional)</div>
                <input type="time" value={form.horario}
                  onChange={e=>setForm(p=>({...p, horario:e.target.value}))}
                  style={{ ...inpSt, colorScheme:"dark" }} />
              </div>

              {/* Tipo */}
              <div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginBottom:8 }}>TIPO</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {TIPO_OPTIONS.map(t => {
                    const col = tipoColor(t);
                    const sel = form.tipo === t;
                    return (
                      <button key={t} type="button"
                        onClick={()=>setForm(p=>({...p, tipo: sel ? "" : t}))}
                        style={{ padding:"5px 12px", borderRadius:99, fontSize:12, fontWeight:700,
                          fontFamily:"inherit", cursor:"pointer", textTransform:"capitalize",
                          background: sel ? col+"22" : "rgba(255,255,255,0.04)",
                          color:      sel ? col : "rgba(255,255,255,0.4)",
                          border:    `1px solid ${sel ? col+"55" : "rgba(255,255,255,0.08)"}` }}>
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Botões */}
              <div style={{ display:"flex", gap:10, marginTop:6 }}>
                {modal.editMode && (
                  <button onClick={()=>{ handleDelete(modal.sheetRow, form.evento); setModal(null); }}
                    style={{ padding:"11px 16px", borderRadius:10, fontSize:13, fontWeight:600,
                      fontFamily:"inherit", cursor:"pointer", border:"1px solid rgba(239,68,68,0.3)",
                      background:"rgba(239,68,68,0.08)", color:"#ef4444" }}>
                    Excluir
                  </button>
                )}
                <button onClick={()=>setModal(null)}
                  style={{ flex:1, padding:12, borderRadius:10, fontSize:13, fontWeight:600,
                    fontFamily:"inherit", cursor:"pointer",
                    background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.4)" }}>
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving || !form.evento.trim() || !form.data}
                  style={{ flex:2, padding:12, borderRadius:10, fontSize:13, fontWeight:700,
                    fontFamily:"inherit", cursor:"pointer", border:"none", color:"#fff",
                    background:"linear-gradient(135deg,#10b981,#059669)",
                    opacity:(saving||!form.evento.trim()||!form.data)?0.5:1 }}>
                  {saving ? "Salvando…" : modal.editMode ? "Salvar" : "Adicionar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
        padding:"12px 0 16px" }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:900, margin:0 }}>Eventos</h1>
          <p style={{ fontSize:12, color:"var(--text-muted)", margin:"3px 0 0" }}>
            {today.toLocaleDateString("pt-BR",{weekday:"long", day:"numeric", month:"long"})}
          </p>
        </div>
        <button onClick={()=>openAdd(null)}
          style={{ padding:"9px 18px", borderRadius:12, fontSize:13, fontWeight:700,
            fontFamily:"inherit", cursor:"pointer", border:"none", color:"#fff",
            background:"linear-gradient(135deg,#10b981,#059669)" }}>
          + Novo Evento
        </button>
      </header>

      {/* Tabs */}
      <div style={{ display:"flex", gap:3, marginBottom:20, padding:"3px",
        background:"rgba(255,255,255,0.04)", borderRadius:10,
        border:"1px solid rgba(255,255,255,0.07)", width:"fit-content" }}>
        {[{k:"agenda",l:"📅 Agenda"},{k:"feriados",l:"🎉 Feriados"}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"7px 18px", borderRadius:8, fontSize:13, fontWeight:600,
              fontFamily:"inherit", cursor:"pointer",
              background: tab===t.k ? "rgba(255,255,255,0.09)" : "transparent",
              color:      tab===t.k ? "#fff" : "rgba(255,255,255,0.35)",
              border:"none", transition:"all 0.2s" }}>
            {t.l}
          </button>
        ))}
      </div>

      {loading && <p style={{ textAlign:"center", padding:"48px 0", color:"var(--text-muted)", fontSize:14 }}>Carregando…</p>}

      {/* ── Agenda ── */}
      {!loading && tab === "agenda" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {weeks.map((week, wi) => (
            <WeekSection key={wi} week={week} today={todayISO}
              onAdd={d=>openAdd(d)} onEdit={openEdit} />
          ))}
        </div>
      )}

      {/* ── Feriados ── */}
      {!loading && tab === "feriados" && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {futureHolidays.map(h => (
            <div key={h.iso} style={{
              display:"flex", alignItems:"center", gap:14,
              padding:"13px 16px", borderRadius:14,
              background:"rgba(168,85,247,0.06)",
              border:`1px solid rgba(168,85,247,${h.diff<=7?"0.35":"0.18"})`,
              borderLeft:`3px solid ${h.diff===0?"#06b6d4":h.diff<=7?"#f59e0b":"#a855f7"}`,
            }}>
              <div style={{ textAlign:"center", minWidth:40, flexShrink:0 }}>
                <div style={{ fontSize:9, fontWeight:800, color:"#a855f7", letterSpacing:"0.06em", textTransform:"uppercase" }}>
                  {h.diff===0 ? "HOJE" : h.diff===1 ? "AMANHÃ" : `${h.diff}d`}
                </div>
                <div style={{ fontSize:26, fontWeight:900, color:"#a855f7", lineHeight:1 }}>
                  {h.date.getDate()}
                </div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)" }}>
                  {MES_ABR[h.date.getMonth()]}
                </div>
              </div>
              <div style={{ width:1, height:32, background:"rgba(168,85,247,0.2)" }} />
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:"#f0f0f8" }}>{h.name}</div>
                <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2, textTransform:"capitalize" }}>
                  {h.date.toLocaleDateString("pt-BR",{weekday:"long"})} · {h.date.toLocaleDateString("pt-BR",{day:"numeric",month:"long",year:"numeric"})}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Componente de semana ─────────────────────────────────────────────────────
function WeekSection({ week, today, onAdd, onEdit }) {
  // Mostra a semana apenas se tiver algo relevante (eventos, feriados, ou for a semana atual/próxima contendo hoje)
  return (
    <div>
      {/* Header da semana */}
      <div style={{ fontSize:11, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.08em",
        color:"var(--text-muted)", marginBottom:6, paddingLeft:4 }}>
        {week.label}
      </div>

      {/* Dias */}
      <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
        {week.days.map(({ date, iso, holiday, events }) => {
          const isToday   = iso === today;
          const isPast    = iso < today;
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const hasContent= holiday || events.length > 0;
          const isActive  = isToday || hasContent;

          // Cor dominante do dia
          const accentColor = isToday ? "#06b6d4"
            : holiday ? "#a855f7"
            : events.length > 0 ? tipoColor(events[0].tipo)
            : isWeekend ? "rgba(255,255,255,0.18)"
            : "rgba(255,255,255,0.07)";

          return (
            <div key={iso} style={{
              display:"flex", alignItems:"center", gap:12,
              padding:"8px 12px", borderRadius:12,
              background: isToday
                ? "rgba(6,182,212,0.06)"
                : holiday
                  ? "rgba(168,85,247,0.05)"
                  : isWeekend && !isPast
                    ? "rgba(255,255,255,0.02)"
                    : "transparent",
              border:`1px solid ${isToday ? "rgba(6,182,212,0.25)" : hasContent ? accentColor+"28" : "rgba(255,255,255,0.04)"}`,
              borderLeft:`3px solid ${isActive ? accentColor : "rgba(255,255,255,0.05)"}`,
              opacity: isPast && !isToday ? 0.4 : 1,
              transition:"opacity 0.15s",
            }}>
              {/* Dia da semana + número */}
              <div style={{ width:44, flexShrink:0, textAlign:"center" }}>
                <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase",
                  color: isToday ? "#06b6d4" : holiday ? "#a855f7" : isWeekend ? "rgba(255,255,255,0.4)" : "var(--text-muted)" }}>
                  {isToday ? "HOJE" : DAY_ABR[date.getDay()]}
                </div>
                <div style={{ fontSize:20, fontWeight:900, lineHeight:1, marginTop:2,
                  color: isToday ? "#06b6d4" : holiday ? "#a855f7" : isWeekend ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.35)" }}>
                  {date.getDate()}
                </div>
              </div>

              {/* Conteúdo */}
              <div style={{ flex:1, minWidth:0, display:"flex", flexWrap:"wrap", gap:5, alignItems:"center" }}>
                {/* Feriado badge */}
                {holiday && (
                  <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:99,
                    background:"rgba(168,85,247,0.15)", color:"#c084fc",
                    border:"1px solid rgba(168,85,247,0.3)", whiteSpace:"nowrap" }}>
                    🎉 {holiday}
                  </span>
                )}
                {/* Eventos */}
                {events.map(e => (
                  <EventChip key={e.sheetRow} event={e} onClick={()=>onEdit(e)} />
                ))}
              </div>

              {/* Botão adicionar */}
              {!isPast && (
                <button onClick={()=>onAdd(date)}
                  style={{ flexShrink:0, width:26, height:26, borderRadius:8,
                    border:"1px dashed rgba(255,255,255,0.15)", background:"transparent",
                    color:"rgba(255,255,255,0.2)", fontSize:16, lineHeight:1,
                    cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                    transition:"all 0.15s" }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(16,185,129,0.5)";e.currentTarget.style.color="#10b981";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.15)";e.currentTarget.style.color="rgba(255,255,255,0.2)";}}>
                  +
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Chip de evento ───────────────────────────────────────────────────────────
function EventChip({ event, onClick }) {
  const col = tipoColor(event.tipo);
  const hora = event.horario ? fmtHora(event.horario) : null;
  return (
    <button onClick={onClick}
      style={{ display:"flex", alignItems:"center", gap:5,
        padding:"3px 10px 3px 8px", borderRadius:99, cursor:"pointer",
        background: col+"18", border:`1px solid ${col}40`,
        fontFamily:"inherit", maxWidth:240 }}>
      {hora && (
        <span style={{ fontSize:10, fontWeight:800, color:col, letterSpacing:"0.03em", flexShrink:0 }}>
          {hora}
        </span>
      )}
      <span style={{ fontSize:12, fontWeight:700, color:"#f0f0f8",
        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
        {event.activity}
      </span>
      {event.tipo && (
        <span style={{ fontSize:9, fontWeight:700, color:col, textTransform:"capitalize", flexShrink:0 }}>
          · {event.tipo}
        </span>
      )}
    </button>
  );
}
