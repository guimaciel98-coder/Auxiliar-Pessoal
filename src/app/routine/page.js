"use client";
import { useState, useEffect, useCallback } from "react";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";
import styles from "./Routine.module.css";

// ─── Constantes ───────────────────────────────────────────────────────────────
const DAYS_SHORT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const DAYS_FULL  = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];

const CAT = {
  treino:   { color: "#9c27b0", label: "Treino"   },
  trabalho: { color: "#2196f3", label: "Trabalho" },
  pessoal:  { color: "#00e5a0", label: "Pessoal"  },
  livre:    { color: "#484f58", label: "Livre"    },
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
  // Prioriza trabalho, treino, pessoal sobre livre
  const priority = ["treino", "trabalho", "pessoal", "livre"];
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

// ─── Aba: Dia ─────────────────────────────────────────────────────────────────
function TabDia({ selectedDay, onDayChange }) {
  const todayIdx = todayIndexBRT();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [tick, setTick]       = useState(0);

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

  const mins    = nowBRT();
  const donePct = blocks.length > 0 && isToday
    ? Math.round((blocks.filter(b => b.minutes + b.duration <= mins).length / blocks.length) * 100)
    : 0;

  return (
    <>
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
      {isToday && current && !loading && (
        <div
          className={styles.currentBlock}
          style={{ borderColor: (CAT[current.category]?.color ?? "#484f58") + "40" }}
        >
          <div className={styles.currentLabel}>
            <span
              className={styles.currentDot}
              style={{ background: CAT[current.category]?.color ?? "#484f58" }}
            />
            AGORA · {current.time}
          </div>
          <div
            className={styles.currentCatTag}
            style={{
              color:       CAT[current.category]?.color ?? "#484f58",
              background:  (CAT[current.category]?.color ?? "#484f58") + "18",
              borderColor: (CAT[current.category]?.color ?? "#484f58") + "30",
              border:      "1px solid",
            }}
          >
            {CAT[current.category]?.label ?? "Livre"}
          </div>
          <div className={styles.currentActivity}>{current.activity}</div>
          {next && (
            <div className={styles.currentNext}>A seguir: {next.time} — {next.activity}</div>
          )}
          {current.duration > 0 && (
            <div className={styles.blockProgress}>
              <div
                className={styles.blockProgressFill}
                style={{ width: `${progressPct}%`, background: CAT[current.category]?.color ?? "#818cf8" }}
              />
            </div>
          )}
        </div>
      )}

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
            const isPast  = isToday && block.minutes + block.duration <= mins;
            const isCurr  = isToday && current?.time === block.time;
            const cat     = CAT[block.category] ?? CAT.livre;

            return (
              <div
                key={i}
                className={`${styles.timelineItem} ${isPast ? styles.timelineItemDone : ""}`}
              >
                <div className={styles.timeCol}>
                  <span className={`${styles.timeLabel} ${isCurr ? styles.timeLabelCurrent : ""} ${isPast ? styles.timeLabelPast : ""}`}>
                    {block.time}
                  </span>
                </div>
                <div className={styles.dotCol}>
                  <div
                    className={`${styles.timelineDot} ${isCurr ? styles.timelineDotCurrent : ""}`}
                    style={{
                      background: isPast
                        ? cat.color + "55"
                        : isCurr
                        ? cat.color
                        : "rgba(255,255,255,0.12)",
                      color: cat.color,
                    }}
                  />
                </div>
                <div className={styles.itemContent}>
                  <div
                    className={`${styles.itemBtn} ${isCurr ? styles.itemBtnCurrent : styles.itemBtnDefault}`}
                    style={isCurr ? { borderColor: cat.color + "40", background: cat.color + "0d" } : {}}
                  >
                    <span className={`${styles.itemName} ${isPast ? styles.itemNameDone : ""}`}>
                      {block.activity}
                    </span>
                    <span
                      className={styles.categoryTag}
                      style={{ color: cat.color, background: cat.color + "18" }}
                    >
                      {cat.label}
                    </span>
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

        return (
          <div
            key={idx}
            className={`${styles.weekDayCard} ${isT ? styles.weekDayCardToday : ""}`}
            onClick={() => onSelectDay(idx)}
          >
            <div className={styles.weekDayTop}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className={`${styles.weekDayName} ${isT ? styles.weekDayNameToday : ""}`}>
                  {DAYS_FULL[idx]}
                </span>
                {isT && <span className={styles.weekDayBadge}>HOJE</span>}
              </div>
              <span className={styles.weekDayBlocks}>{blocks.length} blocos</span>
            </div>

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
        <button
          className={`${styles.tab} ${tab === "dia" ? styles.tabActive : ""}`}
          onClick={() => setTab("dia")}
        >
          Dia
        </button>
        <button
          className={`${styles.tab} ${tab === "semana" ? styles.tabActive : ""}`}
          onClick={() => setTab("semana")}
        >
          Semana
        </button>
      </div>

      {tab === "dia" && (
        <TabDia selectedDay={selectedDay} onDayChange={setSelectedDay} />
      )}

      {tab === "semana" && (
        <TabSemana onSelectDay={handleDayFromWeek} />
      )}

      <Navigation />
    </div>
  );
}
