"use client";
import { useState, useEffect } from "react";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";
import styles from "../Routine.module.css";

const DAY_ABBR = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const DAY_FULL = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const MES_ABR  = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const MES_FULL = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

function toISO(d) { return d.toISOString().slice(0, 10); }

// Sexta do próximo (ou atual) final de semana
function getNextFriday(today) {
  const dow = today.getDay(); // 0=Dom..6=Sáb
  let daysToFri;
  if (dow === 5) daysToFri = 0;
  else if (dow === 6) daysToFri = -1;
  else if (dow === 0) daysToFri = -2;
  else daysToFri = 5 - dow;
  const fri = new Date(today);
  fri.setDate(today.getDate() + daysToFri);
  return fri;
}

// Retorna Sexta-Domingo de um final de semana a partir da sexta
function fdsRange(fri) {
  const sat = new Date(fri); sat.setDate(fri.getDate() + 1);
  const sun = new Date(fri); sun.setDate(fri.getDate() + 2);
  return [fri, sat, sun];
}

// Cálculo da Páscoa (algoritmo anônimo gregoriano)
function calcEaster(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day   = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// Feriados de São Paulo (nacionais + estaduais + municipais + móveis)
function getSpHolidays(year) {
  const iso = (m, d) => `${year}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const set = new Set([
    iso(1,  1),  // Confraternização Universal
    iso(1, 25),  // Aniversário de São Paulo
    iso(4, 21),  // Tiradentes
    iso(5,  1),  // Dia do Trabalho
    iso(7,  9),  // Revolução Constitucionalista (SP)
    iso(9,  7),  // Independência do Brasil
    iso(10,12),  // Nossa Senhora Aparecida
    iso(11, 2),  // Finados
    iso(11,15),  // Proclamação da República
    iso(11,20),  // Consciência Negra
    iso(12,25),  // Natal
  ]);
  const easter = calcEaster(year);
  const addDays = (n) => { const d = new Date(easter); d.setDate(easter.getDate() + n); return toISO(d); };
  set.add(addDays(-48)); // Carnaval — Segunda
  set.add(addDays(-47)); // Carnaval — Terça
  set.add(addDays( -2)); // Sexta-feira da Paixão
  set.add(addDays( 60)); // Corpus Christi
  return set;
}

// Tipo → estilo
function tipoStyle(tipo) {
  const t = (tipo ?? "").toLowerCase();
  if (t === "feriado")  return { color: "#a855f7", bg: "rgba(168,85,247,0.1)",  border: "rgba(168,85,247,0.25)",  pill: "#a855f7" };
  if (t === "família" || t === "familia") return { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)", pill: "#f59e0b" };
  if (t === "saúde" || t === "saude") return { color: "#10b981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.2)", pill: "#10b981" };
  if (t === "social")  return { color: "#818cf8", bg: "rgba(129,140,248,0.08)", border: "rgba(129,140,248,0.2)", pill: "#818cf8" };
  if (t === "lazer")   return { color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.2)",  pill: "#60a5fa" };
  return { color: "rgba(255,255,255,0.6)", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.1)", pill: "rgba(255,255,255,0.4)" };
}

const TIPO_OPTIONS = ["família","feriado","saúde","social","lazer","pessoal","trabalho"];

const TIPO_COLORS = {
  "feriado":  "#a855f7", "família": "#f59e0b", "saude": "#10b981",
  "saúde":    "#10b981", "social":  "#818cf8", "lazer": "#60a5fa",
  "pessoal":  "#00e5a0", "trabalho":"#2196f3",
};

// ── Hero card de um dia do FDS ──────────────────────────────────────────────
function DayCard({ date, evts, isToday, isHoliday, onAdd, onDelete }) {
  const dow   = date.getDay();
  const day   = date.getDate();
  const month = MES_ABR[date.getMonth()];
  const hasEvent = evts.length > 0;
  const isFeriado = isHoliday || evts.some(e => (e.tipo ?? "").toLowerCase() === "feriado");

  // Sexta=laranja, Sábado=verde, Domingo=azul, Feriado=roxo (sobrescreve)
  const DAY_COLORS = { 5: "#f97316", 6: "#22c55e", 0: "#3b82f6" };
  const accent = isFeriado ? "#a855f7" : (DAY_COLORS[dow] ?? "rgba(255,255,255,0.2)");

  return (
    <div style={{
      background: `${accent}1a`,
      border: `1px solid ${accent}40`,
      borderTop: `3px solid ${accent}`,
      borderRadius: 18, padding: "18px 14px 16px",
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: 6, minHeight: 160,
    }}>
      {/* Dia semana */}
      <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: isToday ? "#06b6d4" : accent }}>
        {isToday ? "HOJE" : DAY_ABBR[dow]}
      </div>

      {/* Número do dia */}
      <div style={{ fontSize: 42, fontWeight: 900, lineHeight: 1, color: accent, letterSpacing: "-0.03em" }}>
        {day}
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: -4, marginBottom: 6 }}>
        {month}
      </div>

      {/* Eventos */}
      {hasEvent ? (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 5 }}>
          {evts.map((e, i) => {
            const ts = tipoStyle(e.tipo);
            return (
              <div key={i} style={{ position: "relative", background: ts.bg, border: `1px solid ${ts.border}`, borderRadius: 10, padding: "7px 10px 7px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#f0f0f8", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 16 }}>
                  {e.activity}
                </div>
                {e.tipo && (
                  <div style={{ fontSize: 9, fontWeight: 700, color: ts.color, textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 3 }}>
                    {e.tipo}
                  </div>
                )}
                {e.sheetRow && (
                  <span onClick={ev => { ev.stopPropagation(); onDelete(e.sheetRow); }}
                    style={{ position: "absolute", top: 4, right: 6, fontSize: 10, color: "rgba(255,255,255,0.2)", cursor: "pointer", lineHeight: 1 }}
                    onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                    onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.2)"}
                  >✕</span>
                )}
              </div>
            );
          })}
          <button onClick={() => onAdd(date)} style={{ marginTop: 2, padding: "6px 0", borderRadius: 8, border: "1px dashed rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.25)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>+</button>
        </div>
      ) : (
        <button onClick={() => onAdd(date)} style={{ marginTop: "auto", width: "100%", padding: "10px 0", borderRadius: 10, border: "1px dashed rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.3)", fontSize: 18, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(245,158,11,0.4)"; e.currentTarget.style.color = "#f59e0b"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "rgba(255,255,255,0.3)"; }}
        >+</button>
      )}
    </div>
  );
}

// ── Card de evento na lista ─────────────────────────────────────────────────
function EventCard({ e }) {
  const u = (() => {
    if ((e.tipo ?? "").toLowerCase() === "feriado")
      return { color: "#a855f7", bg: "rgba(168,85,247,0.08)", border: "rgba(168,85,247,0.22)", accent: true,  label: e.daysFromNow === 0 ? "HOJE" : e.daysFromNow === 1 ? "AMANHÃ" : `${e.daysFromNow}d` };
    if (e.isToday)          return { color: "#10b981", bg: "rgba(16,185,129,0.09)", border: "rgba(16,185,129,0.25)", accent: true,  label: "HOJE" };
    if (e.isTomorrow)       return { color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)", accent: true,  label: "AMANHÃ" };
    if (e.daysFromNow <= 3) return { color: "#f97316", bg: "rgba(249,115,22,0.07)", border: "rgba(249,115,22,0.2)",  accent: true,  label: `${e.daysFromNow} DIAS` };
    if (e.isThisWeek)       return { color: "#60a5fa", bg: "rgba(96,165,250,0.06)", border: "rgba(96,165,250,0.16)", accent: false, label: `${e.daysFromNow}d` };
    return { color: "var(--text-muted)", bg: "rgba(255,255,255,0.025)", border: "rgba(255,255,255,0.07)", accent: false, label: `${e.daysFromNow}d` };
  })();
  const ts = tipoStyle(e.tipo);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "13px 16px", borderRadius: 14,
      background: u.bg, border: `1px solid ${u.border}`,
      borderLeft: u.accent ? `3px solid ${u.color}` : `1px solid ${u.border}`,
    }}>
      {/* Data */}
      <div style={{ textAlign: "center", minWidth: 38, flexShrink: 0 }}>
        <div style={{ fontSize: 8, fontWeight: 800, color: u.color, letterSpacing: "0.07em", lineHeight: 1, marginBottom: 3, textTransform: "uppercase" }}>
          {u.label}
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, color: u.color, lineHeight: 1, letterSpacing: "-0.02em" }}>
          {e.dateLabel.split("/")[0]}
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", lineHeight: 1, marginTop: 1 }}>
          /{e.dateLabel.split("/")[1]}
        </div>
      </div>
      <div style={{ width: 1, height: 32, background: u.border, flexShrink: 0 }} />
      {/* Conteúdo */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#f0f0f8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {e.activity}
          </span>
          {e.tipo && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: ts.bg, color: ts.color, border: `1px solid ${ts.border}`, textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>
              {e.tipo}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "capitalize" }}>
          {e.weekday}
        </div>
      </div>
    </div>
  );
}

// ── Página principal ────────────────────────────────────────────────────────
export default function EventosPage() {
  const [events,   setEvents]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showPast, setShowPast] = useState(false);
  const [modal,    setModal]    = useState(null); // { date: Date } | null
  const [form,     setForm]     = useState({ evento: "", tipo: "" });
  const [saving,   setSaving]   = useState(false);

  const reload = () => {
    setLoading(true);
    fetch("/api/routine?agenda=1", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (d.ok) setEvents(d.events); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  function openAdd(date) {
    setForm({ evento: "", tipo: "" });
    setModal({ date });
  }

  async function handleSave() {
    if (!form.evento.trim()) return;
    setSaving(true);
    try {
      const d = modal.date;
      const dd = String(d.getDate()).padStart(2,"0");
      const mm = String(d.getMonth()+1).padStart(2,"0");
      const yyyy = d.getFullYear();
      await fetch("/api/routine/events", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: `${dd}/${mm}/${yyyy}`, evento: form.evento, tipo: form.tipo }),
      });
      setModal(null);
      reload();
    } finally { setSaving(false); }
  }

  async function handleDelete(sheetRow) {
    await fetch("/api/routine/events", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sheetRow }),
    });
    reload();
  }

  const inputSt = { width: "100%", padding: "9px 12px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#f0f0f8", fontSize: 14, fontFamily: "inherit", outline: "none" };

  const today   = new Date(); today.setHours(0,0,0,0);
  const todayISO = toISO(today);

  const past     = events.filter(e => e.isPast);
  const upcoming = events.filter(e => !e.isPast);

  // Mapa de data → eventos
  const eventMap = {};
  for (const e of upcoming) {
    if (!eventMap[e.date]) eventMap[e.date] = [];
    eventMap[e.date].push(e);
  }

  // Próximos 3 FDS
  const nextFri = getNextFriday(today);

  // Feriados SP — cobre os anos dos 3 FDS + adjacentes (Qui/Seg)
  const _ys = new Set();
  for (let i = 0; i < 3; i++) {
    const f = new Date(nextFri); f.setDate(nextFri.getDate() + i * 7);
    _ys.add(f.getFullYear());
    const m = new Date(f); m.setDate(f.getDate() + 10);
    _ys.add(m.getFullYear());
  }
  const spHolidays = new Set([..._ys].flatMap(y => [...getSpHolidays(y)]));

  const weekends = [0, 1, 2].map(i => {
    const fri  = new Date(nextFri);
    fri.setDate(nextFri.getDate() + i * 7);
    const core = fdsRange(fri); // [sex, sáb, dom]
    const sun  = core[2];

    // Pontão: inclui Quinta e/ou Segunda se feriado
    const thu = new Date(fri); thu.setDate(fri.getDate() - 1);
    const mon = new Date(sun); mon.setDate(sun.getDate() + 1);
    const days = [
      ...(spHolidays.has(toISO(thu)) ? [thu] : []),
      ...core,
      ...(spHolidays.has(toISO(mon)) ? [mon] : []),
    ];

    const rangeLabel = `${fri.getDate()} — ${sun.getDate()} ${MES_ABR[sun.getMonth()]}`;
    const isCurrent  = days.some(d => toISO(d) === todayISO);
    const title = i === 0
      ? (isCurrent ? "Este Final de Semana" : "Próximo Final de Semana")
      : `FDS ${fri.getDate()}–${sun.getDate()} · ${MES_ABR[sun.getMonth()]}`;
    return { days, rangeLabel, isCurrent, title };
  });

  // IDs de todos os dias dos 3 FDS (+ pontões) para excluir da lista
  const fdsISOSet = new Set(weekends.flatMap(w => w.days.map(toISO)));

  // Eventos restantes (excluindo os 3 FDS)
  const rest = upcoming.filter(e => !fdsISOSet.has(e.date));

  // Agrupa restantes por semana (Sex do fds mais próximo anterior)
  function fdsSemana(dateISO) {
    const d = new Date(dateISO);
    const dow = d.getDay();
    const offset = dow === 6 ? -1 : dow === 0 ? -2 : dow === 5 ? 0 : -(dow + 2);
    const fri = new Date(d); fri.setDate(d.getDate() + offset);
    return toISO(fri);
  }

  const byWeekend = {};
  for (const e of rest) {
    const key = fdsSemana(e.date);
    if (!byWeekend[key]) byWeekend[key] = { key, events: [] };
    byWeekend[key].events.push(e);
  }
  const weekendGroups = Object.values(byWeekend).sort((a, b) => a.key.localeCompare(b.key));

  return (
    <div className={styles.container}>
      <ModuleHeader title="Eventos" />
      <Navigation />

      {/* Modal adicionar evento */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: 24, width: "100%", maxWidth: 360 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.4)", marginBottom: 4, textTransform: "capitalize" }}>
              {modal.date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Novo Evento</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 5 }}>EVENTO</div>
                <input
                  autoFocus value={form.evento}
                  onChange={e => setForm(p => ({ ...p, evento: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && handleSave()}
                  placeholder="Ex: Almoço em família"
                  style={inputSt}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>TIPO</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {TIPO_OPTIONS.map(t => {
                    const col = TIPO_COLORS[t] ?? "rgba(255,255,255,0.4)";
                    const sel = form.tipo === t;
                    return (
                      <button key={t} onClick={() => setForm(p => ({ ...p, tipo: sel ? "" : t }))}
                        style={{ padding: "5px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", textTransform: "capitalize",
                          background: sel ? col + "22" : "rgba(255,255,255,0.04)",
                          color:      sel ? col : "rgba(255,255,255,0.4)",
                          border:     `1px solid ${sel ? col + "55" : "rgba(255,255,255,0.08)"}`,
                        }}>
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 22 }}>
              <button onClick={() => setModal(null)} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={!form.evento.trim() || saving}
                style={{ flex: 2, padding: "11px 0", borderRadius: 10, border: "none",
                  background: (form.evento.trim() && !saving) ? "linear-gradient(135deg,#f59e0b,#d97706)" : "rgba(255,255,255,0.06)",
                  color: "#fff", fontSize: 13, fontWeight: 700, cursor: (form.evento.trim() && !saving) ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className={styles.header}>
        <div>
          <h1>Eventos</h1>
          <p>{today.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        <button onClick={() => openAdd(today)}
          className={styles.eventAddBtn}
          style={{ padding: "8px 16px", borderRadius: 99, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
          + Evento
        </button>
      </header>

      {loading && <div className={styles.loading}>Carregando eventos...</div>}

      {!loading && (
        <div style={{ paddingBottom: 80 }}>

          {/* ── Próximos 3 FDS ── */}
          {weekends.map(({ days, rangeLabel, title }, wi) => (
            <div key={wi} style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)" }}>
                  {title}
                </span>
                {wi === 0 && (
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-mono)" }}>
                    {rangeLabel}
                  </span>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${days.length},1fr)`, gap: 10 }}>
                {days.map((d, i) => (
                  <DayCard
                    key={i}
                    date={d}
                    evts={eventMap[toISO(d)] ?? []}
                    isToday={toISO(d) === todayISO}
                    isHoliday={spHolidays.has(toISO(d))}
                    onAdd={openAdd}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* ── Divider ── */}
          {weekendGroups.length > 0 && (
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 24 }} />
          )}

          {/* ── Grupos por FDS ── */}
          {weekendGroups.map(({ key, events: grpEvents }) => {
            const friDate = new Date(key);
            const sunDate = new Date(key); sunDate.setDate(friDate.getDate() + 2);
            const monthLabel = friDate.getMonth() === sunDate.getMonth()
              ? `${MES_FULL[friDate.getMonth()]}`
              : `${MES_ABR[friDate.getMonth()]}/${MES_ABR[sunDate.getMonth()]}`;
            const label = `FDS ${friDate.getDate()}–${sunDate.getDate()} · ${monthLabel}`;

            return (
              <div key={key} style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.28)", marginBottom: 10, paddingLeft: 2 }}>
                  {label}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {grpEvents.map((e, i) => <EventCard key={i} e={e} />)}
                </div>
              </div>
            );
          })}

          {upcoming.length === 0 && (
            <div className={styles.empty}>
              <p>Nenhum evento futuro.</p>
              <p style={{ fontSize: 12, marginTop: 6, opacity: 0.5 }}>
                Adicione eventos na aba <strong>App_Eventos</strong> da planilha.
              </p>
            </div>
          )}

          {/* ── Passados ── */}
          {past.length > 0 && (() => {
            // Agrupa por mês (mais recente primeiro)
            const sorted = [...past].reverse();
            const byMonth = [];
            for (const e of sorted) {
              const [d, m, y] = e.dateLabel.split("/").map(Number);
              const fullY = y < 100 ? 2000 + y : y;
              const key = `${fullY}-${String(m).padStart(2,"0")}`;
              const label = `${MES_FULL[m - 1]} ${fullY}`;
              let grp = byMonth.find(g => g.key === key);
              if (!grp) { grp = { key, label, events: [] }; byMonth.push(grp); }
              grp.events.push(e);
            }

            return (
              <div style={{ marginTop: 24, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16 }}>
                <button
                  onClick={() => setShowPast(p => !p)}
                  style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "0 0 14px", display: "flex", alignItems: "center", gap: 6 }}
                >
                  <span style={{ fontSize: 10 }}>{showPast ? "▲" : "▼"}</span>
                  {past.length} evento{past.length !== 1 ? "s" : ""} passado{past.length !== 1 ? "s" : ""}
                </button>

                {showPast && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {byMonth.map(({ key, label, events: grpEvts }) => (
                      <div key={key}>
                        {/* Cabeçalho do mês */}
                        <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.2)", marginBottom: 8, paddingLeft: 2 }}>
                          {label}
                        </div>

                        {/* Linhas de eventos */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {grpEvts.map((e, i) => {
                            const [day, mon] = e.dateLabel.split("/");
                            const ts = tipoStyle(e.tipo);
                            const tipoColor = e.tipo ? (TIPO_COLORS[e.tipo.toLowerCase()] ?? "rgba(255,255,255,0.25)") : "rgba(255,255,255,0.15)";
                            return (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 10, transition: "background 0.15s" }}
                                onMouseEnter={el => el.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                                onMouseLeave={el => el.currentTarget.style.background = "transparent"}
                              >
                                {/* Data */}
                                <div style={{ display: "flex", alignItems: "baseline", gap: 4, minWidth: 46, flexShrink: 0 }}>
                                  <span style={{ fontSize: 16, fontWeight: 800, color: "rgba(255,255,255,0.25)", lineHeight: 1 }}>{day}</span>
                                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", fontWeight: 600 }}>/{mon}</span>
                                </div>

                                {/* Dia da semana */}
                                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", minWidth: 24, flexShrink: 0, textTransform: "uppercase", fontWeight: 700 }}>
                                  {e.weekday ? e.weekday.slice(0, 3) : ""}
                                </span>

                                {/* Dot colorido do tipo */}
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: tipoColor, flexShrink: 0, opacity: 0.7 }} />

                                {/* Nome do evento */}
                                <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                                  {e.activity}
                                </span>

                                {/* Badge do tipo */}
                                {e.tipo && (
                                  <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 99, color: tipoColor, background: tipoColor + "18", border: `1px solid ${tipoColor}30`, textTransform: "capitalize", flexShrink: 0 }}>
                                    {e.tipo}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

        </div>
      )}
    </div>
  );
}
