"use client";
// Saúde > Atividade — o calendário continua no centro, agora no padrão visual do redesign.
import { useState, useMemo } from "react";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";
import Ring from "@/components/ui/Ring";
import ex from "../finance/expenses/Expenses.module.css";
import hl from "./Health.module.css";
import { useHealth } from "@/hooks/useHealth";

// ── Constantes ────────────────────────────────────────────────────────────────
const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MONTH_ABBR  = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const WEEKDAY_FULL = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const WEEK_SHORT  = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];

const WORKOUT_EMOJI = {
  Corrida:"🏃", Ciclismo:"🚴", Caminhada:"🚶", Musculação:"💪",
  Yoga:"🧘", Natação:"🏊", HIIT:"🔥", Elíptico:"🏋️", "Cross Training":"🏅", Outro:"🎯",
};
const WORKOUT_COLOR = {
  Corrida:"#34d399", Ciclismo:"#38bdf8", Caminhada:"#94a3b8", Musculação:"#fbbf24",
  Yoga:"#a78bfa", Natação:"#22d3ee", HIIT:"#fb7185", Outro:"#94a3b8",
};

// Cor da célula: mais forte quanto maior o valor (4 níveis)
const level = (hex, steps) => v => {
  if (!v) return null;
  const i = steps.findIndex(s => v < s);
  const a = [0.18, 0.36, 0.6, 0.9][i === -1 ? 3 : i];
  return `color-mix(in srgb, ${hex} ${Math.round(a * 100)}%, transparent)`;
};

const METRICS = [
  { id:"workouts", icon:"🏋️", label:"Treinos",  unit:"",     dec:0, color:"#a78bfa", goal: 27 },
  { id:"steps",    icon:"👟", label:"Passos",   unit:"",     dec:0, color:"#34d399", goal: 10000, cellColor: level("#34d399", [3000, 6000, 10000]), scale: ["<3k", "3–6k", "6–10k", "10k+"] },
  { id:"calories", icon:"🔥", label:"Calorias", unit:"kcal", dec:0, color:"#fbbf24", goal: 500,   cellColor: level("#fbbf24", [200, 400, 500]),     scale: ["<200", "200–400", "400–500", "500+"] },
  { id:"sleep_h",  icon:"🌙", label:"Sono",     unit:"h",    dec:1, color:"#818cf8", goal: 8,     cellColor: level("#818cf8", [5, 7, 9]),           scale: ["<5h", "5–7h", "7–9h", "9h+"] },
  { id:"bpm_avg",  icon:"💓", label:"BPM",      unit:"bpm",  dec:0, color:"#fb7185",              cellColor: level("#fb7185", [65, 75, 85]),        scale: ["<65", "65–75", "75–85", "85+"] },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function dateToBR(d) {
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}
function brOf(year, month, day) {
  return `${String(day).padStart(2,"0")}/${String(month+1).padStart(2,"0")}/${year}`;
}
function fmt(v, dec = 0) {
  if (v === null || v === undefined) return "—";
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();
  const startDow = (firstDay.getDay() + 6) % 7; // Seg=0 … Dom=6
  const grid = [...Array(startDow).fill(null)];
  for (let d = 1; d <= lastDate; d++) grid.push(d);
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}
function cellFmt(value, metricId) {
  if (value === null || value === undefined) return null;
  if (metricId === "steps")   return value >= 1000 ? `${(value/1000).toFixed(1).replace(".",",")}k` : String(Math.round(value));
  if (metricId === "sleep_h") return `${Number(value).toFixed(1).replace(".",",")}h`;
  return String(Math.round(value));
}
function fmtDur(min) {
  if (!min) return null;
  if (min < 60) return `${min}min`;
  const h = Math.floor(min/60), m = min%60;
  return m ? `${h}h${String(m).padStart(2,"0")}` : `${h}h`;
}

// Estatísticas de um mês: médias, total de treinos e dias que bateram a meta
function calcMonthStats(year, month, dayMap, workoutMap) {
  const lastDate = new Date(year, month + 1, 0).getDate();
  const acc = { steps:[], sleep_h:[], calories:[], bpm_avg:[], workouts:0, wkDays:0 };
  for (let d = 1; d <= lastDate; d++) {
    const br  = brOf(year, month, d);
    const day = dayMap[br];
    const wks = workoutMap[br] ?? [];
    for (const k of ["steps","sleep_h","calories","bpm_avg"]) if (day?.[k] != null) acc[k].push(day[k]);
    acc.workouts += wks.length;
    if (wks.length) acc.wkDays++;
  }
  const avg = arr => arr.length ? arr.reduce((s,v)=>s+v,0)/arr.length : null;
  const hits = {};
  for (const m of METRICS) if (m.goal && m.id !== "workouts") hits[m.id] = { ok: acc[m.id].filter(v => v >= m.goal).length, of: acc[m.id].length };
  return {
    steps: avg(acc.steps), sleep_h: avg(acc.sleep_h), calories: avg(acc.calories), bpm_avg: avg(acc.bpm_avg),
    workouts: acc.workouts, wkDays: acc.wkDays, hits,
  };
}

// ── Calendário ────────────────────────────────────────────────────────────────
function MonthCalendar({ year, month, metric, dayMap, workoutMap, selectedDate, onSelect }) {
  const grid     = useMemo(() => getMonthGrid(year, month), [year, month]);
  const today    = new Date();
  const todayStr = dateToBR(today);

  return (
    <div className={ex.panel}>
      <div className={hl.weekHead}>{WEEK_SHORT.map(l => <span key={l}>{l}</span>)}</div>
      <div className={hl.grid}>
        {grid.map((day, i) => {
          if (!day) return <div key={`e${i}`} className={hl.cellBlank} />;
          const br       = brOf(year, month, day);
          const dayData  = dayMap[br];
          const wks      = workoutMap[br] ?? [];
          const isFuture = new Date(year, month, day) > today;
          const isToday  = br === todayStr;
          const isSel    = br === selectedDate;
          const mainType = wks[0]?.tipo ?? "";
          const wColor   = WORKOUT_COLOR[mainType] ?? metric.color;

          let bg = null, content = null;
          if (!isFuture) {
            if (metric.id === "workouts") {
              if (wks.length) {
                bg = `color-mix(in srgb, ${wColor} 26%, transparent)`;
                content = (<>
                  <span className={hl.emoji}>{wks.length > 1 ? `×${wks.length}` : WORKOUT_EMOJI[mainType] ?? "🏋️"}</span>
                  {wks[0]?.duracao_min && <span className={hl.mini} style={{ color: wColor }}>{fmtDur(wks[0].duracao_min)}</span>}
                </>);
              }
            } else if (dayData?.[metric.id] != null) {
              bg = metric.cellColor?.(dayData[metric.id]) ?? null;
              content = <span className={hl.val}>{cellFmt(dayData[metric.id], metric.id)}</span>;
            }
          }

          return (
            <button key={br} disabled={isFuture} onClick={() => onSelect(isSel ? null : br)}
              className={`${hl.cell} ${isToday ? hl.cellToday : ""} ${isSel ? hl.cellSel : ""}`}
              style={{ "--c": metric.color, ...(bg ? { background: bg, borderColor: "transparent" } : {}) }}>
              <span className={hl.num}>{day}</span>
              {metric.id !== "workouts" && wks.length > 0 && !isFuture && <span className={hl.wk}>{WORKOUT_EMOJI[mainType] ?? "🏋️"}</span>}
              {content}
            </button>
          );
        })}
      </div>
      {metric.scale && (
        <div className={hl.scale}>
          {metric.scale.map((s, i) => (
            <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <i style={{ background: `color-mix(in srgb, ${metric.color} ${[18, 36, 60, 90][i]}%, transparent)` }} />{s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Gráfico dia a dia ─────────────────────────────────────────────────────────
function MonthBarChart({ year, month, metric, dayMap, workoutMap }) {
  const [hovered, setHovered] = useState(null);
  const lastDate = new Date(year, month + 1, 0).getDate();
  const today    = new Date();
  const todayStr = dateToBR(today);

  const values = useMemo(() => Array.from({ length: lastDate }, (_, i) => {
    const br = brOf(year, month, i + 1);
    return metric.id === "workouts" ? (workoutMap[br]?.length ?? 0) : (dayMap[br]?.[metric.id] ?? null);
  }), [year, month, metric, dayMap, workoutMap, lastDate]);

  const valid  = values.filter(v => v !== null && v > 0);
  const maxVal = Math.max(...(valid.length ? valid : [1]), metric.id !== "workouts" && metric.goal ? metric.goal : 0);
  const avg    = valid.length ? valid.reduce((s, v) => s + v, 0) / valid.length : null;

  return (
    <div className={ex.panel}>
      <div className={hl.chartHead}>
        <div className={ex.panelTitle} style={{ marginBottom: 0 }}>{MONTH_NAMES[month]} dia a dia</div>
        <span style={{ color: metric.color }}>
          {avg !== null && `média ${fmt(avg, metric.dec)}${metric.unit ? ` ${metric.unit}` : ""}`}
          {metric.goal && metric.id !== "workouts" && <span style={{ color: "rgba(255,255,255,0.45)" }}> · meta {fmt(metric.goal)}{metric.unit ? ` ${metric.unit}` : ""}</span>}
        </span>
      </div>
      <div className={hl.bars}>
        {metric.goal && metric.id !== "workouts" && (
          <div className={hl.avgLine} style={{ bottom: `${(metric.goal / maxVal) * 100}%`, borderColor: "rgba(255,255,255,0.25)" }} />
        )}
        {avg !== null && <div className={hl.avgLine} style={{ bottom: `${(avg / maxVal) * 100}%`, borderColor: `${metric.color}aa` }} />}
        {values.map((val, i) => {
          const br       = brOf(year, month, i + 1);
          const isToday  = br === todayStr;
          const isFuture = new Date(year, month, i + 1) > today;
          const hitGoal  = metric.goal && metric.id !== "workouts" && val >= metric.goal;
          return (
            <div key={i} className={hl.barCol} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              {hovered === i && val > 0 && <div className={hl.tip}>{i + 1}/{month + 1} · {fmt(val, metric.dec)}{metric.unit ? ` ${metric.unit}` : ""}</div>}
              <div className={hl.bar} style={{
                height: val ? `${Math.max(3, (val / maxVal) * 100)}%` : "3px",
                background: isFuture || !val ? "rgba(255,255,255,0.05)" : isToday || hitGoal ? metric.color : `${metric.color}88`,
                opacity: hovered === null || hovered === i ? 1 : 0.6,
              }} />
            </div>
          );
        })}
      </div>
      <div className={hl.axis}>{values.map((_, i) => <span key={i}>{(i + 1) % 5 === 0 || i === 0 ? i + 1 : ""}</span>)}</div>
    </div>
  );
}

// ── Detalhe do dia (lateral) ─────────────────────────────────────────────────
function DayDetail({ dateStr, dayMap, workoutMap, metric }) {
  const day = dayMap[dateStr];
  const wks = workoutMap[dateStr] ?? [];
  const [dd, mm, yy] = dateStr.split("/").map(Number);
  const d = new Date(yy, mm - 1, dd);
  const isToday = dateStr === dateToBR(new Date());
  const ITEMS = [
    { key:"steps",        label:"Passos",        unit:"",     dec:0 },
    { key:"calories",     label:"Calorias",      unit:" kcal",dec:0 },
    { key:"sleep_h",      label:"Sono",          unit:"h",    dec:1 },
    { key:"sleep_deep_h", label:"Sono profundo", unit:"h",    dec:1 },
    { key:"bpm_avg",      label:"BPM médio",     unit:"",     dec:0 },
    { key:"distance_km",  label:"Distância",     unit:" km",  dec:1 },
  ].filter(m => day?.[m.key] != null);

  return (
    <div className={ex.panel}>
      <div className={hl.dayTitle}>{isToday ? "Hoje" : `${d.getDate()} de ${MONTH_ABBR[d.getMonth()]}`}</div>
      <div className={hl.daySub}>{WEEKDAY_FULL[d.getDay()]}{isToday ? `, ${d.getDate()} de ${MONTH_ABBR[d.getMonth()]}` : ""}</div>
      {ITEMS.length ? (
        <div className={hl.stats}>
          {ITEMS.map(m => (
            <div key={m.key} className={`${hl.stat} ${m.key === metric.id ? hl.statOn : ""}`} style={{ "--c": metric.color }}>
              <b>{fmt(day[m.key], m.dec)}{m.unit}</b><span>{m.label}</span>
            </div>
          ))}
        </div>
      ) : <p className={ex.muted}>Sem métricas para este dia.</p>}
      {wks.map((w, i) => (
        <div key={i} className={hl.wkRow} style={{ "--c": WORKOUT_COLOR[w.tipo] ?? "#a78bfa" }}>
          <span style={{ fontSize: 18 }}>{WORKOUT_EMOJI[w.tipo] ?? "🏋️"}</span>
          <b>{w.tipo}</b>
          <span>{[w.duracao_min && fmtDur(w.duracao_min), w.distancia_km && `${fmt(w.distancia_km, 1)} km`, w.calorias && `${fmt(w.calorias)} kcal`].filter(Boolean).join(" · ")}</span>
        </div>
      ))}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function HealthPage() {
  const { data, loading, error, refetch } = useHealth();

  const now      = new Date();
  const todayStr = dateToBR(now);

  const [activeMetric, setActiveMetric] = useState("steps");
  const [viewYear,  setViewYear]    = useState(now.getFullYear());
  const [viewMonth, setViewMonth]   = useState(now.getMonth());
  const [selectedDate, setSelected] = useState(null);

  const dayMap = useMemo(() => {
    const m = {};
    for (const d of data?.days ?? []) m[d.date] = d;
    return m;
  }, [data]);
  const workoutMap = useMemo(() => {
    const m = {};
    for (const w of data?.workouts ?? []) { if (!m[w.date]) m[w.date] = []; m[w.date].push(w); }
    return m;
  }, [data]);

  const metric = METRICS.find(m => m.id === activeMetric) ?? METRICS[0];
  const isAtCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();
  const hasData = (data?.days ?? []).length > 0 || (data?.workouts ?? []).length > 0;

  function prevMonth() {
    setSelected(null);
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); } else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (isAtCurrentMonth) return;
    setSelected(null);
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); } else setViewMonth(m => m + 1);
  }

  const monthStats = useMemo(() => calcMonthStats(viewYear, viewMonth, dayMap, workoutMap), [viewYear, viewMonth, dayMap, workoutMap]);
  const todayStats = useMemo(() => ({
    steps: dayMap[todayStr]?.steps ?? null, sleep_h: dayMap[todayStr]?.sleep_h ?? null,
    calories: dayMap[todayStr]?.calories ?? null, bpm_avg: dayMap[todayStr]?.bpm_avg ?? null,
  }), [dayMap, todayStr]);

  // Dia mostrado na lateral: o clicado, ou hoje (no mês atual), ou o último dia com dados do mês
  const sideDate = selectedDate ?? (isAtCurrentMonth ? todayStr : (() => {
    const last = new Date(viewYear, viewMonth + 1, 0).getDate();
    for (let d = last; d >= 1; d--) { const br = brOf(viewYear, viewMonth, d); if (dayMap[br] || workoutMap[br]) return br; }
    return null;
  })());

  // Anel do mês: treinos ÷ meta, ou dias que bateram a meta
  const ring = metric.id === "workouts"
    ? { pct: Math.round((monthStats.workouts / metric.goal) * 100), big: monthStats.workouts, of: metric.goal, sub: "treinos no mês", ringSub: "da meta" }
    : metric.goal
      ? (() => { const h = monthStats.hits[metric.id]; return { pct: h.of ? Math.round((h.ok / h.of) * 100) : 0, big: h.ok, of: h.of, sub: `dias com ${fmt(metric.goal)}${metric.unit ? ` ${metric.unit}` : ""} ou mais`, ringSub: "dos dias" }; })()
      : null;

  return (
    <div className={`${ex.page} ${hl.fitPage}`} style={{ background: "radial-gradient(50% 35% at 85% 0%, rgba(251,113,133,0.10), transparent 70%), #07080c" }}>
      <ModuleHeader title="Saúde" hideOnDesktop />
      <Navigation />

      <header className={ex.top}>
        <div className={ex.topLeft}>
          <span className={ex.eyebrow}>Saúde · {now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</span>
          <h1 className={ex.title}>Atividade</h1>
        </div>
        <div className={ex.topRight}>
          {!isAtCurrentMonth && (
            <button className={hl.todayBtn} onClick={() => { setViewYear(now.getFullYear()); setViewMonth(now.getMonth()); setSelected(null); }}>Hoje</button>
          )}
          <div className={hl.monthNav}>
            <button onClick={prevMonth} title="Mês anterior">‹</button>
            <b>{MONTH_NAMES[viewMonth]}<small>{viewYear}</small></b>
            <button onClick={nextMonth} disabled={isAtCurrentMonth} title="Próximo mês">›</button>
          </div>
          <button className={hl.refresh} onClick={refetch} title="Atualizar">↻</button>
        </div>
      </header>

      {loading && <div className={ex.loading}>Carregando…</div>}
      {error && !loading && <div className={ex.errorBox}><p><b>Erro ao carregar.</b> {error}</p><button onClick={refetch} className={ex.retryBtn}>Tentar novamente</button></div>}
      {!loading && !error && !hasData && <p className={ex.empty}>⌚ Sem dados ainda.</p>}

      {!loading && !error && hasData && (<>
        {/* Seletores = big numbers */}
        <div className={`${ex.tabs} ${hl.metrics}`}>
          {METRICS.map(m => {
            const todayVal = todayStats[m.id];
            const value = m.id === "workouts" ? monthStats.workouts : isAtCurrentMonth ? (todayVal ?? monthStats[m.id]) : monthStats[m.id];
            const sub   = m.id === "workouts" ? "no mês" : isAtCurrentMonth ? (todayVal != null ? "hoje" : "média do mês") : "média do mês";
            const pct   = m.goal && value != null ? Math.min(100, (value / m.goal) * 100) : null;
            return (
              <button key={m.id} onClick={() => { setActiveMetric(m.id); setSelected(null); }}
                className={`${ex.tabBox} ${activeMetric === m.id ? ex.tabActive : ""}`} style={{ "--t": m.color }}>
                <span className={ex.tabLabel}><span className={hl.mIcon}>{m.icon}</span>{m.label}</span>
                <span className={ex.tabValue} style={{ color: m.color }}>{value != null ? fmt(value, m.dec) : "—"}</span>
                <span className={ex.tabHint}>{sub}{m.goal ? ` · meta ${fmt(m.goal)}` : ""}</span>
                {pct != null && <div className={hl.goal}><span style={{ width: `${pct}%`, background: m.color }} /></div>}
              </button>
            );
          })}
        </div>

        <div className={`${ex.layout} ${hl.fitLayout}`}>
          <div className={ex.mainArea}>
            <MonthCalendar year={viewYear} month={viewMonth} metric={metric}
              dayMap={dayMap} workoutMap={workoutMap} selectedDate={selectedDate} onSelect={setSelected} />
            <MonthBarChart year={viewYear} month={viewMonth} metric={metric} dayMap={dayMap} workoutMap={workoutMap} />
          </div>

          <div className={ex.side}>
            {sideDate && <DayDetail dateStr={sideDate} dayMap={dayMap} workoutMap={workoutMap} metric={metric} />}
            {ring && (
              <div className={ex.panel}>
                <div className={ex.panelTitle}>{metric.label} em {MONTH_NAMES[viewMonth].toLowerCase()}</div>
                <div className={ex.ringPanel}>
                  <Ring pct={ring.pct} color={metric.color} size={108} stroke={10}>
                    <span className={ex.ringPct}>{ring.pct}%</span>
                    <span className={ex.ringSub}>{ring.ringSub}</span>
                  </Ring>
                  <div className={ex.ringInfo}>
                    <span className={ex.bigValue} style={{ color: metric.color }}>{ring.big}<span className={ex.muted}> / {ring.of}</span></span>
                    <span className={ex.muted}>{ring.sub}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </>)}
    </div>
  );
}
