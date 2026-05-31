"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";
import { useHealth } from "@/hooks/useHealth";

// ── Constantes ────────────────────────────────────────────────────────────────
const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                     "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MONTH_ABBR  = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const WEEKDAY_PT  = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const WEEK_SHORT  = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];

const WORKOUT_EMOJI = {
  Corrida:"🏃", Ciclismo:"🚴", Caminhada:"🚶", Musculação:"💪",
  Yoga:"🧘", Natação:"🏊", HIIT:"🔥",
  Elíptico:"🏋️", "Cross Training":"🏅", Outro:"🎯",
};
const WORKOUT_COLOR = {
  Corrida:"#10b981", Ciclismo:"#3b82f6", Caminhada:"#94a3b8",
  Musculação:"#f59e0b", Yoga:"#8b5cf6",
  Natação:"#06b6d4", HIIT:"#ef4444", Outro:"#94a3b8",
};

// ── Definição dos seletores ───────────────────────────────────────────────────
const METRICS = [
  {
    id:"workouts", icon:"🏋️", label:"Treinos", unit:"", dec:0,
    color:"#8b5cf6",
    cellColor: null,
    goal: 27,
  },
  {
    id:"calories", icon:"🔥", label:"Calorias", unit:"kcal", dec:0,
    color:"#f59e0b",
    cellColor: v => {
      if (!v) return null;
      if (v < 200)  return "rgba(245,158,11,0.20)";
      if (v < 400)  return "rgba(245,158,11,0.42)";
      if (v < 500)  return "rgba(245,158,11,0.68)";
      return "#f59e0b";
    },
    goal: 500,
  },
  {
    id:"sleep_h", icon:"🌙", label:"Sono", unit:"h", dec:1,
    color:"#6366f1",
    cellColor: v => {
      if (!v) return null;
      if (v < 5)  return "rgba(99,102,241,0.20)";
      if (v < 7)  return "rgba(99,102,241,0.42)";
      if (v < 9)  return "rgba(99,102,241,0.68)";
      return "#6366f1";
    },
    goal: 8,
  },
  {
    id:"bpm_avg", icon:"💓", label:"BPM", unit:"bpm", dec:0,
    color:"#ef4444",
    cellColor: v => {
      if (!v) return null;
      const pct = Math.min(1, Math.max(0, (v - 55) / 50));
      return `rgba(239,68,68,${0.15 + pct * 0.55})`;
    },
  },
  {
    id:"steps", icon:"👟", label:"Passos", unit:"", dec:0,
    color:"#10b981",
    cellColor: v => {
      if (!v) return null;
      if (v < 3000)  return "rgba(16,185,129,0.20)";
      if (v < 6000)  return "rgba(16,185,129,0.42)";
      if (v < 10000) return "rgba(16,185,129,0.68)";
      return "#10b981";
    },
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function dateToBR(d) {
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
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

// ── Barra de progresso ────────────────────────────────────────────────────────
function Bar({ value, max, color }) {
  const pct = value ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ background:"rgba(255,255,255,0.08)", borderRadius:99, height:3, overflow:"hidden", marginTop:6 }}>
      <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:99, transition:"width .5s ease" }}/>
    </div>
  );
}

// ── Calcula estatísticas de um mês específico ─────────────────────────────────
function calcMonthStats(year, month, dayMap, workoutMap) {
  const lastDate = new Date(year, month + 1, 0).getDate();
  const acc = { steps:[], sleep_h:[], calories:[], bpm_avg:[], workouts:0 };
  for (let d = 1; d <= lastDate; d++) {
    const br  = `${String(d).padStart(2,"0")}/${String(month+1).padStart(2,"0")}/${year}`;
    const day = dayMap[br];
    const wks = workoutMap[br] ?? [];
    if (day?.steps    != null) acc.steps.push(day.steps);
    if (day?.sleep_h  != null) acc.sleep_h.push(day.sleep_h);
    if (day?.calories != null) acc.calories.push(day.calories);
    if (day?.bpm_avg  != null) acc.bpm_avg.push(day.bpm_avg);
    acc.workouts += wks.length;
  }
  const avg = arr => arr.length ? arr.reduce((s,v)=>s+v,0)/arr.length : null;
  return {
    steps:    avg(acc.steps),
    sleep_h:  avg(acc.sleep_h),
    calories: avg(acc.calories),
    bpm_avg:  avg(acc.bpm_avg),
    workouts: acc.workouts,
  };
}

// ── Seletor de métrica ────────────────────────────────────────────────────────
function MetricSelector({ metrics, selected, onSelect, monthStats, todayStats, isCurrentMonth }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:6 }}>
      {metrics.map(m => {
        const isSelected = selected === m.id;

        const todayVal   = todayStats[m.id];
        const displayVal = m.id === "workouts"
          ? monthStats.workouts
          : isCurrentMonth
            ? (todayVal ?? monthStats[m.id])
            : monthStats[m.id];

        const subLabel = m.id === "workouts"
          ? "no mês"
          : isCurrentMonth
            ? (todayVal != null ? "hoje" : "média do mês")
            : "média";

        return (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            style={{
              all:"unset", cursor:"pointer", display:"flex", flexDirection:"column",
              alignItems:"center", justifyContent:"center",
              padding:"14px 10px 12px", borderRadius:16,
              background: isSelected ? `${m.color}18` : "rgba(255,255,255,0.02)",
              border: isSelected ? `1.5px solid ${m.color}60` : "1.5px solid rgba(255,255,255,0.07)",
              transition:"all .2s ease", position:"relative",
            }}
          >
            {isSelected && (
              <div style={{ position:"absolute", top:0, left:"50%", transform:"translateX(-50%)", width:"40%", height:2, background:m.color, borderRadius:"0 0 4px 4px" }}/>
            )}
            <span style={{ fontSize:20, marginBottom:8 }}>{m.icon}</span>
            <div style={{
              fontSize:19, fontWeight:900,
              color: isSelected ? "#f9fafb" : "rgba(255,255,255,0.5)",
              lineHeight:1, letterSpacing:"-0.02em", transition:"color .2s",
            }}>
              {displayVal !== null && displayVal !== undefined ? fmt(displayVal, m.dec) : "—"}
            </div>
            <div style={{ fontSize:10, color: isSelected ? m.color : "rgba(255,255,255,0.25)", marginTop:3, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", transition:"color .2s" }}>
              {m.label}
            </div>
            <div style={{ fontSize:8, color:"rgba(255,255,255,0.2)", marginTop:1, fontWeight:500 }}>
              {subLabel}
            </div>
            {m.goal && displayVal != null && (
              <div style={{ width:"70%", marginTop:3 }}>
                <Bar value={displayVal} max={m.goal} color={m.color} />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Helpers de formatação compacta para as células ───────────────────────────
function cellFmt(value, metricId) {
  if (value === null || value === undefined) return null;
  if (metricId === "steps")    return value >= 1000 ? `${(value/1000).toFixed(1).replace(".",",")}k` : String(Math.round(value));
  if (metricId === "sleep_h")  return `${Number(value).toFixed(1).replace(".",",")}h`;
  if (metricId === "calories") return String(Math.round(value));
  if (metricId === "bpm_avg")  return String(Math.round(value));
  return String(value);
}
function fmtDur(min) {
  if (!min) return null;
  if (min < 60) return `${min}min`;
  const h = Math.floor(min/60), m = min%60;
  return m ? `${h}h${String(m).padStart(2,"0")}` : `${h}h`;
}

// ── Calendário mensal ─────────────────────────────────────────────────────────
function MonthCalendar({ year, month, metric, dayMap, workoutMap, selectedDate, onSelect }) {
  const grid     = useMemo(() => getMonthGrid(year, month), [year, month]);
  const today    = new Date();
  const todayStr = dateToBR(today);

  return (
    <div style={{ background:"rgba(255,255,255,0.02)", border:`1px solid ${metric.color}20`, borderRadius:12, padding:"5px 8px", overflowX:"auto" }}>
      {/* Header dias da semana */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:3 }}>
        {WEEK_SHORT.map(l => (
          <div key={l} style={{ textAlign:"center", fontSize:8, fontWeight:700, color:"rgba(255,255,255,0.18)", padding:"2px 0" }}>{l}</div>
        ))}
      </div>

      {/* Grade de dias */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
        {grid.map((day, i) => {
          if (!day) return <div key={`e${i}`} style={{ height:62 }}/>;

          const br       = `${String(day).padStart(2,"0")}/${String(month+1).padStart(2,"0")}/${year}`;
          const dayData  = dayMap[br];
          const wks      = workoutMap[br] ?? [];
          const isFuture = new Date(year, month, day) > today;
          const isToday  = br === todayStr;
          const isSel    = br === selectedDate;
          const mainType = wks[0]?.tipo ?? "";
          const wColor   = WORKOUT_COLOR[mainType] ?? metric.color;

          // Fundo baseado na métrica selecionada
          let bgColor = null;
          if (!isFuture) {
            if (metric.id === "workouts") {
              bgColor = wks.length > 0 ? `${wColor}30` : null;
            } else if (dayData?.[metric.id] != null) {
              bgColor = metric.cellColor?.(dayData[metric.id]) ?? null;
            }
          }

          // Conteúdo central: muda conforme métrica
          let centerContent = null;
          if (metric.id === "workouts") {
            if (wks.length > 0) {
              centerContent = (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:1 }}>
                  <span style={{ fontSize:18, lineHeight:1 }}>
                    {wks.length > 1 ? `×${wks.length}` : WORKOUT_EMOJI[mainType] ?? "🏋️"}
                  </span>
                  {wks[0]?.duracao_min && (
                    <span style={{ fontSize:9, fontWeight:800, color:`${wColor}dd`, lineHeight:1 }}>
                      {fmtDur(wks[0].duracao_min)}
                    </span>
                  )}
                </div>
              );
            }
          } else if (!isFuture && dayData?.[metric.id] != null) {
            const val     = cellFmt(dayData[metric.id], metric.id);
            const hasWrkt = wks.length > 0;
            centerContent = (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:1 }}>
                <span style={{
                  fontSize:13, fontWeight:900, lineHeight:1,
                  color: bgColor ? "#fff" : "rgba(255,255,255,0.28)",
                  letterSpacing:"-0.03em",
                }}>
                  {val}
                </span>
                {hasWrkt && (
                  <span style={{ fontSize:10, lineHeight:1 }}>{WORKOUT_EMOJI[mainType] ?? "🏋️"}</span>
                )}
              </div>
            );
          }

          return (
            <div
              key={br}
              onClick={() => !isFuture && onSelect(isSel ? null : br)}
              style={{
                height:62, borderRadius:8, position:"relative",
                display:"flex", flexDirection:"column",
                alignItems:"center", justifyContent:"center",
                cursor: isFuture ? "default" : "pointer",
                background: isSel    ? "rgba(255,255,255,0.12)"
                          : bgColor  ? bgColor
                          : isFuture ? "transparent"
                          : "rgba(255,255,255,0.025)",
                border: isToday ? `2px solid ${metric.color}`
                      : isSel   ? "2px solid rgba(255,255,255,0.35)"
                      : metric.id === "workouts" && wks.length > 0 ? `1px solid ${wColor}45`
                      : "1px solid rgba(255,255,255,0.04)",
                opacity: isFuture ? 0.15 : 1,
                transition:"background .15s, border .15s",
              }}
            >
              {/* Número do dia — topo esquerdo */}
              <span style={{
                position:"absolute", top:3, left:5,
                fontSize:8, fontWeight: isToday ? 900 : 600, lineHeight:1,
                color: isToday ? metric.color
                     : bgColor ? "rgba(255,255,255,0.5)"
                     : "rgba(255,255,255,0.2)",
              }}>
                {day}
              </span>

              {/* Valor central */}
              <div style={{ marginTop:6 }}>
                {centerContent}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Detalhe do dia ────────────────────────────────────────────────────────────
function DayDetail({ dateStr, dayMap, workoutMap, metric }) {
  const day  = dayMap[dateStr];
  const wks  = workoutMap[dateStr] ?? [];
  const d    = new Date(dateStr.split("/").reverse().join("-"));
  const label = `${WEEKDAY_PT[d.getDay()]}, ${d.getDate()} de ${MONTH_ABBR[d.getMonth()]}`;

  return (
    <div style={{
      padding:"16px 18px",
      background:"rgba(255,255,255,0.03)",
      border:`1px solid ${metric.color}25`,
      borderRadius:14,
    }}>
      <div style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.4)", marginBottom:12 }}>{label}</div>

      {day ? (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))", gap:10 }}>
          {[
            { key:"steps",        icon:"👟", label:"Passos",       unit:"",     dec:0 },
            { key:"calories",     icon:"🔥", label:"Calorias",     unit:" kcal",dec:0 },
            { key:"distance_km",  icon:"📍", label:"Distância",    unit:" km",  dec:1 },
            { key:"bpm_avg",      icon:"💓", label:"BPM médio",    unit:" bpm", dec:0 },
            { key:"sleep_h",      icon:"🌙", label:"Sono",         unit:"h",    dec:1 },
            { key:"sleep_deep_h", icon:"💤", label:"Sono profundo",unit:"h",    dec:1 },
          ].map(m => {
            const v = day[m.key];
            if (v === null || v === undefined) return null;
            const isHighlight = m.key === metric.id;
            return (
              <div key={m.key} style={{
                display:"flex", alignItems:"center", gap:8,
                padding:"8px 10px", borderRadius:10,
                background: isHighlight ? `${metric.color}15` : "transparent",
                border: isHighlight ? `1px solid ${metric.color}30` : "1px solid transparent",
              }}>
                <span style={{ fontSize:18 }}>{m.icon}</span>
                <div>
                  <div style={{ fontSize:14, fontWeight:800, color: isHighlight ? "#f9fafb" : "rgba(255,255,255,0.7)", lineHeight:1 }}>
                    {fmt(v, m.dec)}{m.unit}
                  </div>
                  <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:2 }}>{m.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p style={{ fontSize:13, color:"rgba(255,255,255,0.25)" }}>Sem métricas para este dia.</p>
      )}

      {wks.length > 0 && (
        <div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:6 }}>
          {wks.map((w, i) => (
            <div key={i} style={{
              display:"flex", alignItems:"center", gap:10, padding:"8px 12px",
              background:"rgba(255,255,255,0.03)", borderRadius:10,
              borderLeft:`3px solid ${WORKOUT_COLOR[w.tipo] ?? "#8b5cf6"}`,
            }}>
              <span style={{ fontSize:16 }}>{WORKOUT_EMOJI[w.tipo] ?? "🏋️"}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#f9fafb" }}>{w.tipo}</div>
              </div>
              <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", textAlign:"right" }}>
                {w.duracao_min ? `${w.duracao_min}min` : ""}
                {w.distancia_km ? ` · ${fmt(w.distancia_km,1)}km` : ""}
                {w.calorias ? ` · ${fmt(w.calorias)}kcal` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Gráfico de barras do mês ──────────────────────────────────────────────────
function MonthBarChart({ year, month, metric, dayMap, workoutMap }) {
  const [hovered, setHovered] = useState(null);
  const lastDate = new Date(year, month + 1, 0).getDate();
  const today    = new Date();
  const todayStr = dateToBR(today);

  const values = useMemo(() => {
    return Array.from({ length: lastDate }, (_, i) => {
      const day = i + 1;
      const br  = `${String(day).padStart(2,"0")}/${String(month+1).padStart(2,"0")}/${year}`;
      if (metric.id === "workouts") {
        return workoutMap[br]?.length ?? 0;
      }
      return dayMap[br]?.[metric.id] ?? null;
    });
  }, [year, month, metric, dayMap, workoutMap]);

  const maxVal = useMemo(() => {
    const validVals = values.filter(v => v !== null && v > 0);
    return validVals.length ? Math.max(...validVals) : metric.goal ?? 1;
  }, [values, metric]);

  const avg = useMemo(() => {
    const valid = values.filter(v => v !== null && v > 0);
    return valid.length ? valid.reduce((s,v) => s + v, 0) / valid.length : null;
  }, [values]);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6 }}>
        <span style={{ fontSize:12, color:"rgba(255,255,255,0.35)", fontWeight:600 }}>
          {MONTH_NAMES[month]} — dia a dia
        </span>
        {avg !== null && (
          <span style={{ fontSize:12, color:`${metric.color}cc`, fontWeight:700 }}>
            ø {fmt(avg, metric.dec)} {metric.unit}
          </span>
        )}
      </div>

      <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:"10px 10px" }}>
        {/* Linha de meta */}
        {metric.goal && (
          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:4 }}>
            <span style={{ fontSize:9, color:`${metric.color}55`, fontWeight:700 }}>
              meta {fmt(metric.goal, 0)}{metric.unit !== "" ? ` ${metric.unit}` : ""}
            </span>
          </div>
        )}

        {/* Barras */}
        <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:101, position:"relative" }}>
          {/* Linha de média */}
          {avg !== null && (
            <div style={{
              position:"absolute", left:0, right:0,
              top: `${100 - Math.min(100, (avg / maxVal) * 100)}%`,
              borderTop:`1px dashed ${metric.color}40`,
              pointerEvents:"none",
            }}/>
          )}

          {values.map((val, i) => {
            const day    = i + 1;
            const br     = `${String(day).padStart(2,"0")}/${String(month+1).padStart(2,"0")}/${year}`;
            const isToday  = br === todayStr;
            const isFuture = new Date(year, month, day) > today;
            const h      = val ? Math.max(3, (val / maxVal) * 101) : 2;
            const isHov  = hovered === i;

            return (
              <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", position:"relative" }}
                onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
                {isHov && val !== null && val > 0 && (
                  <div style={{
                    position:"absolute", bottom:"calc(100% + 4px)",
                    background:"rgba(10,10,15,0.95)", color:"#fff",
                    fontSize:10, padding:"4px 7px", borderRadius:6,
                    whiteSpace:"nowrap", zIndex:10,
                    border:`1px solid ${metric.color}40`,
                  }}>
                    {day}/{month+1} · {fmt(val, metric.dec)}{metric.unit !== "" ? ` ${metric.unit}` : ""}
                  </div>
                )}
                <div style={{
                  width:"100%", height:h,
                  background: isFuture ? "rgba(255,255,255,0.04)"
                            : val       ? isToday ? metric.color : `${metric.color}88`
                            : "rgba(255,255,255,0.04)",
                  borderRadius:"3px 3px 2px 2px",
                  transition:"height .3s ease, opacity .2s",
                  opacity: isHov ? 1 : 0.85,
                }}/>
              </div>
            );
          })}
        </div>

        {/* Eixo X — números dos dias (só múltiplos de 5) */}
        <div style={{ display:"flex", gap:3, marginTop:3 }}>
          {values.map((_, i) => (
            <div key={i} style={{ flex:1, textAlign:"center", fontSize:8, color:"rgba(255,255,255,0.18)", fontWeight:600 }}>
              {(i + 1) % 5 === 0 || i === 0 ? i + 1 : ""}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function HealthPage() {
  const { data, loading, error, refetch } = useHealth();

  const now     = new Date();
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
    for (const w of data?.workouts ?? []) {
      if (!m[w.date]) m[w.date] = [];
      m[w.date].push(w);
    }
    return m;
  }, [data]);

  const metric = METRICS.find(m => m.id === activeMetric) ?? METRICS[0];

  function prevMonth() {
    setSelected(null);
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewYear > now.getFullYear() || (viewYear === now.getFullYear() && viewMonth >= now.getMonth())) return;
    setSelected(null);
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  const isAtCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();
  const hasData = (data?.days ?? []).length > 0 || (data?.workouts ?? []).length > 0;

  const monthStats = useMemo(() => calcMonthStats(viewYear, viewMonth, dayMap, workoutMap), [viewYear, viewMonth, dayMap, workoutMap]);
  const todayStats = useMemo(() => ({
    steps:    dayMap[todayStr]?.steps    ?? null,
    sleep_h:  dayMap[todayStr]?.sleep_h  ?? null,
    calories: dayMap[todayStr]?.calories ?? null,
    bpm_avg:  dayMap[todayStr]?.bpm_avg  ?? null,
  }), [dayMap, todayStr]);

  return (
    <div style={{ marginLeft:220, minHeight:"100vh" }}>
      <ModuleHeader title="Saúde" />
      <Navigation />

      {/* ── Header ── */}
      <header style={{ display:"flex", justifyContent:"flex-end", alignItems:"center", padding:"8px 20px 6px", gap:8 }}>
<button onClick={refetch} style={{
          padding:"5px 10px", borderRadius:99,
          background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.09)",
          color:"rgba(255,255,255,0.4)", fontSize:13, cursor:"pointer",
        }}>↻</button>
      </header>

      {loading && <div style={{ padding:"80px", textAlign:"center", color:"rgba(255,255,255,0.2)", fontSize:14 }}>Carregando...</div>}
      {error && !loading && (
        <div style={{ margin:"0 28px", padding:"14px 18px", background:"rgba(239,68,68,0.07)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:12 }}>
          <p style={{ color:"#ef4444", fontSize:13 }}>⚠ {error}</p>
        </div>
      )}

      {!loading && !error && !hasData && (
        <div style={{ textAlign:"center", padding:"80px 28px" }}>
          <div style={{ fontSize:48, marginBottom:16 }}>⌚</div>
          <p style={{ fontSize:15, fontWeight:700, color:"rgba(255,255,255,0.4)", marginBottom:10 }}>Sem dados ainda</p>
        </div>
      )}

      {!loading && !error && hasData && (
        <div style={{ padding:"0 20px 12px", display:"flex", flexDirection:"column", gap:18 }}>

          {/* ── NAVEGAÇÃO DE MÊS — destaque acima de tudo ── */}
          <div style={{
            display:"flex", alignItems:"center", justifyContent:"space-between",
            background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:14, padding:"7px 14px",
          }}>
            <button onClick={prevMonth} style={{
              all:"unset", cursor:"pointer",
              width:32, height:32, borderRadius:8,
              background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)",
              color:"#f9fafb", fontSize:18, fontWeight:300,
              display:"flex", alignItems:"center", justifyContent:"center",
              transition:"background .15s",
            }}>‹</button>

            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:21, fontWeight:900, color:"#f9fafb", letterSpacing:"-0.03em", lineHeight:1 }}>
                {MONTH_NAMES[viewMonth]}
              </div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", fontWeight:600, marginTop:2 }}>
                {viewYear}
                {!isAtCurrentMonth && (
                  <button onClick={() => { setViewYear(now.getFullYear()); setViewMonth(now.getMonth()); setSelected(null); }} style={{
                    all:"unset", cursor:"pointer", marginLeft:8,
                    fontSize:10, color:"#10b981", fontWeight:700,
                    background:"rgba(16,185,129,0.1)", border:"1px solid rgba(16,185,129,0.25)",
                    borderRadius:99, padding:"1px 7px",
                  }}>hoje</button>
                )}
              </div>
            </div>

            <button onClick={nextMonth} style={{
              all:"unset", cursor: isAtCurrentMonth ? "default" : "pointer",
              width:32, height:32, borderRadius:8,
              background: isAtCurrentMonth ? "transparent" : "rgba(255,255,255,0.06)",
              border: isAtCurrentMonth ? "1px solid rgba(255,255,255,0.04)" : "1px solid rgba(255,255,255,0.12)",
              color: isAtCurrentMonth ? "rgba(255,255,255,0.15)" : "#f9fafb",
              fontSize:18, fontWeight:300,
              display:"flex", alignItems:"center", justifyContent:"center",
              transition:"background .15s",
            }}>›</button>
          </div>

          {/* ── BIG NUMBERS — seletores ── */}
          <section>
            <MetricSelector
              metrics={METRICS}
              selected={activeMetric}
              onSelect={id => { setActiveMetric(id); setSelected(null); }}
              monthStats={monthStats}
              todayStats={todayStats}
              isCurrentMonth={isAtCurrentMonth}
            />
          </section>

          {/* ── CALENDÁRIO MENSAL ── */}
          <section>
            <MonthCalendar
              year={viewYear} month={viewMonth}
              metric={metric}
              dayMap={dayMap} workoutMap={workoutMap}
              selectedDate={selectedDate} onSelect={setSelected}
            />

            {/* Detalhe do dia clicado */}
            {selectedDate && (
              <div style={{ marginTop:10 }}>
                <DayDetail
                  dateStr={selectedDate}
                  dayMap={dayMap}
                  workoutMap={workoutMap}
                  metric={metric}
                />
              </div>
            )}
          </section>

          {/* ── GRÁFICO DO MÊS ── */}
          <section>
            <MonthBarChart
              year={viewYear} month={viewMonth}
              metric={metric}
              dayMap={dayMap}
              workoutMap={workoutMap}
            />
          </section>

        </div>
      )}
    </div>
  );
}
