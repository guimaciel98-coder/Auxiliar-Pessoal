"use client";
// Rotina > Eventos — visual no padrão do redesign.
import { useState, useEffect, useCallback } from "react";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";
import ex from "../../finance/expenses/Expenses.module.css";
import rt from "../RoutineDay.module.css";
import ev from "./Events.module.css";

// ── Helpers de data ──────────────────────────────────────────────────────────
const DAY_ABR = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const MES_ABR = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

function toISO(d) { return d.toISOString().slice(0, 10); }
function addDays(d, n) { const r = new Date(d); r.setDate(d.getDate() + n); return r; }
function startOfWeek(d) { // segunda-feira
  const r = new Date(d); r.setHours(0,0,0,0);
  const dow = r.getDay(); // 0=dom
  r.setDate(r.getDate() - (dow === 0 ? 6 : dow - 1));
  return r;
}
function isoToDate(iso) { const [y,m,d] = iso.split("-").map(Number); return new Date(y, m - 1, d); }
function emDias(n) { return n === 0 ? "hoje" : n === 1 ? "amanhã" : `em ${n} dias`; }

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
  "família":  "#fbbf24", "trabalho": "#38bdf8", "saúde":   "#34d399",
  "social":   "#a78bfa", "lazer":    "#22d3ee", "pessoal": "#cbd5e1",
  "viagem":   "#fb923c", "médico":   "#fb7185", "outro":   "#9ca3af",
};
const HOLIDAY_COLOR = "#f472b6";
function tipoColor(t) { return TIPO_COLOR[(t||"").toLowerCase()] ?? "#9ca3af"; }

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

  // ── Janela ─────────────────────────────────────────────────────────────────
  function openAdd(date) {
    const iso = date ? toISO(date) : toISO(new Date());
    setForm({ evento:"", tipo:"", horario:"", data: iso });
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
  const holidayMap = { ...getHolidays(today.getFullYear()), ...getHolidays(today.getFullYear()+1) };

  const eventsByDate = {};
  for (const e of events) {
    if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
    eventsByDate[e.date].push(e);
  }

  // Agenda: 12 semanas a partir desta
  const weeks = [];
  const weekStart = startOfWeek(today);
  for (let w = 0; w < 12; w++) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, w * 7 + i);
      const iso = toISO(d);
      days.push({ date: d, iso, holiday: holidayMap[iso] ?? null, events: eventsByDate[iso] ?? [] });
    }
    const hasContent = days.some(d => d.holiday || d.events.length > 0 || d.iso >= todayISO);
    if (w === 0 || hasContent) weeks.push({ label: weekLabel(days[0].date, days[6].date), days, count: days.reduce((s, d) => s + d.events.length, 0) });
  }
  function weekLabel(mon, sun) {
    if (mon.getMonth() === sun.getMonth()) return `${mon.getDate()}–${sun.getDate()} ${MES_ABR[mon.getMonth()]}`;
    return `${mon.getDate()} ${MES_ABR[mon.getMonth()]} – ${sun.getDate()} ${MES_ABR[sun.getMonth()]}`;
  }

  const futureHolidays = Object.entries(holidayMap)
    .filter(([iso]) => iso >= todayISO)
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([iso, name]) => {
      const date = isoToDate(iso);
      return { iso, name, date, diff: Math.round((date - today) / 86400000) };
    });

  // Próximos eventos (a partir de hoje)
  const upcoming = events
    .filter(e => e.date >= todayISO)
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.horario ?? "").localeCompare(String(b.horario ?? "")))
    .map(e => ({ ...e, d: isoToDate(e.date), diff: Math.round((isoToDate(e.date) - today) / 86400000) }));
  const semana   = upcoming.filter(e => e.diff < 7).length;
  const em30     = upcoming.filter(e => e.diff < 30).length;
  const proxEv   = upcoming[0];
  const proxFer  = futureHolidays[0];

  return (
    <div className={ex.page} style={{ background: "radial-gradient(50% 35% at 85% 0%, rgba(244,114,182,0.09), transparent 70%), #07080c" }}>
      <ModuleHeader title="Eventos" hideOnDesktop />
      <Navigation />

      {toast && <div className={ex.toast}>{toast}</div>}

      {/* Janela de evento */}
      {modal && (
        <div className={ex.overlay} onClick={() => setModal(null)}>
          <div className={ex.modal} onClick={e => e.stopPropagation()}>
            <div className={ex.modalTop}>
              <h3 className={ex.modalTitle}>{modal.editMode ? "Editar evento" : "Novo evento"}</h3>
              <button type="button" className={ex.closeBtn} onClick={() => setModal(null)} title="Fechar">✕</button>
            </div>
            <p className={ex.modalSub}>{modal.editMode ? "Altere o que precisar e salve." : "Adicione um compromisso à agenda."}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label className={rt.lbl}>Evento</label>
                <input autoFocus value={form.evento} className={rt.input}
                  onChange={e => setForm(p => ({ ...p, evento: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && handleSave()}
                  placeholder="Ex: Consulta médica, Almoço família…" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className={rt.lbl}>Data</label>
                  <input type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} className={rt.input} />
                </div>
                <div>
                  <label className={rt.lbl}>Horário (opcional)</label>
                  <input type="time" value={form.horario} onChange={e => setForm(p => ({ ...p, horario: e.target.value }))} className={rt.input} />
                </div>
              </div>
              <div>
                <label className={rt.lbl}>Tipo</label>
                <div className={rt.pick}>
                  {TIPO_OPTIONS.map(t => (
                    <button key={t} type="button" onClick={() => setForm(p => ({ ...p, tipo: p.tipo === t ? "" : t }))}
                      className={`${rt.pickBtn} ${form.tipo === t ? rt.pickOn : ""}`} style={{ "--c": tipoColor(t), textTransform: "capitalize" }}>
                      <i />{t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className={rt.mBtns}>
              {modal.editMode && <button type="button" onClick={() => { handleDelete(modal.sheetRow, form.evento); setModal(null); }} className={rt.del}>Excluir</button>}
              <button type="button" onClick={() => setModal(null)} className={rt.cancel}>Cancelar</button>
              <button type="button" onClick={handleSave} disabled={saving || !form.evento.trim() || !form.data} className={rt.save}>
                {saving ? "Salvando…" : modal.editMode ? "Salvar" : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cabeçalho */}
      <header className={ex.top}>
        <div className={ex.topLeft}>
          <span className={ex.eyebrow}>Rotina · {today.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</span>
          <h1 className={ex.title}>Eventos</h1>
        </div>
        <div className={ex.topRight}>
          <div className={rt.switch}>
            {[["agenda","Agenda"],["feriados","Feriados"]].map(([k, l]) => (
              <button key={k} className={tab === k ? rt.on : ""} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
          <button className={ex.primaryBtn} onClick={() => openAdd(null)}><span className={ex.plus}>+</span> Novo evento</button>
        </div>
      </header>

      {/* Big numbers */}
      <div className={ex.tabs}>
        {[
          { label: "Próximo evento",  value: proxEv ? emDias(proxEv.diff) : "—", color: "#38bdf8", hint: proxEv ? proxEv.activity : "nada marcado" },
          { label: "Nesta semana",    value: String(semana), color: "#a78bfa", hint: semana === 1 ? "evento nos próximos 7 dias" : "eventos nos próximos 7 dias" },
          { label: "Próximos 30 dias", value: String(em30),  color: "#34d399", hint: "eventos marcados" },
          { label: "Próximo feriado", value: proxFer ? emDias(proxFer.diff) : "—", color: HOLIDAY_COLOR, hint: proxFer ? proxFer.name : "" },
        ].map(s => (
          <div key={s.label} className={ex.tabBox} style={{ "--t": s.color }}>
            <span className={ex.tabLabel}><span className={ex.tabDot} />{s.label}</span>
            <span className={ex.tabValue} style={{ color: s.color }}>{s.value}</span>
            <span className={ex.tabHint} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.hint}</span>
          </div>
        ))}
      </div>

      {loading && <div className={ex.loading}>Carregando…</div>}

      {/* ── Agenda ── */}
      {!loading && tab === "agenda" && (
        <div className={ex.layout}>
          <div className={ex.mainArea}>
            {weeks.map((week, wi) => (
              <section key={wi} className={ex.listPanel}>
                <div className={ex.sectionHead}>
                  <span className={ex.sectionDot} style={{ background: wi === 0 ? "#38bdf8" : "rgba(255,255,255,0.3)", boxShadow: wi === 0 ? "0 0 10px #38bdf8" : "none" }} />
                  <span className={ex.sectionName}>{wi === 0 ? "Esta semana" : week.label}</span>
                  {wi === 0 && <span className={ex.sectionCount}>{week.label}</span>}
                  <span className={ex.sectionTotal}>{week.count ? `${week.count} evento${week.count > 1 ? "s" : ""}` : ""}</span>
                </div>
                {week.days.map(({ date, iso, holiday, events: evs }) => {
                  const isToday   = iso === todayISO;
                  const isPast    = iso < todayISO;
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  const empty     = !holiday && evs.length === 0;
                  const c = holiday ? HOLIDAY_COLOR : evs.length ? tipoColor(evs[0].tipo) : isToday ? "#38bdf8" : "rgba(255,255,255,0.08)";
                  return (
                    <div key={iso} style={{ "--c": c }}
                      className={`${ev.day} ${isToday ? ev.dayToday : ""} ${isPast && !isToday ? ev.dayPast : ""} ${isWeekend ? ev.weekend : ""} ${empty ? ev.dayEmpty : ""}`}>
                      <div className={ev.date}>
                        <span>{isToday ? "Hoje" : DAY_ABR[date.getDay()]}</span>
                        <b>{date.getDate()}</b>
                      </div>
                      <div className={ev.items}>
                        {holiday && <span className={ev.holiday}>🎉 {holiday}</span>}
                        {evs.map(e => (
                          <button key={e.sheetRow} className={ev.chip} style={{ "--c": tipoColor(e.tipo) }} onClick={() => openEdit(e)} title="Editar">
                            <i />{e.horario && <em>{fmtHora(e.horario)}</em>}<b>{e.activity}</b>
                          </button>
                        ))}
                        {empty && !isPast && <span className={ev.none}>livre</span>}
                      </div>
                      {!isPast ? <button className={ev.add} onClick={() => openAdd(date)} title="Adicionar evento neste dia">+</button> : <span />}
                    </div>
                  );
                })}
              </section>
            ))}
          </div>

          {/* Lateral: próximos eventos e feriados */}
          <div className={ex.side}>
            <div className={ex.panel}>
              <div className={ex.panelTitle}>Próximos eventos</div>
              {upcoming.length === 0 ? <p className={ex.empty} style={{ padding: "16px 0" }}>Nada marcado.</p> : (
                <div className={ev.next}>
                  {upcoming.slice(0, 6).map(e => (
                    <button key={e.sheetRow} className={ev.nextRow} style={{ "--c": tipoColor(e.tipo) }} onClick={() => openEdit(e)}>
                      <span className={ev.nextDate}><b>{e.d.getDate()}</b><span>{MES_ABR[e.d.getMonth()]}</span></span>
                      <span className={ev.nextName}>
                        <b>{e.activity}</b>
                        <small>{DAY_ABR[e.d.getDay()]}{e.horario ? ` · ${fmtHora(e.horario)}` : ""}{e.tipo ? ` · ${e.tipo}` : ""}</small>
                      </span>
                      <span className={ev.nextIn}>{emDias(e.diff)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className={ex.panel}>
              <div className={ex.panelTitle}>Próximos feriados</div>
              <div className={ev.next}>
                {futureHolidays.slice(0, 4).map(h => (
                  <div key={h.iso} className={ev.nextRow} style={{ "--c": HOLIDAY_COLOR, cursor: "default" }}>
                    <span className={ev.nextDate}><b>{h.date.getDate()}</b><span>{MES_ABR[h.date.getMonth()]}</span></span>
                    <span className={ev.nextName}><b>{h.name}</b><small>{h.date.toLocaleDateString("pt-BR", { weekday: "long" })}</small></span>
                    <span className={ev.nextIn}>{emDias(h.diff)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Feriados ── */}
      {!loading && tab === "feriados" && (
        <div className={ex.layout} style={{ gridTemplateColumns: "1fr" }}>
          <section className={ex.listPanel}>
            <div className={ex.sectionHead}>
              <span className={ex.sectionDot} style={{ background: HOLIDAY_COLOR, boxShadow: `0 0 10px ${HOLIDAY_COLOR}` }} />
              <span className={ex.sectionName}>Feriados em São Paulo</span>
              <span className={ex.sectionCount}>{futureHolidays.length}</span>
            </div>
            {futureHolidays.map(h => (
              <div key={h.iso} className={`${ev.holRow} ${h.diff <= 7 ? ev.holSoon : ""}`}>
                <span className={ev.nextDate} style={{ "--c": HOLIDAY_COLOR }}><b>{h.date.getDate()}</b><span>{MES_ABR[h.date.getMonth()]}</span></span>
                <span className={ev.nextName}>
                  <b>{h.name}</b>
                  <small>{h.date.toLocaleDateString("pt-BR", { weekday: "long" })} · {h.date.getFullYear()}</small>
                </span>
                <span className={ev.nextIn} style={h.diff <= 7 ? { color: HOLIDAY_COLOR } : undefined}>{emDias(h.diff)}</span>
              </div>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
